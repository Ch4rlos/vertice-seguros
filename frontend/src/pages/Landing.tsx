import { useEffect } from "react";
import { Link } from "react-router-dom";
import { SITE, AREAS } from "../data/site";
import Testimonials from "../components/Testimonials";
import carlosHero from "../assets/asesor-hero.png";
import carlosAbout from "../assets/asesor-about.jpg";

const PAINS = [
  {
    icon: "🛡️",
    title: "No sabes qué pasaría con tu familia",
    desc: "Si tú faltaras o te invalidaras mañana, ¿quién mantiene el estilo de vida de los tuyos?",
  },
  {
    icon: "💸",
    title: "Vives al día",
    desc: "El dinero entra y sale sin un plan. No hay un peso destinado a tu futuro.",
  },
  {
    icon: "🏚️",
    title: "Tu patrimonio está expuesto",
    desc: "Casa, auto, negocio: un imprevisto puede borrar años de esfuerzo.",
  },
  {
    icon: "📉",
    title: "No tienes estrategia de retiro",
    desc: "Depender solo de tu trabajo hoy significa depender de la suerte mañana.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Responde la evaluación",
    desc: "Preguntas dinámicas e inteligentes sobre tu situación personal, familiar y financiera. Toma menos de 5 minutos.",
  },
  {
    n: "02",
    title: "Agenda tu asesoría",
    desc: "Revisamos tu diagnóstico y diseñamos juntos tu estrategia de protección. Sin compromiso.",
  },
];

