from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)

from django.http import HttpResponse

def metrics_view(request):
    from prometheus_client import (
        CollectorRegistry, multiprocess,
        generate_latest, CONTENT_TYPE_LATEST
    )
    registry = CollectorRegistry()
    multiprocess.MultiProcessCollector(registry)
    data = generate_latest(registry)
    return HttpResponse(data, content_type=CONTENT_TYPE_LATEST)

@require_http_methods(["GET"])
def root(request):
    return JsonResponse({
        "project": "DXC KPI Intelligence Dashboard",
        "version": "1.0.0 — Sprint 1",
        "docs": "/api/docs/",
        "endpoints": [
            "/api/overview/",
            "/api/accounts/",
            "/api/queues/",
            "/api/hourly/",
            "/api/bottom5/",
            "/api/trend7/",
            "/api/snapshots/",
            "/api/sla-config/",
            "/api/historical/",
            "/api/realtime/",          
            "/api/desk-langue/",
            "/api/predictions/",
            "/api/forecast/",
            "/api/forecast-queue/",    
            "/api/queue-summary/",     
            "/api/claude/",
            "/api/health/",
        ]
    })


urlpatterns = [
    path('',        root,                                               name='root'),
    path('admin/',  admin.site.urls),
    path('api/',    include('api.urls', namespace='api')),

    # ── Swagger ──────────────────────────────────────────────────
    path('api/schema/', SpectacularAPIView.as_view(),                   name='schema'),
    path('api/docs/',   SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/',  SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # ── Prometheus ───────────────────────────────────────────────
    path('metrics/', metrics_view, name='prometheus-metrics'),
]