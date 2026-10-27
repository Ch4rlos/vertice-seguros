"""Servicio de evaluacion: conecta el motor con Django.

Carga la base de conocimiento (ruta configurable con KNOWLEDGE_PATH) una vez
por proceso y expone: pregunta inicial, siguiente pregunta, estado parcial
(radar en vivo), y el diagnostico preliminar PUBLICO.

Regla del flujo MVP (aprobada por Carlos): el diagnostico publico NO incluye
estrategia ni productos; esos pertenecen a la asesoria con Carlos.
"""
import json
import os

from django.conf import settings

from engine.engine import Engine, EvaluacionError
from engine.knowledge import Knowledge, KnowledgeError

# Ruta configurable; por defecto el ejemplo incluido en el repo
KNOWLEDGE_PATH = os.environ.get(
    "KNOWLEDGE_PATH",
    os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "engine", "knowledge.example.json",
    ),
)

_KNOWLEDGE = None
_ENGINES = {}  # session_id -> Engine (cache por proceso, MVP monousuario)


def get_knowledge():
    global _KNOWLEDGE
    if _KNOWLEDGE is None:
        _KNOWLEDGE = Knowledge.load(KNOWLEDGE_PATH)
    return _KNOWLEDGE


def nueva_evaluacion(fecha="2026-08-08"):
    kb = get_knowledge()
    engine = Engine(kb, fecha)
    return kb, engine


def evaluar(respuestas, fecha="2026-08-08"):
    """Ejecuta el pipeline completo y devuelve el diagnostico preliminar PUBLICO."""
    kb, engine = nueva_evaluacion(fecha)
    completo = engine.evaluate(respuestas)["diagnostico"]
    publico = diagnostico_publico(completo)
    return completo, publico


# Redaccion natural de brechas para el PUBLICO (directiva de Carlos
# 2026-08-25): el concepto crudo del motor trae la FORMULA
# (calculo de brecha) — logica de negocio
# que no se expone al prospecto. El publico recibe lenguaje natural; el
# panel conserva el detalle tecnico (completo crudo).
_BRECHA_NATURAL = {
    "PF": "Capital que falta para tu familia",
    "IN": "Fondo que falta para tus ingresos",
    "SA": "Cobertura médica que falta",
    "RE": "Ahorro que falta para tu retiro",
    "HO": "Protección que falta para tu hogar",
    "MO": "Cobertura que falta para tu auto",
    "ED": "Ahorro que falta para la educación",
    "NE": "Protección que falta para tu negocio",
}


def _es_formula(concepto):
    """Detecta una formula del motor en el concepto (operadores o nombres
    de variables internas); un concepto ya natural se conserva."""
    c = str(concepto)
    return any(op in c for op in ("=", "*", "(", ")")) or (
        "_" in c and any(ch.isdigit() for ch in c))


def _brechas_publicas(dimension, brechas):
    """Redacta las brechas de una prioridad para el publico: concepto en
    lenguaje natural (sin formula), monto intacto."""
    naturales = []
    for b in brechas or []:
        concepto = b.get("concepto", "")
        if _es_formula(concepto):
            concepto = _BRECHA_NATURAL.get(dimension, "Brecha de protección")
        naturales.append({"concepto": concepto, "monto_mxn": b.get("monto_mxn")})
    return naturales


