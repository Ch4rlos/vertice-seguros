/** Conversacion: contenido narrativo de CQ Patrimonial AI (capa UX).
 * El motor NO se modifica: esta capa explica POR QUE se pregunta, recuerda
 * lo aprendido (ecos) y da storytelling al diagnostico.
 * Fuente de verdad de datos: motor (knowledge v0.3.2). */

/** Etiquetas publicitarias (referencia visual: publicidad CQ Patrimonial AI). */
export const AD_LABELS: Record<string, string> = {
  PF: "FAMILIA",
  IN: "INGRESOS",
  SA: "SALUD",
  RE: "RETIRO",
  HO: "HOGAR",
  MO: "AUTOMÓVIL",
  ED: "EDUCACIÓN",
  NE: "NEGOCIO",
};

/** Orden de ejes del radar (sentido horario desde arriba) — replica la publicidad. */
export const AD_ORDER = ["PF", "SA", "IN", "RE", "ED", "NE", "HO", "MO"];

/** Grupos de la entrevista (orden narrativo; el orden de preguntas vive en el JSON). */
export const GRUPOS: Record<string, { titulo: string; entrada: string }> = {
  IN: { titulo: "Tus ingresos", entrada: "Para dimensionar cualquier riesgo patrimonial, primero necesito entender cómo se sostiene tu flujo de ingresos." },
  PF: { titulo: "Tu familia", entrada: "Ya entiendo cómo se sostiene actualmente tu flujo de ingresos. Ahora quiero revisar qué impacto tendría una interrupción de ese ingreso sobre tu familia." },
  SA: { titulo: "Tu salud", entrada: "Revisemos ahora tu protección médica: en México una parte importante del gasto en salud sale del bolsillo de las familias, así que conviene ver qué tan cubierto estás." },
  RE: { titulo: "Tu retiro", entrada: "Pasemos a tu retiro. Lo que hagas hoy define la pensión que tendrás, así que quiero revisar tu situación actual." },
  HO: { titulo: "Tu hogar", entrada: "Revisemos tu patrimonio inmobiliario: la vivienda suele ser el activo más grande de una familia." },
  MO: { titulo: "Tu movilidad", entrada: "Y ahora tu movilidad: un automóvil es un activo, pero también una fuente de responsabilidad frente a terceros." },
  ED: { titulo: "La educación de tus hijos", entrada: "Hablemos de los objetivos que quieres financiar, como la educación de tus hijos." },
  NE: { titulo: "Tu negocio", entrada: "Si tienes un negocio, quiero revisar qué tan dependiente está tu patrimonio de él." },
  CTX: { titulo: "Panorama general", entrada: "Para cerrar, un par de datos de contexto sobre tu patrimonio total." },
};

/** POR QUE se pregunta cada cosa. El texto es el CONTEXTO natural del experto:
 * se muestra integrado en el mensaje, SIN etiqueta fija tipo "Por que lo
 * pregunto". Preguntas auto-evidentes (SIN_CONTEXTO) no llevan contexto para
 * que la conversacion varie. */
