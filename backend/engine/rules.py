"""RuleEngine: resuelve reglas del Knowledge JSON en orden determinista (id)."""
from .expr import Evaluator


class RuleEngine:
    def __init__(self, knowledge, registry, evaluator_factory):
        self.kb = knowledge
        self.reg = registry
        self.eval = Evaluator({}, self.reg.get)
        self._factory = evaluator_factory
        self.disparadas = []  # [{id, tipo, dimension, clasificacion}]
        self.brechas = {}     # dimension -> [ {concepto, monto, reglas} ]

    def resolver(self):
        """Evalua todas las reglas; registra disparos y brechas."""
        self.disparadas = []
        self.brechas = {}
        for regla in self.kb.reglas():
            cond = regla.get("condicion_eval", "")
            if cond.startswith("@"):
                continue  # reglas gestionadas por el motor (R10, R13, R13f)
            if not cond:
                continue
            try:
                dispara = bool(self._factory()(cond))
            except Exception:
                dispara = False  # regla no evaluable -> no dispara (D1)
            if not dispara:
                continue
            self.disparadas.append({
                "id": regla["id"],
                "tipo": regla.get("tipo"),
                "dimension": regla.get("dimension"),
                "clasificacion": regla.get("clasificacion"),
                "justificacion": regla.get("justificacion", ""),
                "fuente": regla.get("fuente", ""),
            })
            # brechas cuantificadas declaradas en el JSON
            bcalc = regla.get("brecha_calculo")
            if bcalc:
                try:
                    monto = self._factory()(bcalc)
                except Exception:
                    monto = None
                if monto:
                    dim = regla.get("dimension")
                    self.brechas.setdefault(dim, []).append({
                        "concepto": regla.get("efecto", regla["id"]),
                        "monto_mxn": round(monto, 2),
                        "reglas": [regla["id"]],
                    })
        return self.disparadas

    def ids_disparadas(self):
        return [d["id"] for d in self.disparadas]