def diagnostico_publico(completo):
    """Proyeccion publica SANITIZADA (Capa 1 anti-plagio, directiva de Carlos
    2026-08-24): el prospecto ve lo que se muestra en pantalla y NADA mas.
    Se eliminan del JSON publico: factores internos del PR (severidad,
    probabilidad, cascada...), ids de reglas disparadas, variables
    calculadas y version/hash del knowledge — son el 'algoritmo' que un bot
    podria reconstruir con DevTools. El detalle tecnico completo queda SOLO
    en el panel privado (diag.resultado, con password)."""
    prioridades = []
    for p in completo["prioridades"]:
        dim = p["dimension"]
        dim_info = next((d for d in completo["dimensiones"] if d["id"] == dim), {})
        reglas = dim_info.get("reglas", [])
        prioridades.append({
            "orden": p["orden"],
            "dimension": dim,
            "estado": p["estado"],
            # Brechas en lenguaje natural (sin formulas del motor): el
            # prospecto ve el monto y un concepto legible, nunca la
            # operacion de calculo de brecha.
            "brechas": _brechas_publicas(dim, p["brechas"]),
            # Explicacion LEGIBLE redactada por la capa de producto (mapa
            # _FRASES). Los ids de reglas se usan solo para buscar la frase;
            # nunca se emiten en el publico (anti-plagio).
            "explicacion": (
                f"Existe una exposición relevante en {_NOMBRES.get(dim, dim)}"
                f"{_porque(reglas)}"
            ),
        })
    return {
        # El publico NO ve acronimos del motor (IRP), ni listas tecnicas de
        # dimensiones activas/excluidas, ni R_d: es un paseo on-rails, no un
        # reporte tecnico (directiva de Carlos 2026-08-25). La banda es
        # etiqueta de producto.
        "estado_general": {
            "banda": completo["IRP"].get("banda"),
        },
        "dimensiones": [
            {"id": d["id"], "P_d": d["P_d"], "estado": d["estado"]}
            for d in completo["dimensiones"]
        ],
        "prioridades": prioridades,
        "objetivos": completo["objetivos"],
        "oportunidades": completo["oportunidades"],
    }


