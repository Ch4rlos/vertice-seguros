/** Resultado del diagnostico — Puente de Conversión (CP-06..CP-11).
 * 1. RESUMEN (CP-06): banda + radar + fortalezas + prioridad principal
 *    (sin montos) + objetivos + oportunidades. El usuario recibe valor
 *    inmediato, sin datos sensibles.
 * 2. GATING (CP-07): "Ver mi diagnóstico completo" pide SOLO teléfono
 *    (10 digitos MX, normalizado en backend) + correo opcional.
 * 3. DETALLE (CP-08): todas las prioridades con brechas y montos,
 *    estrategia, dimensiones P/R/estado (semantica del motor intacta).
 * 4. PUENTE (CP-09/CP-11): CTA unico "Quiero revisar mi diagnóstico con
 *    Carlos" -> WhatsApp con mensaje contextualizado + registro del clic.
 * 5. COMPARTIR (CP-10): token anonimo de solo lectura.
 */
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import SpiderRadar from "../components/SpiderRadar";
import SemaforoUrgencia from "../components/SemaforoUrgencia";
import type { BanderaUrgencia } from "../components/SemaforoUrgencia";
import { SemaforoProteccion } from "../components/SemaforoProteccion";
import type { ItemProteccion } from "../components/SemaforoProteccion";
import { SITE } from "../data/site";
import { AD_LABELS, STORY, STORY_SOLIDO } from "../data/conversacion";

const API = "/api/evaluations";
const CTA_EXACTO = "Quiero revisar mi diagnóstico con Carlos";

interface DiagnosticoPublico {
  estado_general: { banda: string | null };
  dimensiones: { id: string; P_d: number | null; estado: string }[];
  prioridades: { orden: number; dimension: string; estado: string; explicacion: string; brechas: { concepto: string; monto_mxn?: number }[] }[];
  objetivos: string[];
  oportunidades: string[];
  estrategia?: string[];
  intencion?: string | null;
  banderas_urgencia?: BanderaUrgencia[];
  semaforo_proteccion?: ItemProteccion[];
}

const NOMBRES: Record<string, string> = {
  PF: "Protección familiar", IN: "Ingresos", SA: "Salud", RE: "Retiro",
  HO: "Hogar", MO: "Movilidad", ED: "Educación", NE: "Negocio",
};
const ETIQUETA_BANDA: Record<string, string> = {
  BAJO: "Bajo", MEDIO: "Medio", ALTO: "Alto",
};

// Estados del motor traducidos a lenguaje de producto (el prospecto no ve
// NECESIDAD/RIESGO/OBJETIVO crudos — paseo on-rails, directiva 2026-08-25).
const ESTADO_NATURAL: Record<string, string> = {
  NECESIDAD: "Necesita atención",
  RIESGO: "En riesgo",
  OBJETIVO: "Objetivo",
  OPORTUNIDAD: "Con oportunidad",
  "N/A": "No aplica",
  DESCONOCIDO: "Por confirmar",
};