export const POR_QUE: Record<string, string> = {
  "IN-ING": "Necesito conocer el flujo que sostiene tu patrimonio: cualquier interrupción se dimensiona contra esta base.",
  IN1: "La cantidad de fuentes de ingreso define qué tan concentrado está tu flujo: una sola fuente es más frágil.",
  IN2: "La estabilidad de tu ingreso principal cambia la probabilidad de una interrupción.",
  IN3: "Tus gastos fijos definen cuánto necesitas para mantener tu vida actual si el ingreso se detiene.",
  IN4: "El fondo de emergencia es tu primera línea de defensa: en México se recomienda cubrir de 3 a 6 meses de gastos.",
  "IN-DEUDA": "Las deudas fijas compiten por tu ingreso; su peso determina tu margen de maniobra.",
  PF1: "Si tú faltaras, hay personas cuya estabilidad depende de tu ingreso. Eso define la exposición más importante del diagnóstico.",
  PF2: "Cuando un solo ingreso sostiene a varias personas, el riesgo se concentra en una sola persona.",
  "PF-SUMA": "No basta con tener un seguro: la pregunta real es si el capital disponible cubriría los años de gasto de tu familia.",
  PF7: "Una incapacidad temporal es más frecuente de lo que se cree: el ingreso se detiene, pero los gastos no.",
  PF6: "Sin un testamento, tu familia podría enfrentar juicios largos para acceder a lo que les corresponde.",
  PF5: "Un seguro con beneficiarios desactualizados puede no llegar a quien realmente lo necesita.",
  SA1: "La cobertura médica determina cuánto de un gasto catastrófico saldría de tu bolsillo.",
  "SA-DED": "El deducible es lo que pagas de tu bolsillo antes de que el seguro responda: conviene saber si puedes absorberlo.",
  SA2: "Un gasto médico mayor no cubierto puede consumir años de ahorro en semanas.",
  SA3: "La edad modula los riesgos de salud y también tu horizonte de retiro.",
  SA4: "Las condiciones crónicas cambian la frecuencia y magnitud del gasto médico esperado.",
  RE1: "Tu régimen de pensión define las reglas del juego: Ley 97 y Ley 73 son mundos distintos.",
  RE2: "Las semanas cotizadas son el requisito duro de tu pensión; la brecha contra lo requerido es medible.",
  RE3: "La edad a la que planeas retirarte define cuántos años tendrá que financiar tu ahorro.",
  "RE-SALDO": "Tu saldo actual es el punto de partida de todo el cálculo de retiro.",
  RE5: "Las aportaciones voluntarias son la palanca más directa para mejorar tu pensión.",
  RE6: "Otros activos (inversiones, inmuebles) complementan o sustituyen a la Afore.",
  HO1: "Si la vivienda es tuya, es un activo que proteger; si es rentada, el riesgo es de flujo, no de patrimonio.",
  HO2: "El pago mensual de tu vivienda forma parte de tus gastos fijos.",
  "HO-VALOR": "El valor del inmueble dimensiona cuánto patrimonio hay en juego.",
  HO3: "La ubicación importa: en zonas de riesgo natural, ni el mejor seguro elimina la exposición.",
  HO4: "El seguro de hogar protege tanto la estructura como lo que hay dentro.",
  MO1: "Si no tienes automóvil, no hay exposición de movilidad que evaluar.",
  MO2: "La frecuencia de uso cambia la probabilidad de un siniestro.",
  MO3: "Si dependes del auto para trabajar, su pérdida impacta directamente tu ingreso.",
  MO4: "Sin cobertura de responsabilidad civil, un accidente con daños a terceros puede ser una deuda enorme.",
  ED1: "La educación de los hijos es un objetivo legítimo; primero reviso si la carga existe.",
  "ED-COSTO": "El costo anual de la universidad dimensiona el objetivo educativo.",
  "ED-MONTO": "Lo ahorrado para su educación define qué tan avanzado está el objetivo frente al costo total de la carrera.",
  ED2: "La forma de financiamiento define si el objetivo está planificado o depende del ingreso corriente.",
  NE1: "El negocio puede ser tu mayor activo... o tu mayor concentración de riesgo.",
  NE2: "El porcentaje del ingreso que viene del negocio indica cuánto depende tu familia de él.",
  NE3: "Si el negocio no opera sin ti, su valor desaparece junto con tu capacidad de trabajar.",
  NE4: "Los seguros del negocio protegen la continuidad de la operación.",
  NE5: "Mezclar patrimonio personal y empresarial expone a tu familia a las deudas del negocio.",
  "PA-TOTAL": "El patrimonio total es contexto: ayuda a entender liquidez y concentración, no suma puntos.",
  "INT-1": "Tu intención orienta la conversación; el diagnóstico se hace sobre tu situación real, no sobre lo que vienes a buscar.",
};

/** Preguntas auto-evidentes que NO llevan linea de contexto (variedad natural). */
export const SIN_CONTEXTO: string[] = ["SA3", "SA4", "MO2", "NE1", "ED1", "HO1", "PF2", "RE3", "MO3"];