def banderas_urgencia(completo):
    """Semáforo de urgencia (directiva de Carlos 2026-08-24): detecta SOLO el
    peor escenario de cada segmento y lo marca con nivel 1-3 (rojo suave /
    medio / intenso). NO reordena las prioridades: el orden del motor sigue
    siendo la verdad; la bandera dice 'esto es un tumor, se atiende ya'.

    Nivel 3 (evento de CORTO plazo + absorción nula): MO sin RC con uso
    diario/laboral · IN sin fondo y deuda alta · SA sin ninguna cobertura.
    Nivel 2 (estructural de mediano plazo): PF dependientes sin protección ·
    NE sin continuidad ni seguros · HO zona alta sin seguro · RE cuenta
    propia sin ahorro a 40+.
    Nivel 1 (objetivo en riesgo): ED con hijos, costo alto y ahorro $0.

    Determinista, sin LLM, sin sugerir productos: la 'accion' es mitigación
    mínima accesible (incluso no comercial, p. ej. regularizar
    derechohabiencia). Respaldada por F-13 (INEGI ATUS 2024), F-14 (INEGI
    EDR 2023), F-15 (seguros.com RC)."""
    ep = completo.get("estado_perfil", {}) or {}

    def var(k, default=None):
        if k not in ep:
            return default
        v = ep[k]
        return v.get("valor") if isinstance(v, dict) else v

    banderas = []

    # Nivel 3 — evento de corto plazo con capacidad de absorción nula
    if var("mo_cobertura") == "ninguna" and (
            var("mo_uso") == "diario" or var("mo_dependencia") is True):
        banderas.append({
            "dimension": "MO", "nivel": 3,
            "titulo": "Accidente sin cobertura: ruina de corto plazo",
            "texto": "Usas el auto a diario (o dependes de él para trabajar) y no "
                     "tienes responsabilidad civil: un golpe a terceros puede ser "
                     "una deuda de cientos de miles de pesos que no podrías absorber.",
            "accion": "La responsabilidad civil es la cobertura más barata del "
                      "mercado (3 a 8 mil pesos al año) y es obligatoria en la "
                      "mayoría del país.",
        })
    fondo = var("in_fondo_meses")
    deuda_ratio = var("in_deuda_ratio")
    if isinstance(fondo, (int, float)) and isinstance(deuda_ratio, (int, float)) \
            and fondo < 1 and deuda_ratio >= 0.30:
        banderas.append({
            "dimension": "IN", "nivel": 3,
            "titulo": "Sin colchón: cualquier imprevisto tumba tu flujo",
            "texto": "No tienes ni un mes de gastos cubiertos y tus deudas fijas "
                     "consumen una parte alta de tu ingreso: un imprevisto se "
                     "convierte en deuda nueva.",
            "accion": "Prioriza juntar aunque sea un mes de gastos antes de "
                      "cualquier gasto no esencial.",
        })
    if var("sa_cobertura") == "ninguna":
        banderas.append({
            "dimension": "SA", "nivel": 3,
            "titulo": "Sin red médica: un gasto mayor sale 100% de tu bolsillo",
            "texto": "No tienes ninguna cobertura de salud: un evento médico "
                     "mayor consumiría tus ahorros en semanas.",
            "accion": "Aunque hoy no contrates, regulariza tu derechohabiencia "
                      "(IMSS, ISSSTE o IMSS-Bienestar): un evento menor se "
                      "atiende ahí. La atención privada es una alternativa con "
                      "tiempos y calidad distintos.",
        })

    # Nivel 2 — estructural de mediano plazo
    dep = var("pf_dependientes")
    anios_cubiertos = var("pf_anios_cubiertos")
    if isinstance(dep, list) and dep and "nadie" not in dep \
            and isinstance(anios_cubiertos, (int, float)) and anios_cubiertos < 1:
        banderas.append({
            "dimension": "PF", "nivel": 2,
            "titulo": "Tus dependientes quedan desprotegidos",
            "texto": "Hay personas que dependen de ti y tu protección actual "
                     "cubre menos de un año de su gasto: si faltaras, su "
                     "estabilidad se acaba.",
            "accion": "Revisa beneficiarios y testamento hoy; el capital se "
                      "puede cerrar en una asesoría.",
        })
    if var("ne_tiene") is True and var("ne_continuidad") == "no" \
            and var("ne_seguro") is False:
        banderas.append({
            "dimension": "NE", "nivel": 2,
            "titulo": "Tu negocio se detiene contigo",
            "texto": "El negocio no opera sin ti y no tiene seguros: si te "
                     "detienes, se detiene el ingreso de tu familia.",
            "accion": "Separa el patrimonio personal del negocio y revisa la "
                      "continuidad operativa.",
        })
    if var("ho_zona") == "alta" and var("ho_seguro") == "ninguno":
        banderas.append({
            "dimension": "HO", "nivel": 2,
            "titulo": "Tu casa está desnuda frente al riesgo de la zona",
            "texto": "Vives en una zona con riesgo natural alto y tu vivienda "
                     "(tu mayor activo) no tiene seguro.",
            "accion": "Cotiza aunque sea cobertura de estructura: en zona de "
                      "riesgo no se negocia.",
        })
    saldo = var("re_saldo_afore")
    edad = var("sa_edad")
    if var("re_regimen") == "cuenta_propia" and saldo in (0, None, "0", "") \
            and isinstance(edad, (int, float)) and edad >= 40:
        banderas.append({
            "dimension": "RE", "nivel": 2,
            "titulo": "No hay pensión a la vista",
            "texto": "No cotizas en IMSS ni ISSSTE, no tienes ahorro para el "
                     "retiro y estás en la recta final: tu retiro depende solo "
                     "de lo que ahorres de aquí en adelante.",
            "accion": "Abre una cuenta de ahorro para el retiro con "
                      "aportaciones pequeñas y constantes.",
        })

    # Nivel 1 — objetivo en riesgo
    if var("ed_hijos") == "menores" and var("ed_costo") and var("ed_ahorro") == 0:
        banderas.append({
            "dimension": "ED", "nivel": 1,
            "titulo": "El objetivo educativo no tiene plan",
            "texto": "La educación de tus hijos es un objetivo real y su costo "
                     "es alto, pero hoy no hay un peso ahorrado ni un plan.",
            "accion": "Define el plan antes de que el costo te alcance.",
        })

    # orden estable: nivel desc, luego el orden de prioridades del motor
    orden_motor = {p.get("dimension"): i
                   for i, p in enumerate(completo.get("prioridades", []) or [])}
    banderas.sort(key=lambda b: (-b["nivel"], orden_motor.get(b["dimension"], 99)))
    return banderas


# Techos estructurales por dimension (verificado contra scoring.formulas del
# knowledge 2026-08-24): SA y MO tienen techo 80 (GMM individual / cobertura
# amplia son el maximo alcanzable); HO depende de la zona (sin riesgo 90,
# moderada 76.5, alta 67.5); el resto llega al techo global 95 (TECHO del
# motor: riesgo residual estructural — "no existe 100%", Carlos).
_MAXIMO_SEGMENTO = {
    "PF": 95, "IN": 95, "SA": 80, "RE": 95, "HO": 90,
    "MO": 80, "ED": 95, "NE": 95,
}
_HO_TECHO_POR_ZONA = {"alta": 67.5, "moderada": 76.5}
# Umbrales del semaforo de proteccion (rangos aprobados por Carlos
# 2026-08-24, verificados contra los rangos reales de cada area):
# verde >= 80 · amarillo 60-79 · naranja 40-59 · rojo < 40.
_BANDAS = [
    (80, "verde"), (60, "amarillo"), (40, "naranja"), (-1, "rojo"),
]

