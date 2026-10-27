"""Suite de regresion del motor (SPEC v0.1, seccion 21): casos A-O.

  python -m unittest engine.tests.test_engine -v
"""
import json
import os
import unittest

from engine import engine as engine_mod
from engine.engine import Engine
from engine.knowledge import Knowledge

BASE = os.path.dirname(__file__)
KNOWLEDGE = os.path.join(BASE, "knowledge.example.json")
# Los casos de regresion reales son privados y no se distribuyen.
CASOS = os.path.join(BASE, "casos_a_o.json")
SIN_CASOS = not os.path.exists(CASOS)


def _veredicto(esperado, d):
    fallos = []
    for dim, estado_esp in esperado.get("estados", {}).items():
        real = next((x["estado"] for x in d["dimensiones"] if x["id"] == dim), None)
        if real != estado_esp:
            fallos.append(f"{dim}: esperado {estado_esp}, real {real}")
    if esperado.get("irp_banda") and d["IRP"]["banda"] != esperado["irp_banda"]:
        fallos.append(f"IRP banda: esperado {esperado['irp_banda']}, real {d['IRP']['banda']}")
    prio = esperado.get("prioridad_primera")
    if prio:
        real_prio = d["prioridades"][0]["dimension"] if d["prioridades"] else None
        if real_prio != prio:
            fallos.append(f"prioridad 1: esperado {prio}, real {real_prio}")
    if esperado.get("prioridad_re_top3"):
        orden = [p["dimension"] for p in d["prioridades"]]
        if "RE" not in orden[:3]:
            fallos.append(f"RE debe estar en top 3, real: {orden}")
    if d["productos_sugeridos"]:
        fallos.append("productos_sugeridos debe estar vacio")
    if not d["trazabilidad"]["reglas_disparadas"] and esperado.get("requiere_reglas"):
        fallos.append("no se disparo ninguna regla")
    return not fallos, fallos


@unittest.skipIf(SIN_CASOS, "los casos de regresion son privados y no se distribuyen")
class TestCasosAO(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.kb = Knowledge.load(KNOWLEDGE)
        with open(CASOS, encoding="utf-8") as fh:
            cls.fixture = json.load(fh)

    def test_todos_los_casos_pasan(self):
        fallos_totales = []
        for caso in self.fixture["casos"]:
            fecha = caso.get("fecha", "2026-08-08")
            resultado = Engine(self.kb, fecha).evaluate(caso["respuestas"])
            ok, fallos = _veredicto(caso.get("esperado", {}), resultado["diagnostico"])
            if not ok:
                fallos_totales.append(f"[{caso['id']}] " + " | ".join(fallos))
        self.assertEqual([], fallos_totales, "\n".join(fallos_totales))

    def test_determinismo(self):
        """misma entrada + mismo knowledge -> mismo diagnostico (2 ejecuciones)."""
        caso = self.fixture["casos"][0]  # A
        fecha = caso.get("fecha", "2026-08-08")
        r1 = Engine(self.kb, fecha).evaluate(caso["respuestas"])
        r2 = Engine(self.kb, fecha).evaluate(caso["respuestas"])
        self.assertEqual(json.dumps(r1, sort_keys=True), json.dumps(r2, sort_keys=True))

    def test_determinismo_todos(self):
        for caso in self.fixture["casos"]:
            fecha = caso.get("fecha", "2026-08-08")
            r1 = Engine(self.kb, fecha).evaluate(caso["respuestas"])
            r2 = Engine(self.kb, fecha).evaluate(caso["respuestas"])
            self.assertEqual(
                json.dumps(r1, sort_keys=True), json.dumps(r2, sort_keys=True),
                f"determinismo fallo en {caso['id']}",
            )

    def test_productos_siempre_vacios(self):
        for caso in self.fixture["casos"]:
            fecha = caso.get("fecha", "2026-08-08")
            d = Engine(self.kb, fecha).evaluate(caso["respuestas"])["diagnostico"]
            self.assertEqual([], d["productos_sugeridos"], caso["id"])

    def test_trazabilidad_reglas(self):
        """cada dimension con estado de riesgo debe tener reglas que la expliquen."""
        caso = self.fixture["casos"][1]  # B (fundamental)
        fecha = caso.get("fecha", "2026-08-08")
        d = Engine(self.kb, fecha).evaluate(caso["respuestas"])["diagnostico"]
        por_dim = {x["id"]: x for x in d["dimensiones"]}
        self.assertTrue(por_dim["PF"]["reglas"], "PF debe tener reglas en trazabilidad")
        self.assertTrue(por_dim["IN"]["reglas"], "IN debe tener reglas")
        self.assertEqual("RIESGO", por_dim["PF"]["estado"])

    def test_desconocido_no_es_riesgo(self):
        """variable sin respuesta -> DESCONOCIDO, nunca RIESGO."""
        caso = self.fixture["casos"][0]
        resp = [r for r in caso["respuestas"] if r["pregunta"] != "SA1"]
        fecha = caso.get("fecha", "2026-08-08")
        d = Engine(self.kb, fecha).evaluate(resp)["diagnostico"]
        sa = next(x for x in d["dimensiones"] if x["id"] == "SA")
        self.assertNotEqual("RIESGO", sa["estado"])

    def test_knowledge_versionado(self):
        d = Engine(self.kb, "2026-08-08").evaluate(
            self.fixture["casos"][0]["respuestas"])["diagnostico"]
        self.assertEqual("0.3.5", d["knowledge"]["version"])
        self.assertEqual(1, d["knowledge"]["schema_version"])
        self.assertEqual(64, len(d["knowledge"]["hash"]))


if __name__ == "__main__":
    unittest.main()
