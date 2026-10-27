"""API de evaluacion conversacional (MVP: diagnostico preliminar publico).

Flujo: start -> (answer -> proxima pregunta + radar parcial)* -> finalize
-> diagnostico publico -> /api/prospectos (captura) -> cita con Carlos.
Estrategia y productos NO se exponen (flujo MVP aprobado).
"""
import copy
import secrets
import uuid

from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from . import services
from .models import Diagnostico, Prospect, normalizar_telefono_mx
from .security import proteger
from .validacion import validar_credibilidad

FECHA = "2026-08-08"  # fecha de evaluacion (el motor no usa reloj del sistema)
AVISO_VERSION = "v0.1"  # version del aviso de privacidad (CP-03)
# Edad legal para trabajar en Mexico (LFT): las semanas cotizadas no pueden
# acumularse antes de esa edad. (validacion de producto, no del motor)
# Carlos 2026-08-18: el rango valido es entre la mayoria de edad (18) y la
# jubilacion (RE3); si la jubilacion aun no se conoce, se usa la edad actual.
EDAD_MAYORIA = 18


def _edad_prospecto(respuestas):
    """Edad declarada (SA3) si existe; None si no se respondio."""
    for r in respuestas:
        if r.get("pregunta") == "SA3" and isinstance(r.get("valor"), (int, float)):
            return r["valor"]
    return None


def _edad_jubilacion(respuestas):
    """Edad de retiro declarada (RE3) si existe; None si no se respondio."""
    for r in respuestas:
        if r.get("pregunta") == "RE3" and isinstance(r.get("valor"), (int, float)):
            return r["valor"]
    return None


def _max_semanas(respuestas):
    """Maximo plausible de semanas cotizadas: entre la mayoria de edad y la
    jubilacion (RE3); fallback: hasta la edad actual."""
    jub = _edad_jubilacion(respuestas)
    edad = _edad_prospecto(respuestas)
    tope = jub if jub is not None else edad
    if tope is None:
        return None
    return max(0, int((tope - EDAD_MAYORIA) * 52.14))


@csrf_exempt
@require_http_methods(["POST"])
@proteger("start", pensar=True)
def start(request):
    """Crea una sesion de diagnostico y devuelve la primera pregunta."""
    session_id = str(uuid.uuid4())
    diag = Diagnostico.objects.create(
        session_id=session_id,
        estado=Diagnostico.Estado.EN_CURSO,
        knowledge_version=services.get_knowledge().metadatos().get("version"),
        knowledge_hash=services.get_knowledge().hash,
    )
    services._ENGINES[session_id] = services.nueva_evaluacion(FECHA)[1]
    pregunta = services.proxima_pregunta([], FECHA)
    return JsonResponse({
        "session_id": session_id,
        "diagnostico_id": diag.id,
        "pregunta": pregunta,
    })


