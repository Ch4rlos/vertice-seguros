import { Route, Routes, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Landing from "./pages/Landing";
import Evaluation from "./pages/Evaluation";
import Diagnostico from "./pages/Diagnostico";
import Resultado from "./pages/Resultado";
import Panel from "./pages/Panel";
import PanelProspecto from "./pages/PanelProspecto";
import PanelCrm from "./pages/PanelCrm";
import Compartido from "./pages/Compartido";

export default function App() {
  const loc = useLocation();
  // El chat ocupa todo el viewport (sin scroll de pagina): el footer de la
  // landing no aplica en las rutas de diagnostico. El panel privado tampoco
  // lleva nav/footer de la landing.
  const esChat = loc.pathname.startsWith("/diagnostico");
  const esPanel = loc.pathname.startsWith("/panel");
  return (
    <>
      {!esPanel && <Navbar />}
      <main>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/evaluacion" element={<Evaluation />} />
          <Route path="/diagnostico" element={<Diagnostico />} />
          <Route path="/diagnostico/resultado" element={<Resultado />} />
          <Route path="/compartido/:token" element={<Compartido />} />
          <Route path="/panel" element={<Panel />} />
          <Route path="/panel/prospectos/:id" element={<PanelProspecto />} />
          <Route path="/panel/crm" element={<PanelCrm />} />
          <Route path="*" element={<Landing />} />
        </Routes>
      </main>
      {!esChat && !esPanel && <Footer />}
    </>
  );
}
