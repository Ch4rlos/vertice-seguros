/** Semáforo de urgencia (directiva de Carlos 2026-08-24): tarjetas rojas
 * MONOCROMÁTICAS por nivel 1-3 (rojo suave / medio / intenso). Detecta los
 * peores escenarios de cada segmento SIN reordenar las prioridades del
 * motor: el orden sigue siendo la verdad; la bandera dice "esto es un tumor,
 * se atiende ya". Cada tarjeta trae acción de mitigación mínima accesible. */
import { AD_LABELS } from "../data/conversacion";

const NOMBRES: Record<string, string> = {
  PF: "Familia", IN: "Ingresos", SA: "Salud", RE: "Retiro",
  HO: "Hogar", MO: "Movilidad", ED: "Educación", NE: "Negocio",
};

export type BanderaUrgencia = {
  dimension: string;
  nivel: 1 | 2 | 3;
  titulo: string;
  texto: string;
  accion: string;
};

const ESTILOS: Record<number, { barra: string; badge: string; fondo: string; texto: string }> = {
  3: { barra: "bg-red", badge: "bg-red text-white", fondo: "bg-red/[0.07]", texto: "text-red" },
  2: { barra: "bg-red/70", badge: "bg-red/80 text-white", fondo: "bg-red/[0.05]", texto: "text-red/90" },
  1: { barra: "bg-red/40", badge: "bg-red/50 text-white", fondo: "bg-red/[0.03]", texto: "text-red/80" },
};

const ETIQUETA_NIVEL: Record<number, string> = {
  3: "URGENTE — atiende esto ya",
  2: "ATENCIÓN — resuelve en el corto plazo",
  1: "ALERTA — ponle plan",
};

function labelDim(d: string): string {
  return AD_LABELS[d] ?? NOMBRES[d] ?? d;
}

export default function SemaforoUrgencia({ banderas }: { banderas: BanderaUrgencia[] }) {
  if (!banderas || banderas.length === 0) return null;
  return (
    <div className="space-y-2.5">
      {banderas.map((b, i) => {
        const s = ESTILOS[b.nivel] ?? ESTILOS[1];
        return (
          <div key={`${b.dimension}-${i}`} className={`${s.fondo} border border-red/25 rounded-xl p-4 flex gap-3`}>
            <div className={`${s.barra} w-1.5 rounded-full shrink-0`} aria-hidden />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${s.badge}`}>
                  ⚠ {ETIQUETA_NIVEL[b.nivel]}
                </span>
                <span className={`text-xs font-semibold uppercase tracking-wide ${s.texto}`}>{labelDim(b.dimension)}</span>
              </div>
              <p className="font-sans text-base text-navy-900 leading-snug">{b.titulo}</p>
              <p className="text-sm text-navy-900/75 mt-1">{b.texto}</p>
              <p className="text-xs text-navy-900/60 mt-2">
                <span className="font-semibold">Qué hacer: </span>
                {b.accion}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