@csrf_exempt
@require_http_methods(["POST"])
@proteger("answer", pensar=True)
def answer(request):
    """Registra una respuesta; devuelve la siguiente pregunta y el radar parcial."""
    try:
        body = request.json_body if hasattr(request, "json_body") else (
            request.POST if request.POST else _read_json(request))
    except Exception:
        return JsonResponse({"error": "JSON invalido"}, status=400)
    session_id = body.get("session_id")
    pregunta = body.get("pregunta")
    valor = body.get("valor")
    confianza = body.get("confianza", "alta")
    if not session_id or not pregunta:
        return JsonResponse({"error": "session_id y pregunta son requeridos"}, status=400)
    diag = _diag(session_id)
    if diag is None:
        return JsonResponse({"error": "sesion no encontrada"}, status=404)
    respuestas = list(diag.respuestas.get("items", []))
    # Validacion de producto (no del motor): semanas cotizadas no pueden
    # superar lo acumulable desde la edad legal para trabajar (feedback de
    # Carlos 2026-08-18). Si la edad (SA3) ya se respondio, se rechaza.
    kb = services.get_knowledge()
    pregunta_kb = next((q for q in kb.preguntas() if q.get("id") == pregunta), None)
    if (
        pregunta_kb and (pregunta_kb.get("dominio") or {}).get("tipo") == "semanas"
        and isinstance(valor, (int, float))
    ):
        mx = _max_semanas(respuestas)
        if mx is not None and valor > mx:
            return JsonResponse({
                "error": f"Ese número no es posible: con tu edad, el máximo de semanas cotizadas es {mx}.",
            }, status=400)
    # Validacion de CREDIBILIDAD (directiva de Carlos 2026-08-25): no se
    # aceptan edades de 1000 anios ni montos mayores a Carlos Slim; si el
    # valor se sale de un rango creible, se responde con ironia. El "no se"
    # (valor None + confianza no_se) es una respuesta legitima y no aplica.
    if valor is not None:
        ok, error = validar_credibilidad(pregunta_kb, valor)
        if not ok:
            return JsonResponse({"error": error}, status=400)
    respuestas.append({"pregunta": pregunta, "valor": valor, "confianza": confianza})
    diag.respuestas = {"items": respuestas}
    diag.save(update_fields=["respuestas", "updated_at"])
    siguiente = services.proxima_pregunta(respuestas, FECHA)
    # Enriquecer la siguiente pregunta (capa producto): si es de semanas,
    # el frontend recibe el maximo segun la edad para validar el input.
    # IMPORTANTE: clonar antes de mutar — el dict del conocimiento del motor
    # esta cacheado en memoria y NO debe modificarse (bug detectado 2026-08-18:
    # el max de una sesion contaminaba las siguientes).
    if siguiente:
        dom = siguiente.get("dominio")
        if isinstance(dom, dict) and dom.get("tipo") == "semanas":
            mx = _max_semanas(respuestas)
            if mx is not None:
                siguiente = copy.deepcopy(siguiente)
                siguiente["dominio"]["max"] = mx
                siguiente["dominio"]["min"] = 0
    parcial = _estado_parcial(respuestas)
    return JsonResponse({"pregunta": siguiente, "radar": parcial, "respondidas": len(respuestas)})


@csrf_exempt
@require_http_methods(["POST"])
@proteger("finalize", pensar=True)
def finalize(request):
    """Completa el diagnostico y devuelve el resultado preliminar publico."""
    body = _read_json(request)
    session_id = body.get("session_id")
    diag = _diag(session_id)
    if diag is None:
        return JsonResponse({"error": "sesion no encontrada"}, status=404)
    respuestas = list(diag.respuestas.get("items", []))
    completo, publico = services.evaluar(respuestas, FECHA)
    # Semáforo de urgencia (directiva de Carlos): capa producto determinista,
    # NO reordena prioridades; se persiste con el diagnóstico para que el
    # público (Resultado) y el panel (detalle) lo lean de una sola fuente.
    completo["banderas_urgencia"] = services.banderas_urgencia(completo)
    publico["banderas_urgencia"] = completo["banderas_urgencia"]
    # Semaforo de PROTECCION (directiva de Carlos): el publico ve el nivel de
    # proteccion de cada area (banda + P_d). Los TECHOS (maximo_segmento,
    # en_maximo) son datos de negocio y NO viajan al publico (directiva de
    # confidencialidad 2026-08-25); solo el panel los recibe.
    publico["semaforo_proteccion"] = [
        {"dimension": s["dimension"], "P_d": s["P_d"], "banda": s["banda"]}
        for s in services.semaforo_proteccion(completo)
    ]
    diag.resultado = completo  # completo para la asesoria (revision de Carlos)
    diag.resultado_publico = publico
    diag.estado = Diagnostico.Estado.COMPLETADO
    diag.save(update_fields=["resultado", "resultado_publico", "estado", "updated_at"])
    # CP-08/CP-09: el resultado publico lleva estrategia (semantica del motor)
    # y la intencion declarada (INT-1) para el puente contextualizado.
    publico["estrategia"] = completo.get("estrategia", [])
    publico["intencion"] = next(
        (i.get("valor") for i in respuestas if i.get("pregunta") == "INT-1"), None)
    return JsonResponse({"diagnostico": publico})


