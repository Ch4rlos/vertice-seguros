/** Panel privado de Carlos (CP-13/CP-14): login + dashboard de metricas +
 * tabla localizable de prospectos. Solo lectura; todo viene del API /panel. */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const API = "/api/evaluations/panel";

type Dash = {
  diagnosticos: { iniciados: number; completados: number; sin_finalizar: number; tasa_finalizacion: number | null };
  motor: { bandas: Record<string, number>; estados_por_dimension: Record<string, number>; prioridad_1_mas_frecuente: Record<string, number>; prioridades_todas: Record<string, number>; objetivos_mas_frecuentes: Record<string, number>; irp_promedio: number | null };
  embudo: Record<string, number | null>;
  knowledge?: string;
};

type Sospechoso = {
  ip: string;
  endpoint: string;
  motivo: string;
  veces: number;
  bloqueado_hasta: string | null;
  actualizado: string;
};

const NOMBRES: Record<string, string> = {
  PF: "Familia", IN: "Ingresos", SA: "Salud", RE: "Retiro",
  HO: "Hogar", MO: "Movilidad", ED: "Educación", NE: "Negocio",
};

const ETIQUETA_ETAPA: Record<string, string> = {
  lead_inicial: "Lead inicial", en_diagnostico: "En diagnóstico",
  telefono_capturado: "Teléfono capturado", completo_visto: "Diagnóstico visto",
  whatsapp_click: "WhatsApp", compartido: "Compartido",
};

