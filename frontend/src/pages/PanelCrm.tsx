/** CRM del agente (Track 6) — kanban de la cartera de clientes.
 * Columnas: Pendiente / En curso / En espera / Completada.
 * Tarjetas = tareas (renovacion, mejora, cobro, llamada...). Drag & drop
 * nativo + botones. Gestion de clientes, polizas y pagos. */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const API = "/api/evaluations/panel/crm";

type Tarea = {
  id: number; cliente_id: number; cliente_nombre: string; poliza_id: number | null;
  tipo: string; tipo_etiqueta: string; titulo: string; descripcion: string;
  fecha_limite: string | null; columna: string; ramo: string | null;
};
type Poliza = {
  id: number; cliente_id: number; ramo: string; ramo_etiqueta: string;
  aseguradora: string; prima_anual: number | null; fecha_inicio: string | null;
  fecha_vencimiento: string | null; estado: string; producto_id: number | null;
  producto_nombre: string | null; vigencia_tipo: string; vigencia_etiqueta: string;
  pagos: { id: number; monto: number; fecha_limite: string; estado: string }[];
};
type Producto = {
  id: number; nombre: string; aseguradora: string; ramo: string;
  ramo_etiqueta: string; descripcion: string; vigencia_tipo: string;
  vigencia_etiqueta: string; activo: boolean;
};
type Cliente = {
  id: number; nombre: string; telefono: string; correo: string; ciudad: string;
  notas: string; relacion: string; relacion_etiqueta: string; prospect_id: number | null;
  polizas: Poliza[];
};
type Resumen = {
  clientes: Cliente[]; tareas: Tarea[]; productos: Producto[];
  alertas: { tarea_id: number; tipo: string }[];
  pagos_atrasados: { pago_id: number; cliente_nombre: string; monto: number; fecha_limite: string }[];
  stats: { renovaciones_proximas: number; tareas_activas: number; pagos_atrasados: number; clientes: number };
};

const COLUMNAS = [
  { id: "pendiente", etiqueta: "Pendiente", color: "border-gold" },
  { id: "en_curso", etiqueta: "En curso", color: "border-navy-900" },
  { id: "en_espera", etiqueta: "En espera", color: "border-[#7a8aa8]" },
  { id: "completada", etiqueta: "Completada", color: "border-emerald-600" },
];
const TIPOS = [
  "renovacion", "mejora", "cobro", "llamada", "entrega", "cita", "seguimiento",
];
const ETIQUETA_TIPO: Record<string, string> = {
  renovacion: "Renovación", mejora: "Mejora", cobro: "Cobro", llamada: "Llamada",
  entrega: "Entrega", cita: "Cita", seguimiento: "Seguimiento",
};
const RAMOS = ["vida", "gmm", "auto", "hogar", "retiro", "negocio", "otros"];
const ETIQUETA_RAMO: Record<string, string> = {
  vida: "Vida", gmm: "GMM / Salud", auto: "Auto", hogar: "Hogar",
  retiro: "Retiro", negocio: "Negocio", otros: "Otros",
};

