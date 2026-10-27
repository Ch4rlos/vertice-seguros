"""Calculator: variables derivadas a partir de las formulas del Knowledge JSON."""
from .expr import Evaluator, ExprError


class Calculator:
    def __init__(self, knowledge, registry, normative, fecha_evaluacion):
        self.kb = knowledge
        self.reg = registry
        self.norm = normative
        self.fecha = fecha_evaluacion
        self.eval = Evaluator(self._functions(), self.reg.get)
        self._order = [v["id"] for v in knowledge.variables() if v.get("calculo")]

    # ---------------------------------------------------- funciones declaradas
    def _functions(self):
        return {
            "min": lambda *a: min([x for x in a if x is not None]) if any(x is not None for x in a) else None,
            "max": lambda *a: max([x for x in a if x is not None]) if any(x is not None for x in a) else None,
            "norma": self._norma,
            "norma_valor": self._norma_valor,
            "tabla": self._tabla,
            "desconocido_si": lambda *args: None if any(a is None for a in args) else args[-1],
            "fpb_elegible": self._fpb_elegible,
            "re_reemplazo_calc": self._re_reemplazo_calc,
            "re_fpb_bonus": self._re_fpb_bonus,
        }

    def _norma(self, regla, anio):
        if anio is None:
            return None  # fecha de retiro desconocida -> variable desconocida (D1)
        bloque = self.norm.obtener_parametro_normativo(regla, anio)
        for key in ("semanas",):
            if key in bloque:
                return bloque[key]
        return bloque

    def _norma_valor(self, regla, parametro):
        return self.norm.valor(regla, parametro, self.fecha)

    def _tabla(self, nombre, clave):
        tablas = self.kb.scoring().get("tablas", {})
        tabla = tablas.get(nombre)
        if tabla is None:
            raise ExprError(f"tabla inexistente: {nombre}")
        if isinstance(tabla, dict):
            return tabla.get(clave)
        raise ExprError(f"tabla no indexable por clave: {nombre}")

    def _fpb_elegible(self):
        """Determina elegibilidad FPB; None si falta informacion (D2)."""
        edad = self.reg.get("re_edad_retiro")
        saldo = self.reg.get("re_saldo_afore")
        ingreso = self.reg.get("in_ingreso")
        regimen = self.reg.get("re_regimen")
        if regimen != "ley97" or edad is None or saldo is None or ingreso is None:
            return None if (edad is None or saldo is None or ingreso is None) else False
        params = self.norm.obtener_parametro_normativo("fpb", self.fecha)
        if edad < params["edad_minima_retiro"]:
            return False
        # hipotesis H4: saldo menor a 5 anios de ingreso -> pension < ultimo salario
        return saldo < ingreso * 12 * 5

    def _re_reemplazo_calc(self):
        tablas = self.kb.scoring().get("tablas", {})
        regimen = self.reg.get("re_regimen")
        semanas = self.reg.get("re_semanas")
        aportaciones = self.reg.get("re_aportaciones")
        if regimen is None:
            return None
        if regimen == "ley73":
            if semanas is None:
                return None
            b = tablas["re_ley73_base"]
            return b["reemplazo"] if semanas >= b["semanas_max"] else b["reemplazo_min"]
        if regimen == "ley97":
            if semanas is None:
                return None
            for bucket in tablas["re_ley97_buckets"]:
                if self._bucket_match(bucket, semanas, aportaciones):
                    return bucket["reemplazo"]
            return 20
        if regimen == "issste2007":
            return 40
        if regimen == "cuenta_propia":
            return 35
        return None

    def _bucket_match(self, bucket, semanas, aportaciones):
        cond = bucket.get("cond", "true")
        try:
            return bool(self.eval.eval(cond))
        except ExprError:
            return False

    def _re_fpb_bonus(self):
        elegible = self.reg.get("re_fpb_elegible")
        if elegible is not True:
            return 0
        return self.kb.scoring().get("tablas", {}).get("fpb_bonus", 15)

    # ------------------------------------------------------------ ejecucion
    def recalcular(self):
        """Recalcula todas las variables derivadas en orden declarado."""
        for var_id in self._order:
            v = self.reg.estado()[var_id]
            formula = v["calculo"]
            try:
                valor = self.eval.eval(formula)
            except ExprError as exc:
                raise ExprError(f"E-KNOWLEDGE: formula de {var_id} no evaluable: {exc}")
            self.reg.set_calculada(var_id, valor)
