/** Diagnostico conversacional — identidad LLM moderna.
 * Burbujas de chat (no formulario), contexto integrado y variado (sin
 * etiquetas repetidas), transiciones por dimension como pills, indicador de
 * escritura, radar lateral con tamano acotado. El motor decide preguntas. */
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import SpiderRadar from "../components/SpiderRadar";
import { PreguntaEscrita, TypeText, useAutoScroll } from "../components/Typewriter";
import { GRUPOS, POR_QUE, SIN_CONTEXTO, eco, labelOpcion } from "../data/conversacion";

interface Pregunta { id: string; texto: string; dominio: Record<string, unknown>; obligatoria?: boolean; }
interface RadarDim { id: string; P_d: number | null; estado: string; }
type Msg =
  | { tipo: "sys"; texto: string; escrito?: boolean }
  | { tipo: "trans"; titulo: string }
  | { tipo: "q"; pregunta: Pregunta; contexto: string; escrito?: boolean }
  | { tipo: "a"; texto: string }
  | { tipo: "eco"; texto: string; escrito?: boolean };

const API = "/api/evaluations";
const TOTAL_APROX = 28; // referencia de progreso (el motor decide; tope declarado)

const PREG_DIM: Record<string, string> = {
  "IN-ING": "IN", IN1: "IN", IN2: "IN", IN3: "IN", IN4: "IN", "IN-DEUDA": "IN",
  PF1: "PF", PF2: "PF", "PF-SUMA": "PF", PF7: "PF", PF6: "PF", PF5: "PF",
  SA1: "SA", "SA-DED": "SA", SA2: "SA", SA3: "SA", SA4: "SA",
  RE1: "RE", RE2: "RE", RE3: "RE", "RE-SALDO": "RE", RE5: "RE", RE6: "RE",
  HO1: "HO", HO2: "HO", "HO-VALOR": "HO", HO3: "HO", HO4: "HO",
  MO1: "MO", MO2: "MO", MO3: "MO", MO4: "MO",
  ED1: "ED", "ED-COSTO": "ED", "ED-MONTO": "ED", ED2: "ED",
  NE1: "NE", NE2: "NE", NE3: "NE", NE4: "NE", NE5: "NE",
  "PA-TOTAL": "CTX", "INT-1": "CTX",
};

function fmtValor(valor: unknown): string {
  if (valor === null) return "Prefiero no responder";
  if (typeof valor === "boolean") return valor ? "Sí" : "No";
  if (typeof valor === "number") return new Intl.NumberFormat("es-MX").format(valor);
  if (Array.isArray(valor)) return valor.map((v) => labelOpcion(v)).join(", ");
  return labelOpcion(valor);
}

/** Formatea la entrada numerica en vivo segun el tipo (feedback de Carlos):
 * monto -> "$ 1,000" (separador de miles con coma); porcentaje -> "50%". */
function formatearEntrada(texto: string, tipo: string): string {
  const digitos = texto.replace(/[^0-9.]/g, "");
  if (!digitos) return "";
  const [ent, dec] = digitos.split(".");
  if (tipo === "monto") {
    const entFmt = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return "$ " + entFmt + (dec !== undefined ? "." + dec : "");
  }
  if (tipo === "porcentaje") return digitos + "%";
  return digitos;
}

/** Convierte la entrada formateada ("$ 1,000" | "50%") a numero puro. */
function parsearEntrada(texto: string): number {
  const limpio = texto.replace(/[^0-9.]/g, "");
  if (!limpio) return NaN;
  const n = limpio.includes(".") ? parseFloat(limpio) : parseInt(limpio, 10);
  return Number.isFinite(n) ? n : NaN;
}

function Avatar() {
  return (
    <div className="shrink-0 w-9 h-9 rounded-full bg-navy-900 flex items-center justify-center shadow-sm">
      <span className="text-gold text-xs font-bold tracking-wider">CQ</span>
    </div>
  );
}

