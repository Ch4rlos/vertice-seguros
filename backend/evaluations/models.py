"""Modelos de evaluaciones: sesion de diagnostico y prospecto (CRM).

Flujo MVP: Diagnostico (respuestas + resultado preliminar) -> Prospect
(datos de contacto) -> cita con Carlos. Estrategia y productos quedan
FUERA del diagnostico publico (se construyen en la asesoria).
"""
from django.db import models
from django.utils import timezone


class Diagnostico(models.Model):
    """Sesion de diagnostico patrimonial (motor v0.1)."""

    class Estado(models.TextChoices):
        EN_CURSO = "en_curso", "En curso"
        COMPLETADO = "completado", "Completado"
        ABANDONADO = "abandonado", "Abandonado"

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    session_id = models.CharField(max_length=64, unique=True, blank=True)
    estado = models.CharField(max_length=16, choices=Estado.choices,
                              default=Estado.EN_CURSO)
    knowledge_hash = models.CharField(max_length=64, blank=True, default="")
    knowledge_version = models.CharField(max_length=32, blank=True, default="")
    # CP-10: compartido anonimo (token de solo lectura, sin datos personales)
    token_compartido = models.CharField(max_length=64, unique=True, null=True, blank=True)
    respuestas = models.JSONField(default=dict, blank=True)
    resultado = models.JSONField(null=True, blank=True)
    # resultado preliminar publico (sin estrategia ni productos): dimensiones,
    # irp, prioridades, objetivos, oportunidades, trazabilidad
    resultado_publico = models.JSONField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]


class Prospect(models.Model):
    """Prospecto del puente de conversión (CP-01..CP-12).

    Etapas del embudo: lead_inicial (nombre+ciudad al inicio) ->
    en_diagnostico -> telefono_capturado (desbloqueo) -> completo_visto ->
    whatsapp_click -> compartido. El teléfono se normaliza a 10 dígitos
    nacionales MX (telefono_normalizado, único cuando existe) para evitar
    duplicados. El consentimiento del aviso de privacidad es obligatorio
    para guardar datos personales (CP-03)."""

    class Etapa(models.TextChoices):
        LEAD_INICIAL = "lead_inicial", "Lead inicial"
        EN_DIAGNOSTICO = "en_diagnostico", "En diagnóstico"
        TELEFONO_CAPTURADO = "telefono_capturado", "Teléfono capturado"
        COMPLETO_VISTO = "completo_visto", "Diagnóstico completo visto"
        WHATSAPP_CLICK = "whatsapp_click", "Clic en WhatsApp"
        COMPARTIDO = "compartido", "Compartido"

    diagnostico = models.OneToOneField(
        Diagnostico, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="prospecto",
    )
    nombre = models.CharField(max_length=120)
    ciudad = models.CharField(max_length=120, blank=True)
    telefono = models.CharField(max_length=40, blank=True)
    telefono_normalizado = models.CharField(
        max_length=10, unique=True, null=True, blank=True,
        help_text="Número nacional MX de 10 dígitos (sin +52, espacios ni guiones).",
    )
    correo = models.EmailField(blank=True)
    # consentimiento del aviso de privacidad (CP-03)
    consentimiento = models.BooleanField(default=False)
    aviso_version = models.CharField(max_length=32, blank=True)
    consentimiento_at = models.DateTimeField(null=True, blank=True)
    # embudo de métricas (CP-02): timestamps por etapa
    lead_inicial_at = models.DateTimeField(null=True, blank=True)
    en_diagnostico_at = models.DateTimeField(null=True, blank=True)
    telefono_capturado_at = models.DateTimeField(null=True, blank=True)
    completo_visto_at = models.DateTimeField(null=True, blank=True)
    whatsapp_click_at = models.DateTimeField(null=True, blank=True)
    compartido_at = models.DateTimeField(null=True, blank=True)
    etapa = models.CharField(
        max_length=24, choices=Etapa.choices, default=Etapa.LEAD_INICIAL,
    )
    notas = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.nombre} <{self.telefono or 'sin teléfono'}>"

    def registrar_evento(self, etapa):
        """Avanza el embudo: setea la etapa y su timestamp (CP-02)."""
        if etapa not in Prospect.Etapa.values:
            raise ValueError(f"etapa inválida: {etapa}")
        setattr(self, f"{etapa}_at", timezone.now())
        self.etapa = etapa
        if self.pk:
            self.save(update_fields=[f"{etapa}_at", "etapa", "updated_at"])
        else:
            self.save()  # prospecto recién creado: guarda todos los campos

    def registrar_consentimiento(self, version="v0.1"):
        self.consentimiento = True
        self.aviso_version = version
        self.consentimiento_at = timezone.now()