/** Ecos: el sistema demuestra que escucho (memoria visible). */
/** Etiquetas autoexplicativas de opciones: el usuario no debe inferir nada.
 * Las keys internas del knowledge (gmm_individual, rc_limitada, ley97...)
 * se persisten en BD; aqui se traducen a texto completo para la UI. */
export const LABELS_OPCIONES: Record<string, string> = {
  // IN2 — origen del ingreso
  nomina: "Nómina (sueldo fijo de un empleador)",
  honorarios: "Honorarios (trabajo independiente)",
  variable: "Variable (comisiones o ventas)",
  informal: "Informal (sin contrato)",
  // PF1 — dependientes
  hijos_menores: "Hijos menores de edad",
  coyuge: "Cónyuge",
  padres_mayores: "Padres mayores",
  otros: "Otros dependientes",
  nadie: "Nadie",
  // PF5 — beneficiarios
  si: "Sí, en todos",
  parcial: "En algunos",
  n_a: "No aplica",
  // PF6 — herencia
  testamento_vigente: "Sí, tengo testamento vigente",
  solo_designaciones: "Solo designaciones de beneficiarios",
  nada: "Nada preparado",
  // PF7 — incapacidad
  cobertura_propia: "Tengo un seguro que cubre mis ingresos",
  solo_imss: "Solo lo del IMSS",
  // SA1 — cobertura de salud (jerga GMM/seguro social)
  gmm_individual: "Seguro de Gastos Médicos Mayores propio",
  gmm_colectivo: "Gastos Médicos Mayores colectivo (empresa o familiar)",
  imss_issste: "IMSS o ISSSTE (seguro social)",
  imss_bienestar: "IMSS-Bienestar o programa público",
  ninguna: "Ninguna",
  // SA2 — gasto mayor no cubierto
  con_ahorros: "Sí, con mis ahorros",
  no: "No",
  // SA4 — condiciones cronicas
  controladas: "Sí, controladas",
  sin_control: "Sí, sin control",
  // RE1 — regimen de pension (jerga leyes IMSS/ISSSTE)
  ley73: "IMSS Ley 1973 (cotizas desde antes de julio de 1997)",
  ley97: "IMSS Ley 1997 (cotizas desde julio de 1997 o después)",
  issste2007: "ISSSTE Ley 2007",
  cuenta_propia: "Cuenta propia (no cotizo en IMSS ni ISSSTE)",
  no_se: "No lo sé",
  // RE5 — aportaciones voluntarias
  recurrentes: "Sí, cada mes",
  esporadicas: "De vez en cuando",
  // RE6 — activos de retiro
  inversiones: "Inversiones",
  inmuebles: "Inmuebles",
  negocio: "Negocio propio",
  ninguno: "Ninguno",
  // HO1 — vivienda
  propia: "Propia (sin deuda)",
  propia_hipoteca: "Propia, con hipoteca",
  renta: "Renta",
  prestada: "Prestada",
  compartida: "Compartida",
  // HO3 — zona de riesgo
  no_conocida: "No lo sé",
  moderada: "Riesgo moderado",
  alta: "Riesgo alto",
  // HO4 — seguro de casa (estructura/contenido)
  estructura: "Solo la estructura (paredes y techo)",
  contenido: "Solo el contenido (muebles y objetos)",
  ambos: "Estructura y contenido",
  // MO2 — uso del auto
  diario: "Todos los días",
  ocasional: "Algunas veces a la semana",
  rara_vez: "Rara vez",
  // MO4 — cobertura del auto (jerga RC)
  amplia: "Cobertura amplia (daños a mi auto y a terceros)",
  rc_limitada: "Solo responsabilidad civil (daños a terceros)",
  // ED1 — hijos
  menores: "Sí, hijos menores",
  mayores: "Sí, hijos mayores",
  // ED2 — financiamiento universitario
  instrumento: "Con un instrumento de ahorro o inversión (plan educativo)",
  ingreso_corriente: "Con mi ingreso de cada mes",
  sin_definir: "Aún no lo defino",
  // NE3 — negocio sin ti
  equipo: "Sí, mi equipo puede operar sin mí",
  // INT-1 es texto libre; no aplica.
};

