from django.urls import path

from . import crm, panel, views

urlpatterns = [
    path("start", views.start, name="evaluacion-start"),
    path("answer", views.answer, name="evaluacion-answer"),
    path("finalize", views.finalize, name="evaluacion-finalize"),
    path("leads", views.crear_lead, name="leads-create"),
    path("prospectos", views.crear_prospecto, name="prospectos-create"),
    path("prospectos/<str:session_id>/evento", views.evento_prospecto, name="prospectos-evento"),
    # CP-10: compartido anonimo
    path("compartir", views.compartir, name="compartir"),
    path("compartido/<str:token>", views.compartido_publico, name="compartido-publico"),
    # panel privado de Carlos (CP-13..CP-15)
    path("panel/login", panel.login, name="panel-login"),
    path("panel/logout", panel.logout, name="panel-logout"),
    path("panel/sesion", panel.sesion, name="panel-sesion"),
    path("panel/dashboard", panel.dashboard, name="panel-dashboard"),
    path("panel/prospectos", panel.prospectos, name="panel-prospectos"),
    path("panel/prospectos/<int:prospecto_id>", panel.prospecto_detalle, name="panel-prospecto-detalle"),
    path("panel/seguridad", panel.seguridad, name="panel-seguridad"),
    # CRM del agente (Track 6)
    path("panel/crm/resumen", crm.resumen, name="crm-resumen"),
    path("panel/crm/clientes", crm.crear_cliente, name="crm-clientes-create"),
    path("panel/crm/clientes/<int:cliente_id>", crm.editar_cliente, name="crm-clientes-edit"),
    path("panel/crm/clientes/<int:cliente_id>/delete", crm.eliminar_cliente, name="crm-clientes-delete"),
    path("panel/crm/convertir/<int:prospecto_id>", crm.convertir_prospecto, name="crm-convertir"),
    path("panel/crm/polizas", crm.crear_poliza, name="crm-polizas-create"),
    path("panel/crm/polizas/<int:poliza_id>", crm.editar_poliza, name="crm-polizas-edit"),
    path("panel/crm/polizas/<int:poliza_id>/delete", crm.eliminar_poliza, name="crm-polizas-delete"),
    path("panel/crm/pagos", crm.crear_pago, name="crm-pagos-create"),
    path("panel/crm/pagos/<int:pago_id>", crm.editar_pago, name="crm-pagos-edit"),
    path("panel/crm/pagos/<int:pago_id>/delete", crm.eliminar_pago, name="crm-pagos-delete"),
    path("panel/crm/productos", crm.crear_producto, name="crm-productos-create"),
    path("panel/crm/productos/<int:producto_id>", crm.editar_producto, name="crm-productos-edit"),
    path("panel/crm/productos/<int:producto_id>/delete", crm.eliminar_producto, name="crm-productos-delete"),
    path("panel/crm/tareas", crm.crear_tarea, name="crm-tareas-create"),
    path("panel/crm/tareas/<int:tarea_id>", crm.mover_tarea, name="crm-tareas-edit"),
    path("panel/crm/tareas/<int:tarea_id>/delete", crm.eliminar_tarea, name="crm-tareas-delete"),
]
