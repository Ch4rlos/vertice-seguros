"""Panel privado de Carlos (CP-13..CP-15) — solo lectura.

Un unico usuario; password por variable de entorno (DJANGO_PANEL_PASSWORD);
sesion con cookie HttpOnly (django.contrib.sessions); logout; proteccion de
rutas; rate-limit simple de intentos. NO modifica el motor ni el Knowledge:
toda la informacion se lee de lo ya persistido (Diagnostico.resultado trae
el diagnostico completo con trazabilidad).
"""
import json
import secrets
import time
from collections import Counter
from datetime import date

from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from . import services
from .security import proteger
from .models import Diagnostico, Prospect

MAX_INTENTOS = 5
BLOQUEO_SEG = 60
ETAPAS_EMBUDO = [
    "lead_inicial", "telefono_capturado", "completo_visto",
    "whatsapp_click", "compartido",
]


def _leer(request):
    try:
        return json.loads(request.body or b"{}")
    except json.JSONDecodeError:
        return {}


def _autenticado(request):
    return bool(request.session.get("panel_ok"))


def _denegado():
    return JsonResponse({"error": "no autorizado"}, status=401)


@csrf_exempt
@require_http_methods(["POST"])
@proteger("login", pensar=False)
def login(request):
    """CP-13: login con password unico + rate-limit simple.
    Capa 7 (auditoria OWASP A07 2026-08-26): el bloqueo por SESION es
    evadible con sesiones frescas -> @proteger("login") anade limite POR
    IP (Redis, 5 intentos/min) con bloqueo progresivo."""
    body = _leer(request)
    password = body.get("password") or ""
    ahora = time.time()
    if ahora < request.session.get("panel_bloqueo_hasta", 0):
        return JsonResponse(
            {"error": "demasiados intentos, espera unos segundos"}, status=429)
    # Fix 2026-09-03 (equipo): secrets.compare_digest NO soporta strings
    # no-ASCII (TypeError -> 500 con passwords con acentos/ñ/símbolos).
    # Comparar en bytes: soporta cualquier carácter.
    if not secrets.compare_digest(
            password.encode("utf-8"), settings.PANEL_PASSWORD.encode("utf-8")):
        intentos = request.session.get("panel_intentos", 0) + 1
        if intentos >= MAX_INTENTOS:
            request.session["panel_bloqueo_hasta"] = ahora + BLOQUEO_SEG
            request.session["panel_intentos"] = 0
        else:
            request.session["panel_intentos"] = intentos
        return JsonResponse({"error": "contraseña incorrecta"}, status=401)
    request.session["panel_ok"] = True
    request.session["panel_intentos"] = 0
    return JsonResponse({"ok": True})


@csrf_exempt
@require_http_methods(["POST"])
def logout(request):
    request.session.flush()
    return JsonResponse({"ok": True})


@csrf_exempt
@require_http_methods(["GET"])
def sesion(request):
    """Estado de la sesion del panel (para que el frontend decida login/dashboard)."""
    if _autenticado(request):
        return JsonResponse({"autenticado": True})
    return JsonResponse({"autenticado": False})


@csrf_exempt
@require_http_methods(["GET"])
def dashboard(request):
    """CP-14: metricas calculadas SOLO con lo persistido (no inventar)."""
    if not _autenticado(request):
        return _denegado()
    diags = list(Diagnostico.objects.all().values("id", "estado", "resultado"))
    total = len(diags)
    completados = sum(1 for d in diags if d["estado"] == "completado")
    en_curso = total - completados  # iniciados sin finalizar (abandonos derivados)
    tasa_fin = round(completados / total, 3) if total else None

    bandas = Counter()
    estados_dim = Counter()
    prioridad1 = Counter()
    prioridades_todas = Counter()
    objetivos = Counter()
    irps = []
    for d in diags:
        r = d["resultado"] or {}
        irp = r.get("IRP") or {}
        if irp.get("banda"):
            bandas[irp["banda"]] += 1
        if isinstance(irp.get("valor"), (int, float)):
            irps.append(irp["valor"])
        for dim in r.get("dimensiones", []):
            estados_dim[(dim.get("id"), dim.get("estado"))] += 1
        for p in r.get("prioridades", []):
            dim = p.get("dimension")
            if dim:
                prioridades_todas[dim] += 1
                if p.get("orden") == 1:
                    prioridad1[dim] += 1
        for o in r.get("objetivos", []):
            objetivos[o] += 1

    # embudo: conteos ACUMULADOS por timestamp (no por etapa actual)
    pros = list(Prospect.objects.all())
    embudo = {}
    for etapa in ETAPAS_EMBUDO:
        embudo[etapa] = sum(1 for p in pros if getattr(p, f"{etapa}_at"))
    leads = embudo["lead_inicial"]
    tasa_captura = round(embudo["telefono_capturado"] / leads, 3) if leads else None

    irp_promedio = round(sum(irps) / len(irps), 1) if irps else None
    # CRM (Track 6): alertas de la cartera para el dashboard
    from .models import Cliente, Pago, Poliza, Tarea
    renovaciones = Tarea.objects.filter(tipo=Tarea.Tipos.RENOVACION).exclude(
        columna=Tarea.Columnas.COMPLETADA).count()
    pagos_atrasados_crm = 0
    for pg in Pago.objects.all():
        if pg.estado != Pago.Estado.PAGADO and not pg.fecha_pago \
                and pg.fecha_limite < date.today():
            pagos_atrasados_crm += 1
    return JsonResponse({
        "diagnosticos": {
            "iniciados": total,
            "completados": completados,
            "sin_finalizar": en_curso,
            "tasa_finalizacion": tasa_fin,
        },
        "motor": {
            "bandas": dict(bandas.most_common()),
            "estados_por_dimension": {f"{k[0]}|{k[1]}": v for k, v in estados_dim.most_common()},
            "prioridad_1_mas_frecuente": dict(prioridad1.most_common()),
            "prioridades_todas": dict(prioridades_todas.most_common()),
            "objetivos_mas_frecuentes": dict(objetivos.most_common()),
            "irp_promedio": irp_promedio,
        },
        "embudo": {**embudo, "tasa_captura_telefono": tasa_captura},
        "crm": {
            "renovaciones_proximas": renovaciones,
            "pagos_atrasados": pagos_atrasados_crm,
            "clientes": Cliente.objects.count(),
        },
        "knowledge": services.get_knowledge().metadatos().get("version"),
    })


