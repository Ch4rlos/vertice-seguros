"""KnowledgeLoader: carga, valida y hashea el Knowledge JSON."""
import hashlib
import json

from . import SCHEMA_VERSION
from .expr import ExprError


class KnowledgeError(Exception):
    """Error de conocimiento (E-KNOWLEDGE): el JSON no es interpretable."""


class Knowledge:
    def __init__(self, data, path=None):
        self.path = path
        self.raw = data
        self.hash = hashlib.sha256(
            json.dumps(data, ensure_ascii=False, sort_keys=True).encode("utf-8")
        ).hexdigest()
        self.validate()

    # ---------------------------------------------------------------- carga
    @classmethod
    def load(cls, path):
        try:
            with open(path, "r", encoding="utf-8") as fh:
                data = json.load(fh)
        except (OSError, json.JSONDecodeError) as exc:
            raise KnowledgeError(f"E-KNOWLEDGE: no se puede leer {path}: {exc}")
        return cls(data, path=path)

    # ------------------------------------------------------------ validacion
    def validate(self):
        meta = self.raw.get("metadatos", {})
        if meta.get("schema_version") != SCHEMA_VERSION:
            raise KnowledgeError(
                f"E-KNOWLEDGE: schema_version {meta.get('schema_version')} "
                f"incompatible con motor (esperado {SCHEMA_VERSION})"
            )
        vars_by_id = {v["id"] for v in self.raw.get("variables", [])}
        preg_by_id = {p["id"] for p in self.raw.get("preguntas", [])}
        # integridad referencial variables <-> preguntas
        for p in self.raw.get("preguntas", []):
            if p["variable"] not in vars_by_id:
                raise KnowledgeError(
                    f"E-KNOWLEDGE: pregunta {p['id']} usa variable inexistente {p['variable']}"
                )
        # integridad de formulas
        for v in self.raw.get("variables", []):
            if v.get("calculo"):
                try:
                    ast_check(v["calculo"])
                except ExprError as exc:
                    raise KnowledgeError(
                        f"E-KNOWLEDGE: formula invalida en {v['id']}: {exc}"
                    )
        # integridad de condiciones de reglas
        for r in self.raw.get("reglas", []):
            cond = r.get("condicion_eval", "")
            if cond.startswith("@"):
                continue
            try:
                ast_check(cond)
            except ExprError as exc:
                raise KnowledgeError(
                    f"E-KNOWLEDGE: condicion invalida en regla {r['id']}: {exc}"
                )
        # integridad de sondas
        for s in self.raw.get("scoring", {}).get("R_d", {}).get("sondas", []):
            try:
                ast_check(s["condicion"])
            except ExprError as exc:
                raise KnowledgeError(
                    f"E-KNOWLEDGE: sonda invalida {s.get('id')}: {exc}"
                )
        # integridad de formulas de scoring
        for dim, formula in self.raw.get("scoring", {}).get("formulas", {}).items():
            try:
                ast_check(formula)
            except ExprError as exc:
                raise KnowledgeError(
                    f"E-KNOWLEDGE: formula P_d invalida para {dim}: {exc}"
                )
        # variables calculadas con formula deben tener dependencias coherentes
        return True

    # ------------------------------------------------------------- acceso
    def variables(self):
        return self.raw["variables"]

    def preguntas(self):
        return self.raw["preguntas"]

    def reglas(self):
        return sorted(self.raw["reglas"], key=lambda r: r["id"])

    def normativa(self):
        return self.raw.get("normativa", {})

    def scoring(self):
        return self.raw.get("scoring", {})

    def fuentes(self):
        return self.raw.get("fuentes", [])

    def hipotesis(self):
        return self.raw.get("hipotesis", [])

    def metadatos(self):
        return self.raw.get("metadatos", {})

    def dimensiones(self):
        return self.raw.get("dimensiones", [])

    def pesos_irp(self):
        return {d["id"]: d["peso_irp"] for d in self.dimensiones()}

    def estados_orden(self):
        return self.raw.get("scoring", {}).get(
            "clasificacion_orden",
            ["N/A", "RIESGO", "NECESIDAD", "OBJETIVO", "OPORTUNIDAD", "DESCONOCIDO"],
        )


def ast_check(expr):
    """Valida sintaxis de expresion declarada (sin evaluarla)."""
    import ast

    try:
        ast.parse(expr, mode="eval")
    except SyntaxError as exc:
        raise ExprError(f"{expr!r}: {exc}")
