import { useState } from "react";
import { Link } from "react-router-dom";
import { SITE } from "../data/site";
import logo from "../assets/marca-logo-claro.png";
import PrivacyModal from "./PrivacyModal";

export default function Footer() {
  const [showPrivacy, setShowPrivacy] = useState(false);

  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <img src={logo} alt="Vértice Patrimonial" className="footer-logo" />
          <p className="footer-tagline">{SITE.tagline}</p>
          <p className="footer-small">
            Resultados con estrategia. Asesoría patrimonial respaldada por Aseguradora del Valle.
          </p>
        </div>

        <div>
          <h4>Navegación</h4>
          <ul>
            <li><Link to="/">Inicio</Link></li>
            <li><Link to="/evaluacion">Evaluación de Riesgo Patrimonial</Link></li>
            <li><a href="/#contacto">Contacto</a></li>
          </ul>
        </div>

        <div>
          <h4>Contacto</h4>
          <ul>
            <li>
              <a href={SITE.whatsappUrl("Hola Carlos, quiero agendar mi asesoría patrimonial.")}>
                WhatsApp: 55 0000 0000
              </a>
            </li>
            <li><a href={SITE.instagram} target="_blank" rel="noreferrer">Instagram</a></li>
            <li><a href={SITE.facebook} target="_blank" rel="noreferrer">Facebook</a></li>
          </ul>
        </div>
      </div>

      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} {SITE.brand}. Todos los derechos reservados.</span>
        <button className="link-btn" onClick={() => setShowPrivacy(true)}>
          Aviso de Privacidad
        </button>
      </div>

      {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}
    </footer>
  );
}
