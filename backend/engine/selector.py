"""QuestionSelector: determina preguntas seleccionadas/omitidas segun el JSON."""
from .expr import Evaluator


class QuestionSelector:
    def __init__(self, knowledge, registry, evaluator_factory):
        self.kb = knowledge
        self.reg = registry
        self.eval = Evaluator({}, self.reg.get)
        self._factory = evaluator_factory

    def plan(self, respondidas):
        """Devuelve (seleccionadas, omitidas) con razones.

        respondidas: set de pregunta_id ya respondidos.
        """
        seleccionadas = []
        omitidas = []
        for pregunta in self.kb.preguntas():
            pid = pregunta["id"]
            if pid in respondidas:
                continue
            cond = pregunta.get("condicion_eval") or pregunta.get("condicion", "true")
            if cond in ("siempre", "true", ""):
                elegible = True
            else:
                try:
                    elegible = bool(self._factory()(cond))
                except Exception:
                    elegible = False  # prosa no evaluable = documentacion
            if not elegible:
                omitidas.append({"pregunta": pid, "razon": f"condicion no cumplida: {cond}"})
                continue
            # omitidas por otra pregunta respondida
            omitida_por = None
            for rpid in respondidas:
                for p in self.kb.preguntas():
                    if p["id"] == rpid:
                        if pid in p.get("omite", []):
                            omitida_por = rpid
                        break
            if omitida_por:
                omitidas.append({"pregunta": pid, "razon": f"omitida por {omitida_por}"})
                continue
            seleccionadas.append(pid)
        # orden determinista: obligatorias primero, luego orden declarado (JSON),
        # desempate por id (SPEC v0.1 seccion 5)
        preg_by_id = {p["id"]: p for p in self.kb.preguntas()}
        oblig = {p["id"] for p in self.kb.preguntas() if p.get("obligatoria")}
        seleccionadas.sort(
            key=lambda pid: (0 if pid in oblig else 1,
                             preg_by_id.get(pid, {}).get("orden", 999), pid))
        return seleccionadas, omitidas
