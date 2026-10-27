/** SpiderRadar v3 — LEGIBILIDAD 40+ estilo menu de videojuego
 * (directiva de Carlos 2026-08-25): "mi gente son arriba de 40, no tienen
 * buena vista, pero entienden de menus de videojuegos". Cambios:
 * - etiquetas con ICONO + nombre grande (fontWeight 700), contraste alto
 * - el poligono PROTAGONISTA: relleno fuerte + trazo grueso + halo suave
 *   (el "espacio de proteccion" — escenarios ante los que estas cubierto)
 * - anillos/numeros de nivel mas visibles (apoyo, no competencia)
 * - tamaño mayor (460x460, max-w 340px)
 * DATOS SIEMPRE del motor: P_d, estados (N/A y DESCONOCIDO se atenuan y no
 * forman parte del poligono). El motor tiene prioridad sobre el diseno. */
import { AD_LABELS, AD_ORDER } from "../data/conversacion";

const W = 480;
const H = 480;
const CX = W / 2;
const CY = H / 2;
const R = 165;
const NIVELES = [25, 50, 75, 100];

// iconos por dimension (lenguaje de videojuego: icono + nombre)
const ICONOS: Record<string, string> = {
  PF: "👨‍👩‍👧", IN: "💼", SA: "🏥", RE: "🏖️",
  HO: "🏠", MO: "🚗", ED: "🎓", NE: "🏪",
};

function punto(i: number, n: number, radio: number) {
  const ang = -Math.PI / 2 + (2 * Math.PI * i) / n;
  return [CX + radio * Math.cos(ang), CY + radio * Math.sin(ang)] as const;
}

function poly(radio: number, n: number) {
  return Array.from({ length: n }, (_, i) => punto(i, n, radio).join(",")).join(" ");
}

export default function SpiderRadar({
  valores,
  estados = {},
  prioridad = null,
}: {
  valores: Record<string, number | null>;
  estados?: Record<string, string>;
  prioridad?: string | null;
}) {
  const n = AD_ORDER.length;
  const activos = AD_ORDER.filter((dim) => {
    const st = estados[dim];
    return st !== "N/A" && st !== "DESCONOCIDO" && valores[dim] != null;
  });
  // poligono solo con dimensiones evaluadas
  const polyPts = activos.length >= 3
    ? activos.map((dim) => punto(AD_ORDER.indexOf(dim), n, ((valores[dim] ?? 0) / 100) * R).join(",")).join(" ")
    : "";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[420px] mx-auto overflow-visible"
         role="img" aria-label="Radar de protección patrimonial">
      {/* anillos de nivel 25/50/75/100 (apoyo legible) */}
      {NIVELES.map((lv) => (
        <polygon key={lv} points={poly((R * lv) / 100, n)} fill="none" stroke="var(--navy-900)" strokeOpacity={0.2} strokeDasharray={lv === 100 ? "0" : "3 3"} />
      ))}
      {/* ejes */}
      {AD_ORDER.map((dim, i) => {
        const [x, y] = punto(i, n, R);
        const st = estados[dim];
        const atenuado = st === "N/A" || st === "DESCONOCIDO" || valores[dim] == null;
        return (
          <line key={dim} x1={CX} y1={CY} x2={x} y2={y}
                stroke="var(--navy-900)"
                strokeOpacity={atenuado ? 0.12 : 0.25}
                strokeWidth={dim === prioridad ? 2.5 : 1}
                strokeDasharray={atenuado ? "4 4" : "0"} />
        );
      })}
      {/* HALO del poligono (profundidad del "espacio de proteccion") */}
      {polyPts && (
        <polygon points={polyPts} fill="var(--gold)" fillOpacity={0.14} stroke="var(--gold)" strokeWidth={8} strokeLinejoin="round" strokeOpacity={0.35} />
      )}
      {/* poligono de proteccion (protagonista) */}
      {polyPts && (
        <polygon points={polyPts} fill="var(--gold)" fillOpacity={0.48} stroke="var(--gold)" strokeWidth={3} strokeLinejoin="round" />
      )}
      {/* vertices: solo cuando hay poligono (>= 3 dims evaluadas) */}
      {activos.length >= 3 && AD_ORDER.map((dim, i) => {
        const st = estados[dim];
        const atenuado = st === "N/A" || st === "DESCONOCIDO" || valores[dim] == null;
        const v = valores[dim];
        const [x, y] = punto(i, n, atenuado ? 0 : ((v ?? 0) / 100) * R);
        if (atenuado) return null;
        return (
          <circle key={dim} cx={x} cy={y} r={dim === prioridad ? 6 : 4.5}
                  fill={dim === prioridad ? "var(--red)" : "var(--navy-900)"} />
        );
      })}
      {/* etiquetas: ICONO grande + nombre (legibles de un vistazo) */}
      {AD_ORDER.map((dim, i) => {
        const [x, y] = punto(i, n, R + 26);
        const st = estados[dim];
        const atenuado = st === "N/A" || st === "DESCONOCIDO" || valores[dim] == null;
        const esPrioridad = dim === prioridad;
        return (
          <g key={dim}>
            <text x={x} y={y - 10} textAnchor="middle" dominantBaseline="middle"
                  fontSize={17}
                  opacity={atenuado ? 0.4 : 1}>
              {ICONOS[dim] ?? "•"}
            </text>
            <text x={x} y={y + 14} textAnchor="middle" dominantBaseline="middle"
                  fontSize={12.5} fontWeight={esPrioridad ? 800 : 700}
                  fill={esPrioridad ? "var(--red)" : "var(--navy-900)"}
                  opacity={atenuado ? 0.5 : 1}>
              {AD_LABELS[dim] ?? dim}
            </text>
            {atenuado && (
              <text x={x} y={y + 29} textAnchor="middle" fontSize={10} fill="var(--navy-900)" opacity={0.55}>
                {st === "N/A" ? "no aplica" : "—"}
              </text>
            )}
          </g>
        );
      })}
      {/* niveles numericos (eje vertical superior) */}
      {NIVELES.map((lv) => (
        <text key={lv} x={CX + 10} y={CY - (R * lv) / 100 + 4} fontSize={11} fontWeight={600} fill="var(--navy-900)" opacity={0.55}>
          {lv}
        </text>
      ))}
      {/* marcador de prioridad (estilo "A" de la publicidad) */}
      {prioridad && activos.length >= 3 && (
        <text x={CX} y={CY - (R * (valores[prioridad] ?? 0)) / 100 - 14}
              textAnchor="middle" fontSize={16} fontWeight={800} fill="var(--red)">
          ▲
        </text>
      )}
      {/* sin poligono: mensaje de construccion (en vez de nodos sueltos) */}
      {activos.length < 3 && (
        <text x={CX} y={CY - 44} textAnchor="middle" fontSize={13}
              fontWeight={700} fill="var(--navy-900)" opacity={0.6}>
          Tu radar se construye
        </text>
      )}
      {activos.length < 3 && (
        <text x={CX} y={CY - 24} textAnchor="middle" fontSize={11.5}
              fill="var(--navy-900)" opacity={0.5}>
          con cada respuesta
        </text>
      )}
    </svg>
  );
}
