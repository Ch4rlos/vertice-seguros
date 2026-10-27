export default function PrivacyModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Cerrar">✕</button>
        <h3>Aviso de Privacidad</h3>
        <p>
          En <strong>Vértice Patrimonial</strong> (Ana Beltrán Soluciones
          Estratégicas) tratamos tus datos personales de forma confidencial y
          exclusivamente para: atender solicitudes de asesoría patrimonial,
          elaborar diagnósticos de riesgo, dar seguimiento comercial y cumplir
          obligaciones derivadas de la relación con Aseguradora del Valle.
        </p>
        <p>
          No comercializamos ni transferimos tus datos a terceros sin tu
          consentimiento, salvo los supuestos previstos por la Ley Federal de
          Protección de Datos Personales en Posesión de los Particulares
          (LFPDPPP). Puedes ejercer tus derechos ARCO en cualquier momento
          escribiéndonos por WhatsApp.
        </p>
        <p className="modal-small">
          Este aviso corresponde a la versión MVP de la plataforma; el aviso
          integral se publicará en versiones posteriores conforme al spec del
          proyecto.
        </p>
      </div>
    </div>
  );
}
