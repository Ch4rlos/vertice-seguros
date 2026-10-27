"""OutputBuilder: salida estructurada + trazabilidad (respuesta->variable->regla->dimension->estado->prioridad->conclusion)."""
import json


class OutputBuilder:
    def __init__(self, knowledge, fecha_evaluacion):
        self.kb = knowledge
        self.fecha = fecha_evaluacion

    def construir(self, resultado):
        """resultado: dict del pipeline (engine.evaluate)."""
        return {
            "diagnostico": {
                "knowledge": {
                    "version": self.kb.metadatos().get("version"),
                    "hash": self.kb.hash,
                    "schema_version": self.kb.metadatos().get("schema_version"),
                },
                "fecha_evaluacion": self.fecha,
                "estado_perfil": resultado["estado_perfil"],
                "dimensiones": resultado["dimensiones"],
                "IRP": resultado["irp"],
                "prioridades": resultado["prioridades"],
                "objetivos": resultado["objetivos"],
                "oportunidades": resultado["oportunidades"],
                "estrategia": resultado["estrategia"],
                "productos_sugeridos": [],  # SOLO despues de estrategia (capa posterior)
                "trazabilidad": {
                    "preguntas_seleccionadas": resultado["preguntas_seleccionadas"],
                    "preguntas_omitidas": resultado["preguntas_omitidas"],
                    "variables_calculadas": resultado["variables_calculadas"],
                    "reglas_disparadas": resultado["reglas_disparadas"],
                    "sondas_activas": resultado["sondas_activas"],
                },
            }
        }

    @staticmethod
    def a_json(resultado, path):
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(resultado, fh, ensure_ascii=False, indent=1)
