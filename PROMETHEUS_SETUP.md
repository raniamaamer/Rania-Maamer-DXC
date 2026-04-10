
####  GUIDE : Intégrer django-prometheus dans ton backend Django
#### Fichier : backend/PROMETHEUS_SETUP.md
───────────────────────────────────────────────
### 1. Installer la librairie

Ajouter dans requirements.txt :

    django-prometheus==2.3.1


### 2. Modifier dxc_backend/settings.py

    INSTALLED_APPS = [
        'django_prometheus',   # <-- ajouter EN PREMIER
        ...
        'django.contrib.admin',
        'django.contrib.auth',
        # ...
        'django_prometheus',   # <-- aussi EN DERNIER
    ]

    MIDDLEWARE = [
        'django_prometheus.middleware.PrometheusBeforeMiddleware',  # <-- PREMIER
        ...
        'django.middleware.security.SecurityMiddleware',
        # ... tes middlewares existants ...
        'django_prometheus.middleware.PrometheusAfterMiddleware',   # <-- DERNIER
    ]


### 3. Modifier dxc_backend/urls.py

    from django.urls import path, include

    urlpatterns = [
        # ... tes URLs existantes ...
        path('', include('django_prometheus.urls')),  # expose /metrics
    ]


### 4. Modifier le Dockerfile backend
   S'assurer que curl est installé pour le healthcheck :

    RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*


### 5. Ajouter un endpoint /health/ dans urls.py (pour le healthcheck docker)

    from django.http import JsonResponse

    def health_check(request):
        return JsonResponse({"status": "ok"})

    urlpatterns = [
        path('health/', health_check),
        path('', include('django_prometheus.urls')),
        # ... reste des URLs
    ]


### 6. Vérifier que ça marche

    # Lancer les containers
    docker-compose up -d

    # Tester l'endpoint métriques
    curl http://localhost:8000/metrics

    # Accéder à Prometheus
    http://localhost:9090

    # Accéder à Grafana
    http://localhost:3000
    # Login : admin / admin123


### Structure de fichiers créée

    projet/
    ├── docker-compose.yaml          ← mis à jour (Prometheus + Grafana)
    ├── monitoring/
    │   ├── prometheus.yml           ← config scraping
    │   └── grafana/
    │       ├── provisioning/
    │       │   ├── datasources/
    │       │   │   └── prometheus.yml   ← connexion auto Prometheus
    │       │   └── dashboards/
    │       │       └── dashboard.yml    ← chargement auto dashboards
    │       └── dashboards/
    │           └── django.json          ← dashboard DXC Portal
    └── backend/
        └── dxc_backend/
            ├── settings.py          ← ajouter django_prometheus
            └── urls.py              ← ajouter /metrics et /health/