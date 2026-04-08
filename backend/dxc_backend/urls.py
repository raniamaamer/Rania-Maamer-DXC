"""
DXC KPI Dashboard - URL Configuration
"""
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

urlpatterns = [
    path('', root),
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),
]
