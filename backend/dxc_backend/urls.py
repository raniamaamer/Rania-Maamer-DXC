from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse

def root(request):
    return JsonResponse({
        "project": "DXC KPI Intelligence Dashboard",
        "version": "1.0.0 — Sprint 1",
        "docs": "/api/",
        "endpoints": [
            "/api/overview/",
            "/api/accounts/",
            "/api/queues/",
            "/api/hourly/",
            "/api/bottom5/",
            "/api/trend7/",
            "/api/snapshots/",
            "/api/sla-config/",
            "/api/health/",
        ]
    })

def health_check(request):
    return JsonResponse({"status": "ok"})

urlpatterns = [
    path('', root),
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),

    # ── Ajouts Sprint S3 ────────────────────────────────────────
    # Health check Docker → GET /health/
    path('health/', health_check),

    # Métriques Prometheus → GET /metrics
    # Scrapé automatiquement par Prometheus toutes les 10s
    path('', include('django_prometheus.urls')),
]