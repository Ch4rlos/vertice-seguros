"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.conf import settings
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('api/', include('core.urls')),
    path('api/landing/', include('landing.urls')),
    path('api/evaluations/', include('evaluations.urls')),
    path('api/crm/', include('crm.urls')),
]

# Capa 5 (directiva de Carlos 2026-08-24): el admin de Django desaparece de
# las rutas en produccion (DEBUG=0) — no hay razon para exponerlo.
if settings.DEBUG:
    urlpatterns.insert(0, path('admin/', admin.site.urls))
