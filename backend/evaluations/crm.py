"""CRM del agente (Track 6, aprobado por Carlos 2026-08-18) — kanban de la
cartera de clientes: renovaciones, mejoras, pagos y entidades del ramo.

Misma sesion del panel privado (login DJANGO_PANEL_PASSWORD). Automatiza:
- polizas activas que vencen en < 60 dias generan la tarea de renovacion;
- polizas vencidas se marcan como por_renovar/vencida;
- pagos con fecha limite proxima o vencida se senalan (pendiente/atrasado).
"""
import json
from datetime import date, timedelta

from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import Cliente, Pago, Poliza, Producto, Prospect, Tarea

DIAS_RENOVACION = 60
DIAS_PAGO_PROXIMO = 15

_RAMO_ETIQUETA = dict(Poliza.Ramos.choices)
_TIPO_ETIQUETA = dict(Tarea.Tipos.choices)
_COLUMNA_ETIQUETA = dict(Tarea.Columnas.choices)
_RELACION_ETIQUETA = dict(Cliente.Relacion.choices)
_VIGENCIA_ETIQUETA = dict(Producto.Vigencia.choices)

# Catalogo base de servicios GNP (seed automatico si el catalogo esta vacio).
SEED_PRODUCTOS = [
    ("Trascendi", "GNP", "gmm", "GMM individual con red hospitalaria nacional", "anual"),
    ("Trascendi Colectivo", "GNP", "gmm", "GMM colectivo (empresa o familia)", "anual"),
    ("Vida Individual", "GNP", "vida", "Seguro de vida individual con ahorro", "anual"),
    ("Vida Temporal", "GNP", "vida", "Seguro de vida temporal a plazo definido (1, 5 o 10 años)", "temporal"),
    ("Vida Grupo", "GNP", "vida", "Seguro de vida para grupos o empresas", "anual"),
    ("Auto Premier", "GNP", "auto", "Cobertura amplia de auto con asistencia", "anual"),
    ("Auto RC", "GNP", "auto", "Responsabilidad civil de auto", "anual"),
    ("Hogar Protegido", "GNP", "hogar", "Seguro de hogar (estructura y contenido)", "anual"),
    ("Fletes", "GNP", "transporte", "Póliza de fletes — cobertura de mercancía por embarque", "embarque"),
    ("Transporte de Carga", "GNP", "transporte", "Transporte de mercancías con cobertura anual", "anual"),
    ("Incendio y Multirriesgo", "GNP", "negocio", "Multirriesgo para negocio (incendio, robo, RC)", "anual"),
    ("Plan de Retiro", "GNP", "retiro", "Plan personalizado de retiro con ahorro", "anual"),
]


def _seed_productos():
    """Si el catalogo esta vacio, siembra los servicios base GNP."""
    if Producto.objects.count() == 0:
        for nombre, aseg, ramo, desc, vig in SEED_PRODUCTOS:
            Producto.objects.create(nombre=nombre, aseguradora=aseg, ramo=ramo,
                                    descripcion=desc, vigencia_tipo=vig)


def _autenticado(request):
    return bool(request.session.get("panel_ok"))


def _denegado():
    return JsonResponse({"error": "no autorizado"}, status=401)


def _leer(request):
    try:
        return json.loads(request.body or b"{}")
    except json.JSONDecodeError:
        return {}


def _estado_poliza_efectivo(p):
    """Estado segun fechas (la cancelacion manual prevalece)."""
    if p.estado == Poliza.Estado.CANCELADA:
        return p.estado
    if not p.fecha_vencimiento:
        return p.estado
    dias = (p.fecha_vencimiento - date.today()).days
    if dias < 0:
        return Poliza.Estado.VENCIDA
    if dias <= DIAS_RENOVACION:
        return Poliza.Estado.POR_RENOVAR
    return Poliza.Estado.ACTIVA


def _sync_renovaciones():
    """Crea las tareas de renovacion faltantes y actualiza estados."""
    creadas = 0
    hoy = date.today()
    for p in Poliza.objects.select_related("cliente").exclude(estado=Poliza.Estado.CANCELADA):
        if not p.fecha_vencimiento:
            continue
        dias = (p.fecha_vencimiento - hoy).days
        if dias <= DIAS_RENOVACION:
            # actualiza el estado persistido (por_renovar / vencida)
            nuevo = Poliza.Estado.VENCIDA if dias < 0 else Poliza.Estado.POR_RENOVAR
            if p.estado != nuevo:
                p.estado = nuevo
                p.save(update_fields=["estado", "updated_at"])
            # tarea de renovacion (una sola, salvo que ya exista alguna activa)
            ya_existe = Tarea.objects.filter(
                poliza=p, tipo=Tarea.Tipos.RENOVACION,
            ).exclude(columna=Tarea.Columnas.COMPLETADA).exists()
            if not ya_existe:
                Tarea.objects.create(
                    cliente=p.cliente, poliza=p,
                    tipo=Tarea.Tipos.RENOVACION,
                    titulo=f"Renovar póliza de {p.cliente.nombre} ({_RAMO_ETIQUETA.get(p.ramo, p.ramo)})",
                    fecha_limite=p.fecha_vencimiento - timedelta(days=30),
                    columna=Tarea.Columnas.PENDIENTE,
                )
                creadas += 1
    return creadas


