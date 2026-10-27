from django.http import JsonResponse


def health(request):
    return JsonResponse({"status": "ok", "service": "cq-asesor-patrimonial-api"})