export function labelOpcion(key: unknown): string {
  const k = String(key);
  return LABELS_OPCIONES[k] ?? k.replace(/_/g, " ");
}

export function eco(pregunta: string, valor: unknown): string | null {
  switch (pregunta) {
    case "IN4": {
      const m = valor as number;
      if (m >= 6) return "Excelente: tener seis o más meses de gastos cubiertos es una base sólida de liquidez.";
      if (m >= 3) return "Bien: tres a seis meses de fondo es lo recomendado; vamos a ver el resto del panorama.";
      return "Entendido: con menos de tres meses de fondo, una interrupción de ingresos pondría en riesgo tus gastos muy rápido. Eso es justo lo que conviene revisar.";
    }
    case "PF1": {
      const v = valor as string[];
      if (Array.isArray(v) && v.length > 0 && v[0] !== "nadie")
        return `Perfecto. Entonces tienes ${v.length === 1 ? "una persona" : v.length + " personas"} que dependen económicamente de ti.`;
      return "Entendido: no hay personas que dependan económicamente de ti en este momento.";
    }
    case "PF-SUMA": {
      const s = valor as number;
      if (!s || s <= 0) return "Entendido: hoy no hay un capital asegurado que proteja a tu familia en caso de que faltaras.";
      return `Anotado: un capital asegurado de ${new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(s)}. Ahora veamos si cubre los años que tu familia necesitaría.`;
    }
    case "MO4": {
      if (valor === "ninguna") return "Ojo: sin cobertura, un accidente con daños a terceros recae por completo sobre tu bolsillo.";
      if (valor === "amplia") return "Bien: cobertura amplia protege tanto tu auto como los daños que puedas causar.";
      return "Anotado: cobertura limitada protege a terceros, pero no los daños de tu propio vehículo.";
    }
    default:
      return null;
  }
}

/** Storytelling del resultado: interpretacion por dimension prioritaria. */
export const STORY: Record<string, string> = {
  PF: "Encontramos una vulnerabilidad importante en la protección de tu familia. Actualmente existen personas que dependen de tus ingresos y la protección disponible no cubriría adecuadamente una interrupción prolongada. Esta es la principal situación que conviene revisar.",
  IN: "La vulnerabilidad principal está en tu flujo de ingresos: el margen entre lo que entra y lo que sale, o la liquidez disponible, no resistiría una interrupción prolongada. Esta es la base de todo lo demás.",
  SA: "Existe una exposición relevante en tu salud: un gasto médico mayor podría salir en gran parte de tu bolsillo y consumir tus ahorros. Conviene revisar la cobertura con la que cuentas hoy.",
  RE: "Tu retiro presenta una brecha importante: con los recursos y semanas actuales, la pensión estimada no cubriría tu nivel de vida. Cuanto antes se cierre esa brecha, más barata es.",
  HO: "Tu vivienda concentra una parte importante de tu patrimonio y existe exposición que conviene revisar: seguro, deuda o ubicación en zona de riesgo.",
  MO: "Tu automóvil representa una exposición seria: un accidente con daños a terceros, sin cobertura adecuada, puede convertirse en una deuda de cientos de miles de pesos. Vale la pena resolver esto cuanto antes.",
  ED: "La educación de tus hijos es un objetivo legítimo, pero en tu situación no es la exposición más urgente: primero conviene proteger la capacidad de generar los ingresos que la sostienen.",
  NE: "Tu patrimonio depende en gran medida de tu negocio: si el negocio se detiene, se detiene todo. La continuidad y la separación patrimonial son la clave aquí.",
};

export const STORY_SOLIDO =
  "Tu estructura patrimonial presenta un nivel de protección sólido. No identificamos una vulnerabilidad crítica, aunque siempre hay oportunidades de optimización que podemos revisar.";

export const COPY_CTA =
  "Ya tenemos una primera lectura de tu situación patrimonial. Si quieres, podemos revisar estos resultados juntos y determinar qué alternativas tienen sentido para ti.";

export const LIMITE_DIAGNOSTICO =
  "El diagnóstico identifica tus principales exposiciones y prioridades. El siguiente paso es revisar estos hallazgos contigo para determinar la estrategia adecuada para tu situación.";