def _estado_pago_efectivo(pg):
    if pg.estado == Pago.Estado.PAGADO:
        return pg.estado
    if pg.fecha_pago:
        return pg.estado
    if pg.fecha_limite < date.today():
        return Pago.Estado.ATRASADO
    return pg.estado


def _serializar_cliente(c):
    return {
        "id": c.id, "nombre": c.nombre, "telefono": c.telefono,
        "correo": c.correo, "ciudad": c.ciudad, "notas": c.notas,
        "relacion": c.relacion,
        "relacion_etiqueta": _RELACION_ETIQUETA.get(c.relacion, c.relacion),
        "prospect_id": c.prospect_id,
        "polizas": [_serializar_poliza(p) for p in c.polizas.all()],
        "created_at": c.created_at.isoformat(),
    }


def _serializar_producto(p):
    return {
        "id": p.id, "nombre": p.nombre, "aseguradora": p.aseguradora,
        "ramo": p.ramo, "ramo_etiqueta": _RAMO_ETIQUETA.get(p.ramo, p.ramo),
        "descripcion": p.descripcion, "vigencia_tipo": p.vigencia_tipo,
        "vigencia_etiqueta": _VIGENCIA_ETIQUETA.get(p.vigencia_tipo, p.vigencia_tipo),
        "activo": p.activo,
    }


def _serializar_poliza(p):
    pagos = []
    for pg in p.pagos.all():
        pagos.append({
            "id": pg.id, "monto": float(pg.monto),
            "fecha_limite": pg.fecha_limite.isoformat(),
            "fecha_pago": pg.fecha_pago.isoformat() if pg.fecha_pago else None,
            "estado": _estado_pago_efectivo(pg),
        })
    return {
        "id": p.id, "cliente_id": p.cliente_id, "ramo": p.ramo,
        "ramo_etiqueta": _RAMO_ETIQUETA.get(p.ramo, p.ramo),
        "aseguradora": p.aseguradora,
        "producto_id": p.producto_id,
        "producto_nombre": p.producto.nombre if p.producto else None,
        "vigencia_tipo": p.vigencia_tipo,
        "vigencia_etiqueta": _VIGENCIA_ETIQUETA.get(p.vigencia_tipo, p.vigencia_tipo),
        "prima_anual": float(p.prima_anual) if p.prima_anual is not None else None,
        "fecha_inicio": p.fecha_inicio.isoformat() if p.fecha_inicio else None,
        "fecha_vencimiento": p.fecha_vencimiento.isoformat() if p.fecha_vencimiento else None,
        "estado": _estado_poliza_efectivo(p),
        "pagos": pagos,
    }


def _serializar_tarea(t):
    return {
        "id": t.id, "cliente_id": t.cliente_id,
        "cliente_nombre": t.cliente.nombre,
        "poliza_id": t.poliza_id,
        "tipo": t.tipo, "tipo_etiqueta": _TIPO_ETIQUETA.get(t.tipo, t.tipo),
        "titulo": t.titulo, "descripcion": t.descripcion,
        "fecha_limite": t.fecha_limite.isoformat() if t.fecha_limite else None,
        "columna": t.columna,
        "ramo": t.poliza.ramo if t.poliza else None,
        "created_at": t.created_at.isoformat(),
    }