# Mapa dimension -> productos GNP del catalogo (CRM) con rentabilidad del
# agente (1-5 estrellas; investigacion 2026-08-24, F-16 goagentes.mx +
# HIPOTESIS_DISENO): VIDA es el ramo que mas paga (comision alta primer
# anio + renovable decreciente), GMM fijo renovable, daños (auto/hogar)
# 10-15%. La sugerencia SIEMPRE sigue la dimension que el diagnostico marca
# (no se tergiversa por comision); la rentabilidad ordena dentro de la
# misma urgencia para enfocar el tiempo del asesor.
_PRODUCTO_POR_DIMENSION = {
    "PF": [("Vida Individual", 5), ("Vida Temporal", 5)],
    "IN": [("Vida Temporal", 4)],
    "SA": [("Trascendi", 4)],
    "RE": [("Plan de Retiro", 4)],
    "ED": [("Trascendi", 3)],
    "NE": [("Incendio y Multirriesgo", 3)],
    "MO": [("Auto Premier", 2), ("Auto RC", 2)],
    "HO": [("Hogar Protegido", 1)],
}


def semaforo_proteccion(completo):
    """Semaforo de PROTECCION por dimension (directiva de Carlos 2026-08-24):
    clasifica el P_d de cada area activa en verde/amarillo/naranja/rojo con
    los umbrales 80/60/40, y marca el tope estructural del segmento (SA y MO
    llegan a 80; HO segun zona) para no sugerir que falta margen donde el
    modelo no lo hay. Determinista, sin LLM; solo lee lo persistido."""
    ep = completo.get("estado_perfil", {}) or {}

    def var(k):
        v = ep.get(k)
        return v.get("valor") if isinstance(v, dict) else v

    items = []
    for dim in ("PF", "IN", "SA", "RE", "HO", "MO", "ED", "NE"):
        info = next((d for d in completo.get("dimensiones", []) if d["id"] == dim), {})
        p_d = info.get("P_d")
        if p_d is None or info.get("estado") == "N/A":
            continue  # dimension no activa (gris en la UI)
        maximo = _MAXIMO_SEGMENTO.get(dim, 95)
        if dim == "HO":
            maximo = _HO_TECHO_POR_ZONA.get(str(var("ho_zona") or ""), 90)
        # clamp defensivo: jamas mostrar mas que el tope del segmento
        # (el motor ya clamp a 95; aqui se garantiza la coherencia del
        # semaforo: "no existe 100%").
        p_d = min(float(p_d), maximo)
        banda = next(b for umbral, b in _BANDAS if p_d >= umbral)
        items.append({
            "dimension": dim,
            "P_d": round(p_d, 1),
            "banda": banda,
            "maximo_segmento": maximo,
            "en_maximo": p_d >= maximo - 0.5,
        })
    return items


def oportunidades_venta(completo):
    """Oportunidades de venta GNP para el PANEL (directiva de Carlos
    2026-08-24): por cada dimension en rojo/naranja/amarillo, el producto del
    catalogo con su rentabilidad de agente. NUNCA va al publico (la venta es
    la asesoria). Orden: urgencia primero (rojo -> amarillo) y, dentro de la
    misma urgencia, rentabilidad desc — el diagnostico manda, la comision
    enfoca."""
    items = []
    orden_banda = {"rojo": 0, "naranja": 1, "amarillo": 2}
    for s in semaforo_proteccion(completo):
        if s["banda"] == "verde":
            continue  # no se vende donde ya esta protegido
        productos = _PRODUCTO_POR_DIMENSION.get(s["dimension"], [])
        items.append({
            "dimension": s["dimension"],
            "banda": s["banda"],
            "P_d": s["P_d"],
            "productos": [{"nombre": nombre, "rentabilidad": estrellas}
                          for nombre, estrellas in productos],
            "rentabilidad_max": max((e for _, e in productos), default=0),
        })
    items.sort(key=lambda i: (orden_banda.get(i["banda"], 9),
                              -i["rentabilidad_max"]))
    return items