@csrf_exempt
@require_http_methods(["GET"])
def prospectos(request):
    """CP-15: lista localizable de prospectos (tabla)."""
    if not _autenticado(request):
        return _denegado()
    items = []
    for p in Prospect.objects.select_related("diagnostico").all():
        items.append({
            "id": p.id,
            "nombre": p.nombre,
            "ciudad": p.ciudad,
            "telefono": p.telefono_normalizado or p.telefono,
            "correo": p.correo,
            "etapa": p.etapa,
            "fecha": p.created_at.isoformat(),
            "estado_diag": p.diagnostico.estado if p.diagnostico else None,
        })
    return JsonResponse({"prospectos": items})


def _preparacion(p, diag, kb, preguntas_por_id):
    """CP-16: Preparacion de asesoria. ORGANIZA la info del motor para llegar
    preparado a la conversacion: prioridad principal, riesgos secundarios,
    objetivos declarados, intencion original, oportunidades, datos relevantes
    de la entrevista (solo dimensiones priorizadas) y puntos a aclarar
    (DESCONOCIDAS, omitidas, no_se). Determinista, sin LLM: solo lee lo
    persistido y el knowledge. NO sugiere productos, NO inventa necesidades,
    NO modifica el diagnostico."""
    resultado = diag.resultado or {}
    prioridades = resultado.get("prioridades", []) or []

    prioridad_principal = None
    riesgos_secundarios = []
    for pr in prioridades:
        item = {
            "dimension": pr.get("dimension"),
            "estado": pr.get("estado"),
            "PR": pr.get("PR"),
            "brechas": pr.get("brechas", []),
            "explicacion": pr.get("explicacion"),
        }
        if pr.get("orden") == 1:
            prioridad_principal = item
        else:
            riesgos_secundarios.append(item)

    # intencion original (INT-1) + respuestas "no se" del prospecto
    intencion_original = None
    no_se = []
    for r in diag.respuestas.get("items", []):
        if r["pregunta"] == "INT-1":
            intencion_original = r.get("valor")
        elif r.get("confianza") == "no_se":
            q = preguntas_por_id.get(r["pregunta"])
            no_se.append({
                "pregunta": r["pregunta"],
                "texto": q.get("texto") if q else r["pregunta"],
                "variable": q.get("variable") if q else None,
                "valor": r.get("valor"),
            })

    # datos relevantes: SOLO respuestas que alimentan dimensiones priorizadas
    dims_priorizadas = {pr.get("dimension") for pr in prioridades if pr.get("dimension")}
    datos_relevantes = []
    vistos = set()
    for r in diag.respuestas.get("items", []):
        pid = r["pregunta"]
        if pid == "INT-1" or pid in vistos:
            continue
        q = preguntas_por_id.get(pid)
        if not q:
            continue
        alimenta = set(q.get("dimensiones_alimenta", []) or [])
        toca = alimenta & dims_priorizadas
        if toca:
            vistos.add(pid)
            datos_relevantes.append({
                "pregunta": pid,
                "texto": q.get("texto"),
                "variable": q.get("variable"),
                "valor": r.get("valor"),
                "dimensiones": sorted(toca),
            })

    # puntos a aclarar: variables DESCONOCIDAS (con su pregunta si existe)
    estado_perfil = resultado.get("estado_perfil", {}) or {}
    variables_kb = {v["id"]: v for v in kb.variables() if v.get("id")}
    desconocidas = []
    for var, info in estado_perfil.items():
        if not (isinstance(info, dict) and info.get("confianza") == "desconocido"):
            continue
        q = next((q for q in preguntas_por_id.values() if q.get("variable") == var), None)
        vmeta = variables_kb.get(var, {})
        desconocidas.append({
            "variable": var,
            "pregunta": q["id"] if q else None,
            "texto": q.get("texto") if q else None,
            "dimension": vmeta.get("dimension"),
            "derivada": q is None,
        })

    omitidas = []
    for o in (resultado.get("trazabilidad", {}) or {}).get("preguntas_omitidas", []) or []:
        q = preguntas_por_id.get(o.get("pregunta"))
        omitidas.append({
            "pregunta": o.get("pregunta"),
            "texto": q.get("texto") if q else o.get("pregunta"),
            "razon": o.get("razon"),
        })

    return {
        "prioridad_principal": prioridad_principal,
        "riesgos_secundarios": riesgos_secundarios,
        "objetivos": resultado.get("objetivos", []),
        "intencion_original": intencion_original,
        "oportunidades": resultado.get("oportunidades", []),
        "datos_relevantes": datos_relevantes,
        "puntos_a_aclarar": {
            "desconocidas": desconocidas,
            "omitidas": omitidas,
            "no_se": no_se,
        },
    }


