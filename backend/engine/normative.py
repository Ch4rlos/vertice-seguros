"""NormativeResolver: consulta de parametros normativos vigentes por fecha.

El motor conoce el MECANISMO de consulta; el JSON conoce los valores; la
fuente conoce la procedencia (knowledge.fuentes).
"""
from datetime import date


class NormativeError(Exception):
    """E-KNOWLEDGE: periodo normativo ausente para la fecha consultada."""


class NormativeResolver:
    def __init__(self, knowledge):
        self.kb = knowledge

    def obtener_parametro_normativo(self, regla, fecha_evaluacion):
        """Devuelve el bloque de parametros vigente para la fecha.

        regla: clave en knowledge.normativa.
        fecha_evaluacion: str ISO (YYYY-MM-DD) o int anio.
        """
        bloque = self.kb.normativa().get(regla)
        if bloque is None:
            raise NormativeError(f"E-KNOWLEDGE: regla normativa inexistente: {regla}")
        anio = self._anio(fecha_evaluacion)
        if anio is None:
            raise NormativeError(f"E-KNOWLEDGE: fecha invalida para {regla}: {fecha_evaluacion!r}")
        periodos = bloque.get("parametros_por_periodo")
        if periodos is not None:
            for periodo in periodos:
                desde = int(periodo["desde"][:4])
                hasta = periodo.get("hasta")
                hasta = int(hasta[:4]) if hasta else None
                if hasta is None or anio <= hasta:
                    if anio >= desde:
                        return periodo
            # FALLBACK (fix 2026-08-25, destapado por la validacion de
            # credibilidad): fechas fuera del rango normativo (ej. retiro a
            # los 30 -> anio 2016, anterior al primer periodo) usan el
            # periodo MAS CERCANO disponible en vez de crashear con 500.
            # Un retiro atipico es una eleccion de vida valida; el motor
            # proyecta con el periodo disponible mas proximo.
            periodos_ord = sorted(periodos, key=lambda p: int(p["desde"][:4]))
            if anio < int(periodos_ord[0]["desde"][:4]):
                return periodos_ord[0]
            return periodos_ord[-1]
        return bloque.get("parametros", {})

    def valor(self, regla, parametro, fecha_evaluacion):
        """Valor puntual de un parametro normativo (ej. deuda_max_ratio)."""
        params = self.obtener_parametro_normativo(regla, fecha_evaluacion)
        if parametro not in params:
            raise NormativeError(
                f"E-KNOWLEDGE: parametro {parametro} inexistente en {regla}"
            )
        return params[parametro]

    @staticmethod
    def _anio(fecha):
        if fecha is None:
            return None
        if isinstance(fecha, int):
            return fecha
        return date.fromisoformat(str(fecha)).year