@csrf_exempt
@require_http_methods(["POST"])
@proteger("leads")
def crear_lead(request):
    """CP-01: lead minimo temprano (nombre+ciudad) antes de la entrevista.

    Crea/actualiza el Prospecto por session_id con etapa=lead_inicial y
    registra el consentimiento del aviso de privacidad (CP-03). Si el
    usuario abandona, el lead minimo ya quedo guardado.
    """
    body = _read_json(request)
    session_id = body.get("session_id")
    nombre = (body.get("nombre") or "").strip()
    ciudad = (body.get("ciudad") or "").strip()
    consentimiento = body.get("consentimiento") in (True, "true", "1")
    aviso_version = body.get("aviso_version") or AVISO_VERSION
    if not session_id or not nombre:
        return JsonResponse({"error": "session_id y nombre son requeridos"}, status=400)
    if not consentimiento:
        return JsonResponse({"error": "Se requiere aceptar el aviso de privacidad"}, status=400)
    diag = _diag(session_id)
    if diag is None:
        return JsonResponse({"error": "sesion no encontrada"}, status=404)
    prospect = Prospect.objects.filter(diagnostico=diag).first()
    creado = prospect is None
    if prospect is None:
        prospect = Prospect(diagnostico=diag, nombre=nombre, ciudad=ciudad)
    else:
        # no pisa datos ya capturados (p. ej. nombre editado en el desbloqueo)
        prospect.nombre = prospect.nombre or nombre
        prospect.ciudad = prospect.ciudad or ciudad
    prospect.registrar_consentimiento(aviso_version)
    if not prospect.lead_inicial_at:
        prospect.lead_inicial_at = timezone.now()
    prospect.etapa = Prospect.Etapa.LEAD_INICIAL
    prospect.save()
    return JsonResponse({
        "prospecto_id": prospect.id,
        "creado": creado,
        "etapa": prospect.etapa,
    }, status=201 if creado else 200)


@csrf_exempt
@require_http_methods(["POST"])
@proteger("evento")
def evento_prospecto(request, session_id):
    """CP-02: registra un evento del embudo (completo_visto, whatsapp_click,
    compartido) sobre el prospecto de la sesion."""
    body = _read_json(request)
    evento = body.get("evento")
    validos = {
        Prospect.Etapa.COMPLETO_VISTO,
        Prospect.Etapa.WHATSAPP_CLICK,
        Prospect.Etapa.COMPARTIDO,
    }
    if evento not in validos:
        return JsonResponse({"error": "evento invalido"}, status=400)
    prospect = Prospect.objects.filter(diagnostico__session_id=session_id).first()
    if prospect is None:
        return JsonResponse({"error": "prospecto no encontrado"}, status=404)
    prospect.registrar_evento(evento)
    return JsonResponse({"prospecto_id": prospect.id, "etapa": prospect.etapa})


@csrf_exempt
@require_http_methods(["POST"])
def compartir(request):
    """CP-10: genera el token de compartido anonimo (solo lectura) y
    registra la etapa compartido del embudo."""
    body = _read_json(request)
    diag = _diag(body.get("session_id"))
    if diag is None:
        return JsonResponse({"error": "sesion no encontrada"}, status=404)
    if not diag.token_compartido:
        diag.token_compartido = secrets.token_urlsafe(12)
        diag.save(update_fields=["token_compartido", "updated_at"])
    p = Prospect.objects.filter(diagnostico=diag).first()
    if p is not None:
        p.registrar_evento(Prospect.Etapa.COMPARTIDO)
    return JsonResponse({"url": f"/compartido/{diag.token_compartido}"})


@csrf_exempt
@require_http_methods(["GET"])
def compartido_publico(request, token):
    """CP-10: vista publica ANONIMA — solo Spider Chart + banda general.
    Sin nombre, sin telefono, sin prioridad identificable, sin montos."""
    diag = Diagnostico.objects.filter(token_compartido=token).first()
    if diag is None:
        return JsonResponse({"error": "compartido no encontrado"}, status=404)
    publico = diag.resultado_publico or {}
    return JsonResponse({
        "banda": (publico.get("estado_general") or {}).get("banda"),
        "dimensiones": [
            {"id": d.get("id"), "P_d": d.get("P_d"), "estado": d.get("estado")}
            for d in publico.get("dimensiones", [])
        ],
    })