export default function Landing() {
  // Scroll-reveal (directiva de Carlos 2026-08-25): movimiento al hacer
  // scroll. IntersectionObserver PROPIO (first-party, sin librerias —
  // la superficie de ataque no cambia). Stagger por indice dentro del
  // grupo; respeta prefers-reduced-motion (el CSS lo neutraliza).
  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) {
      els.forEach((e) => e.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          const el = en.target as HTMLElement;
          const grupo = el.parentElement;
          if (grupo) {
            const idx = Array.from(grupo.children).indexOf(el);
            el.style.transitionDelay = `${idx * 70}ms`;
          }
          el.classList.add("is-visible");
          io.unobserve(el);
        });
      },
      { threshold: 0.12 }
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  return (
    <>
      {/* HERO */}
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <p className="eyebrow">ASESOR PATRIMONIAL · Aseguradora del Valle</p>
            <h1 className="hero-title">
              Descubre qué tan protegido está tu <em>patrimonio</em>
            </h1>
            <p className="hero-sub">
              En menos de 5 minutos, una evaluación gratuita te muestra el nivel
              de protección de tu familia, tu ingreso y lo que has construido —
              y qué riesgos podrían ponerlo en peligro.
            </p>
            <div className="hero-actions">
              <Link to="/diagnostico" className="btn btn-primary btn-lg">
                Hacer mi evaluación gratuita
              </Link>
            </div>
            <p className="hero-micro">Gratis · Confidencial · Sin compromiso</p>
          </div>
          <div className="hero-media">
            <div className="hero-photo-frame">
              <img src={carlosHero} alt="Ana Beltrán, asesora patrimonial" />
            </div>
          </div>
        </div>
      </section>

      {/* ¿ES PARA TI? */}
      <section className="section" id="beneficios">
        <div className="container center">
          <p className="eyebrow">¿ESTO ES PARA TI?</p>
          <h2 className="section-title">
            Cuatro señales de que tu patrimonio necesita atención
          </h2>
          <div className="cards-4">
            {PAINS.map((p) => (
              <div key={p.title} className="card pain-card reveal">
                <span className="pain-icon">{p.icon}</span>
                <h3>{p.title}</h3>
                <p>{p.desc}</p>
              </div>
            ))}
          </div>
          <div className="callout">
            <p>
              <strong>Si te identificas con algo de esto, la evaluación es para ti.</strong>
            </p>
            <Link to="/diagnostico" className="btn btn-primary">
              Hacer mi evaluación gratuita
            </Link>
          </div>
        </div>
      </section>

      {/* QUÉ MIDE */}
      <section className="section section-alt">
        <div className="container">
          <div className="section-head">
            <p className="eyebrow">QUÉ MIDE LA EVALUACIÓN</p>
            <h2 className="section-title">Ocho áreas de tu patrimonio, analizadas</h2>
            <p className="section-sub">
              Un motor de diagnóstico basado en metodología actuarial evalúa tu
              nivel de protección en tiempo real.
            </p>
          </div>
          <div className="areas-grid">
            {AREAS.map((a) => (
              <div key={a.name} className="area-chip reveal">
                <span className="area-icon">{a.icon}</span>
                <span>{a.name}</span>
              </div>
            ))}
          </div>
          <div className="center">
            <Link to="/diagnostico" className="btn btn-outline">
              Ver cómo funciona la evaluación
            </Link>
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section className="section" id="como-funciona">
        <div className="container center">
          <p className="eyebrow">CÓMO FUNCIONA</p>
          <h2 className="section-title">Dos pasos hacia tu diagnóstico</h2>
          <div className="cards-2">
            {STEPS.map((s) => (
              <div key={s.n} className="card step-card reveal">
                <span className="step-n">{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLATAFORMA */}
      <section className="section section-alt" id="plataforma">
        <div className="container center">
          <p className="eyebrow">NO ES SOLO UNA WEB</p>
          <h2 className="section-title">Trae Dashboard y CRM incluidos</h2>
          <p className="section-sub">
            Cada evaluación se convierte en un prospecto con diagnóstico, prioridades
            y siguiente acción. Nada se queda en una bandeja de correo.
          </p>
          <div className="cards-4">
            <div className="card pain-card reveal">
              <span className="pain-icon">📊</span>
              <h3>Dashboard</h3>
              <p>Cuántos prospectos tienes, en qué etapa van y qué nivel de protección tiene cada uno.</p>
            </div>
            <div className="card pain-card reveal">
              <span className="pain-icon">🗂️</span>
              <h3>CRM</h3>
              <p>Ficha por prospecto: diagnóstico, pólizas, vencimientos y la siguiente acción comercial.</p>
            </div>
            <div className="card pain-card reveal">
              <span className="pain-icon">🧠</span>
              <h3>Diagnóstico automático</h3>
              <p>Motor con metodología actuarial que evalúa ocho áreas del patrimonio en menos de cinco minutos.</p>
            </div>
            <div className="card pain-card reveal">
              <span className="pain-icon">🔗</span>
              <h3>Resultado compartible</h3>
              <p>El prospecto recibe su diagnóstico en un enlace propio, sin instalar nada.</p>
            </div>
          </div>
          <div className="callout">
            <p>
              <strong>¿Te gusta? Te lo ajusto a tu medida:</strong> tu marca, tu
              aseguradora, tus productos y tus reglas de venta. Tú pones el
              conocimiento, yo el sistema.
            </p>
          </div>
        </div>
      </section>

      {/* CONFIANZA */}
      <section className="section section-dark">
        <div className="container trust-grid reveal">
          <div className="trust-photo-wrap">
            <div className="trust-photo-frame">
              <img src={carlosAbout} alt="Ana Beltrán" className="trust-photo" />
            </div>
          </div>
          <div>
            <p className="eyebrow">¿QUIÉN TE VA A ASESORAR?</p>
            <h2 className="section-title">Ana Beltrán</h2>
            <p className="section-dark-text">
              Asesora patrimonial y agente de seguros certificada por Aseguradora del Valle. Mi trabajo no es venderte un producto: es ayudarte a
              comprender tu situación patrimonial para que tomes mejores
              decisiones de protección financiera.
            </p>
            <blockquote className="trust-quote">
              "No vendemos productos. Diseñamos estrategias."
            </blockquote>
            <p className="trust-creds">
              Especialista en protección patrimonial · Ahorro e inversión ·
              Retiro · Educación universitaria
            </p>
          </div>
        </div>
      </section>

      <Testimonials />

      {/* CONTACTO */}
      <section className="section" id="contacto">
        <div className="container center">
          <p className="eyebrow">CONTACTO</p>
          <h2 className="section-title">Hablemos de tu patrimonio</h2>
          <p className="section-sub">
            El primer paso es una conversación. Cuéntame tu situación y juntos
            encontramos el mejor camino.
          </p>
          <a
            href={SITE.whatsappUrl("Hola Carlos, quiero agendar mi asesoría patrimonial.")}
            target="_blank"
            rel="noreferrer"
            className="btn btn-whatsapp btn-lg"
          >
            Escríbeme por WhatsApp
          </a>
          <p className="hero-micro">Respondo en menos de 24 horas</p>
        </div>
      </section>
    </>
  );
}