export default function Resultado() {
  const location = useLocation();
  const nav = useNavigate();
  const [diag, setDiag] = useState<DiagnosticoPublico | null>(null);
  const [error, setError] = useState("");
  const [sesion, setSesion] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  // CP-07: gating con SOLO telefono (+ correo opcional)
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");
  const [desbloqueado, setDesbloqueado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorDesbloqueo, setErrorDesbloqueo] = useState("");
  // CP-10: compartido anonimo
  const [compartidoUrl, setCompartidoUrl] = useState("");
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    const st = location.state as { sesion?: string; nombre?: string } | null;
    const sid = st?.sesion ?? localStorage.getItem("cq_session");
    const nom = st?.nombre ?? "";
    setNombre(nom);
    localStorage.setItem("cq_nombre", nom);
    if (!sid) {
      setError("No se encontró una sesión de diagnóstico. Inicia una nueva desde la página principal.");
      return;
    }
    setSesion(sid);
    fetch(`${API}/finalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sid }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error("No se pudo completar el diagnóstico");
        return r.json();
      })
      .then((d) => setDiag(d.diagnostico))
      .catch((e) => setError(e.message));
  }, [location.state]);

  /** CP-07: desbloquea el detalle completo con SOLO telefono (+correo opcional). */
  async function desbloquear() {
    if (!sesion) return;
    setGuardando(true);
    setErrorDesbloqueo("");
    const r = await fetch(`${API}/prospectos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sesion, telefono: telefono.trim(), correo: correo.trim() || undefined }),
    });
    const d = await r.json();
    setGuardando(false);
    if (!r.ok) {
      setErrorDesbloqueo(d.error ?? "No se pudo verificar tu teléfono.");
      return;
    }
    setDesbloqueado(true);
  }

  /** CP-09: mensaje contextualizado para el puente de WhatsApp. */
  function mensajeWhatsApp(): string {
    const partes: string[] = [];
    partes.push(`Hola Carlos, soy ${nombre || "quien acaba de realizar su diagnóstico"}.`);
    partes.push("Acabo de realizar mi diagnóstico patrimonial y quiero revisarlo contigo.");
    if (diag?.prioridades?.[0]) {
      partes.push(`Mi principal prioridad es ${AD_LABELS[diag.prioridades[0].dimension] ?? NOMBRES[diag.prioridades[0].dimension] ?? diag.prioridades[0].dimension}.`);
    }
    if (diag?.intencion) {
      partes.push(`Te comento: ${diag.intencion}`);
    }
    return partes.join(" ");
  }

  /** CP-09/CP-11: abre WhatsApp y registra el clic (embudo). */
  function irAWhatsApp() {
    if (sesion) {
      void fetch(`${API}/prospectos/${sesion}/evento`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evento: "whatsapp_click" }),
      }).catch(() => undefined);
    }
    window.open(SITE.whatsappUrl(mensajeWhatsApp()), "_blank", "noopener");
  }

  /** CP-10: genera el token anonimo y copia el link. */
  async function compartir() {
    if (!sesion) return;
    const r = await fetch(`${API}/compartir`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sesion }),
    });
    const d = await r.json();
    if (!r.ok) return;
    const url = `${window.location.origin}${d.url}`;
    setCompartidoUrl(url);
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream px-4">
        <div className="text-center">
          <p className="text-navy-900 mb-4">{error}</p>
          <a href="/diagnostico" className="bg-navy-900 text-white rounded-xl px-6 py-3">Iniciar diagnóstico</a>
        </div>
      </div>
    );
  }
  if (!diag) {
    return <div className="min-h-screen flex items-center justify-center bg-cream"><p className="text-navy-900">Interpretando tu diagnóstico…</p></div>;
  }

  const radar = Object.fromEntries(diag.dimensiones.map((d) => [d.id, d.P_d]));
  const estados = Object.fromEntries(diag.dimensiones.map((d) => [d.id, d.estado]));
  const prioridad1 = diag.prioridades[0]?.dimension ?? null;
  const historia = prioridad1 ? STORY[prioridad1] ?? STORY_SOLIDO : STORY_SOLIDO;
  const fortalezas = diag.dimensiones.filter((d) => (d.P_d ?? 0) >= 70 && d.estado !== "N/A");
  const monto = (n: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="min-h-screen bg-cream py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <p className="text-sm text-navy-900/60 mb-1">CQ Patrimonial AI</p>
        <h1 className="font-sans text-4xl text-navy-900 mb-6">
          {nombre ? `Tu diagnóstico, ${nombre}` : "Tu diagnóstico patrimonial"}
        </h1>

        {/* CP-06: interpretacion primero; los numeros respaldan, no sustituyen */}
        <div className="bg-white rounded-2xl p-8 mb-6 border border-navy-900/10">
          <p className="font-sans text-2xl text-navy-900 leading-relaxed">{historia}</p>
          <div className="mt-4 flex items-center gap-3 text-sm text-navy-900/70">
            <span className="bg-cream rounded-lg px-3 py-1.5">
              Estado general: <strong>{ETIQUETA_BANDA[diag.estado_general.banda ?? ""] ?? diag.estado_general.banda ?? "—"}</strong>
            </span>
            {fortalezas.length > 0 && (
              <span className="bg-cream rounded-lg px-3 py-1.5">
                Bien protegido: <strong>{fortalezas.map((f) => AD_LABELS[f.id] ?? NOMBRES[f.id]).join(", ")}</strong>
              </span>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-[minmax(0,1fr)_360px] gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 border border-navy-900/10 min-w-0">
            {/* CP-06: SOLO la prioridad principal, sin montos en el resumen */}
            <h2 className="font-sans text-2xl text-navy-900 mb-4">Lo que conviene revisar primero</h2>
            {diag.prioridades.length === 0 ? (
              <p className="text-navy-900/70">No identificamos una vulnerabilidad crítica en tu perfil. El detalle completo te mostrará el panorama.</p>
            ) : (
              <div className="border-l-4 border-red pl-4">
                <p className="font-semibold text-navy-900 tabular-nums">
                  {AD_LABELS[diag.prioridades[0].dimension] ?? NOMBRES[diag.prioridades[0].dimension] ?? diag.prioridades[0].dimension}
                </p>
                <p className="text-sm text-navy-900/80 mt-1">{diag.prioridades[0].explicacion}</p>
              </div>
            )}

            {/* Semáforo de urgencia (directiva de Carlos): peores escenarios de
                cada segmento, sin reordenar las prioridades del motor */}
            {diag.banderas_urgencia && diag.banderas_urgencia.length > 0 && (
              <div className="mt-6">
                <h3 className="font-sans text-xl text-navy-900 mb-2">Semáforo de urgencia</h3>
                <SemaforoUrgencia banderas={diag.banderas_urgencia} />
              </div>
            )}

            {/* Semáforo de protección por área: el nivel de protección de cada
                dimensión (barra de vida del videojuego). Sin rangos ni techos:
                son datos de negocio (directiva de Carlos 2026-08-25). */}
            {diag.semaforo_proteccion && diag.semaforo_proteccion.length > 0 && (
              <div className="mt-6">
                <h3 className="font-sans text-xl text-navy-900 mb-2">Tu nivel de protección por área</h3>
                <p className="text-xs text-navy-900/60 mb-2">
                  Así está cada área hoy. En la asesoría vemos cómo subir tu protección.
                </p>
                <SemaforoProteccion items={diag.semaforo_proteccion} />
              </div>
            )}

            <h3 className="font-sans text-xl text-navy-900 mt-8 mb-2">Tus objetivos</h3>
            {diag.objetivos.length === 0 ? (
              <p className="text-sm text-navy-900/60">No se identificaron objetivos declarados.</p>
            ) : (
              <ul className="text-sm text-navy-900/80 list-disc pl-5">
                {diag.objetivos.map((o) => <li key={o}>{AD_LABELS[o] ?? NOMBRES[o] ?? o}</li>)}
              </ul>
            )}

            <h3 className="font-sans text-xl text-navy-900 mt-6 mb-2">Oportunidades</h3>
            {diag.oportunidades.length === 0 ? (
              <p className="text-sm text-navy-900/60">Sin oportunidades detectadas.</p>
            ) : (
              <ul className="text-sm text-navy-900/80 list-disc pl-5">
                {diag.oportunidades.map((o) => <li key={o}>{AD_LABELS[o] ?? NOMBRES[o] ?? o}</li>)}
              </ul>
            )}

            {/* CP-08: detalle completo (solo tras desbloquear) */}
            {desbloqueado && (
              <>
                <h3 className="font-sans text-xl text-navy-900 mt-8 mb-2">Todas las prioridades</h3>
                <ol className="space-y-3">
                  {diag.prioridades.map((p) => (
                    <li key={p.orden} className="border-l-4 border-red pl-4">
                      <p className="font-semibold text-navy-900 tabular-nums">
                        {p.orden}. {AD_LABELS[p.dimension] ?? NOMBRES[p.dimension] ?? p.dimension}
                      </p>
                      <p className="text-sm text-navy-900/80 mt-0.5">{p.explicacion}</p>
                      {p.brechas.map((b, i) => (
                        <p key={i} className="text-xs text-navy-900/60 mt-0.5">
                          {b.concepto}{b.monto_mxn != null && ` · ${monto(b.monto_mxn)}`}
                        </p>
                      ))}
                    </li>
                  ))}
                </ol>

                {diag.estrategia && diag.estrategia.length > 0 && (
                  <>
                    <h3 className="font-sans text-xl text-navy-900 mt-8 mb-2">Estrategia que sugiere el diagnóstico</h3>
                    <ul className="text-sm text-navy-900/80 list-disc pl-5">
                      {diag.estrategia.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </>
                )}
              </>
            )}
          </div>

          <div className="bg-white rounded-2xl p-6 border border-navy-900/10 h-fit">
            <h2 className="font-sans text-xl text-navy-900 mb-3">Tu espacio de protección</h2>
            <SpiderRadar valores={radar} estados={estados} prioridad={prioridad1} />
            <p className="mt-3 text-sm text-navy-900/70 leading-relaxed">
              El área dorada es tu <strong>espacio de protección</strong>: cubre
              los escenarios ante los que estás protegido de los incidentes más
              posibles que imposibles. Mientras más grande, más cubierto estás.
            </p>
            <ul className="mt-4 space-y-1 text-xs text-navy-900/70">
              {diag.dimensiones.filter((d) => d.estado !== "N/A").map((d) => (
                <li key={d.id} className="flex justify-between">
                  <span>{AD_LABELS[d.id] ?? NOMBRES[d.id]}</span>
                  <span>{desbloqueado && d.P_d != null ? `${d.P_d} · ${ESTADO_NATURAL[d.estado] ?? d.estado}` : ESTADO_NATURAL[d.estado] ?? d.estado}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* CP-07: gating — SOLO telefono para desbloquear el detalle */}
        {!desbloqueado ? (
          <div className="bg-white rounded-2xl p-6 border border-navy-900/10">
            <h2 className="font-sans text-2xl text-navy-900 mb-2">Ver mi diagnóstico completo</h2>
            <p className="text-navy-900/80 mb-1">El detalle incluye todas las prioridades, las brechas en pesos y la estrategia sugerida.</p>
            <p className="text-sm text-navy-900/60 mb-4">Solo necesitamos tu teléfono para entregarte esta parte (10 dígitos, ej. 55 0000 0000). El correo es opcional.</p>
            <div className="grid md:grid-cols-2 gap-3 mb-4">
              <input value={telefono} onChange={(e) => setTelefono(e.target.value)} inputMode="tel"
                     placeholder="Teléfono (10 dígitos)" autoFocus
                     className="bg-cream border border-navy-900/20 rounded-xl px-4 py-3" />
              <input value={correo} onChange={(e) => setCorreo(e.target.value)} type="email"
                     placeholder="Correo electrónico (opcional)"
                     className="bg-cream border border-navy-900/20 rounded-xl px-4 py-3" />
            </div>
            {errorDesbloqueo && <p className="text-sm text-red mb-3">{errorDesbloqueo}</p>}
            <button onClick={() => void desbloquear()} disabled={guardando || telefono.trim().length < 10}
                    className="bg-navy-900 text-white rounded-xl px-6 py-3 font-semibold disabled:opacity-40">
              {guardando ? "Verificando…" : "Ver mi diagnóstico completo"}
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-6 border border-gold">
            <h2 className="font-sans text-2xl text-navy-900 mb-3">Tu diagnóstico completo quedó listo</h2>
            <p className="text-navy-900/80 mb-5">
              Ahora tienes el panorama completo. El siguiente paso es revisarlo con un asesor que lo
              interprete en el contexto de tu vida. Ese es el valor de la conversación.
            </p>
            {/* CP-11: CTA unico (prohibido: comprar/cotizar/contratar) */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={irAWhatsApp}
                      className="flex-1 bg-navy-900 text-white rounded-xl px-6 py-4 font-semibold hover:bg-navy-900/90 transition">
                {CTA_EXACTO}
              </button>
              <button onClick={() => void compartir()}
                      className="flex-1 bg-white border border-navy-900/15 rounded-xl px-6 py-4 font-semibold text-navy-900 hover:border-gold transition">
                {compartidoUrl ? (copiado ? "Link copiado ✓" : "Compartir (copia el link)") : "Compartir mi resultado"}
              </button>
            </div>
            {compartidoUrl && (
              <p className="text-xs text-navy-900/60 mt-3 break-all">
                {compartidoUrl} — quien lo abra verá solo tu gráfica y la banda general, sin datos personales.
              </p>
            )}
            <button onClick={() => void nav("/")}
                    className="mt-4 text-xs text-navy-900/60 underline underline-offset-2">
              Volver al inicio
            </button>
            <p className="mt-4 text-[11px] leading-relaxed text-navy-900/60 max-w-md">
              Este resultado es orientativo: se basa en fuentes públicas y de la industria y en lo
              que compartiste, y la IA intenta acercarse lo más posible a tu realidad. No es un
              diagnóstico real ni asesoría financiera — el diagnóstico definitivo lo hace un asesor
              patrimonial humano contigo.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
