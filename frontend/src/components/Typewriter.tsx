/** Efecto typewriter estilo LLM para el chat de CQ Patrimonial AI.
 * El texto llega completo del motor; aqui se revela como si se estuviera
 * generando en vivo (peticion de Carlos 2026-08-18):
 *  - pausa inicial de "pensamiento" (cursor pulsando sin texto);
 *  - rafagas de 1-3 caracteres con delay variable (token streaming);
 *  - micro-pausas despues de puntuacion (. , : ; ! ? —);
 *  - cursor de generacion "▍" parpadeante mientras escribe.
 * activo=false => texto completo inmediato (click para saltar).
 * La cola de escritura la gestiona el padre (Diagnostico). */
import { useEffect, useRef, useState } from "react";

export function TypeText({ texto, activo, onTerminado }: {
  texto: string;
  activo: boolean;
  onTerminado?: () => void;
}) {
  const [n, setN] = useState(activo ? 0 : texto.length);
  const [fase, setFase] = useState<"pensando" | "escribiendo" | "listo">(
    activo ? "pensando" : "listo");
  const avisado = useRef(false);

  // Ciclo garantizado: activo=true SIEMPRE arranca pensando -> escribiendo.
  // La pausa de "pensamiento" es proporcional a la longitud (los textos
  // cortos casi no esperan).
  useEffect(() => {
    avisado.current = false;
    if (!activo) {
      setN(texto.length);
      setFase("listo");
      return;
    }
    setN(0);
    setFase("pensando");
    const pausa = texto.length >= 40 ? 260 + Math.random() * 180 : 90;
    const t = window.setTimeout(() => setFase("escribiendo"), pausa);
    return () => window.clearTimeout(t);
  }, [activo, texto]);

  // Escritura con velocidad ADAPTATIVA: la duracion objetivo esta acotada
  // (~700ms fijos + 6ms/char, max 3.2s) para que un texto largo no se
  // alargue; los cortos se sienten fluidos. Rafagas 1-4 chars con jitter.
  useEffect(() => {
    if (fase !== "escribiendo") return;
    if (n >= texto.length) {
      setFase("listo");
      return;
    }
    const restante = texto.length - n;
    const duracionObj = Math.min(3200, 700 + texto.length * 6);
    const rafaga = Math.max(1, Math.ceil(restante / (duracionObj / 16)));
    const ultimo = n > 0 ? texto[n - 1] : "";
    let delay = 10 + Math.random() * 12;
    if (/[.,:;!?—]/.test(ultimo)) delay += 40;
    const t = window.setTimeout(() => {
      setN((v) => Math.min(texto.length, v + rafaga));
    }, delay);
    return () => window.clearTimeout(t);
  }, [fase, n, texto]);

  useEffect(() => {
    if (fase === "listo" && n >= texto.length && !avisado.current) {
      avisado.current = true;
      onTerminado?.();
    }
  }, [fase, n, onTerminado, texto.length]);

  const escribiendo = activo && fase !== "listo";
  return (
    <span>
      {texto.slice(0, n)}
      {escribiendo && <span className="cq-cursor-llm" aria-hidden="true" />}
    </span>
  );
}

/** Pregunta con escritura encadenada: primero el contexto (si existe),
 * despues la pregunta. onTerminado se dispara al completar la pregunta. */
export function PreguntaEscrita({ contexto, texto, activo, onTerminado }: {
  contexto: string;
  texto: string;
  activo: boolean;
  onTerminado: () => void;
}) {
  const [ctxListo, setCtxListo] = useState(!activo || !contexto);
  useEffect(() => {
    setCtxListo(!activo || !contexto);
  }, [activo, contexto]);
  const preguntaActiva = activo && (ctxListo || !contexto);
  return (
    <>
      {contexto && (
        <p className="text-[13px] text-navy-900/65 italic mb-1.5 break-words">
          <TypeText texto={contexto} activo={activo && !ctxListo} onTerminado={() => setCtxListo(true)} />
        </p>
      )}
      <p className="font-sans text-lg sm:text-xl text-navy-900 leading-snug break-words">
        <TypeText texto={texto} activo={preguntaActiva} onTerminado={onTerminado} />
      </p>
    </>
  );
}

/** Auto-scroll: mantiene el final del chat a la vista mientras el texto crece. */
export function useAutoScroll(activo: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!activo || !ref.current) return;
    const el = ref.current;
    const ob = new ResizeObserver(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
    ob.observe(el);
    return () => ob.disconnect();
  }, [activo]);
  return ref;
}