@csrf_exempt
@require_http_methods(["GET"])
def resumen(request):
    """Todo lo del CRM en una sola respuesta (kanban + clientes + catalogo)."""
    if not _autenticado(request):
        return _denegado()
    _sync_renovaciones()
    _seed_productos()
    hoy = date.today()
    tareas = list(Tarea.objects.select_related("cliente", "poliza")
                  .order_by("-created_at"))
    # marcas de alerta: fecha limite proxima o vencida en tareas activas
    alertas = []
    for t in tareas:
        if t.columna == Tarea.Columnas.COMPLETADA or not t.fecha_limite:
            continue
        dias = (t.fecha_limite - hoy).days
        if dias < 0:
            alertas.append({"tarea_id": t.id, "tipo": "atrasada"})
        elif dias <= DIAS_PAGO_PROXIMO:
            alertas.append({"tarea_id": t.id, "tipo": "proxima"})
    pagos_atrasados = []
    for p in Poliza.objects.all():
        for pg in p.pagos.all():
            if _estado_pago_efectivo(pg) == Pago.Estado.ATRASADO:
                pagos_atrasados.append({
                    "pago_id": pg.id, "poliza_id": p.id,
                    "cliente_nombre": p.cliente.nombre, "monto": float(pg.monto),
                    "fecha_limite": pg.fecha_limite.isoformat(),
                })
    return JsonResponse({
        "clientes": [_serializar_cliente(c) for c in Cliente.objects.prefetch_related("polizas__pagos").all()],
        "tareas": [_serializar_tarea(t) for t in tareas],
        "productos": [_serializar_producto(p) for p in Producto.objects.all()],
        "alertas": alertas,
        "pagos_atrasados": pagos_atrasados,
        "stats": {
            "renovaciones_proximas": Tarea.objects.filter(
                tipo=Tarea.Tipos.RENOVACION).exclude(
                columna=Tarea.Columnas.COMPLETADA).count(),
            "tareas_activas": Tarea.objects.exclude(
                columna=Tarea.Columnas.COMPLETADA).count(),
            "pagos_atrasados": len(pagos_atrasados),
            "clientes": Cliente.objects.count(),
        },
    })


@csrf_exempt
@require_http_methods(["POST"])
def crear_cliente(request):
    if not _autenticado(request):
        return _denegado()
    b = _leer(request)
    nombre = (b.get("nombre") or "").strip()
    if not nombre:
        return JsonResponse({"error": "nombre requerido"}, status=400)
    c = Cliente.objects.create(
        nombre=nombre,
        telefono=(b.get("telefono") or "").strip(),
        correo=(b.get("correo") or "").strip(),
        ciudad=(b.get("ciudad") or "").strip(),
        notas=(b.get("notas") or ""),
        relacion=b.get("relacion") or Cliente.Relacion.PROSPECTO,
    )
    return JsonResponse({"cliente": _serializar_cliente(c)}, status=201)


@csrf_exempt
@require_http_methods(["PUT"])
def editar_cliente(request, cliente_id):
    if not _autenticado(request):
        return _denegado()
    c = Cliente.objects.filter(pk=cliente_id).first()
    if c is None:
        return JsonResponse({"error": "cliente no encontrado"}, status=404)
    b = _leer(request)
    for campo in ("nombre", "telefono", "correo", "ciudad", "notas"):
        if campo in b:
            setattr(c, campo, (b[campo] or "").strip() if campo != "notas" else (b[campo] or ""))
    if "relacion" in b and b["relacion"] in dict(Cliente.Relacion.choices):
        c.relacion = b["relacion"]
    c.save()
    return JsonResponse({"cliente": _serializar_cliente(c)})


@csrf_exempt
@require_http_methods(["DELETE"])
def eliminar_cliente(request, cliente_id):
    if not _autenticado(request):
        return _denegado()
    n, _ = Cliente.objects.filter(pk=cliente_id).delete()
    if not n:
        return JsonResponse({"error": "cliente no encontrado"}, status=404)
    return JsonResponse({"ok": True})


@csrf_exempt
@require_http_methods(["POST"])
def convertir_prospecto(request, prospecto_id):
    """Convierte un Prospect del diagnostico en Cliente del CRM."""
    if not _autenticado(request):
        return _denegado()
    p = Prospect.objects.filter(pk=prospecto_id).first()
    if p is None:
        return JsonResponse({"error": "prospecto no encontrado"}, status=404)
    if Cliente.objects.filter(prospect=p).exists():
        c = Cliente.objects.get(prospect=p)
        return JsonResponse({"cliente": _serializar_cliente(c)})
    c = Cliente.objects.create(
        nombre=p.nombre or "Sin nombre",
        telefono=p.telefono_normalizado or p.telefono or "",
        correo=p.correo or "",
        ciudad=p.ciudad or "",
        relacion=Cliente.Relacion.PROSPECTO,
        prospect=p,
    )
    return JsonResponse({"cliente": _serializar_cliente(c)}, status=201)