def normalizar_telefono_mx(texto):
    """Normaliza un teléfono MX a 10 dígitos nacionales.

    Acepta: +52 55 0000 0000, (81) 1183-5907, 5500000000, 52-55-0000-0000.
    Reglas: se extraen los dígitos; 12 dígitos que empiezan con 52 -> se
    quita el 52; 11 dígitos que empiezan con 1 -> se quita el 1 (LADA
    antiguo); 10 dígitos -> válido. Cualquier otra longitud -> None.
    """
    if not texto:
        return None
    digitos = "".join(ch for ch in str(texto) if ch.isdigit())
    if len(digitos) == 12 and digitos.startswith("52"):
        digitos = digitos[2:]
    elif len(digitos) == 11 and digitos.startswith("1"):
        digitos = digitos[1:]
    return digitos if len(digitos) == 10 else None


# ============================================================================
# CRM del agente (Track 6, aprobado por Carlos 2026-08-18): gestion de la
# cartera de clientes con kanban. Entidades: Cliente, Poliza, Pago, Tarea.
# ============================================================================
class Cliente(models.Model):
    """Cliente de la cartera; puede nacer de un Prospect del diagnostico."""
    class Relacion(models.TextChoices):
        PROSPECTO = "prospecto", "Prospecto"
        COTIZACION = "cotizacion", "Cotizacion"
        CLIENTE = "cliente", "Cliente"
        ACTIVO = "activo", "Cliente activo"

    nombre = models.CharField(max_length=200)
    telefono = models.CharField(max_length=16, blank=True, default="")
    correo = models.EmailField(blank=True, default="")
    ciudad = models.CharField(max_length=120, blank=True, default="")
    notas = models.TextField(blank=True, default="")
    relacion = models.CharField(max_length=24, choices=Relacion.choices,
                                default=Relacion.PROSPECTO)
    prospect = models.OneToOneField("Prospect", null=True, blank=True,
                                    on_delete=models.SET_NULL,
                                    related_name="cliente_crm")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.nombre


class Poliza(models.Model):
    """Poliza de un cliente (ramo, vigencia, aseguradora)."""
    class Ramos(models.TextChoices):
        VIDA = "vida", "Vida"
        GMM = "gmm", "GMM / Salud"
        AUTO = "auto", "Auto"
        HOGAR = "hogar", "Hogar"
        RETIRO = "retiro", "Retiro"
        NEGOCIO = "negocio", "Negocio"
        TRANSPORTE = "transporte", "Transporte / Fletes"
        OTROS = "otros", "Otros"

    class Estado(models.TextChoices):
        ACTIVA = "activa", "Activa"
        POR_RENOVAR = "por_renovar", "Por renovar"
        VENCIDA = "vencida", "Vencida"
        CANCELADA = "cancelada", "Cancelada"

    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE,
                                related_name="polizas")
    ramo = models.CharField(max_length=16, choices=Ramos.choices,
                            default=Ramos.OTROS)
    aseguradora = models.CharField(max_length=120, blank=True, default="")
    prima_anual = models.DecimalField(max_digits=14, decimal_places=2,
                                      null=True, blank=True)
    fecha_inicio = models.DateField(null=True, blank=True)
    fecha_vencimiento = models.DateField(null=True, blank=True)
    estado = models.CharField(max_length=16, choices=Estado.choices,
                              default=Estado.ACTIVA)
    # catalogo de servicios (Track 6, extension de Carlos 2026-08-18):
    # la poliza se vincula a un Producto y declara su tipo de vigencia
    # (anual, temporal o por embarque — p. ej. polizas de fletes).
    producto = models.ForeignKey("Producto", null=True, blank=True,
                                 on_delete=models.SET_NULL,
                                 related_name="polizas")
    vigencia_tipo = models.CharField(
        max_length=16,
        choices=[("anual", "Anual"), ("temporal", "Temporal"),
                 ("embarque", "Por embarque")],
        default="anual")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.ramo} de {self.cliente.nombre}"