export default function Diagnostico() {
  const nav = useNavigate();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pregunta, setPregunta] = useState<Pregunta | null>(null);
  const [radar, setRadar] = useState<RadarDim[]>([]);
  const [mensajes, setMensajes] = useState<Msg[]>([]);
  const [texto, setTexto] = useState("");
  const [multiSel, setMultiSel] = useState<string[]>([]);
  const [cargando, setCargando] = useState(false);
  const dimActual = useRef<string | null>(null);
  const [animando, setAnimando] = useState<number | null>(null); // indice del mensaje escribiendose
  const [controlesListos, setControlesListos] = useState(false);
  // CP-04: bienvenida con captura de nombre+ciudad + aviso de privacidad
  const [fase, setFase] = useState<"bienvenida" | "entrevista">("bienvenida");
  const [nombre, setNombre] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [avisoOk, setAvisoOk] = useState(false);
  const [errorBienvenida, setErrorBienvenida] = useState("");
  const [errorRespuesta, setErrorRespuesta] = useState("");
  const preguntaPendiente = useRef<Pregunta | null>(null);
  // Altura del nav (sticky, ~80px pero variable): el chat llena exactamente
  // el viewport menos nav y padding, para que la pagina NUNCA scrollee.
  const [navH, setNavH] = useState(80);
  const scrollRef = useAutoScroll(animando !== null || cargando);

  useEffect(() => {
    const h = document.querySelector("header");
    if (!h) return;
    const update = () => setNavH(h.offsetHeight);
    update();
    const ob = new ResizeObserver(update);
    ob.observe(h);
    return () => ob.disconnect();
  }, []);

  // Scroll SOLO del contenedor del chat (nunca de la pagina): scrollIntoView
  // propaga a todos los ancestros scrollables y bajaba la vista hasta el
  // footer, robando visibilidad al radar lateral.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [mensajes, cargando, animando, controlesListos]);

  useEffect(() => {
    if (!sessionId && !pregunta) {
      void (async () => {
        setCargando(true);
        const r = await fetch(`${API}/start`, { method: "POST" }).then((x) => x.json());
        setSessionId(r.session_id);
        preguntaPendiente.current = r.pregunta ?? null;
        setRadar(r.radar ?? []);
        setMensajes([{ tipo: "sys", texto: "Hola, soy CQ Patrimonial AI. Antes de empezar necesito saber cómo llamarte y desde qué ciudad me acompañas: así personalizo tu diagnóstico. Tus datos solo se usan para esto y no se comparten con nadie." }]);
        setCargando(false);
      })();
    }
  }, [sessionId, pregunta]);

  /** CP-04/CP-05: envia la captura inicial (nombre+ciudad+consentimiento)
   * y arranca la entrevista con bienvenida personalizada. */
  async function enviarCaptura() {
    if (!sessionId || !nombre.trim() || !avisoOk) return;
    setCargando(true);
    setErrorBienvenida("");
    try {
      const r = await fetch(`${API}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId, nombre: nombre.trim(), ciudad: ciudad.trim(),
          consentimiento: true, aviso_version: "v0.1",
        }),
      }).then((x) => x.json());
      if (r.error) {
        setErrorBienvenida(r.error);
        setCargando(false);
        return;
      }
      setMensajes((m) => [...m, {
        tipo: "sys",
        texto: `¡Mucho gusto, ${nombre.trim()}! Ahora sí, voy a hacerte algunas preguntas para entender tu situación patrimonial: qué está protegido, dónde estás expuesto y qué conviene revisar primero. Tómate tu tiempo: no hay respuestas correctas.`,
      }]);
      setFase("entrevista");
      setPregunta(preguntaPendiente.current);
    } catch {
      setErrorBienvenida("No se pudo guardar tu información. Intenta de nuevo.");
    }
    setCargando(false);
  }

  useEffect(() => {
    if (!pregunta) return;
    const dim = PREG_DIM[pregunta.id] ?? "CTX";
    const nuevos: Msg[] = [];
    if (dim !== dimActual.current) {
      nuevos.push({ tipo: "trans", titulo: GRUPOS[dim]?.titulo ?? dim });
      dimActual.current = dim;
    }
    const contexto = SIN_CONTEXTO.includes(pregunta.id) ? "" : (POR_QUE[pregunta.id] ?? "");
    nuevos.push({ tipo: "q", pregunta, contexto });
    setMensajes((m) => [...m, ...nuevos]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pregunta?.id]);

  // Cola de escritura: el primer mensaje del asistente sin escribir se anima;
  // al terminar pasa al siguiente. Los controles aparecen cuando todo termino.
  useEffect(() => {
    if (animando !== null) return;
    const idx = mensajes.findIndex(
      (m) => m.tipo !== "a" && m.tipo !== "trans" && !(m as { escrito?: boolean }).escrito
    );
    if (idx === -1) {
      setControlesListos(true);
      return;
    }
    setControlesListos(false);
    setAnimando(idx);
  }, [mensajes, animando]);

  function terminarAnimacion(idx: number) {
    setMensajes((m) => m.map((mm, i) => (i === idx ? { ...mm, escrito: true } : mm)));
    setAnimando(null);
  }

  async function responder(valor: unknown, confianza = "alta") {
    if (!sessionId || !pregunta) return;
    setCargando(true);
    setErrorRespuesta("");
    const r = await fetch(`${API}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, pregunta: pregunta.id, valor, confianza }),
    }).then((x) => x.json());
    if (r.error) {
      // validacion del backend (p. ej. semanas maximas): se queda en la
      // misma pregunta y muestra el motivo.
      setErrorRespuesta(r.error);
      setCargando(false);
      return;
    }
    const nuevos: Msg[] = [{ tipo: "a", texto: fmtValor(valor) }];
    const ec = eco(pregunta.id, valor);
    if (ec) nuevos.push({ tipo: "eco", texto: ec });
    setMensajes((m) => [...m, ...nuevos]);
    setPregunta(r.pregunta ?? null);
    setRadar(r.radar ?? []);
    setTexto("");
    setMultiSel([]);
    setCargando(false);
  }

  if (!pregunta && mensajes.length > 0 && fase === "entrevista") {
    void nav("/diagnostico/resultado", { state: { sesion: sessionId, nombre } });
  }

  const d = (pregunta?.dominio ?? {}) as { tipo?: string; opciones?: (string | number)[]; multi?: string[]; max?: number; min?: number };
  const esMulti = Array.isArray(d.multi);
  const esOpciones = Array.isArray(d.opciones);
  const esBool = d.tipo === "bool";
  const esNumero = ["monto", "meses", "edad", "semanas", "porcentaje", "conteo"].includes(d.tipo ?? "");
  const esTexto = d.tipo === "texto";
  // Validacion de maximo (p. ej. semanas cotizadas segun la edad): el
  // backend envia d.max en el dominio cuando puede calcularlo.
  const validoNumerico = parsearEntrada(texto);
  const excedeMax = !Number.isNaN(validoNumerico) && d.max != null && validoNumerico > d.max;
  const progreso = Math.min(100, Math.round((mensajes.filter((m) => m.tipo === "a").length / TOTAL_APROX) * 100));
  const respuestas = mensajes.filter((m) => m.tipo === "a").length;

  return (
    <div className="h-dvh overflow-hidden bg-cream">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 grid md:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
        <div className="bg-white rounded-2xl border border-navy-900/10 shadow-soft flex flex-col overflow-hidden"
             style={{ height: `calc(100dvh - ${navH + 32}px)`, minHeight: "480px" }}>
          {/* cabecera */}
          <div className="px-5 py-3.5 border-b border-navy-900/10 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar />
              <div className="min-w-0">
                <p className="font-sans text-base text-navy-900 truncate">CQ Patrimonial AI</p>
                <p className="text-[11px] text-navy-900/60 flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${cargando || animando !== null ? "bg-gold animate-pulse" : "bg-emerald-500"}`} />
                  {cargando || animando !== null ? "Escribiendo…" : "En línea"}
                </p>
              </div>
            </div>
            <button onClick={() => void nav("/diagnostico/resultado", { state: { sesion: sessionId, nombre } })}
                    disabled={respuestas === 0}
                    className="shrink-0 text-xs bg-navy-900 text-white rounded-full px-4 py-2 font-semibold hover:bg-navy-900/90 transition disabled:opacity-40">
              Ver mi diagnóstico
            </button>
          </div>
          {/* progreso */}
          <div className="px-5 pt-3">
            <div className="h-1 rounded-full bg-navy-900/10 overflow-hidden">
              <div className="h-full bg-gold transition-all duration-500" style={{ width: `${progreso}%` }} />
            </div>
            <p className="text-[10px] text-navy-900/45 mt-1">
              {respuestas === 0 ? "Sin respuestas aún" : `${respuestas} preguntas respondidas`}
            </p>
          </div>
          {/* mensajes */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-4 space-y-4" id="chat-scroll" ref={scrollRef}>
            {mensajes.map((m, i) => {
              const activo = i === animando;
              if (m.tipo === "sys")
                return (
                  <div key={i} className="flex gap-2.5 max-w-[88%]">
                    <Avatar />
                    <div onClick={activo ? () => terminarAnimacion(i) : undefined}
                         className={`bg-cream rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-navy-900/90 break-words ${activo ? "cursor-pointer" : ""}`}>
                      <TypeText texto={m.texto} activo={activo} onTerminado={() => terminarAnimacion(i)} />
                    </div>
                  </div>
                );
              if (m.tipo === "trans")
                return (
                  <div key={i} className="flex justify-center">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-navy-900/55 bg-navy-900/5 rounded-full px-3.5 py-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-gold" /> {m.titulo}
                    </span>
                  </div>
                );
              if (m.tipo === "a")
                return (
                  <div key={i} className="flex justify-end">
                    <div className="bg-navy-900 text-white rounded-2xl rounded-br-sm px-4 py-2.5 text-sm max-w-[75%] break-words shadow-sm">{m.texto}</div>
                  </div>
                );
              if (m.tipo === "eco")
                return (
                  <div key={i} className="flex gap-2.5 max-w-[88%]">
                    <Avatar />
                    <div onClick={activo ? () => terminarAnimacion(i) : undefined}
                         className={`bg-gold-soft rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm text-navy-900/80 break-words ${activo ? "cursor-pointer" : ""}`}>
                      <TypeText texto={m.texto} activo={activo} onTerminado={() => terminarAnimacion(i)} />
                    </div>
                  </div>
                );
              // pregunta: contexto + texto con escritura encadenada; controles solo en la activa al terminar
              const esActiva = m.pregunta.id === pregunta?.id;
              return (
                <div key={i} className="flex gap-2.5 max-w-full">
                  <Avatar />
                  <div onClick={activo ? () => terminarAnimacion(i) : undefined}
                       className={`bg-cream rounded-2xl rounded-tl-sm px-4 sm:px-5 py-3.5 max-w-full min-w-0 ${activo ? "cursor-pointer" : ""}`}>
                    <PreguntaEscrita contexto={m.contexto} texto={m.pregunta.texto} activo={activo}
                                      onTerminado={() => terminarAnimacion(i)} />
                    {esActiva && controlesListos && (
                      <div className="mt-3 space-y-2.5">
                      {esOpciones && (
                        <div className="flex flex-wrap gap-2">
                          {(d.opciones as (string | number)[]).map((op) => (
                            <button key={String(op)} onClick={() => void responder(op)}
                                    className="bg-white border border-navy-900/15 rounded-full px-4 py-2 text-sm text-navy-900 hover:border-gold hover:shadow-sm transition break-words">
                              {labelOpcion(op)}
                            </button>
                          ))}
                        </div>
                      )}
                      {esMulti && (
                        <div className="flex flex-wrap gap-2">
                          {(d.multi as string[]).map((op) => (
                            <button key={op}
                                    onClick={() => setMultiSel((s) => {
                                      // exclusividad: "ninguno"/"nadie" no
                                      // conviven con otras opciones (feedback
                                      // de Carlos 2026-08-18)
                                      const exclusivas = new Set(["ninguno", "nadie"]);
                                      if (exclusivas.has(op)) {
                                        return s.includes(op) ? [] : [op];
                                      }
                                      const sinExclusiva = s.filter((x) => !exclusivas.has(x));
                                      return sinExclusiva.includes(op)
                                        ? sinExclusiva.filter((x) => x !== op)
                                        : [...sinExclusiva, op];
                                    })}
                                    className={`rounded-full px-4 py-2 text-sm border transition break-words ${multiSel.includes(op) ? "bg-navy-900 text-white border-navy-900" : "bg-white border-navy-900/15 text-navy-900"}`}>
                              {labelOpcion(op)}
                            </button>
                          ))}
                          <button onClick={() => void responder(multiSel)} disabled={multiSel.length === 0}
                                  className="bg-gold text-navy-900 rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-40 transition">
                            Continuar
                          </button>
                        </div>
                      )}
                      {esBool && (
                        <div className="flex gap-2">
                          <button onClick={() => void responder(true)} className="flex-1 bg-white border border-navy-900/15 rounded-full px-4 py-2 text-sm hover:border-gold transition">Sí</button>
                          <button onClick={() => void responder(false)} className="flex-1 bg-white border border-navy-900/15 rounded-full px-4 py-2 text-sm hover:border-gold transition">No</button>
                        </div>
                      )}
                      {esNumero && (
                        <div className="space-y-1.5">
                          <div className="flex gap-2 max-w-full">
                            <input value={texto}
                                   onChange={(e) => setTexto(formatearEntrada(e.target.value, d.tipo ?? ""))}
                                   inputMode="numeric"
                                   placeholder={d.tipo === "monto" ? "$ 0" : d.tipo === "porcentaje" ? "0%" : d.tipo === "meses" ? "Número de meses" : d.tipo === "semanas" ? "Número de semanas" : d.tipo === "edad" ? "Edad" : d.tipo === "conteo" ? "Cantidad" : "Valor"}
                                   className="flex-1 min-w-0 bg-white border border-navy-900/15 rounded-full px-4 py-2 text-sm focus:border-gold focus:outline-none" />
                            <button onClick={() => { const n = parsearEntrada(texto); if (!Number.isNaN(n)) void responder(n); }}
                                    disabled={Number.isNaN(parsearEntrada(texto)) || excedeMax}
                                    className="shrink-0 bg-navy-900 text-white rounded-full px-5 py-2 text-sm disabled:opacity-40 transition">
                              Enviar
                            </button>
                          </div>
                          {excedeMax && d.max != null && (
                            <p className="text-xs text-red">
                              {d.tipo === "semanas"
                                ? `Ese número no es posible: el máximo de semanas cotizadas según tu edad es ${d.max.toLocaleString("es-MX")}.`
                                : `El máximo permitido es ${d.max.toLocaleString("es-MX")}.`}
                            </p>
                          )}
                          {!excedeMax && d.max != null && (
                            <p className="text-[10px] text-navy-900/45">
                              {d.tipo === "semanas"
                                ? `Máximo ${d.max.toLocaleString("es-MX")} semanas según tu edad`
                                : `Máximo ${d.max.toLocaleString("es-MX")}`}
                            </p>
                          )}
                        </div>
                      )}
                      {esTexto && (
                        <div className="flex gap-2 max-w-full">
                          <input value={texto} onChange={(e) => setTexto(e.target.value)} type="text"
                                 placeholder="Escribe tu respuesta"
                                 onKeyDown={(e) => { if (e.key === "Enter" && texto.trim()) { const t = texto.trim(); void responder(t); } }}
                                 className="flex-1 min-w-0 bg-white border border-navy-900/15 rounded-full px-4 py-2 text-sm focus:border-gold focus:outline-none" />
                          <button onClick={() => { const t = texto.trim(); if (t) void responder(t); }}
                                  disabled={texto.trim() === ""} className="shrink-0 bg-navy-900 text-white rounded-full px-5 py-2 text-sm disabled:opacity-40 transition">
                            Enviar
                          </button>
                        </div>
                      )}
                      <button onClick={() => void responder(null, "no_se")}
                              className="text-xs text-navy-900/60 underline underline-offset-2">
                        No sé / Prefiero no responder
                      </button>
                      {errorRespuesta && (
                        <p className="text-xs text-red bg-red/5 rounded-lg px-3 py-2">
                          {errorRespuesta}
                        </p>
                      )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {cargando && (
              <div className="flex gap-2.5">
                <Avatar />
                <div className="bg-cream rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-navy-900/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-navy-900/40 animate-bounce" style={{ animationDelay: "120ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-navy-900/40 animate-bounce" style={{ animationDelay: "240ms" }} />
                </div>
              </div>
            )}
            {/* CP-04: captura de nombre+ciudad + aviso de privacidad, al
                terminar de escribir el saludo */}
            {fase === "bienvenida" && controlesListos && (
              <div className="flex gap-2.5 max-w-[88%]">
                <Avatar />
                <div className="bg-cream rounded-2xl rounded-tl-sm px-4 py-3.5 flex-1">
                  <div className="space-y-2.5">
                    <input value={nombre} onChange={(e) => setNombre(e.target.value)}
                           placeholder="Tu nombre"
                           className="w-full bg-white border border-navy-900/15 rounded-full px-4 py-2 text-sm focus:border-gold focus:outline-none" />
                    <input value={ciudad} onChange={(e) => setCiudad(e.target.value)}
                           placeholder="Tu ciudad (opcional)"
                           className="w-full bg-white border border-navy-900/15 rounded-full px-4 py-2 text-sm focus:border-gold focus:outline-none" />
                    <details className="text-xs text-navy-900/60">
                      <summary className="cursor-pointer underline underline-offset-2">
                        Aviso de privacidad
                      </summary>
                      <p className="mt-1.5 leading-relaxed">
                        CQ Patrimonial AI usa tus datos (nombre, ciudad y las respuestas del
                        diagnóstico) únicamente para elaborar tu diagnóstico patrimonial y,
                        si lo pides, para que un asesor te contacte. No se comparten con
                        terceros ni se usan para publicidad. Puedes pedir la eliminación de
                        tus datos en cualquier momento.
                      </p>
                      <p className="mt-2 leading-relaxed">
                        Los resultados de este diagnóstico se basan en fuentes públicas y de
                        la industria (estadísticas oficiales, metodologías de retiro y
                        parámetros de aseguradoras) y en la información que compartiste.
                        NO constituyen un diagnóstico real ni asesoría financiera: la IA
                        intenta acercarse lo más posible a tu situación, pero el diagnóstico
                        definitivo y las recomendaciones siempre deben venir de un asesor
                        patrimonial humano.
                      </p>
                    </details>
                    <label className="flex items-start gap-2 text-xs text-navy-900/70 cursor-pointer">
                      <input type="checkbox" checked={avisoOk} onChange={(e) => setAvisoOk(e.target.checked)}
                             className="mt-0.5 accent-navy-900" />
                      Acepto el aviso de privacidad
                    </label>
                    {errorBienvenida && (
                      <p className="text-xs text-red">{errorBienvenida}</p>
                    )}
                    <button onClick={() => void enviarCaptura()}
                            disabled={!nombre.trim() || !avisoOk || cargando}
                            className="w-full bg-navy-900 text-white rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-40 transition">
                      Comenzar diagnóstico
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* radar lateral: tamano acotado */}
        <aside className="hidden md:block sticky top-4">
          <div className="bg-white rounded-2xl border border-navy-900/10 shadow-soft p-4">
            <p className="text-xs text-navy-900/60 mb-2 flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${respuestas === 0 ? "bg-navy-900/20" : "bg-gold"}`} />
              {respuestas === 0 ? "Tu nivel de protección se construirá aquí" : "Tu nivel de protección, en tiempo real"}
            </p>
            <SpiderRadar valores={Object.fromEntries(radar.map((x) => [x.id, x.P_d]))}
                         estados={Object.fromEntries(radar.map((x) => [x.id, x.estado]))} />
            <p className="text-[10px] text-navy-900/60 mt-2 text-center">
              {respuestas === 0 ? "Cada respuesta actualiza tu radar" : "Las áreas en gris aún no se evalúan o no aplican"}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
