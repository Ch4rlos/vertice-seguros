/** CP-10: vista publica ANONIMA del compartido.
 * Solo Spider Chart + banda general + invitacion a hacer el propio
 * diagnostico. Sin nombre, sin telefono, sin prioridad identificable. */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import SpiderRadar from "../components/SpiderRadar";

const API = "/api/evaluations";

const ETIQUETA_BANDA: Record<string, string> = {
  BAJO: "Bajo", MEDIO: "Medio", ALTO: "Alto",
};

export default function Compartido() {
  const { token } = useParams();
  const [data, setData] = useState<{ banda: string | null; dimensiones: { id: string; P_d: number | null; estado: string }[] } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API}/compartido/${token}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Este enlace de diagnóstico no existe o ya no está disponible.");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, [token]);

  if (error) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-navy-900 mb-4">{error}</p>
          <Link to="/diagnostico" className="inline-block bg-navy-900 text-white rounded-xl px-6 py-3">Hacer mi propio diagnóstico</Link>
        </div>
      </div>
    );
  }
  if (!data) {
    return <div className="min-h-screen bg-cream flex items-center justify-center"><p className="text-navy-900">Cargando…</p></div>;
  }

  const radar = Object.fromEntries(data.dimensiones.map((d) => [d.id, d.P_d]));
  const estados = Object.fromEntries(data.dimensiones.map((d) => [d.id, d.estado]));

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full">
        <div className="bg-white rounded-2xl border border-navy-900/10 shadow-soft p-8 text-center">
          <p className="text-xs uppercase tracking-wide text-gold font-semibold mb-1">Diagnóstico patrimonial</p>
          <h1 className="font-sans text-3xl text-navy-900 mb-1">Así se ve mi protección</h1>
          <p className="text-sm text-navy-900/60 mb-6">
            Estado general: <strong>{ETIQUETA_BANDA[data.banda ?? ""] ?? data.banda ?? "—"}</strong>
          </p>
          <div className="mx-auto max-w-[420px]">
            <SpiderRadar valores={radar} estados={estados} />
          </div>
          <p className="text-xs text-navy-900/45 mt-6 leading-relaxed">
            Esta es una vista general y anónima de mi diagnóstico patrimonial: las áreas con más
            protección se dibujan más lejos del centro.
          </p>
          <Link to="/diagnostico"
                className="mt-6 inline-block bg-navy-900 text-white rounded-xl px-8 py-4 font-semibold hover:bg-navy-900/90 transition">
            Haz tu propio diagnóstico
          </Link>
        </div>
      </div>
    </div>
  );
}
