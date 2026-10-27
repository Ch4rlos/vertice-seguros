import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { SITE } from "../data/site";
import logo from "../assets/marca-logo.png";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  // "Evaluar mi patrimonio" SOLO en la landing (feedback de Carlos):
  // en el diagnostico o resultados no tiene nada que hacer.
  const enLanding = loc.pathname === "/";

  return (
    <header className="nav">
      <div className="nav-inner">
        <Link to="/" className="nav-brand" onClick={() => setOpen(false)}>
          <img src={logo} alt="Vértice Patrimonial" className="nav-logo" />
          <span className="nav-brand-text">
            <strong>Vértice Patrimonial</strong>
          </span>
        </Link>

        <nav className={`nav-links ${open ? "open" : ""}`}>
          {SITE.nav.map((item) => (
            <a key={item.label} href={item.href} onClick={() => setOpen(false)}>
              {item.label}
            </a>
          ))}
          {enLanding && (
            <Link to="/diagnostico" className="btn btn-primary btn-sm" onClick={() => setOpen(false)}>
              Evaluar mi patrimonio
            </Link>
          )}
        </nav>

        <button
          className="nav-toggle"
          aria-label="Menú"
          onClick={() => setOpen(!open)}
        >
          ☰
        </button>
      </div>
    </header>
  );
}