@csrf_exempt
@require_http_methods(["GET"])
def prospecto_detalle(request, prospecto_id):
    """CP-15/CP-16: vista completa (datos, entrevista, diagnostico,
    trazabilidad + preparacion de asesoria). Todo se lee de lo persistido;
    nada se recalcula."""
    if not _autenticado(request):
        return _denegado()
    p = Prospect.objects.select_related("diagnostico").filter(pk=prospecto_id).first()
    if p is None or p.diagnostico is None:
        return JsonResponse({"error": "prospecto no encontrado"}, status=404)
    diag = p.diagnostico

    kb = services.get_knowledge()
    preguntas = {q["id"]: q for q in kb.preguntas()}
    respuestas = diag.respuestas.get("items", [])
    entrevista = []
    intencion = None
    for r in respuestas:
        q = preguntas.get(r["pregunta"])
        item = {
            "pregunta": r["pregunta"],
            "texto": q.get("texto") if q else r["pregunta"],
            "valor": r.get("valor"),
            "confianza": r.get("confianza"),
            "variable": q.get("variable") if q else None,
            "condicional": bool(q.get("condicion")) if q else False,
        }
        if r["pregunta"] == "INT-1":
            intencion = item
        else:
            entrevista.append(item)

    resultado = diag.resultado or {}
    # Semáforo de urgencia: si el diagnóstico es anterior a la directiva
    # (2026-08-24) no trae banderas persistidas; se calculan en vivo (misma
    # función determinista → mismo resultado). Fuente única: services.
    if "banderas_urgencia" not in resultado:
        resultado = {**resultado, "banderas_urgencia": services.banderas_urgencia(resultado)}
    # Semaforo de proteccion + oportunidades de venta GNP (directiva de
    # Carlos 2026-08-24): calculados en vivo para el panel (privado).
    semaforo_prot = services.semaforo_proteccion(resultado)
    oportunidades = services.oportunidades_venta(resultado)
    trazabilidad = resultado.get("trazabilidad", {}) or {}
    return JsonResponse({
        "prospecto": {
            "id": p.id,
            "nombre": p.nombre,
            "ciudad": p.ciudad,
            "telefono": p.telefono_normalizado or p.telefono,
            "correo": p.correo,
            "etapa": p.etapa,
            "fecha": p.created_at.isoformat(),
            "estado_diag": diag.estado,
        },
        "intencion": intencion,
        "entrevista": entrevista,
        "diagnostico": resultado,
        "trazabilidad": trazabilidad,
        "hipotesis": kb.hipotesis(),
        "preparacion": _preparacion(p, diag, kb, preguntas),
        "semaforo_proteccion": semaforo_prot,
        "oportunidades_venta": oportunidades,
    })


@csrf_exempt
@require_http_methods(["GET"])
def seguridad(request):
    """Capa 6 (directiva de Carlos 2026-08-24): accesos sospechosos
    registrados (rate-limit excedido, User-Agent de bot) — el otro lado de
    la moneda del anti-monitoreo: quien intenta husmear queda visto."""
    if not _autenticado(request):
        return _denegado()
    from .models import AccesoSospechoso
    items = []
    for a in AccesoSospechoso.objects.all()[:20]:
        items.append({
            "ip": a.ip,
            "endpoint": a.endpoint,
            "motivo": a.motivo,
            "veces": a.veces,
            "bloqueado_hasta": a.bloqueado_hasta.isoformat() if a.bloqueado_hasta else None,
            "actualizado": a.updated_at.isoformat(),
        })
    return JsonResponse({"sospechosos": items})