export default function Panel() {
  const [autenticado, setAutenticado] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [dash, setDash] = useState<Dash | null>(null);
  const [prospectos, setProspectos] = useState<Record<string, unknown>[]>([]);
  const [sospechosos, setSospechosos] = useState<Sospechoso[]>([]);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    void (async () => {
      const d = await fetch(`${API}/sesion`).then((r) => r.json());
      setAutenticado(d.autenticado);
      if (d.autenticado) void cargar();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargar() {
    const [d, p, s] = await Promise.all([
      fetch(`${API}/dashboard`).then((r) => r.json()),
      fetch(`${API}/prospectos`).then((r) => r.json()),
      fetch(`${API}/seguridad`).then((r) => r.json()),
    ]);
    setDash(d);
    setProspectos(p.prospectos);
    setSospechosos(s.sospechosos ?? []);
  }

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch(`${API}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const d = await r.json();
    if (!r.ok) {
      setError(d.error ?? "Error de acceso");
      return;
    }
    setAutenticado(true);
    setError("");
    setPassword("");
    void cargar();
  }

  async function salir() {
    await fetch(`${API}/logout`, { method: "POST" });
    setAutenticado(false);
    setDash(null);
    setProspectos([]);
  }

  if (autenticado === null) {
    return <div className="min-h-screen bg-cream flex items-center justify-center"><p className="text-navy-900">Cargando…</p></div>;
  }

  if (!autenticado) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-4">
        <form onSubmit={entrar} className="bg-white rounded-2xl border border-navy-900/10 shadow p-8 w-full max-w-sm">
          <p className="font-sans text-2xl text-navy-900 mb-1">Panel de entrevistas</p>
          <p className="text-sm text-navy-900/60 mb-5">Acceso privado de CQ Patrimonial</p>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password"
                 placeholder="Contraseña" autoFocus
                 className="w-full bg-cream border border-navy-900/20 rounded-xl px-4 py-3 mb-3" />
          {error && <p className="text-sm text-red mb-3">{error}</p>}
          <button className="w-full bg-navy-900 text-white rounded-xl px-6 py-3 font-semibold">
            Entrar
          </button>
        </form>
      </div>
    );
  }

  const filtrados = prospectos.filter((p) => {
    const q = busqueda.toLowerCase();
    if (!q) return true;
    return [p.nombre, p.ciudad, p.telefono, p.etapa, p.estado_diag]
      .map((v) => String(v ?? "").toLowerCase()).some((v) => v.includes(q));
  });

  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-navy-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <p className="font-sans text-lg">Panel de Entrevistas y Diagnósticos</p>
            <p className="text-xs text-white/60">CQ Patrimonial AI · knowledge {dash?.knowledge ?? ""}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/panel/crm" className="text-xs bg-gold text-navy-900 rounded-full px-4 py-2 font-semibold hover:bg-gold/90 transition">
              CRM · Cartera
            </Link>
            <button onClick={() => void salir()} className="text-xs bg-white/10 rounded-full px-4 py-2 hover:bg-white/20">
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {dash && (
          <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <Tarjeta titulo="Diagnósticos iniciados" valor={String(dash.diagnosticos.iniciados)} />
            <Tarjeta titulo="Completados" valor={String(dash.diagnosticos.completados)} />
            <Tarjeta titulo="Sin finalizar (abandonos)" valor={String(dash.diagnosticos.sin_finalizar)} />
            <Tarjeta titulo="Tasa de finalización" valor={dash.diagnosticos.tasa_finalizacion != null ? `${Math.round(dash.diagnosticos.tasa_finalizacion * 100)}%` : "—"} />
            <Tarjeta titulo="IRP promedio" valor={dash.motor.irp_promedio != null ? String(dash.motor.irp_promedio) : "—"} />
            <Tarjeta titulo="Teléfonos capturados" valor={String(dash.embudo.telefono_capturado ?? 0)} />
            <Tarjeta titulo="Clícs WhatsApp" valor={String(dash.embudo.whatsapp_click ?? 0)} />
            <Tarjeta titulo="Compartidos" valor={String(dash.embudo.compartido ?? 0)} />
          </section>
        )}

        {dash && (
          <section className="grid md:grid-cols-2 gap-3 mb-6">
            <div className="bg-white rounded-2xl border border-navy-900/10 p-4">
              <p className="text-xs uppercase tracking-wide text-navy-900/60 mb-2">Prioridad #1 más frecuente</p>
              <ListaClaves mapa={dash.motor.prioridad_1_mas_frecuente} />
            </div>
            <div className="bg-white rounded-2xl border border-navy-900/10 p-4">
              <p className="text-xs uppercase tracking-wide text-navy-900/60 mb-2">Bandas del estado general</p>
              <ListaClaves mapa={dash.motor.bandas} />
            </div>
            <div className="bg-white rounded-2xl border border-navy-900/10 p-4">
              <p className="text-xs uppercase tracking-wide text-navy-900/60 mb-2">Dimensiones vulnerables (todas las prioridades)</p>
              <ListaClaves mapa={dash.motor.prioridades_todas} />
            </div>
            <div className="bg-white rounded-2xl border border-navy-900/10 p-4">
              <p className="text-xs uppercase tracking-wide text-navy-900/60 mb-2">Objetivos más frecuentes</p>
              <ListaClaves mapa={dash.motor.objetivos_mas_frecuentes} />
            </div>
          </section>
        )}

        <section className="bg-white rounded-2xl border border-red/30 p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="font-sans text-lg text-navy-900">Seguridad · accesos sospechosos ({sospechosos.length})</p>
            <span className="text-[10px] uppercase tracking-wide text-navy-900/60">rate-limit · anti-bots · anti-plagio activos</span>
          </div>
          {sospechosos.length === 0 ? (
            <p className="text-sm text-navy-900/60">Sin intentos registrados. Si alguien intenta robar el flujo o monitorear, aparece aquí.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-navy-900/60 text-xs uppercase tracking-wide">
                    <th className="py-1.5 pr-3">IP</th>
                    <th className="py-1.5 pr-3">Endpoint</th>
                    <th className="py-1.5 pr-3">Motivo</th>
                    <th className="py-1.5 pr-3">Veces</th>
                    <th className="py-1.5 pr-3">Bloqueado hasta</th>
                    <th className="py-1.5">Última vez</th>
                  </tr>
                </thead>
                <tbody>
                  {sospechosos.map((s, i) => (
                    <tr key={i} className="border-t border-navy-900/5">
                      <td className="py-1.5 pr-3 font-mono text-navy-900">{s.ip}</td>
                      <td className="py-1.5 pr-3">{s.endpoint}</td>
                      <td className="py-1.5 pr-3">{s.motivo === "rate_limit" ? "Rate limit excedido" : "User-Agent de bot"}</td>
                      <td className="py-1.5 pr-3 font-semibold">{s.veces}</td>
                      <td className="py-1.5 pr-3">{s.bloqueado_hasta ? String(s.bloqueado_hasta).slice(0, 19).replace("T", " ") : "—"}</td>
                      <td className="py-1.5">{String(s.actualizado).slice(0, 19).replace("T", " ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="bg-white rounded-2xl border border-navy-900/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <p className="font-sans text-lg text-navy-900">Prospectos ({filtrados.length})</p>
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                   placeholder="Buscar por nombre, ciudad, teléfono, etapa…"
                   className="bg-cream border border-navy-900/20 rounded-xl px-4 py-2 text-sm min-w-[260px]" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-navy-900/60 text-xs uppercase tracking-wide">
                  <th className="py-2 pr-3">Nombre</th>
                  <th className="py-2 pr-3">Ciudad</th>
                  <th className="py-2 pr-3">Teléfono</th>
                  <th className="py-2 pr-3">Etapa</th>
                  <th className="py-2 pr-3">Diagnóstico</th>
                  <th className="py-2 pr-3">Fecha</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p) => (
                  <tr key={String(p.id)} className="border-t border-navy-900/5">
                    <td className="py-2 pr-3 font-semibold text-navy-900">{String(p.nombre)}</td>
                    <td className="py-2 pr-3">{String(p.ciudad ?? "")}</td>
                    <td className="py-2 pr-3">{String(p.telefono ?? "")}</td>
                    <td className="py-2 pr-3">{ETIQUETA_ETAPA[String(p.etapa)] ?? String(p.etapa)}</td>
                    <td className="py-2 pr-3">{String(p.estado_diag ?? "")}</td>
                    <td className="py-2 pr-3">{String(p.fecha ?? "").slice(0, 10)}</td>
                    <td className="py-2 text-right">
                      <Link to={`/panel/prospectos/${String(p.id)}`}
                            className="text-xs bg-navy-900 text-white rounded-full px-3 py-1.5">
                        Ver entrevista
                      </Link>
                    </td>
                  </tr>
                ))}
                {filtrados.length === 0 && (
                  <tr><td colSpan={7} className="py-6 text-center text-navy-900/60">Sin resultados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

function Tarjeta({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="bg-white rounded-2xl border border-navy-900/10 p-4">
      <p className="text-xs uppercase tracking-wide text-navy-900/60 mb-1">{titulo}</p>
      <p className="font-sans text-2xl text-navy-900">{valor}</p>
    </div>
  );
}

function ListaClaves({ mapa }: { mapa: Record<string, number> }) {
  const entries = Object.entries(mapa).sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (entries.length === 0) return <p className="text-sm text-navy-900/60">Sin datos aún</p>;
  return (
    <ul className="space-y-1 text-sm">
      {entries.map(([k, v]) => (
        <li key={k} className="flex justify-between">
          <span>{NOMBRES[k] ?? k}</span>
          <span className="font-semibold">{v}</span>
        </li>
      ))}
    </ul>
  );
}