class Pago(models.Model):
    """Pago de una poliza (fecha limite, estado)."""
    class Estado(models.TextChoices):
        PENDIENTE = "pendiente", "Pendiente"
        PARCIAL = "parcial", "Parcial"
        PAGADO = "pagado", "Pagado"
        ATRASADO = "atrasado", "Atrasado"

    poliza = models.ForeignKey(Poliza, on_delete=models.CASCADE,
                               related_name="pagos")
    monto = models.DecimalField(max_digits=14, decimal_places=2)
    fecha_limite = models.DateField()
    fecha_pago = models.DateField(null=True, blank=True)
    estado = models.CharField(max_length=16, choices=Estado.choices,
                              default=Estado.PENDIENTE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Pago {self.monto} de {self.poliza}"


class Tarea(models.Model):
    """Tarjeta del kanban de la cartera del agente."""
    class Tipos(models.TextChoices):
        RENOVACION = "renovacion", "Renovacion"
        MEJORA = "mejora", "Mejora"
        COBRO = "cobro", "Cobro"
        LLAMADA = "llamada", "Llamada"
        ENTREGA = "entrega", "Entrega de documento"
        CITA = "cita", "Cita"
        SEGUIMIENTO = "seguimiento", "Seguimiento"

    class Columnas(models.TextChoices):
        PENDIENTE = "pendiente", "Pendiente"
        EN_CURSO = "en_curso", "En curso"
        EN_ESPERA = "en_espera", "En espera"
        COMPLETADA = "completada", "Completada"

    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE,
                                related_name="tareas")
    poliza = models.ForeignKey(Poliza, null=True, blank=True,
                               on_delete=models.SET_NULL, related_name="tareas")
    tipo = models.CharField(max_length=16, choices=Tipos.choices,
                            default=Tipos.SEGUIMIENTO)
    titulo = models.CharField(max_length=240)
    descripcion = models.TextField(blank=True, default="")
    fecha_limite = models.DateField(null=True, blank=True)
    columna = models.CharField(max_length=16, choices=Columnas.choices,
                               default=Columnas.PENDIENTE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.titulo


class Producto(models.Model):
    """Catalogo de servicios/productos del ramo (ej. GNP Trascendi, Vida
    Temporal, Fletes). Las polizas se vinculan a un producto del catalogo."""
    class Vigencia(models.TextChoices):
        ANUAL = "anual", "Anual"
        TEMPORAL = "temporal", "Temporal"
        EMBARQUE = "embarque", "Por embarque"

    nombre = models.CharField(max_length=200)
    aseguradora = models.CharField(max_length=120, blank=True, default="")
    ramo = models.CharField(max_length=16, choices=Poliza.Ramos.choices,
                            default=Poliza.Ramos.OTROS)
    descripcion = models.TextField(blank=True, default="")
    vigencia_tipo = models.CharField(max_length=16, choices=Vigencia.choices,
                                     default=Vigencia.ANUAL)
    activo = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.nombre} ({self.aseguradora or 'sin aseguradora'})"


class AccesoSospechoso(models.Model):
    """Capa 6 (directiva de Carlos 2026-08-24): registro de accesos
    sospechosos (rate-limit excedido, User-Agent de bot) visible en el panel
    privado — el otro lado de la moneda: no puedes impedir que un humano
    mire las requests, pero SI puedes ver quien lo intenta."""

    class Motivo(models.TextChoices):
        RATE_LIMIT = "rate_limit", "Rate limit excedido"
        BOT_UA = "bot_ua", "User-Agent de bot"

    ip = models.CharField(max_length=64, db_index=True)
    endpoint = models.CharField(max_length=120)
    motivo = models.CharField(max_length=32, choices=Motivo.choices)
    veces = models.PositiveIntegerField(default=1)
    bloqueado_hasta = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["ip", "endpoint", "motivo"],
                name="uq_acceso_sospechoso_ip_endpoint_motivo"),
        ]

    def __str__(self):
        return f"{self.ip} · {self.endpoint} · {self.motivo} x{self.veces}"