@csrf_exempt
@require_http_methods(["POST"])
def crear_producto(request):
    """Catalogo de servicios: agrega un producto (ej. Fletes, Vida Temporal)."""
    if not _autenticado(request):
        return _denegado()
    b = _leer(request)
    nombre = (b.get("nombre") or "").strip()
    if not nombre:
        return JsonResponse({"error": "nombre requerido"}, status=400)
    vig = b.get("vigencia_tipo") or Producto.Vigencia.ANUAL
    if vig not in dict(Producto.Vigencia.choices):
        return JsonResponse({"error": "vigencia_tipo invalida"}, status=400)
    p = Producto.objects.create(
        nombre=nombre,
        aseguradora=(b.get("aseguradora") or "").strip(),
        ramo=b.get("ramo") or Poliza.Ramos.OTROS,
        descripcion=(b.get("descripcion") or ""),
        vigencia_tipo=vig,
    )
    return JsonResponse({"producto": _serializar_producto(p)}, status=201)


@csrf_exempt
@require_http_methods(["PUT"])
def editar_producto(request, producto_id):
    if not _autenticado(request):
        return _denegado()
    p = Producto.objects.filter(pk=producto_id).first()
    if p is None:
        return JsonResponse({"error": "producto no encontrado"}, status=404)
    b = _leer(request)
    for campo in ("nombre", "aseguradora", "ramo", "descripcion"):
        if campo in b:
            setattr(p, campo, (b[campo] or "").strip() if campo != "descripcion" else (b[campo] or ""))
    if "vigencia_tipo" in b and b["vigencia_tipo"] in dict(Producto.Vigencia.choices):
        p.vigencia_tipo = b["vigencia_tipo"]
    if "activo" in b:
        p.activo = bool(b["activo"])
    p.save()
    return JsonResponse({"producto": _serializar_producto(p)})


@csrf_exempt
@require_http_methods(["DELETE"])
def eliminar_producto(request, producto_id):
    if not _autenticado(request):
        return _denegado()
    n, _ = Producto.objects.filter(pk=producto_id).delete()
    if not n:
        return JsonResponse({"error": "producto no encontrado"}, status=404)
    return JsonResponse({"ok": True})


@csrf_exempt
@require_http_methods(["POST"])
def crear_poliza(request):
    if not _autenticado(request):
        return _denegado()
    b = _leer(request)
    c = Cliente.objects.filter(pk=b.get("cliente_id")).first()
    if c is None:
        return JsonResponse({"error": "cliente no encontrado"}, status=400)
    producto = None
    if b.get("producto_id"):
        producto = Producto.objects.filter(pk=b["producto_id"]).first()
    vig = b.get("vigencia_tipo") or (producto.vigencia_tipo if producto else "anual")
    if vig not in [c[0] for c in Producto.Vigencia.choices]:
        vig = "anual"
    p = Poliza.objects.create(
        cliente=c,
        ramo=b.get("ramo") or (producto.ramo if producto else Poliza.Ramos.OTROS),
        aseguradora=(b.get("aseguradora") or "").strip() or (producto.aseguradora if producto else ""),
        producto=producto,
        vigencia_tipo=vig,
        prima_anual=b.get("prima_anual"),
        fecha_inicio=_fecha(b.get("fecha_inicio")),
        fecha_vencimiento=_fecha(b.get("fecha_vencimiento")),
        estado=b.get("estado") or Poliza.Estado.ACTIVA,
    )
    return JsonResponse({"poliza": _serializar_poliza(p)}, status=201)


@csrf_exempt
@require_http_methods(["PUT"])
def editar_poliza(request, poliza_id):
    if not _autenticado(request):
        return _denegado()
    p = Poliza.objects.filter(pk=poliza_id).first()
    if p is None:
        return JsonResponse({"error": "poliza no encontrada"}, status=404)
    b = _leer(request)
    if "producto_id" in b:
        p.producto = Producto.objects.filter(pk=b["producto_id"]).first() if b["producto_id"] else None
    if "vigencia_tipo" in b and b["vigencia_tipo"] in [c[0] for c in Producto.Vigencia.choices]:
        p.vigencia_tipo = b["vigencia_tipo"]
    for campo in ("ramo", "aseguradora", "estado"):
        if campo in b:
            setattr(p, campo, b[campo])
    if "prima_anual" in b:
        p.prima_anual = b["prima_anual"]
    if "fecha_inicio" in b:
        p.fecha_inicio = _fecha(b["fecha_inicio"])
    if "fecha_vencimiento" in b:
        p.fecha_vencimiento = _fecha(b["fecha_vencimiento"])
    p.save()
    return JsonResponse({"poliza": _serializar_poliza(p)})


