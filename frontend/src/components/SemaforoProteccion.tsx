/** Semáforo de PROTECCIÓN por dimensión (directiva de Carlos 2026-08-24):
 * el nivel de protección (P_d) de cada área en 4 tonos — verde ≥80,
 * amarillo 60-79, naranja 40-59, rojo <40 — con el tope estructural del
 * segmento visible (SA y MO llegan a 80; HO depende de la zona; el techo
 * global del motor es 95: "no existe 100%"). Verificado contra los rangos
 * reales de cada área: ningún segmento activo tiene techo por debajo de 80. */
import { AD_LABELS } from "../data/conversacion";

const NOMBRES: Record<string, string> = {
  PF: "Familia", IN: "Ingresos", SA: "Salud", RE: "Retiro",
  HO: "Hogar", MO: "Movilidad", ED: "Educación", NE: "Negocio",
};

export type ItemProteccion = {
  dimension: string;
  P_d: number;
  banda: "verde" | "amarillo" | "naranja" | "rojo";
  maximo_segmento: number;
  en_maximo: boolean;
};

export type OportunidadVenta = {
  dimension: string;
  banda: string;
  P_d: number;
  productos: { nombre: string; rentabilidad: number }[];
  rentabilidad_max: number;
};

const TONOS: Record<string, { barra: string; texto: string; chip: string; etiqueta: string }> = {
  verde: {
    barra: "bg-green",
    texto: "text-green",
    chip: "bg-green/10 text-green border-green/30",
    etiqueta: "Protección sólida",
  },
  amarillo: {
    barra: "bg-amber",
    texto: "text-amber-dark",
    chip: "bg-amber/10 text-amber-dark border-amber/30",
    etiqueta: "Espacio para mejorar",
  },
  naranja: {
    barra: "bg-orange",
    texto: "text-red-dark",
    chip: "bg-orange/10 text-red-dark border-orange/30",
    etiqueta: "Necesita atención",
  },
  rojo: {
    barra: "bg-red",
    texto: "text-red",
    chip: "bg-red/10 text-red border-red/30",
    etiqueta: "Exposición crítica",
  },
};

function labelDim(d: string): string {
  return AD_LABELS[d] ?? NOMBRES[d] ?? d;
}

function Estrellas({ n }: { n: number }) {
  return (
    <span className="text-gold tracking-tight" title={`Rentabilidad ${n} de 5`}>
      {"★".repeat(n)}
      <span className="text-navy-900/20">{"★".repeat(5 - n)}</span>
    </span>
  );
}

export function SemaforoProteccion({ items, mostrarTope = false }: { items: ItemProteccion[]; mostrarTope?: boolean }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="space-y-2">
      {items.map((s) => {
        const t = TONOS[s.banda] ?? TONOS.rojo;
        const pct = Math.min(100, Math.round((s.P_d / (s.maximo_segmento || 95)) * 100));
        return (
          <div key={s.dimension} className="flex items-center gap-3 text-sm">
            <span className={`w-20 shrink-0 font-semibold text-navy-900 ${t.texto}`}>
              {labelDim(s.dimension)}
            </span>
            <div className="flex-1 h-2.5 bg-navy-900/8 rounded-full overflow-hidden">
              <div className={`${t.barra} h-full rounded-full`} style={{ width: `${pct}%` }} />
            </div>
            <span className="w-14 text-right font-semibold text-navy-900 tabular-nums">
              {s.P_d}
            </span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap ${t.chip}`}>
              {t.etiqueta}
              {/* El tope del segmento es dato de negocio: SOLO en el panel */}
              {mostrarTope && s.en_maximo && " · máximo del segmento"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function OportunidadesDeVenta({ items }: { items: OportunidadVenta[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="space-y-2">
      {items.map((o) => (
        <div key={o.dimension} className="flex items-center justify-between gap-3 text-sm border-b border-navy-900/5 pb-1.5 last:border-0">
          <div className="min-w-0">
            <p className="font-semibold text-navy-900">
              {labelDim(o.dimension)}
              <span className="ml-2 text-xs font-normal text-navy-900/60">
                P_d {o.P_d} · {o.banda}
              </span>
            </p>
            <p className="text-xs text-navy-900/70 truncate">
              {o.productos.map((p) => p.nombre).join(" · ")}
            </p>
          </div>
          <Estrellas n={o.rentabilidad_max} />
        </div>
      ))}
    </div>
  );
}
