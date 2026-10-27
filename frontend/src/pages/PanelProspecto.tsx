/** Detalle de prospecto (CP-15): 4 bloques — A datos, B entrevista (con
 * intención separada), C diagnóstico (semántica del motor intacta),
 * D trazabilidad. Solo lectura; nada se recalcula. */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import SpiderRadar from "../components/SpiderRadar";
import SemaforoUrgencia from "../components/SemaforoUrgencia";
import type { BanderaUrgencia } from "../components/SemaforoUrgencia";
import { SemaforoProteccion, OportunidadesDeVenta } from "../components/SemaforoProteccion";
import type { ItemProteccion, OportunidadVenta } from "../components/SemaforoProteccion";
import { AD_LABELS, labelOpcion } from "../data/conversacion";

const API = "/api/evaluations/panel";

const NOMBRES: Record<string, string> = {
  PF: "Familia", IN: "Ingresos", SA: "Salud", RE: "Retiro",
  HO: "Hogar", MO: "Movilidad", ED: "Educación", NE: "Negocio",
};
const ETIQUETA_ETAPA: Record<string, string> = {
  lead_inicial: "Lead inicial", en_diagnostico: "En diagnóstico",
  telefono_capturado: "Teléfono capturado", completo_visto: "Diagnóstico visto",
  whatsapp_click: "WhatsApp", compartido: "Compartido",
};

function fmtValor(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (typeof v === "number") return new Intl.NumberFormat("es-MX").format(v);
  if (Array.isArray(v)) return v.map((x) => labelOpcion(x)).join(", ");
  return labelOpcion(v);
}

type Preparacion = {
  prioridad_principal: {
    dimension: string; estado: string; PR: number | null;
    brechas: { concepto: string; monto_mxn?: number }[]; explicacion: string | null;
  } | null;
  riesgos_secundarios: {
    dimension: string; estado: string; PR: number | null;
    brechas: { concepto: string; monto_mxn?: number }[]; explicacion: string | null;
  }[];
  objetivos: string[];
  intencion_original: string | null;
  oportunidades: string[];
  datos_relevantes: {
    pregunta: string; texto: string; variable: string;
    valor: unknown; dimensiones: string[];
  }[];
  puntos_a_aclarar: {
    desconocidas: { variable: string; pregunta: string | null; texto: string | null; dimension: string; derivada: boolean }[];
    omitidas: { pregunta: string; texto: string; razon: string }[];
    no_se: { pregunta: string; texto: string; variable: string | null; valor: unknown }[];
  };
};

const PREPARACION_VACIA: Preparacion = {
  prioridad_principal: null,
  riesgos_secundarios: [],
  objetivos: [],
  intencion_original: null,
  oportunidades: [],
  datos_relevantes: [],
  puntos_a_aclarar: { desconocidas: [], omitidas: [], no_se: [] },
};

function labelDim(d: string): string {
  return AD_LABELS[d] ?? NOMBRES[d] ?? d;
}

function BrechasDe({ item }: { item: { brechas: { concepto: string; monto_mxn?: number }[] } }) {
  if (!item.brechas || item.brechas.length === 0) return null;
  return (
    <span className="text-xs text-navy-900/60">
      {" · "}
      {item.brechas.map((b, i) => (
        <span key={i}>
          {b.concepto}
          {b.monto_mxn != null &&
            ` ${new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(b.monto_mxn)}`}
          {i < item.brechas.length - 1 ? "; " : ""}
        </span>
      ))}
    </span>
  );
}