@csrf_exempt
@require_http_methods(["DELETE"])
def eliminar_poliza(request, poliza_id):
    if not _autenticado(request):
        return _denegado()
    n, _ = Poliza.objects.filter(pk=poliza_id).delete()
    if not n:
        return JsonResponse({"error": "poliza no encontrada"}, status=404)
    return JsonResponse({"ok": True})


@csrf_exempt
@require_http_methods(["POST"])
def crear_pago(request):
    if not _autenticado(request):
        return _denegado()
    b = _leer(request)
    p = Poliza.objects.filter(pk=b.get("poliza_id")).first()
    if p is None:
        return JsonResponse({"error": "poliza no encontrada"}, status=400)
    pg = Pago.objects.create(
        poliza=p,
        monto=b.get("monto") or 0,
        fecha_limite=_fecha(b.get("fecha_limite")) or date.today(),
        fecha_pago=_fecha(b.get("fecha_pago")),
        estado=b.get("estado") or Pago.Estado.PENDIENTE,
    )
    return JsonResponse({"pago": _serializar_poliza(p)["pagos"][-1]}, status=201)


@csrf_exempt
@require_http_methods(["PUT"])
def editar_pago(request, pago_id):
    if not _autenticado(request):
        return _denegado()
    pg = Pago.objects.filter(pk=pago_id).first()
    if pg is None:
        return JsonResponse({"error": "pago no encontrado"}, status=404)
    b = _leer(request)
    for campo in ("monto", "estado"):
        if campo in b:
            setattr(pg, campo, b[campo])
    if "fecha_limite" in b:
        pg.fecha_limite = _fecha(b["fecha_limite"]) or pg.fecha_limite
    if "fecha_pago" in b:
        pg.fecha_pago = _fecha(b["fecha_pago"])
    pg.save()
    return JsonResponse({"pago": {"id": pg.id, "estado": _estado_pago_efectivo(pg)}})


@csrf_exempt
@require_http_methods(["DELETE"])
def eliminar_pago(request, pago_id):
    if not _autenticado(request):
        return _denegado()
    n, _ = Pago.objects.filter(pk=pago_id).delete()
    if not n:
        return JsonResponse({"error": "pago no encontrado"}, status=404)
    return JsonResponse({"ok": True})


@csrf_exempt
@require_http_methods(["POST"])
def crear_tarea(request):
    if not _autenticado(request):
        return _denegado()
    b = _leer(request)
    c = Cliente.objects.filter(pk=b.get("cliente_id")).first()
    if c is None:
        return JsonResponse({"error": "cliente no encontrado"}, status=400)
    t = Tarea.objects.create(
        cliente=c,
        poliza_id=b.get("poliza_id") or None,
        tipo=b.get("tipo") or Tarea.Tipos.SEGUIMIENTO,
        titulo=(b.get("titulo") or "").strip() or "Seguimiento",
        descripcion=(b.get("descripcion") or ""),
        fecha_limite=_fecha(b.get("fecha_limite")),
        columna=b.get("columna") or Tarea.Columnas.PENDIENTE,
    )
    return JsonResponse({"tarea": _serializar_tarea(t)}, status=201)


@csrf_exempt
@require_http_methods(["PUT"])
def mover_tarea(request, tarea_id):
    """Edita y/o mueve una tarea entre columnas del kanban."""
    if not _autenticado(request):
        return _denegado()
    t = Tarea.objects.filter(pk=tarea_id).first()
    if t is None:
        return JsonResponse({"error": "tarea no encontrada"}, status=404)
    b = _leer(request)
    if "columna" in b and b["columna"] in dict(Tarea.Columnas.choices):
        t.columna = b["columna"]
    for campo in ("titulo", "descripcion"):
        if campo in b:
            setattr(t, campo, b[campo])
    if "tipo" in b and b["tipo"] in dict(Tarea.Tipos.choices):
        t.tipo = b["tipo"]
    if "fecha_limite" in b:
        t.fecha_limite = _fecha(b["fecha_limite"])
    t.save()
    return JsonResponse({"tarea": _serializar_tarea(t)})


@csrf_exempt
@require_http_methods(["DELETE"])
def eliminar_tarea(request, tarea_id):
    if not _autenticado(request):
        return _denegado()
    n, _ = Tarea.objects.filter(pk=tarea_id).delete()
    if not n:
        return JsonResponse({"error": "tarea no encontrada"}, status=404)
    return JsonResponse({"ok": True})


def _fecha(valor):
    """Parsea 'YYYY-MM-DD' -> date; None si vacio/invalido."""
    if not valor:
        return None
    try:
        return date.fromisoformat(str(valor))
    except (ValueError, TypeError):
        return None
