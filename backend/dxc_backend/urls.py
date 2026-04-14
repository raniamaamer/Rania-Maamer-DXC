from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from drf_spectacular.views import (          
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)

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
            "/api/health/",
        ]
    })

def health_check(request):
    return JsonResponse({"status": "ok"})

urlpatterns = [
    path('', root),
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),

    # ── Swagger ─────────────────────────────────────────────────
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # ── Sprint S3 ────────────────────────────────────────────────
    path('health/', health_check),
    path('', include('django_prometheus.urls')),
]