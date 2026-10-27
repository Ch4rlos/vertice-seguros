"""Scoring: P_d (ratio, techo 95), R_d (sondas), IRP (solo activas)."""
from .expr import Evaluator

TECHO = 95  # riesgo residual estructural (spec v0.3, resultado.pdf)


class ScoringEngine:
    def __init__(self, knowledge, registry, evaluator_factory, estado_dim):
        self.kb = knowledge
        self.reg = registry
        self._factory = evaluator_factory
        self.estado_dim = estado_dim  # dict dimension -> estado final
        self.P = {}
        self.R = {}
        self.sondas_activas = []

    # ------------------------------------------------------------------ P_d
    def calcular_P(self):
        formulas = self.kb.scoring().get("formulas", {})
        self.P = {}
        for dim, formula in formulas.items():
            if self.estado_dim.get(dim) in ("N/A",):
                continue
            try:
                valor = self._factory()(formula)
            except Exception:
                valor = None
            if valor is None:
                continue
            self.P[dim] = min(TECHO, max(0.0, float(valor)))
        return self.P

    # ------------------------------------------------------------------ R_d
    def calcular_R(self):
        sondas = self.kb.scoring().get("R_d", {}).get("sondas", [])
        self.sondas_activas = []
        por_dim = {}
        for sonda in sondas:
            try:
                dispara = bool(self._factory()(sonda["condicion"]))
            except Exception:
                dispara = False
            if not dispara:
                continue
            dim = sonda["dimension"]
            banda = sonda.get("banda", "MEDIO")
            self.sondas_activas.append({"id": sonda["id"], "dimension": dim, "banda": banda})
            if banda == "ALTO":
                por_dim[dim] = "ALTO"
            elif banda == "MEDIO" and por_dim.get(dim) != "ALTO":
                por_dim[dim] = "MEDIO"
            elif banda == "BAJO" and dim not in por_dim:
                por_dim[dim] = "BAJO"
        self.R = {dim: por_dim.get(dim, "BAJO") for dim in self.estado_dim}
        return self.R

    # ------------------------------------------------------------------ IRP
    def calcular_IRP(self):
        pesos = self.kb.pesos_irp()
        activas = []
        for dim in self.estado_dim:
            estado = self.estado_dim[dim]
            # OBJETIVO / N/A / DESCONOCIDO quedan fuera; RIESGO/NECESIDAD/
            # OPORTUNIDAD (proteccion activa) entran
            if estado in ("RIESGO", "NECESIDAD", "OPORTUNIDAD") and dim in self.P:
                activas.append(dim)
        if not activas:
            return {"valor": None, "banda": None, "activas": [], "excluidas": self._excluidas(pesos)}
        total_w = sum(pesos.get(d, 0) for d in activas)
        if total_w <= 0:
            return {"valor": None, "banda": None, "activas": [], "excluidas": self._excluidas(pesos)}
        valor = sum(pesos.get(d, 0) * self.P[d] for d in activas) / total_w
        return {
            "valor": round(valor, 1),
            "banda": self._banda(valor),
            "activas": activas,
            "excluidas": self._excluidas(pesos),
        }

    def _excluidas(self, pesos):
        excl = {}
        for dim in self.estado_dim:
            estado = self.estado_dim[dim]
            if estado not in ("RIESGO", "NECESIDAD", "OPORTUNIDAD"):
                excl[dim] = estado
        return excl

    def _banda(self, valor):
        for b in self.kb.raw.get("bandas_irp", []):
            if b["min"] <= valor < b["max"] or (valor >= b["min"] and b["max"] == 95 and valor <= 95):
                if b["min"] <= valor:
                    return b["nivel"]
        return "DESCONOCIDO"