async function api(path: string, metodo = "GET", body?: unknown) {
  const r = await fetch(API + path, {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Error");
  return r.json();
}

function hoyISO(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export default function PanelCrm() {
  const [data, setData] = useState<Resumen | null>(null);
  const [error, setError] = useState("");
  const [arrastrando, setArrastrando] = useState<number | null>(null);
  const [seccion, setSeccion] = useState<"kanban" | "clientes" | "servicios">("kanban");
  // formularios
  const [nuevoCliente, setNuevoCliente] = useState({ nombre: "", telefono: "", correo: "", ciudad: "" });
  const [nuevaTarea, setNuevaTarea] = useState({ cliente_id: "", tipo: "seguimiento", titulo: "", fecha_limite: hoyISO(7), descripcion: "" });
  const [nuevaPoliza, setNuevaPoliza] = useState({ cliente_id: "", producto_id: "", ramo: "gmm", aseguradora: "Aseguradora del Valle", vigencia_tipo: "anual", prima_anual: "", fecha_vencimiento: "" });
  const [nuevoProducto, setNuevoProducto] = useState({ nombre: "", aseguradora: "Aseguradora del Valle", ramo: "gmm", vigencia_tipo: "anual", descripcion: "" });
  const [pagoDe, setPagoDe] = useState<{ poliza_id: number; cliente_nombre: string } | null>(null);
  const [nuevoPago, setNuevoPago] = useState({ monto: "", fecha_limite: hoyISO(15), estado: "pendiente" });
  const [msg, setMsg] = useState("");

  function cargar() {
    api("/resumen").then(setData).catch((e) => setError(e.message));
  }
  useEffect(() => { cargar(); }, []);

  function mover(tareaId: number, columna: string) {
    void api(`/tareas/${tareaId}`, "PUT", { columna }).then(cargar);
  }

  async function crearCliente(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/clientes", "POST", nuevoCliente);
      setNuevoCliente({ nombre: "", telefono: "", correo: "", ciudad: "" });
      setMsg("Cliente creado ✓");
      cargar();
    } catch (err) { setError((err as Error).message); }
  }

  async function crearTarea(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/tareas", "POST", {
        cliente_id: Number(nuevaTarea.cliente_id), tipo: nuevaTarea.tipo,
        titulo: nuevaTarea.titulo, fecha_limite: nuevaTarea.fecha_limite || null,
        descripcion: nuevaTarea.descripcion,
      });
      setNuevaTarea({ ...nuevaTarea, titulo: "", descripcion: "" });
      setMsg("Tarea creada ✓");
      cargar();
    } catch (err) { setError((err as Error).message); }
  }

  async function crearPoliza(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/polizas", "POST", {
        cliente_id: Number(nuevaPoliza.cliente_id),
        producto_id: nuevaPoliza.producto_id ? Number(nuevaPoliza.producto_id) : null,
        ramo: nuevaPoliza.ramo, aseguradora: nuevaPoliza.aseguradora,
        vigencia_tipo: nuevaPoliza.vigencia_tipo,
        prima_anual: nuevaPoliza.prima_anual ? Number(nuevaPoliza.prima_anual) : null,
        fecha_vencimiento: nuevaPoliza.fecha_vencimiento || null,
      });
      setNuevaPoliza({ ...nuevaPoliza, producto_id: "", prima_anual: "", fecha_vencimiento: "" });
      setMsg("Póliza creada ✓");
      cargar();
    } catch (err) { setError((err as Error).message); }
  }

  async function crearProducto(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/productos", "POST", nuevoProducto);
      setNuevoProducto({ ...nuevoProducto, nombre: "", descripcion: "" });
      setMsg("Servicio agregado al catálogo ✓");
      cargar();
    } catch (err) { setError((err as Error).message); }
  }

  async function crearPago(e: React.FormEvent) {
    e.preventDefault();
    if (!pagoDe) return;
    try {
      await api("/pagos", "POST", {
        poliza_id: pagoDe.poliza_id, monto: Number(nuevoPago.monto),
        fecha_limite: nuevoPago.fecha_limite,
        estado: nuevoPago.estado,
        fecha_pago: nuevoPago.estado === "pagado" ? hoyISO() : null,
      });
      setPagoDe(null);
      setNuevoPago({ monto: "", fecha_limite: hoyISO(15), estado: "pendiente" });
      setMsg("Pago registrado ✓");
      cargar();
    } catch (err) { setError((err as Error).message); }
  }

  async function cambiarRelacion(clienteId: number, relacion: string) {
    try {
      await api(`/clientes/${clienteId}`, "PUT", { relacion });
      cargar();
    } catch (err) { setError((err as Error).message); }
  }

  async function marcarPagado(pagoId: number) {
    try {
      await api(`/pagos/${pagoId}`, "PUT", { estado: "pagado", fecha_pago: hoyISO() });
      setMsg("Pago marcado como pagado ✓");
      cargar();
    } catch (err) { setError((err as Error).message); }
  }

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
    return <div className="min-h-screen bg-cream flex items-center justify-center"><p className="text-navy-900">Cargando cartera…</p></div>;
  }

  const porColumna = (id: string) => data.tareas.filter((t) => t.columna === id);
  const alertaDe = (t: Tarea) => data.alertas.find((a) => a.tarea_id === t.id)?.tipo;

  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-navy-900 text-white">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <Link to="/panel" className="font-sans text-lg hover:opacity-80">← Panel</Link>
            <p className="font-sans text-lg">CRM · Cartera de clientes</p>
          </div>
          <div className="flex gap-3 text-xs">
            <span className="bg-white/10 rounded-full px-3 py-1.5">Renovaciones: <strong>{data.stats.renovaciones_proximas}</strong></span>
            <span className="bg-white/10 rounded-full px-3 py-1.5">Tareas: <strong>{data.stats.tareas_activas}</strong></span>
            <span className={`rounded-full px-3 py-1.5 ${data.stats.pagos_atrasados > 0 ? "bg-red/80" : "bg-white/10"}`}>
              Pagos atrasados: <strong>{data.stats.pagos_atrasados}</strong>
            </span>
            <span className="bg-white/10 rounded-full px-3 py-1.5">Clientes: <strong>{data.stats.clientes}</strong></span>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 pb-3 flex gap-2 text-sm">
          <button onClick={() => setSeccion("kanban")}
                  className={`rounded-full px-4 py-1.5 ${seccion === "kanban" ? "bg-gold text-navy-900 font-semibold" : "bg-white/10"}`}>
            Kanban
          </button>
          <button onClick={() => setSeccion("clientes")}
                  className={`rounded-full px-4 py-1.5 ${seccion === "clientes" ? "bg-gold text-navy-900 font-semibold" : "bg-white/10"}`}>
            Clientes y pólizas
          </button>
          <button onClick={() => setSeccion("servicios")}
                  className={`rounded-full px-4 py-1.5 ${seccion === "servicios" ? "bg-gold text-navy-900 font-semibold" : "bg-white/10"}`}>
            Servicios ({data.productos.length})
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-5">
        {msg && <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 mb-4">{msg}</p>}

        {seccion === "kanban" && (
          <>
            {/* formulario de tarea */}
            <form onSubmit={crearTarea} className="bg-white rounded-2xl border border-navy-900/10 p-4 mb-5 grid sm:grid-cols-[1fr_150px_150px_auto] gap-2 items-end">
              <div>
                <label className="text-[10px] uppercase text-navy-900/60">Cliente</label>
                <select value={nuevaTarea.cliente_id} onChange={(e) => setNuevaTarea({ ...nuevaTarea, cliente_id: e.target.value })}
                        required className="w-full bg-cream border border-navy-900/20 rounded-lg px-3 py-2 text-sm">
                  <option value="">— selecciona —</option>
                  {data.clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase text-navy-900/60">Tipo</label>
                <select value={nuevaTarea.tipo} onChange={(e) => setNuevaTarea({ ...nuevaTarea, tipo: e.target.value })}
                        className="w-full bg-cream border border-navy-900/20 rounded-lg px-3 py-2 text-sm">
                  {TIPOS.map((t) => <option key={t} value={t}>{ETIQUETA_TIPO[t]}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase text-navy-900/60">Fecha límite</label>
                <input type="date" value={nuevaTarea.fecha_limite} onChange={(e) => setNuevaTarea({ ...nuevaTarea, fecha_limite: e.target.value })}
                       className="w-full bg-cream border border-navy-900/20 rounded-lg px-3 py-2 text-sm" />
              </div>
              <button className="bg-navy-900 text-white rounded-lg px-4 py-2 text-sm font-semibold">+ Tarea</button>
              <div className="sm:col-span-4">
                <input value={nuevaTarea.titulo} onChange={(e) => setNuevaTarea({ ...nuevaTarea, titulo: e.target.value })}
                       placeholder="Título de la tarea (ej. Renovar GMM, llamada de seguimiento…)" required
                       className="w-full bg-cream border border-navy-900/20 rounded-lg px-3 py-2 text-sm" />
              </div>
            </form>

            {/* kanban */}
            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {COLUMNAS.map((col) => (
                <div key={col.id} onDragOver={(e) => e.preventDefault()}
                     onDrop={() => { if (arrastrando !== null) { mover(arrastrando, col.id); setArrastrando(null); } }}
                     className="bg-navy-900/[0.03] rounded-2xl p-3 min-h-[220px]">
                  <p className={`text-xs font-bold uppercase tracking-wide text-navy-900/60 border-l-4 ${col.color} pl-2 mb-2`}>
                    {col.etiqueta} ({porColumna(col.id).length})
                  </p>
                  <div className="space-y-2">
                    {porColumna(col.id).map((t) => {
                      const alerta = alertaDe(t);
                      return (
                        <div key={t.id} draggable onDragStart={() => setArrastrando(t.id)}
                             className="bg-white rounded-xl border border-navy-900/10 p-3 shadow-sm cursor-grab active:cursor-grabbing">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold text-navy-900 leading-snug">{t.titulo}</p>
                            {alerta && (
                              <span className={`shrink-0 text-[9px] font-bold uppercase rounded-full px-2 py-0.5 ${alerta === "atrasada" ? "bg-red text-white" : "bg-gold text-navy-900"}`}>
                                {alerta === "atrasada" ? "Atrasada" : "Próxima"}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-navy-900/55 mt-1">{t.cliente_nombre}{t.ramo ? ` · ${ETIQUETA_RAMO[t.ramo] ?? t.ramo}` : ""} · {t.tipo_etiqueta}</p>
                          {t.fecha_limite && (
                            <p className={`text-[11px] mt-0.5 ${t.fecha_limite < hoyISO() && t.columna !== "completada" ? "text-red font-semibold" : "text-navy-900/45"}`}>
                              ⏱ {t.fecha_limite}
                            </p>
                          )}
                          <div className="flex gap-1.5 mt-2">
                            {col.id !== "pendiente" && <button onClick={() => mover(t.id, "pendiente")} className="text-[10px] bg-cream rounded-full px-2 py-0.5">‹</button>}
                            {col.id !== "completada" && <button onClick={() => mover(t.id, "completada")} className="text-[10px] bg-emerald-50 text-emerald-700 rounded-full px-2 py-0.5">✓ Lista</button>}
                            {col.id !== "en_curso" && col.id !== "completada" && <button onClick={() => mover(t.id, "en_curso")} className="text-[10px] bg-cream rounded-full px-2 py-0.5">Empezar</button>}
                            {col.id !== "en_espera" && col.id !== "completada" && <button onClick={() => mover(t.id, "en_espera")} className="text-[10px] bg-cream rounded-full px-2 py-0.5">Espera</button>}
                            <button onClick={() => void api(`/tareas/${t.id}/delete`, "DELETE").then(cargar)}
                                    className="text-[10px] text-red rounded-full px-2 py-0.5 ml-auto">✕</button>
                          </div>
                        </div>
                      );
                    })}
                    {porColumna(col.id).length === 0 && (
                      <p className="text-[11px] text-navy-900/30 text-center py-6">Sin tareas</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {seccion === "clientes" && (
          <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-5">
            <div className="space-y-4">
              {/* clientes */}
              <section className="bg-white rounded-2xl border border-navy-900/10 p-4">
                <p className="font-sans text-lg text-navy-900 mb-3">Clientes ({data.clientes.length})</p>
                <div className="space-y-3">
                  {data.clientes.map((c) => (
                    <div key={c.id} className="border border-navy-900/10 rounded-xl p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-navy-900">{c.nombre}</p>
                        <select value={c.relacion}
                                onChange={(e) => void cambiarRelacion(c.id, e.target.value)}
                                title="Cambiar tag del cliente"
                                className="text-[10px] bg-cream border border-navy-900/20 rounded-full px-2 py-0.5 font-semibold text-navy-900 cursor-pointer">
                          <option value="prospecto">Prospecto</option>
                          <option value="cotizacion">Cotización</option>
                          <option value="cliente">Cliente</option>
                          <option value="activo">Cliente activo</option>
                        </select>
                      </div>
                      <p className="text-xs text-navy-900/55">{c.telefono}{c.correo ? ` · ${c.correo}` : ""}{c.ciudad ? ` · ${c.ciudad}` : ""}</p>
                      {c.polizas.map((p) => (
                        <div key={p.id} className="mt-2 bg-cream rounded-lg p-2 text-xs">
                          <div className="flex justify-between">
                            <span className="font-semibold">
                              {p.producto_nombre ?? p.ramo_etiqueta}
                              {p.aseguradora ? ` · ${p.aseguradora}` : ""}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 ${p.estado === "por_renovar" ? "bg-gold text-navy-900" : p.estado === "vencida" ? "bg-red text-white" : "bg-emerald-100 text-emerald-700"}`}>
                              {p.estado.replace("_", " ")}
                            </span>
                          </div>
                          <p className="text-navy-900/55">{p.vigencia_etiqueta}{p.prima_anual != null && ` · ${new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(p.prima_anual)}/año`}</p>
                          {p.fecha_vencimiento && <p className="text-navy-900/55">Vence: {p.fecha_vencimiento}</p>}
                          {p.pagos.length > 0 && (
                            <div className="mt-1.5 border-t border-navy-900/10 pt-1.5 space-y-1">
                              <p className="text-[10px] uppercase text-navy-900/60 font-semibold">Pagos</p>
                              {p.pagos.map((pg) => (
                                <div key={pg.id} className="flex items-center justify-between gap-2">
                                  <span className="text-navy-900/60">
                                    {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(pg.monto)} · {pg.fecha_limite}
                                  </span>
                                  <span className={`text-[9px] font-bold uppercase rounded-full px-1.5 py-0.5 ${pg.estado === "pagado" ? "bg-emerald-100 text-emerald-700" : pg.estado === "atrasado" ? "bg-red/10 text-red" : "bg-gold/20 text-navy-900"}`}>
                                    {pg.estado === "pagado" ? "Pagado" : pg.estado === "atrasado" ? "Atrasado" : pg.estado === "parcial" ? "Parcial" : "Pendiente"}
                                  </span>
                                  {pg.estado !== "pagado" && (
                                    <button onClick={() => void marcarPagado(pg.id)}
                                            className="text-[9px] text-emerald-700 bg-emerald-50 rounded-full px-1.5 py-0.5">✓ Pagado</button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="flex gap-2 mt-1">
                            <button onClick={() => setPagoDe({ poliza_id: p.id, cliente_nombre: c.nombre })}
                                    className="text-[10px] bg-navy-900 text-white rounded-full px-2 py-0.5">+ Pago</button>
                            <button onClick={() => void api(`/polizas/${p.id}/delete`, "DELETE").then(cargar)}
                                    className="text-[10px] text-red rounded-full px-2 py-0.5">✕</button>
                          </div>
                        </div>
                      ))}
                      {c.polizas.length === 0 && <p className="text-xs text-navy-900/60 mt-1">Sin pólizas aún</p>}
                    </div>
                  ))}
                  {data.clientes.length === 0 && <p className="text-sm text-navy-900/60">Sin clientes. Crea el primero o convierte un prospecto.</p>}
                </div>
              </section>

              {/* pagos atrasados */}
              {data.pagos_atrasados.length > 0 && (
                <section className="bg-white rounded-2xl border border-red/30 p-4">
                  <p className="font-sans text-lg text-red mb-2">Pagos atrasados ({data.pagos_atrasados.length})</p>
                  {data.pagos_atrasados.map((p) => (
                    <p key={p.pago_id} className="text-sm text-navy-900/80">
                      {p.cliente_nombre} · ${new Intl.NumberFormat("es-MX").format(p.monto)} · límite {p.fecha_limite}
                    </p>
                  ))}
                </section>
              )}
            </div>

            {/* formularios */}
            <div className="space-y-4">
              <form onSubmit={crearCliente} className="bg-white rounded-2xl border border-navy-900/10 p-4 space-y-2">
                <p className="font-sans text-base text-navy-900">Nuevo cliente</p>
                <input value={nuevoCliente.nombre} onChange={(e) => setNuevoCliente({ ...nuevoCliente, nombre: e.target.value })} placeholder="Nombre *" required
                       className="w-full bg-cream border border-navy-900/20 rounded-lg px-3 py-2 text-sm" />
                <div className="grid grid-cols-2 gap-2">
                  <input value={nuevoCliente.telefono} onChange={(e) => setNuevoCliente({ ...nuevoCliente, telefono: e.target.value })} placeholder="Teléfono"
                         className="w-full bg-cream border border-navy-900/20 rounded-lg px-3 py-2 text-sm" />
                  <input value={nuevoCliente.ciudad} onChange={(e) => setNuevoCliente({ ...nuevoCliente, ciudad: e.target.value })} placeholder="Ciudad"
                         className="w-full bg-cream border border-navy-900/20 rounded-lg px-3 py-2 text-sm" />
                </div>
                <input value={nuevoCliente.correo} onChange={(e) => setNuevoCliente({ ...nuevoCliente, correo: e.target.value })} placeholder="Correo"
                       className="w-full bg-cream border border-navy-900/20 rounded-lg px-3 py-2 text-sm" />
                <button className="w-full bg-navy-900 text-white rounded-lg px-4 py-2 text-sm font-semibold">Guardar cliente</button>
              </form>

              <form onSubmit={crearPoliza} className="bg-white rounded-2xl border border-navy-900/10 p-4 space-y-2">
                <p className="font-sans text-base text-navy-900">Nueva póliza</p>
                <select value={nuevaPoliza.cliente_id} onChange={(e) => setNuevaPoliza({ ...nuevaPoliza, cliente_id: e.target.value })} required
                        className="w-full bg-cream border border-navy-900/20 rounded-lg px-3 py-2 text-sm">
                  <option value="">Cliente *</option>
                  {data.clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
                <select value={nuevaPoliza.producto_id}
                        onChange={(e) => {
                          const pid = e.target.value;
                          const prod = data.productos.find((p) => String(p.id) === pid);
                          setNuevaPoliza({
                            ...nuevaPoliza, producto_id: pid,
                            ramo: prod?.ramo ?? nuevaPoliza.ramo,
                            aseguradora: prod?.aseguradora ?? nuevaPoliza.aseguradora,
                            vigencia_tipo: prod?.vigencia_tipo ?? nuevaPoliza.vigencia_tipo,
                          });
                        }}
                        className="w-full bg-cream border border-navy-900/20 rounded-lg px-3 py-2 text-sm">
                  <option value="">Producto del catálogo (opcional)</option>
                  {data.productos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} · {p.ramo_etiqueta} · {p.vigencia_etiqueta}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <select value={nuevaPoliza.ramo} onChange={(e) => setNuevaPoliza({ ...nuevaPoliza, ramo: e.target.value })}
                          className="w-full bg-cream border border-navy-900/20 rounded-lg px-3 py-2 text-sm">
                    {RAMOS.concat("transporte").map((r) => <option key={r} value={r}>{ETIQUETA_RAMO[r] ?? r}</option>)}
                  </select>
                  <input value={nuevaPoliza.aseguradora} onChange={(e) => setNuevaPoliza({ ...nuevaPoliza, aseguradora: e.target.value })} placeholder="Aseguradora"
                         className="w-full bg-cream border border-navy-900/20 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select value={nuevaPoliza.vigencia_tipo} onChange={(e) => setNuevaPoliza({ ...nuevaPoliza, vigencia_tipo: e.target.value })}
                          className="w-full bg-cream border border-navy-900/20 rounded-lg px-3 py-2 text-sm">
                    <option value="anual">Vigencia anual</option>
                    <option value="temporal">Temporal (plazo definido)</option>
                    <option value="embarque">Por embarque (fletes)</option>
                  </select>
                  <input value={nuevaPoliza.prima_anual} onChange={(e) => setNuevaPoliza({ ...nuevaPoliza, prima_anual: e.target.value })} placeholder="Prima"
                         type="number" className="w-full bg-cream border border-navy-900/20 rounded-lg px-3 py-2 text-sm" />
                </div>
                <input value={nuevaPoliza.fecha_vencimiento} onChange={(e) => setNuevaPoliza({ ...nuevaPoliza, fecha_vencimiento: e.target.value })} type="date"
                       className="w-full bg-cream border border-navy-900/20 rounded-lg px-3 py-2 text-sm" />
                <button className="w-full bg-navy-900 text-white rounded-lg px-4 py-2 text-sm font-semibold">Guardar póliza</button>
              </form>

              {pagoDe && (
                <form onSubmit={crearPago} className="bg-white rounded-2xl border border-gold p-4 space-y-2">
                  <p className="font-sans text-base text-navy-900">Pago de {pagoDe.cliente_nombre}</p>
                  <p className="text-[11px] text-navy-900/55">
                    Puedes registrar varios pagos de la misma póliza: un pago parcial hoy y otro más adelante.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={nuevoPago.monto} onChange={(e) => setNuevoPago({ ...nuevoPago, monto: e.target.value })} placeholder="Monto *" type="number" required
                           className="w-full bg-cream border border-navy-900/20 rounded-lg px-3 py-2 text-sm" />
                    <input value={nuevoPago.fecha_limite} onChange={(e) => setNuevoPago({ ...nuevoPago, fecha_limite: e.target.value })} type="date"
                           className="w-full bg-cream border border-navy-900/20 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <select value={nuevoPago.estado} onChange={(e) => setNuevoPago({ ...nuevoPago, estado: e.target.value })}
                          className="w-full bg-cream border border-navy-900/20 rounded-lg px-3 py-2 text-sm">
                    <option value="pendiente">Pendiente</option>
                    <option value="parcial">Pago parcial</option>
                    <option value="pagado">Pagado completo</option>
                  </select>
                  <div className="flex gap-2">
                    <button className="flex-1 bg-navy-900 text-white rounded-lg px-4 py-2 text-sm font-semibold">Registrar pago</button>
                    <button type="button" onClick={() => setPagoDe(null)} className="text-sm text-navy-900/60">Cancelar</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {seccion === "servicios" && (
          <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-5">
            {/* catalogo de servicios */}
            <section className="bg-white rounded-2xl border border-navy-900/10 p-4">
              <p className="font-sans text-lg text-navy-900 mb-1">Catálogo de servicios ({data.productos.length})</p>
              <p className="text-xs text-navy-900/55 mb-3">
                Productos que vendes (Aseguradora del Valle Trascendi, Vida Temporal, Fletes…). Al crear una póliza puedes
                elegir uno del catálogo y hereda ramo, aseguradora y tipo de vigencia.
              </p>
              <div className="space-y-2">
                {data.productos.map((p) => (
                  <div key={p.id} className="border border-navy-900/10 rounded-xl p-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-navy-900">{p.nombre}</p>
                      <p className="text-xs text-navy-900/55">
                        {p.aseguradora} · {p.ramo_etiqueta} · {p.vigencia_etiqueta}
                      </p>
                      {p.descripcion && <p className="text-xs text-navy-900/45 mt-0.5">{p.descripcion}</p>}
                    </div>
                    <button onClick={() => void api(`/productos/${p.id}/delete`, "DELETE").then(cargar)}
                            className="shrink-0 text-xs text-red rounded-full px-2 py-1">✕</button>
                  </div>
                ))}
                {data.productos.length === 0 && <p className="text-sm text-navy-900/60">Catálogo vacío.</p>}
              </div>
            </section>

            {/* alta de servicio */}
            <form onSubmit={crearProducto} className="bg-white rounded-2xl border border-navy-900/10 p-4 space-y-2 h-fit">
              <p className="font-sans text-base text-navy-900">Agregar servicio</p>
              <input value={nuevoProducto.nombre} onChange={(e) => setNuevoProducto({ ...nuevoProducto, nombre: e.target.value })}
                     placeholder="Nombre comercial (ej. Fletes, Vida Temporal) *" required
                     className="w-full bg-cream border border-navy-900/20 rounded-lg px-3 py-2 text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <input value={nuevoProducto.aseguradora} onChange={(e) => setNuevoProducto({ ...nuevoProducto, aseguradora: e.target.value })} placeholder="Aseguradora"
                       className="w-full bg-cream border border-navy-900/20 rounded-lg px-3 py-2 text-sm" />
                <select value={nuevoProducto.ramo} onChange={(e) => setNuevoProducto({ ...nuevoProducto, ramo: e.target.value })}
                        className="w-full bg-cream border border-navy-900/20 rounded-lg px-3 py-2 text-sm">
                  {RAMOS.concat("transporte").map((r) => <option key={r} value={r}>{ETIQUETA_RAMO[r] ?? r}</option>)}
                </select>
              </div>
              <select value={nuevoProducto.vigencia_tipo} onChange={(e) => setNuevoProducto({ ...nuevoProducto, vigencia_tipo: e.target.value })}
                      className="w-full bg-cream border border-navy-900/20 rounded-lg px-3 py-2 text-sm">
                <option value="anual">Vigencia anual</option>
                <option value="temporal">Temporal (plazo definido)</option>
                <option value="embarque">Por embarque (fletes)</option>
              </select>
              <textarea value={nuevoProducto.descripcion} onChange={(e) => setNuevoProducto({ ...nuevoProducto, descripcion: e.target.value })}
                        placeholder="Descripción breve" rows={2}
                        className="w-full bg-cream border border-navy-900/20 rounded-lg px-3 py-2 text-sm" />
              <button className="w-full bg-navy-900 text-white rounded-lg px-4 py-2 text-sm font-semibold">Agregar al catálogo</button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
