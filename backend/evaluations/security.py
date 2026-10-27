"""Capas de seguridad del API publico (directiva de Carlos 2026-08-24):

Capa 1 - Anti-plagio: el diagnostico PUBLICO se sanitiza (sin factores del
         motor, sin reglas, sin variables_calculadas) — ver services.py.
Capa 2 - Rate-limit por IP en los endpoints de evaluacion (start/answer/
         finalize/leads/prospectos/evento) con bloqueo progresivo.
Capa 3 - Anti-bots de monitoreo: User-Agent de bot -> 403 (navegadores reales
         nunca se ven afectados) + registro de sospechosos.
Capa 4 - Delay de "pensamiento" (la jugada Silent Hill): pausas de 300-700ms
         en start/answer/finalize que hacen la simulacion de LLM mas creible
         mientras encarecen el recorrido completo del flujo para un bot.
Capa 6 - Registro de accesos sospechosos (AccesoSospechoso) visible en el
         panel privado.

Fail-open: si el cache (Redis) no responde, se permite el acceso y se
registra el fallo — el producto no se rompe por un cache caido.
"""
import random
import re
import time

from django.conf import settings
from django.core.cache import cache
from django.http import JsonResponse
from django.utils import timezone

# Patrones de User-Agent de bots/monitoreo (navegadores reales NO matchean).
UA_BOT = re.compile(
    r"bot|crawl|spider|scrapy|headless|phantomjs|selenium|puppeteer|"
    r"curl|wget|postman|httpclient|libwww|python-requests|python-urllib|"
    r"go-http|okhttp|axios|node-fetch|fetch-|monitor|uptime|pingdom|"
    r"datadog|newrelic|semrush|ahrefs|mj12|petalbot|bytespider|"
    r"facebookexternalhit|whatsapp|telegrambot|discordbot|slackbot",
    re.IGNORECASE,
)

# Limites por endpoint: (max_requests, ventana_segundos)
LIMITES = {
    "start": (20, 60),
    "answer": (60, 60),
    "finalize": (30, 60),
    "leads": (20, 60),
    "prospectos": (30, 60),
    "evento": (30, 60),
    # Auditoria OWASP A07 (2026-08-26): login 5 intentos/min por IP
    # (el bloqueo por sesion es evadible con sesiones frescas).
    "login": (5, 60),
}
# Bloqueo progresivo tras exceder el limite: 60s -> 5min -> 15min
BLOQUEOS = [60, 300, 900]


def ip_cliente(request):
    """IP real detras de nginx. Fix auditoria OWASP A07 (2026-08-26):
    X-Forwarded-For SPOOFEABLE (nginx ahora pisa el header del cliente con
    $remote_addr; por defensa en profundidad se toma el ULTIMO valor —
    el unico que puede venir del proxy confiable)."""
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[-1].strip()
    return request.META.get("REMOTE_ADDR", "desconocida")


def es_bot_ua(request):
    ua = request.META.get("HTTP_USER_AGENT", "") or ""
    return bool(UA_BOT.search(ua))


def _registrar_sospechoso(ip, endpoint, motivo, bloqueado_hasta=None):
    """Registra un acceso sospechoso (Capa 6); nunca lanza excepciones."""
    try:
        from .models import AccesoSospechoso
        obj, creado = AccesoSospechoso.objects.get_or_create(
            ip=ip, endpoint=endpoint, motivo=motivo,
            defaults={"veces": 1, "bloqueado_hasta": bloqueado_hasta})
        if not creado:
            obj.veces += 1
            if bloqueado_hasta:
                obj.bloqueado_hasta = bloqueado_hasta
            obj.save(update_fields=["veces", "bloqueado_hasta", "updated_at"])
    except Exception:
        pass  # el registro de sospechosos jamas rompe el flujo


def _excede_rate_limit(request, endpoint):
    """Capa 2: contador por IP+endpoint en ventana deslizante; bloqueo
    progresivo tras excesos repetidos. Devuelve (excede, bloqueado_hasta)."""
    if not getattr(settings, "RATE_LIMIT_ENABLED", True):
        return False, None
    limites = LIMITES.get(endpoint)
    if not limites:
        return False, None
    max_req, ventana = limites
    ip = ip_cliente(request)
    ahora = int(time.time())
    bucket = ahora // ventana

    try:
        clave_ventana = f"rl:{ip}:{endpoint}:{bucket}"
        clave_bloqueo = f"rl:{ip}:{endpoint}:bloqueo"
        clave_excesos = f"rl:{ip}:{endpoint}:excesos"

        bloqueado_hasta = cache.get(clave_bloqueo)
        if bloqueado_hasta and time.time() < bloqueado_hasta:
            return True, bloqueado_hasta

        contador = cache.get(clave_ventana, 0) + 1
        cache.set(clave_ventana, contador, timeout=ventana + 5)

        if contador <= max_req:
            return False, None

        # exceso: acumula y aplica bloqueo progresivo
        excesos = cache.get(clave_excesos, 0) + 1
        cache.set(clave_excesos, excesos, timeout=3600)
        indice = min(excesos - 1, len(BLOQUEOS) - 1)
        bloqueo = ahora + BLOQUEOS[indice]
        cache.set(clave_bloqueo, bloqueo, timeout=BLOQUEOS[indice] + 60)
        _registrar_sospechoso(
            ip, endpoint, "rate_limit",
            timezone.now() + timezone.timedelta(seconds=BLOQUEOS[indice]))
        return True, bloqueo
    except Exception:
        # fail-open: cache caido no rompe el producto
        return False, None


def _pensar(endpoint):
    """Capa 4 (la jugada Silent Hill): pausa 300-700ms en los endpoints de
    evaluacion. La debilidad (lentitud) se vende como feature (un LLM tarda
    en 'razonar') y encarece el recorrido completo del flujo para un bot."""
    if not getattr(settings, "SIMULATE_THINKING", False):
        return
    time.sleep(random.uniform(0.30, 0.70))


def proteger(endpoint, pensar=False):
    """Decorador de capas 2/3/4 para los endpoints publicos de evaluacion.
    Orden: bot-UA (403) -> rate-limit (429) -> delay de pensamiento."""
    def decorador(fn):
        def wrapper(request, *args, **kwargs):
            if es_bot_ua(request):
                _registrar_sospechoso(ip_cliente(request), endpoint, "bot_ua")
                return JsonResponse({"error": "acceso no permitido"}, status=403)
            excede, bloqueado_hasta = _excede_rate_limit(request, endpoint)
            if excede:
                return JsonResponse({
                    "error": "demasiadas solicitudes, intenta en unos minutos",
                }, status=429)
            if pensar:
                _pensar(endpoint)
            return fn(request, *args, **kwargs)
        return wrapper
    return decorador
