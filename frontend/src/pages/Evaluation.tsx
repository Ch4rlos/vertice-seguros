import { useState } from "react";
import { Link } from "react-router-dom";
import { AREAS, SITE } from "../data/site";

const OUTPUTS = [
  { title: "Radar patrimonial", desc: "Tu nivel de protección en 8 áreas, en tiempo real." },
  { title: "Índice de resiliencia", desc: "Una métrica clara de qué tan preparado estás ante imprevistos." },
  { title: "Fortalezas y riesgos", desc: "Lo que ya proteges y los huecos que debes atender." },
  { title: "Estrategia recomendada", desc: "Prioridades accionables — no productos, primero estrategia." },
];

export default function Evaluation() {
  const [comingSoon, setComingSoon] = useState(false);

  return (
    <>
      <section className="hero hero-compact">
        <div className="container center">
          <p className="eyebrow">CQ PATRIMONIAL AI</p>
          <h1 className="hero-title">
            Evaluación de <em>Riesgo Patrimonial</em>
          </h1>
          <p className="hero-sub">
            Un sistema experto que analiza tu situación personal, familiar y
            financiera con una sola pregunta a la vez — y construye tu
            diagnóstico en tiempo real.
          </p>
          <div className="hero-actions">
            {comingSoon ? (
              <div className="coming-soon">
                <p>⚙️ El motor de diagnóstico está en construcción.</p>
                <p className="hero-micro">
                  Mientras tanto, agenda tu asesoría personalizada.
                </p>
              </div>
            ) : (
              <button className="btn btn-primary btn-lg" onClick={() => setComingSoon(true)}>
                Comenzar evaluación
              </button>
            )}
          </div>
          <p className="hero-micro">5 minutos · Gratis · Confidencial</p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <p className="eyebrow">QUÉ OBTENDRÁS</p>
          <h2 className="section-title">Un diagnóstico, no un formulario</h2>
          <div className="cards-4">
            {OUTPUTS.map((o) => (
              <div key={o.title} className="card">
                <h3>{o.title}</h3>
                <p>{o.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container">
          <p className="eyebrow">ÁREAS EVALUADAS</p>
          <h2 className="section-title">Tu patrimonio visto en 8 dimensiones</h2>
          <div className="areas-grid">
            {AREAS.map((a) => (
              <div key={a.name} className="area-chip">
                <span className="area-icon">{a.icon}</span>
                <span>{a.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container center">
          <h2 className="section-title">¿Prefieres hablar primero?</h2>
          <p className="section-sub">
            Una conversación de 30 minutos para conocer tu situación. Sin costo
            y sin compromiso.
          </p>
          <a
            href={SITE.whatsappUrl("Hola Carlos, quiero una asesoría patrimonial personalizada.")}
            target="_blank"
            rel="noreferrer"
            className="btn btn-whatsapp btn-lg"
          >
            Agendar por WhatsApp
          </a>
          <p className="hero-micro">
            <Link to="/">← Volver al inicio</Link>
          </p>
        </div>
      </section>
    </>
  );
}
