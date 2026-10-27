"""Validacion de CREDIBILIDAD de inputs (directiva de Carlos 2026-08-25):
no se aceptan respuestas absurdas — edades mas alla del record mundial de
los ultimos 5 anios, montos que rebasan a Carlos Slim, porcentajes >100.
Cuando el valor se sale de un rango creible, se responde con un mensaje
IRONICO (Carlos lo autorizo: "te permito poner mensajes ironicos").

La validacion vive en el BACKEND (autoritativa; el cliente no se toca).
Rangos disenados para ser generosos (nunca rechazar un caso real) pero
imposibles de confundir con pendejadas. Los mensajes son de producto.

Referencia de rangos creibles (2026):
- Edad: record mundial verificado 122 (Calment 1997); en los ultimos 5
  anios el maximo fue 119 (Kane Tanaka, 2022). Tope: 120.
- Slim: patrimonio ~1.6 billones MXN (~80,000M USD). Tope patrimonial:
  2 billones MXN ("mas que Carlos Slim").
"""
from typing import Optional, Tuple

# Limites por TIPO de dominio (aplica a cualquier pregunta de ese tipo).
TOPES_POR_TIPO = {
    "edad": (1, 120, "Ni la persona más longeva verificada del planeta llegó ahí (119 años). Escribe tu edad real 😉"),
    "semanas": (0, 2600, "Ese número de semanas no existe ni sumando dos vidas laborales."),
    "meses": (0, 120, "Más de 10 años de fondo de emergencia es de sobra. Escribe meses reales."),
    "conteo": (0, 30, "Ese número no cabe ni en un inventario. Escribe una cantidad real."),
    "porcentaje": (0, 100, "El porcentaje no pasa de 100, ni en la barra de vida de un videojuego."),
}

# Limites por PREGUNTA para montos (la escala depende de que se mide).
# Formato: id -> (min, max, mensaje_ironico)
TOPES_MONTOS = {
    "IN-ING": (1, 50_000_000,
               "Ese ingreso no aparece ni en la lista de Forbes. Escribe una cifra creíble."),
    "IN3": (1, 20_000_000,
            "¿Gastas más de 20 millones al mes? Ni el mantenimiento de un estadio cuesta eso."),
    "IN-DEUDA": (0, 20_000_000,
                 "Esa deuda no la autoriza ni un banco suizo. Escribe un monto real."),
    "PF-SUMA": (0, 2_000_000_000,
                "Esa suma asegurada no la suscribe ninguna aseguradora del país."),
    "SA-DED": (0, 2_000_000,
               "Ese deducible es más caro que el seguro completo. Escribe el deducible real."),
    "RE-SALDO": (0, 2_000_000_000,
                 "Ese saldo no cabe en ninguna Afore del país."),
    "HO2": (0, 5_000_000,
            "¿Esa renta? Ni la Torre Reforma cuesta eso al mes."),
    "HO-VALOR": (0, 2_000_000_000,
                 "Esa casa no existe ni en Lomas de Chapultepec."),
    "ED-COSTO": (0, 10_000_000,
                 "Esa colegiatura no existe ni en Harvard con residencia incluida."),
    "ED-MONTO": (0, 100_000_000,
                 "Ese ahorro educativo ya cubre la universidad de un campus entero."),
    "PA-TOTAL": (0, 2_000_000_000_000,
                 "Ese patrimonio lo tiene UNA sola persona en México y no es quien está llenando esto 😉"),
}


def validar_credibilidad(pregunta_kb: Optional[dict], valor) -> Tuple[bool, Optional[str]]:
    """Valida un valor contra los rangos creibles. Devuelve (ok, error).
    ok=True -> valor aceptado. ok=False -> error es el mensaje ironico.
    Solo aplica a dominios NUMERICOS (monto/edad/semanas/meses/conteo/
    porcentaje); select/multi/bool/texto quedan fuera del alcance."""
    if pregunta_kb is None:
        return True, None
    dominio = pregunta_kb.get("dominio", {}) or {}
    tipo = dominio.get("tipo")
    if tipo != "monto" and tipo not in TOPES_POR_TIPO:
        return True, None  # select/multi/bool/texto: fuera del alcance
    if not isinstance(valor, (int, float)) or isinstance(valor, bool):
        return False, "Eso no es un número. Escribe la cifra, sin comas ni letras."
    pid = str(pregunta_kb.get("id") or "")

    # montos: tabla por pregunta (mas precisa que el tipo generico)
    if tipo == "monto":
        tope = TOPES_MONTOS.get(pid)
        if tope is None:
            tope = (0, 100_000_000_000, "Esa cifra no cabe en la economía de México.")
        minimo, maximo, mensaje = tope
    else:
        tope = TOPES_POR_TIPO.get(tipo)
        if tope is None:
            return True, None  # tipo sin regla (select/bool/texto): sin validar
        minimo, maximo, mensaje = tope

    if valor < minimo or valor > maximo:
        return False, mensaje
    return True, None
