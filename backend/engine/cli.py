"""CLI de evaluacion: herramienta de VALIDACION y TRAZABILIDAD del motor
(no es interfaz de producto). Uso:

  python -m engine.cli <knowledge.json> <casos.json> [--caso B] [--trace]

Muestra el flujo: INPUT -> PREGUNTAS -> VARIABLES CALCULADAS -> REGLAS
DISPARADAS -> DIMENSIONES -> P_d/R_d -> IRP -> PRIORIDADES -> ESTRATEGIAS
-> DIAGNOSTICO, y el veredicto PASS/FAIL/AMBIGUOUS contra lo esperado.
"""
import argparse
import json
import sys

from .engine import Engine, EvaluacionError
from .knowledge import Knowledge, KnowledgeError


def _trace(resultado):
    d = resultado["diagnostico"]
    print("=== INPUT ===")
    for k, v in d["estado_perfil"].items():
        if v["confianza"] != "desconocido":
            print(f"  {k} = {v['valor']} ({v['confianza']})")
    print("\n=== PREGUNTAS SELECCIONADAS ===")
    print("  " + ", ".join(d["trazabilidad"]["preguntas_seleccionadas"]) or "  -")
    print("\n=== PREGUNTAS OMITIDAS ===")
    for o in d["trazabilidad"]["preguntas_omitidas"]:
        print(f"  {o['pregunta']}: {o['razon']}")
    print("\n=== VARIABLES CALCULADAS ===")
    for k, v in d["trazabilidad"]["variables_calculadas"].items():
        print(f"  {k} = {v}")
    print("\n=== REGLAS DISPARADAS ===")
    for r in d["trazabilidad"]["reglas_disparadas"]:
        print(f"  {r['id']} [{r.get('tipo')}] -> {r.get('dimension')} ({r.get('clasificacion')})")
    print("\n=== DIMENSIONES (P_d / R_d / estado) ===")
    for dim in d["dimensiones"]:
        print(f"  {dim['id']}: P_d={dim['P_d']} R_d={dim['R_d']} estado={dim['estado']}")
        for b in dim["brechas"]:
            print(f"      brecha: {b['concepto']} ${b.get('monto_mxn')} reglas={b['reglas']}")
    print(f"\n=== IRP ===")
    irp = d["IRP"]
    print(f"  valor={irp['valor']} banda={irp['banda']}")
    print(f"  activas={irp['activas']} excluidas={irp['excluidas']}")
    print("\n=== PRIORIDADES ===")
    for p in d["prioridades"]:
        print(f"  {p['orden']}. {p['dimension']} ({p['estado']}) PR={p['PR']} "
              f"factores={p['factores']}")
    print("\n=== ESTRATEGIAS ===")
    for e in d["estrategia"]:
        print(f"  - {e}")
    print("\n=== DIAGNOSTICO ===")
    print(f"  objetivos={d['objetivos']}")
    print(f"  oportunidades={d['oportunidades']}")
    print(f"  productos_sugeridos={d['productos_sugeridos']} (debe estar vacio en evaluacion)")
    print(f"  knowledge={d['knowledge']['version']} hash={d['knowledge']['hash'][:12]}...")


def _veredicto(esperado, d):
    """Compara contra lo esperado declarado en el fixture."""
    fallos = []
    for dim, estado_esp in esperado.get("estados", {}).items():
        real = next((x["estado"] for x in d["dimensiones"] if x["id"] == dim), None)
        if real != estado_esp:
            fallos.append(f"{dim}: esperado {estado_esp}, real {real}")
    banda_esp = esperado.get("irp_banda")
    if banda_esp and d["IRP"]["banda"] != banda_esp:
        fallos.append(f"IRP banda: esperado {banda_esp}, real {d['IRP']['banda']}")
    prio_esp = esperado.get("prioridad_primera")
    if prio_esp:
        real_prio = d["prioridades"][0]["dimension"] if d["prioridades"] else None
        if real_prio != prio_esp:
            fallos.append(f"prioridad 1: esperado {prio_esp}, real {real_prio}")
    if esperado.get("prioridad_re_top3"):
        orden = [p["dimension"] for p in d["prioridades"]]
        if "RE" not in orden[:3]:
            fallos.append(f"RE debe estar en top 3 de prioridades, real: {orden}")
    if d["productos_sugeridos"]:
        fallos.append("productos_sugeridos debe estar vacio durante la evaluacion patrimonial")
    if not d["trazabilidad"]["reglas_disparadas"] and esperado.get("requiere_reglas"):
        fallos.append("no se disparo ninguna regla")
    return "PASS" if not fallos else "FAIL", fallos


def main(argv=None):
    ap = argparse.ArgumentParser(description="CLI de validacion del motor CQ Patrimonial AI")
    ap.add_argument("knowledge", help="ruta al knowledge JSON")
    ap.add_argument("casos", help="ruta al fixture de casos A-O")
    ap.add_argument("--caso", help="ejecutar solo un caso (A..O)")
    ap.add_argument("--trace", action="store_true", help="imprimir trazabilidad completa")
    args = ap.parse_args(argv)

    try:
        kb = Knowledge.load(args.knowledge)
    except KnowledgeError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    with open(args.casos, encoding="utf-8") as fh:
        fixture = json.load(fh)

    casos = [c for c in fixture["casos"] if args.caso is None or c["id"] == args.caso]
    if not casos:
        print(f"ERROR: caso {args.caso} no existe", file=sys.stderr)
        return 1

    resumen = []
    for caso in casos:
        fecha = caso.get("fecha", "2026-08-08")
        try:
            engine = Engine(kb, fecha)
            r1 = engine.evaluate(caso["respuestas"])
            # determinismo: segunda ejecucion identica
            engine2 = Engine(kb, fecha)
            r2 = engine2.evaluate(caso["respuestas"])
            mismo = json.dumps(r1, sort_keys=True) == json.dumps(r2, sort_keys=True)
        except (EvaluacionError, KnowledgeError, Exception) as exc:  # noqa: BLE001
            print(f"\n[{caso['id']}] ERROR: {exc}")
            resumen.append((caso["id"], "FAIL", [f"error: {exc}"]))
            continue
        veredicto, fallos = _veredicto(caso.get("esperado", {}), r1["diagnostico"])
        if not mismo:
            veredicto = "FAIL"
            fallos.append("DETERMINISMO: dos ejecuciones con la misma entrada produjeron distinta salida")
        print(f"\n{'='*70}\nCASO {caso['id']} — {caso.get('nombre', '')}\n{'='*70}")
        if args.trace:
            _trace(r1)
        print(f"\nVEREDICTO: {veredicto}")
        for f in fallos:
            print(f"  - {f}")
        resumen.append((caso["id"], veredicto, fallos))

    print(f"\n{'='*70}\nRESUMEN")
    for cid, v, _ in resumen:
        print(f"  {cid}: {v}")
    if all(v == "PASS" for _, v, _ in resumen):
        print("TODOS LOS CASOS: PASS")
    return 0 if all(v == "PASS" for _, v, _ in resumen) else 2


if __name__ == "__main__":
    sys.exit(main())