def proxima_pregunta(respuestas, fecha="2026-08-08"):
    """Devuelve la siguiente pregunta elegible (orden del selector) o None."""
    kb, engine = nueva_evaluacion(fecha)
    respondidas = set()
    for r in respuestas:
        respondidas.add(r["pregunta"])
    # aplica respuestas para evaluar condiciones (pipeline parcial)
    engine.evaluate(respuestas)
    seleccionadas, _ = engine.selector.plan(respondidas)
    for pid in seleccionadas:
        if pid not in respondidas:
            return _pregunta_publica(pid)
    return None


def _pregunta_publica(pid):
    kb = get_knowledge()
    for p in kb.preguntas():
        if p["id"] == pid:
            return {
                "id": p["id"],
                "texto": p["texto"],
                "dominio": p.get("dominio", {}),
                "obligatoria": p.get("obligatoria", False),
            }
    return None


def _porque(reglas_ids):
    """Construye el 'porque' de la explicacion con frases redactadas para el
    usuario (feedback de Carlos 2026-08-18: las justificaciones tecnicas del
    knowledge sonaban a 'cavernicola'). Reglas sin frase de usuario se omiten."""
    kb = get_knowledge()
    for r in kb.reglas():
        if r["id"] in reglas_ids and r["id"] in _FRASES:
            return ", porque " + _FRASES[r["id"]] + "."
    return "."


# Frases de usuario por regla (capa producto). Las reglas internas del
# modelo (notas de diseño, separaciones semanticas) no llevan frase y se
# omiten de las explicaciones.
_FRASES = {
    "R1": "tu seguro de vida no cubre los años de gasto que tus dependientes necesitarían si tú faltaras",
    "R3": "el IMSS o ISSSTE no cubre un gasto médico catastrófico ni la pérdida de ingreso: un evento mayor saldría casi todo de tu bolsillo",
    "R5": "tus gastos fijos consumen más del 60% de tu ingreso, dejando un margen muy reducido",
    "R6": "la brecha de semanas cotizadas, sin aportaciones voluntarias y con horizonte corto, compromete tu pensión",
    "R7": "tu vivienda está en una zona con riesgo natural (inundaciones, sismos o deslaves) que el seguro no elimina",
    "R11": "tus deudas fijas representan un porcentaje alto de tu ingreso",
    "R12": "tu fondo de emergencia cubre solo 3 a 6 meses de gastos, cuando lo recomendado es más",
    "R13b": "tienes un horizonte corto y una insuficiencia cuantificable en esta dimensión",
    "R13c": "el gasto de bolsillo en salud en México es alto (41.4% del gasto total) y tú absorberías la mayor parte",
    "R13d": "no tienes responsabilidad civil en tu auto y lo usas con frecuencia: un accidente con daños a terceros sería una deuda enorme",
    "R13e": "tu protección cubre menos de 5 años de gasto de tu familia",
    "R14": "tu ingreso sostiene todos tus objetivos; sin él, cada objetivo se convierte en una exposición mayor",
    "I1": "tu ingreso está concentrado en pocas fuentes y tu familia depende de él",
    "I3": "una enfermedad significaría gasto médico, pérdida de ingreso y consumo de tu ahorro al mismo tiempo",
    "I4": "estás cerca del retiro y tu saldo no alcanza el nivel recomendado",
    "I5": "tu patrimonio está concentrado en un activo poco líquido",
    "I6": "tu familia depende casi por completo del ingreso de tu negocio",
    "I7": "sin liquidez, cualquier evento inesperado consumiría tu patrimonio",
    "I8": "tus dependientes no tienen una cobertura propia que los respalde",
    "R13a": "la educación de tus hijos es un objetivo legítimo que conviene planificar con ahorro",
    "R16": "no tienes hijos, así que no hay exposición educativa actual",
    "R20": "sin hijos menores no hay exposición educativa actual",
    "R18": "tu pensión proyectada cubriría solo una parte de tu ingreso habitual",
    "R19": "con un horizonte amplio, tu retiro es un objetivo de planificación, no un riesgo actual",
    "I2": "la continuidad de tu ingreso es la que sostiene la educación de tus hijos",
    "D2": "hay información pendiente en esta dimensión que conviene completar para evaluar el riesgo real",
}


_NOMBRES = {
    "PF": "tu protección familiar", "IN": "tus ingresos", "SA": "tu salud",
    "RE": "tu retiro", "HO": "tu hogar", "MO": "tu movilidad",
    "ED": "la educación de tus hijos", "NE": "tu negocio",
}
