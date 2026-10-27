"""PriorityEngine (PR_d multicriterio, IRP != prioridad) + Classifier (R13)."""
from .expr import Evaluator


class Classifier:
    """Determina el estado final de cada dimension (R13 y reglas n_a)."""

    def __init__(self, knowledge, registry, evaluator_factory, reglas_disparadas, P):
        self.kb = knowledge
        self.reg = registry
        self._factory = evaluator_factory
        self.disparadas = {d["id"] for d in reglas_disparadas}
        self.P = P

    def clasificar(self):
        estados = {}
        for dim_info in self.kb.dimensiones():
            dim = dim_info["id"]
            if any(r in self.disparadas for r in self._reglas(dim, "n_a")):
                estados[dim] = "N/A"
                continue
            if any(r in self.disparadas for r in self._reglas(dim, "RIESGO")):
                estados[dim] = "RIESGO"
                continue
            if any(r in self.disparadas for r in self._reglas(dim, "NECESIDAD")):
                estados[dim] = "NECESIDAD"
                continue
            if any(r in self.disparadas for r in self._reglas(dim, "OBJETIVO")):
                estados[dim] = "OBJETIVO"
                continue
            if not self._evaluada(dim):
                estados[dim] = "DESCONOCIDO"
                continue
            estados[dim] = "OPORTUNIDAD" if self.P.get(dim, 0) >= 70 else "NECESIDAD"
        return estados

    def _reglas(self, dim, clase):
        return [
            r["id"] for r in self.kb.reglas()
            if r.get("dimension") == dim
            and r.get("tipo") not in ("interaccion", "cascada")
            and (r.get("tipo") == clase or r.get("clasificacion") == clase)
        ]

    def _evaluada(self, dim):
        for v in self.kb.variables():
            if v.get("dimension") == dim and self.reg.get(v["id"]) is not None:
                return True
        return False


class PriorityEngine:
    """PR_d segun tablas declaradas en knowledge.scoring.prioridad (H8)."""

    def __init__(self, knowledge, registry, estados, reglas_disparadas, brechas):
        self.kb = knowledge
        self.reg = registry
        self.estados = estados
        self.disparadas = {d["id"] for d in reglas_disparadas}
        self.brechas = brechas
        self.prio = self.kb.scoring().get("prioridad", {})
        self.dim_index = {d["id"]: i for i, d in enumerate(self.kb.dimensiones())}

    def priorizar(self):
        sev = self.prio.get("severidad", {})
        prob = self.prio.get("probabilidad", {})
        n_dep = self.reg.get("n_dependientes") or 0
        afectados = 1 + 0.3 * n_dep
        fondo = self.reg.get("in_fondo_meses")
        anios = self.reg.get("anios_al_retiro")
        capacidad = self._capacidad(fondo)
        i7 = fondo is not None and fondo < 3
        r14 = "R14" in self.disparadas

        resultados = []
        for dim, estado in self.estados.items():
            if estado not in ("RIESGO", "NECESIDAD"):
                continue
            urgencia = self._urgencia(dim, anios, fondo, i7, r14)
            cascada = 1.0
            if dim in ("PF", "IN") and r14:
                cascada *= 1.3
            if i7:
                cascada *= 1.2
            pr = (sev.get(dim, 1) * prob.get(dim, 1) * afectados * urgencia * cascada) / capacidad
            resultados.append({
                "dimension": dim,
                "estado": estado,
                "PR": round(pr, 1),
                "factores": {
                    "severidad": sev.get(dim, 1),
                    "probabilidad": prob.get(dim, 1),
                    "afectados": round(afectados, 2),
                    "urgencia": urgencia,
                    "cascada": round(cascada, 2),
                    "capacidad": round(capacidad, 2),
                },
                "brechas": self.brechas.get(dim, []),
            })
        resultados.sort(key=lambda r: (-r["PR"], self.dim_index.get(r["dimension"], 99)))
        for i, r in enumerate(resultados, start=1):
            r["orden"] = i
        return resultados

    def _capacidad(self, fondo):
        tabla = self.prio.get("capacidad", {})
        if fondo is None:
            return tabla.get("fondo_3_6", 1.0)
        if fondo < 3:
            return tabla.get("fondo_lt_3", 1.3)
        if fondo >= 6:
            return tabla.get("fondo_ge_6", 0.8)
        return tabla.get("fondo_3_6", 1.0)

    def _urgencia(self, dim, anios, fondo, i7, r14):
        u = 1
        if dim == "RE":
            if anios is not None and anios <= 10:
                u += 2
            elif anios is not None and anios <= 15 and (self.reg.get("re_reemplazo") or 0) < 40:
                u += 2
        if dim == "MO" and self.reg.get("mo_dependencia") is True:
            u += 1
        if dim == "IN":
            if (self.reg.get("in_gasto_ratio") or 0) > 0.60:
                u += 1
            if i7:
                u += 1
        if dim == "PF" and r14:
            u += 1
        return u
