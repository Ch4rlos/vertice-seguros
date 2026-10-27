"""VariableRegistry: estado del perfil (valor + confianza por variable)."""
from copy import deepcopy


class VariableRegistry:
    def __init__(self, knowledge):
        self.kb = knowledge
        self._vars = {}
        for v in knowledge.variables():
            self._vars[v["id"]] = {
                "id": v["id"],
                "dimension": v.get("dimension"),
                "tipo": v.get("tipo", "entrada"),
                "calculo": v.get("calculo"),
                "valor": None,
                "confianza": "desconocido",
                "dominio": v.get("dominio", {}),
            }
        # contexto derivado (no son variables declaradas; los calcula el motor
        # a partir de la fecha de evaluacion y las variables, sin inventar reglas)
        self._ctx = {
            "fecha_retiro": None,
            "anios_al_retiro": None,
            "n_dependientes": 0,
            "gasto_anual": None,
        }

    # ------------------------------------------------------------ escritura
    def set_respuesta(self, pregunta_id, valor, confianza="alta"):
        """Registra una respuesta de pregunta (valida dominio)."""
        preg = self._pregunta(pregunta_id)
        variable = preg["variable"]
        self._validar(valor, preg.get("dominio", {}))
        self._vars[variable]["valor"] = valor
        self._vars[variable]["confianza"] = confianza

    def set_calculada(self, variable_id, valor):
        self._vars[variable_id]["valor"] = valor
        self._vars[variable_id]["confianza"] = "calculada"

    def marcar_no_se(self, pregunta_id):
        preg = self._pregunta(pregunta_id)
        variable = preg["variable"]
        self._vars[variable]["valor"] = None
        self._vars[variable]["confianza"] = "no_se"

    # ------------------------------------------------------------ lectura
    def get(self, variable_id):
        if variable_id in self._ctx:
            return self._ctx[variable_id]
        v = self._vars.get(variable_id)
        return None if v is None else v["valor"]

    def confianza(self, variable_id):
        v = self._vars.get(variable_id)
        return "desconocido" if v is None else v["confianza"]

    def estado(self):
        return deepcopy(self._vars)

    def set_ctx(self, **kwargs):
        self._ctx.update(kwargs)

    # ------------------------------------------------------------ soporte
    def _pregunta(self, pregunta_id):
        for p in self.kb.preguntas():
            if p["id"] == pregunta_id:
                return p
        raise ValueError(f"E-INPUT: pregunta desconocida: {pregunta_id}")

    def _validar(self, valor, dominio):
        tipo = dominio.get("tipo")
        if tipo in ("monto", "edad", "semanas", "porcentaje", "conteo", "meses"):
            if valor is not None and not isinstance(valor, (int, float)):
                raise ValueError(
                    f"E-INPUT: valor no numerico para dominio {tipo}: {valor!r}"
                )
        elif tipo == "bool":
            if valor is not None and not isinstance(valor, bool):
                raise ValueError(f"E-INPUT: valor no booleano: {valor!r}")
        elif "opciones" in dominio:
            if valor is not None and valor not in dominio["opciones"]:
                raise ValueError(
                    f"E-INPUT: valor fuera de dominio: {valor!r} "
                    f"(opciones: {dominio['opciones']})"
                )
        elif "multi" in dominio:
            if valor is not None:
                if not isinstance(valor, list):
                    raise ValueError(f"E-INPUT: multi debe ser lista: {valor!r}")
                for item in valor:
                    if item not in dominio["multi"]:
                        raise ValueError(f"E-INPUT: valor fuera de dominio: {item!r}")
