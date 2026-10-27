"""Evaluador de expresiones restringido (AST whitelist).

Solo operadores aritmeticos, comparaciones, booleanos, IfExp y funciones
whitelisted. Sin eval/exec. Semantica de valor DESCONOCIDO (None):
  - aritmetica con None -> None
  - comparacion con None -> False (salvo == null / != null)
  - bool(None) -> False (reglas con variable desconocida NO disparan)
"""
import ast


class ExprError(Exception):
    pass


_BIN = {
    ast.Add: lambda a, b: a + b,
    ast.Sub: lambda a, b: a - b,
    ast.Mult: lambda a, b: a * b,
    ast.Div: lambda a, b: a / b,
}
_CMP = {
    ast.Eq: lambda a, b: a == b,
    ast.NotEq: lambda a, b: a != b,
    ast.Lt: lambda a, b: a < b,
    ast.LtE: lambda a, b: a <= b,
    ast.Gt: lambda a, b: a > b,
    ast.GtE: lambda a, b: a >= b,
    ast.In: lambda a, b: a in b,
    ast.NotIn: lambda a, b: a not in b,
}


class Evaluator:
    """Evalua expresiones declaradas en el Knowledge JSON.

    functions: dict nombre -> callable (min, max, norma, norma_valor, ...)
    getvar: callable(nombre_variable) -> valor | None
    """

    def __init__(self, functions, getvar):
        self.functions = functions
        self.getvar = getvar

    def eval(self, expr):
        try:
            tree = ast.parse(expr, mode="eval")
        except SyntaxError as exc:
            raise ExprError(f"expresion invalida: {expr!r}: {exc}")
        return self._node(tree.body)

    def _node(self, n):
        if isinstance(n, ast.Constant):
            return n.value
        if isinstance(n, ast.Name):
            if n.id in self.functions:
                raise ExprError(f"funcion usada como valor: {n.id}")
            if n.id in ("true", "True"):
                return True
            if n.id in ("false", "False"):
                return False
            if n.id in ("null", "None"):
                return None
            return self.getvar(n.id)
        if isinstance(n, (ast.List, ast.Tuple)):
            return [self._node(e) for e in n.elts]
        if isinstance(n, ast.BinOp):
            op = _BIN.get(type(n.op))
            if op is None:
                raise ExprError(f"operador no permitido: {type(n.op).__name__}")
            left, right = self._node(n.left), self._node(n.right)
            if left is None or right is None:
                return None
            try:
                return op(left, right)
            except Exception:
                return None
        if isinstance(n, ast.UnaryOp):
            if isinstance(n.op, ast.USub):
                v = self._node(n.operand)
                return None if v is None else -v
            if isinstance(n.op, ast.Not):
                return not bool(self._node(n.operand))
            raise ExprError(f"operador unario no permitido: {type(n.op).__name__}")
        if isinstance(n, ast.Compare):
            left = self._node(n.left)
            for op, comp in zip(n.ops, n.comparators):
                right = self._node(comp)
                fn = _CMP.get(type(op))
                if fn is None:
                    raise ExprError(f"comparador no permitido: {type(op).__name__}")
                if left is None or right is None:
                    if isinstance(op, ast.Eq):
                        left = left is None and right is None
                    elif isinstance(op, ast.NotEq):
                        left = not (left is None and right is None)
                    else:
                        left = False
                else:
                    try:
                        left = fn(left, right)
                    except Exception:
                        left = False
            return left
        if isinstance(n, ast.BoolOp):
            values = [self._node(v) for v in n.values]
            if isinstance(n.op, ast.And):
                return all(bool(v) for v in values)
            return any(bool(v) for v in values)
        if isinstance(n, ast.IfExp):
            return self._node(n.body) if bool(self._node(n.test)) else self._node(n.orelse)
        if isinstance(n, ast.Call):
            if not isinstance(n.func, ast.Name) or n.func.id not in self.functions:
                raise ExprError(f"funcion no permitida: {n.func!r}")
            args = [self._node(a) for a in n.args]
            return self.functions[n.func.id](*args)
        raise ExprError(f"nodo no permitido: {type(n).__name__}")