export default function PanelProspecto() {
  const { id } = useParams();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API}/prospectos/${id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("No autorizado o prospecto no encontrado");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-navy-900 mb-4">{error}</p>
          <Link to="/panel" className="bg-navy-900 text-white rounded-xl px-6 py-3">Volver al panel</Link>
        </div>
      </div>
    );
  }
  if (!data) {
    return <div className="min-h-screen bg-cream flex items-center justify-center"><p className="text-navy-900">Cargando entrevista…</p></div>;
  }

  const prospecto = data.prospecto as Record<string, unknown>;
  const entrevista = (data.entrevista ?? []) as { pregunta: string; texto: string; valor: unknown; confianza: string; variable: string | null; condicional: boolean }[];
  const intencion = data.intencion as { pregunta: string; texto: string; valor: unknown } | null;
  const diagnostico = (data.diagnostico ?? {}) as {
    IRP?: { valor: number | null; banda: string | null };
    dimensiones?: { id: string; P_d: number | null; R_d: string; estado: string; brechas?: { concepto: string; monto_mxn?: number }[] }[];
    prioridades?: { orden: number; dimension: string; estado: string; PR?: number; brechas?: { concepto: string; monto_mxn?: number }[]; explicacion?: string }[];
    objetivos?: string[];
    oportunidades?: string[];
    estrategia?: string[];
    fecha_evaluacion?: string;
    knowledge?: { version?: string; hash?: string };
    banderas_urgencia?: BanderaUrgencia[];
  };
  const semaforo_prot = (data.semaforo_proteccion ?? []) as ItemProteccion[];
  const oportunidades = (data.oportunidades_venta ?? []) as OportunidadVenta[];
  const trazabilidad = (data.trazabilidad ?? {}) as {
    reglas_disparadas?: { id: string; tipo?: string; dimension?: string; clasificacion?: string }[];
    preguntas_omitidas?: { pregunta?: string; razon?: string }[];
    variables_calculadas?: Record<string, unknown>;
  };
  const hipotesis = (data.hipotesis ?? []) as { id: string; texto: string; estado?: string }[];
  const preparacion = (data.preparacion ?? PREPARACION_VACIA) as Preparacion;
  const estado_perfil = (diagnostico as Record<string, unknown>).estado_perfil as
    Record<string, { valor: unknown; confianza: string }> | undefined;

  const radar = Object.fromEntries((diagnostico.dimensiones ?? []).map((d) => [d.id, d.P_d]));
  const estados = Object.fromEntries((diagnostico.dimensiones ?? []).map((d) => [d.id, d.estado]));
  const prioridad1 = diagnostico.prioridades?.[0]?.dimension ?? null;
  const desconocidas = estado_perfil
    ? Object.entries(estado_perfil).filter(([, v]) => v.confianza === "desconocido").map(([k]) => k)
    : [];

  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-navy-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/panel" className="font-sans text-lg hover:opacity-80">← Panel</Link>
          <p className="text-xs text-white/60">Prospecto #{String(prospecto.id)}</p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* A. Datos del prospecto */}
        <section className="bg-white rounded-2xl border border-navy-900/10 p-5">
          <h2 className="font-sans text-xl text-navy-900 mb-3">A. Datos del prospecto</h2>
          <div className="grid sm:grid-cols-3 gap-2 text-sm">
            <Dato k="Nombre" v={String(prospecto.nombre)} />
            <Dato k="Ciudad" v={String(prospecto.ciudad ?? "—")} />
            <Dato k="Teléfono" v={String(prospecto.telefono ?? "—")} />
            <Dato k="Correo" v={String(prospecto.correo ?? "—")} />
            <Dato k="Fecha" v={String(prospecto.fecha ?? "").slice(0, 10)} />
            <Dato k="Etapa" v={ETIQUETA_ETAPA[String(prospecto.etapa)] ?? String(prospecto.etapa)} />
          </div>
        </section>

        {/* B. Entrevista */}
        <section className="bg-white rounded-2xl border border-navy-900/10 p-5">
          <h2 className="font-sans text-xl text-navy-900 mb-3">B. Entrevista</h2>
          {intencion && (
            <div className="bg-gold-soft border border-gold/40 rounded-xl p-4 mb-4">
              <p className="text-xs uppercase tracking-wide text-gold mb-1">Intención declarada por el prospecto</p>
              <p className="text-navy-900">{String(intencion.valor ?? "")}</p>
            </div>
          )}
          <ol className="space-y-2.5 text-sm">
            {entrevista.map((r, i) => (
              <li key={i} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 border-b border-navy-900/5 pb-2">
                <span className="font-semibold text-navy-900 min-w-[200px]">{r.texto}</span>
                <span className="flex-1 tabular-nums">{fmtValor(r.valor)}</span>
                <span className="text-xs text-navy-900/60 whitespace-nowrap">
                  {r.variable ?? ""}{r.condicional ? " · condicional" : ""}{r.confianza === "no_se" ? " · no sabe" : ""}
                </span>
              </li>
            ))}
          </ol>
        </section>

        {/* C. Diagnóstico */}
        <section className="bg-white rounded-2xl border border-navy-900/10 p-5">
          <h2 className="font-sans text-xl text-navy-900 mb-3">C. Diagnóstico</h2>
          <div className="grid md:grid-cols-[minmax(0,1fr)_300px] gap-5">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="bg-cream rounded-lg px-3 py-1.5">IRP: <strong>{diagnostico.IRP?.valor ?? "—"}</strong></span>
                <span className="bg-cream rounded-lg px-3 py-1.5">Banda: <strong>{diagnostico.IRP?.banda ?? "—"}</strong></span>
                <span className="bg-cream rounded-lg px-3 py-1.5">Evaluado: <strong>{diagnostico.fecha_evaluacion ?? "—"}</strong></span>
              </div>
              {(diagnostico.prioridades ?? []).length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-navy-900/60 mb-1">Prioridades</p>
                  <ol className="space-y-2">
                    {(diagnostico.prioridades ?? []).map((p) => (
                      <li key={p.orden} className="border-l-4 border-red pl-3 text-sm">
                        <p className="font-semibold text-navy-900">
                          {p.orden}. {AD_LABELS[p.dimension] ?? NOMBRES[p.dimension] ?? p.dimension} · {p.estado}
                        </p>
                        {(p.brechas ?? []).map((b, i) => (
                          <p key={i} className="text-xs text-navy-900/60">
                            {b.concepto}{b.monto_mxn != null && ` · ${new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(b.monto_mxn)}`}
                          </p>
                        ))}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              <div className="grid sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-wide text-navy-900/60 mb-1">Objetivos</p>
                  <ul className="list-disc pl-4">{((diagnostico.objetivos ?? []) as string[]).map((o) => <li key={o}>{AD_LABELS[o] ?? NOMBRES[o] ?? o}</li>)}</ul>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-navy-900/60 mb-1">Oportunidades</p>
                  <ul className="list-disc pl-4">{((diagnostico.oportunidades ?? []) as string[]).map((o) => <li key={o}>{AD_LABELS[o] ?? NOMBRES[o] ?? o}</li>)}</ul>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-navy-900/60 mb-1">Estrategia</p>
                  <ul className="list-disc pl-4">{(diagnostico.estrategia ?? []).map((s, i) => <li key={i}>{s}</li>)}</ul>
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-navy-900/60 mb-1">Dimensiones (P_d / R_d / estado)</p>
                <ul className="text-sm space-y-0.5">
                  {(diagnostico.dimensiones ?? []).map((d) => (
                    <li key={d.id} className="flex justify-between">
                      <span>{AD_LABELS[d.id] ?? NOMBRES[d.id]}</span>
                      <span>{d.P_d != null ? `${d.P_d} · ${d.R_d} · ${d.estado}` : d.estado}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div>
              <SpiderRadar valores={radar} estados={estados} prioridad={prioridad1} />
            </div>
          </div>
        </section>

        {/* D. Trazabilidad */}
        <section className="bg-white rounded-2xl border border-navy-900/10 p-5">
          <h2 className="font-sans text-xl text-navy-900 mb-3">D. Trazabilidad</h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-navy-900/60 mb-1">Versión</p>
              <p>Knowledge: <strong>{diagnostico.knowledge?.version ?? "—"}</strong></p>
              <p className="break-all">Hash: {diagnostico.knowledge?.hash ?? "—"}</p>
              <p>Fecha de evaluación: {diagnostico.fecha_evaluacion ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-navy-900/60 mb-1">Reglas disparadas ({trazabilidad.reglas_disparadas?.length ?? 0})</p>
              {(trazabilidad.reglas_disparadas ?? []).map((r) => (
                <p key={r.id} className="text-xs text-navy-900/70">
                  {r.id} · {r.dimension ?? ""} · {r.clasificacion ?? r.tipo ?? ""}
                </p>
              ))}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-navy-900/60 mb-1">Variables DESCONOCIDAS ({desconocidas.length})</p>
              <p className="text-xs text-navy-900/70 break-words">{desconocidas.join(", ") || "ninguna"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-navy-900/60 mb-1">Preguntas omitidas ({trazabilidad.preguntas_omitidas?.length ?? 0})</p>
              {(trazabilidad.preguntas_omitidas ?? []).map((o, i) => (
                <p key={i} className="text-xs text-navy-900/70">{o.pregunta}: {o.razon}</p>
              ))}
            </div>
            <div className="md:col-span-2">
              <p className="text-xs uppercase tracking-wide text-navy-900/60 mb-1">Catálogo de hipótesis del knowledge (sin atribución por caso)</p>
              {(hipotesis ?? []).map((h) => (
                <p key={h.id} className="text-xs text-navy-900/70">{h.id} · {h.texto} <span className="text-navy-900/60">[{h.estado ?? ""}]</span></p>
              ))}
            </div>
          </div>
        </section>

        {/* E. Preparación de asesoría (CP-16) */}
        <section className="bg-white rounded-2xl border border-navy-900/10 p-5">
          <h2 className="font-sans text-xl text-navy-900 mb-1">E. Preparación de asesoría</h2>
          <p className="text-sm text-navy-900/60 mb-4">
            Organiza lo que el diagnóstico ya dijo y alinea las oportunidades de venta Aseguradora del Valle — para llegar preparado a la conversación.
          </p>

          {/* Semáforo de urgencia: los "tumores" primero, aunque estén en
              posición 3+ del orden del motor */}
          {diagnostico.banderas_urgencia && diagnostico.banderas_urgencia.length > 0 && (
            <div className="mb-5">
              <p className="text-xs uppercase tracking-wide text-navy-900/60 mb-1.5">Semáforo de urgencia</p>
              <SemaforoUrgencia banderas={diagnostico.banderas_urgencia} />
            </div>
          )}

          {/* Nivel de protección por área + oportunidades de venta Aseguradora del Valle */}
          {semaforo_prot.length > 0 && (
            <div className="mb-5">
              <p className="text-xs uppercase tracking-wide text-navy-900/60 mb-1.5">
                Nivel de protección por área <span className="normal-case text-navy-900/60">(verde ≥80 · amarillo 60-79 · naranja 40-59 · rojo &lt;40)</span>
              </p>
              <SemaforoProteccion items={semaforo_prot} mostrarTope />
            </div>
          )}

          {oportunidades.length > 0 && (
            <div className="mb-5 bg-gold-soft border border-gold/30 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs uppercase tracking-wide text-gold">Oportunidades de venta Aseguradora del Valle</p>
                <span className="text-[10px] text-navy-900/60">★ rentabilidad del agente · el diagnóstico manda, la comisión enfoca</span>
              </div>
              <OportunidadesDeVenta items={oportunidades} />
            </div>
          )}

          {preparacion.prioridad_principal && (
            <div className="border-l-4 border-red bg-red-soft rounded-r-xl p-4 mb-4">
              <p className="text-xs uppercase tracking-wide text-red mb-1">Con qué abrir la conversación · Prioridad principal</p>
              <p className="font-sans text-lg text-navy-900">
                {labelDim(preparacion.prioridad_principal.dimension)} · {preparacion.prioridad_principal.estado}
                {preparacion.prioridad_principal.PR != null && (
                  <span className="text-sm text-navy-900/60"> · PR {preparacion.prioridad_principal.PR}</span>
                )}
                <BrechasDe item={preparacion.prioridad_principal} />
              </p>
              {preparacion.prioridad_principal.explicacion && (
                <p className="text-sm text-navy-900/70 mt-2">{preparacion.prioridad_principal.explicacion}</p>
              )}
            </div>
          )}

          {preparacion.riesgos_secundarios.length > 0 && (
            <div className="mb-4">
              <p className="text-xs uppercase tracking-wide text-navy-900/60 mb-1.5">Riesgos secundarios (en orden)</p>
              <ol className="space-y-1.5">
                {preparacion.riesgos_secundarios.map((r, i) => (
                  <li key={i} className="flex items-baseline gap-2 text-sm border-b border-navy-900/5 pb-1.5">
                    <span className="font-semibold text-navy-900">{labelDim(r.dimension)}</span>
                    <span className="text-navy-900/60">
                      {r.estado}
                      {r.PR != null && ` · PR ${r.PR}`}
                      <BrechasDe item={r} />
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3 mb-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-navy-900/60 mb-1">Objetivos declarados</p>
              <div className="flex flex-wrap gap-1.5">
                {(preparacion.objetivos ?? []).length === 0 && <span className="text-navy-900/60">ninguno</span>}
                {(preparacion.objetivos ?? []).map((o) => (
                  <span key={o} className="bg-cream rounded-lg px-2.5 py-1 text-navy-900">{labelDim(o)}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-navy-900/60 mb-1">Oportunidades</p>
              <div className="flex flex-wrap gap-1.5">
                {(preparacion.oportunidades ?? []).length === 0 && <span className="text-navy-900/60">ninguna</span>}
                {(preparacion.oportunidades ?? []).map((o) => (
                  <span key={o} className="bg-[#eef3ee] rounded-lg px-2.5 py-1 text-navy-900">{labelDim(o)}</span>
                ))}
              </div>
            </div>
          </div>

          {preparacion.intencion_original && (
            <div className="bg-gold-soft border border-gold/40 rounded-xl p-4 mb-4">
              <p className="text-xs uppercase tracking-wide text-gold mb-1">Por qué vino (intención original)</p>
              <p className="text-navy-900">{String(preparacion.intencion_original)}</p>
            </div>
          )}

          {preparacion.datos_relevantes.length > 0 && (
            <div className="mb-4">
              <p className="text-xs uppercase tracking-wide text-navy-900/60 mb-1.5">
                Datos relevantes de la entrevista ({preparacion.datos_relevantes.length}) · solo dimensiones priorizadas
              </p>
              <ul className="text-sm space-y-1">
                {preparacion.datos_relevantes.map((dr, i) => (
                  <li key={i} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 border-b border-navy-900/5 pb-1.5">
                    <span className="text-navy-900/70 min-w-[200px]">{dr.texto}</span>
                    <span className="flex-1 font-medium text-navy-900 tabular-nums">{fmtValor(dr.valor)}</span>
                    <span className="text-xs text-navy-900/60 whitespace-nowrap">{dr.dimensiones.map(labelDim).join(" · ")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <p className="text-xs uppercase tracking-wide text-navy-900/60 mb-1.5">Puntos a aclarar</p>
            <div className="grid md:grid-cols-3 gap-3 text-sm">
              <div className="bg-red-soft rounded-xl p-3">
                <p className="text-xs font-semibold text-red mb-1">
                  Sin dato / no sabe ({preparacion.puntos_a_aclarar.desconocidas.length})
                </p>
                {preparacion.puntos_a_aclarar.desconocidas.length === 0 && (
                  <p className="text-xs text-navy-900/60">ninguno</p>
                )}
                <ul className="space-y-1">
                  {preparacion.puntos_a_aclarar.desconocidas.map((x, i) => (
                    <li key={i} className="text-xs text-navy-900/70">
                      {x.texto ?? <span className="italic">{x.variable} (derivado)</span>}
                      {x.dimension && <span className="text-navy-900/60"> · {labelDim(x.dimension)}</span>}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-cream rounded-xl p-3">
                <p className="text-xs font-semibold text-navy-900 mb-1">
                  Preguntas omitidas ({preparacion.puntos_a_aclarar.omitidas.length})
                </p>
                {preparacion.puntos_a_aclarar.omitidas.length === 0 && (
                  <p className="text-xs text-navy-900/60">ninguna</p>
                )}
                <ul className="space-y-1">
                  {preparacion.puntos_a_aclarar.omitidas.map((o, i) => (
                    <li key={i} className="text-xs text-navy-900/70">
                      <span className="font-medium">{o.texto}</span>
                      <span className="text-navy-900/60"> — {o.razon}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-cream rounded-xl p-3">
                <p className="text-xs font-semibold text-navy-900 mb-1">
                  Respondió «no sé» ({preparacion.puntos_a_aclarar.no_se.length})
                </p>
                {preparacion.puntos_a_aclarar.no_se.length === 0 && (
                  <p className="text-xs text-navy-900/60">ninguno</p>
                )}
                <ul className="space-y-1">
                  {preparacion.puntos_a_aclarar.no_se.map((n, i) => (
                    <li key={i} className="text-xs text-navy-900/70">
                      {n.texto}
                      {n.valor != null && <span className="text-navy-900/60 tabular-nums"> — respondió {fmtValor(n.valor)}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function Dato({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-navy-900/60">{k}</p>
      <p className="font-semibold text-navy-900">{v}</p>
    </div>
  );
}