@csrf_exempt
@require_http_methods(["POST"])
@proteger("prospectos")
def crear_prospecto(request):
    """CP-07: desbloqueo del diagnostico completo.

    Telefono OBLIGATORIO y normalizado a 10 digitos MX (acepta +52,
    espacios, guiones, parentesis). Correo opcional. Nombre/ciudad vienen
    del lead temprano (CP-01) si existe. Evita duplicados por
    telefono_normalizado: si el numero ya pertenece a otro prospecto, se
    reasigna a esta sesion (merge). Etapa -> telefono_capturado.
    """
    body = _read_json(request)
    session_id = body.get("session_id")
    telefono = (body.get("telefono") or "").strip()
    normalizado = normalizar_telefono_mx(telefono)
    if not session_id:
        return JsonResponse({"error": "session_id requerido"}, status=400)
    if not telefono or not normalizado:
        return JsonResponse(
            {"error": "telefono invalido: se requieren 10 digitos (ej. +52 55 0000 0000)"},
            status=400,
        )
    diag = _diag(session_id)
    if diag is None:
        return JsonResponse({"error": "sesion no encontrada"}, status=404)

    # Dedupe por telefono (CP-07): mismo numero normalizado = misma persona.
    # La sesion mas reciente se queda con el prospecto que tiene el telefono;
    # si la sesion actual ya tenia un lead sin telefono, se fusiona y se borra
    # el lead huerfano (conservando campos que falten).
    prospect = Prospect.objects.filter(diagnostico=diag).first()
    por_tel = Prospect.objects.filter(telefono_normalizado=normalizado).first()
    if prospect is not None and por_tel is not None and prospect.pk != por_tel.pk:
        if not por_tel.nombre or por_tel.nombre == "Sin nombre":
            por_tel.nombre = prospect.nombre
        if not por_tel.ciudad:
            por_tel.ciudad = prospect.ciudad
        prospect.delete()
        prospect = por_tel
    elif prospect is None and por_tel is not None:
        prospect = por_tel
    creado = prospect is None
    if prospect is None:
        prospect = Prospect(
            diagnostico=diag,
            nombre=(body.get("nombre") or "").strip() or "Sin nombre",
            ciudad=(body.get("ciudad") or "").strip(),
            telefono=telefono,
            telefono_normalizado=normalizado,
            correo=(body.get("correo") or "").strip(),
        )
    else:
        prospect.diagnostico = diag
        prospect.telefono = telefono
        prospect.telefono_normalizado = normalizado
        if body.get("correo"):
            prospect.correo = (body.get("correo") or "").strip()
        if not prospect.nombre or prospect.nombre == "Sin nombre":
            prospect.nombre = (body.get("nombre") or "").strip() or "Sin nombre"
        if not prospect.ciudad:
            prospect.ciudad = (body.get("ciudad") or "").strip()
    prospect.save()  # persiste campos seteados (telefono, normalizado, diagnostico...)
    prospect.registrar_evento(Prospect.Etapa.TELEFONO_CAPTURADO)
    return JsonResponse({
        "prospecto_id": prospect.id,
        "mensaje": "Diagnostico desbloqueado.",
        "whatsapp_url": "https://wa.me/525500000000?text=" + _wa_text(prospect.nombre),
    }, status=201 if creado else 200)


def _estado_parcial(respuestas):
    """Radar parcial: P_d por dimension con lo respondido hasta ahora."""
    try:
        completo, _ = services.evaluar(respuestas, FECHA)
        return [
            {"id": d["id"], "P_d": d["P_d"], "estado": d["estado"]}
            for d in completo["dimensiones"]
        ]
    except Exception:
        return []


def _read_json(request):
    import json
    try:
        return json.loads(request.body or b"{}")
    except json.JSONDecodeError:
        return {}


def _diag(session_id):
    """Localiza el Diagnostico por session_id (o None)."""
    if not session_id:
        return None
    return Diagnostico.objects.filter(session_id=session_id).first()


def _wa_text(nombre):
    from urllib.parse import quote
    return quote(
        f"Hola Carlos, soy {nombre}. Complete mi diagnostico patrimonial "
        f"en CQ Patrimonial AI y me gustaria agendar una sesion para "
        f"revisar los resultados."
    )
