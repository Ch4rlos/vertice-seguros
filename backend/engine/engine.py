"""Engine: pipeline determinista (SPEC motor v0.1, seccion 3)."""
from .calculator import Calculator
from .expr import ExprError
from .knowledge import Knowledge, KnowledgeError
from .normative import NormativeResolver, NormativeError
from .output import OutputBuilder
from .priority import Classifier, PriorityEngine
from .registry import VariableRegistry
from .rules import RuleEngine
from .scoring import ScoringEngine
from .selector import QuestionSelector


class EvaluacionError(Exception):
    """E-INPUT: contrato de entrada invalido."""


class Engine:
    def __init__(self, knowledge, fecha_evaluacion):
        if not isinstance(knowledge, Knowledge):
            raise TypeError("knowledge debe ser una instancia de engine.knowledge.Knowledge")
        self.kb = knowledge
        self.fecha = fecha_evaluacion
        self.norm = NormativeResolver(knowledge)
        self.reg = VariableRegistry(knowledge)
        self.calc = Calculator(knowledge, self.reg, self.norm, fecha_evaluacion)
        self.selector = QuestionSelector(knowledge, self.reg, self._factory)
        self.output = OutputBuilder(knowledge, fecha_evaluacion)
        self._auditoria = []

    def _factory(self):
        """Fabrica de evaluadores: devuelve un callable(expr) -> valor."""
        return self.calc.eval.eval

    # ---------------------------------------------------------------------
    def evaluate(self, respuestas):
        """respuestas: [{pregunta, valor, confianza?}]. Pipeline completo."""
        if not isinstance(respuestas, list):
            raise EvaluacionError("E-INPUT: respuestas debe ser lista")
        # 1-2. aplicar respuestas sobre el estado inicial (DESCONOCIDO)
        respondidas = set()
        for r in respuestas:
            pid = r["pregunta"]
            try:
                if r.get("confianza") == "no_se":
                    self.reg.marcar_no_se(pid)
                else:
                    self.reg.set_respuesta(pid, r.get("valor"), r.get("confianza", "alta"))
            except ValueError as exc:
                raise EvaluacionError(f"E-INPUT: {exc}")
            respondidas.add(pid)
        # normalizaciones declaradas (listas -> valores canonicos)
        self._normalizar()
        # contexto derivado (fecha de evaluacion + variables)
        self._calcular_contexto()
        # 6. variables derivadas
        self.calc.recalcular()
        # 7-8. reglas
        reglas = RuleEngine(self.kb, self.reg, self._factory)
        reglas_disparadas = reglas.resolver()
        brechas = reglas.brechas
        # 9. scoring P_d (estados desconocidos: se calculan todas)
        scoring = ScoringEngine(self.kb, self.reg, self._factory, {})
        P = scoring.calcular_P()
        # clasificacion (estados)
        classifier = Classifier(self.kb, self.reg, self._factory, reglas_disparadas, P)
        estados = classifier.clasificar()
        # R_d y IRP con estados finales (P_d recalculado excluyendo N/A)
        scoring.estado_dim = estados
        P = scoring.calcular_P()
        R = scoring.calcular_R()
        irp = scoring.calcular_IRP()
        # 10-11. prioridades
        prio = PriorityEngine(self.kb, self.reg, estados, reglas_disparadas, brechas)
        prioridades = prio.priorizar()
        # 12. estrategia (declarada en el JSON)
        estrategia = self._estrategia(prioridades)
        # salida
        dims_out = []
        for dim_info in self.kb.dimensiones():
            dim = dim_info["id"]
            p_val = P.get(dim)
            dims_out.append({
                "id": dim,
                "P_d": round(p_val, 1) if p_val is not None else None,
                "R_d": R.get(dim, "BAJO"),
                "estado": estados.get(dim, "DESCONOCIDO"),
                "brechas": brechas.get(dim, []),
                "reglas": [d["id"] for d in reglas_disparadas if d.get("dimension") == dim],
            })
        resultado = {
            "estado_perfil": {k: {"valor": v["valor"], "confianza": v["confianza"]}
                              for k, v in self.reg.estado().items()},
            "preguntas_seleccionadas": self._preguntas_plan(respondidas)[0],
            "preguntas_omitidas": self._preguntas_plan(respondidas)[1],
            "variables_calculadas": {k: v["valor"] for k, v in self.reg.estado().items()
                                     if v["tipo"] == "calculada"},
            "reglas_disparadas": reglas_disparadas,
            "sondas_activas": scoring.sondas_activas,
            "dimensiones": dims_out,
            "irp": irp,
            "prioridades": prioridades,
            "objetivos": [d["id"] for d in dims_out if d["estado"] == "OBJETIVO"],
            "oportunidades": [d["id"] for d in dims_out if d["estado"] == "OPORTUNIDAD"],
            "estrategia": estrategia,
            "productos_sugeridos": [],
        }
        self._auditoria.append(resultado)
        return self.output.construir(resultado)

    # ---------------------------------------------------------------- helpers
    def _normalizar(self):
        deps = self.reg.get("pf_dependientes")
        if isinstance(deps, list):
            if deps == ["nadie"]:
                self.reg._vars["pf_dependientes"]["valor"] = "nadie"
            else:
                self.reg._vars["pf_dependientes"]["valor"] = [d for d in deps if d != "nadie"]

    def _calcular_contexto(self):
        edad = self.reg.get("sa_edad")
        retiro = self.reg.get("re_edad_retiro")
        anios = (retiro - edad) if (edad is not None and retiro is not None) else None
        deps = self.reg.get("pf_dependientes")
        n_dep = len(deps) if isinstance(deps, list) else (0 if deps in (None, "nadie") else 1)
        gasto = self.reg.get("in_gasto_fijo")
        self.reg.set_ctx(
            fecha_retiro=(self.norm._anio(self.fecha) + anios) if anios is not None else None,
            anios_al_retiro=anios,
            n_dependientes=n_dep,
            gasto_anual=(gasto * 12) if gasto is not None else None,
        )

    def _preguntas_plan(self, respondidas):
        return self.selector.plan(respondidas)

    def _estrategia(self, prioridades):
        mapa = self.kb.scoring().get("estrategias", {})
        if not prioridades:
            return ["Mantener y optimizar: no se identifican vulnerabilidades criticas"]
        primero = prioridades[0]["dimension"]
        return [mapa.get(primero, f"Atender {primero}")]
