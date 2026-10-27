// Testimonios — comentarios Aseguradora del Valle-positivos (placeholders hasta tener los reales)
const TESTIMONIALS = [
  {
    initials: "JM",
    name: "J. Martínez",
    city: "Monterrey, N.L.",
    quote:
      "Llevo años con Aseguradora del Valle y el respaldo siempre ha estado ahí. Una evaluación así te hace ver lo que no sabías que estaba en riesgo.",
  },
  {
    initials: "LR",
    name: "L. Rivera",
    city: "San Pedro, N.L.",
    quote:
      "La tranquilidad de saber que mi familia está protegida no tiene precio. El proceso de Aseguradora del Valle es claro y el acompañamiento humano hace la diferencia.",
  },
  {
    initials: "AG",
    name: "A. Garza",
    city: "Guadalupe, N.L.",
    quote:
      "Nunca había entendido del todo mi cobertura. Hablar con un asesor que primero escucha y después propone — eso se agradece.",
  },
];

export default function Testimonials() {
  return (
    <section className="section section-alt" id="testimonios">
      <div className="container">
        <p className="eyebrow">TESTIMONIOS</p>
        <h2 className="section-title">Personas que ya tomaron el control</h2>
        <div className="cards-3">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="card testimonial">
              <p className="testimonial-quote">“{t.quote}”</p>
              <div className="testimonial-author">
                <span className="avatar">{t.initials}</span>
                <div>
                  <strong>{t.name}</strong>
                  <small>{t.city}</small>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
