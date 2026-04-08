# DXC KPI Dashboard — Guide DevOps 🚀

> **Objectif :** Automatiser le déploiement et monitorer la santé du portail.

---

## 📁 Structure DevOps

```
devops/
├── backend/
│   ├── Dockerfile          # Image Python 3.9 · Django · Gunicorn (multi-stage)
│   └── .dockerignore
├── frontend/
│   ├── Dockerfile          # Image Node 20 · Vite build → Nginx
│   ├── nginx.conf          # SPA React + reverse proxy /api/ → backend
│   └── .dockerignore
├── .github/
│   └── workflows/
│       ├── ci.yml          # Sprint 1 — Tests + SonarQube
│       └── cd.yml          # Sprint 2 — Deploy Staging → Prod
├── monitoring/
│   ├── prometheus.yml      # Sprint 3 — Scrape config
│   └── alerts.yml          # Règles d'alerting
└── docker-compose.yml      # Orchestration locale
```

---

## 🐳 Sprint 0 — Docker (Fondation)

### Démarrage en une commande

```bash
# 1. Copier et configurer les variables d'environnement
cp backend/.env.example backend/.env
# Éditez backend/.env avec vos vraies valeurs

# 2. Lancer tous les services
docker-compose up --build

# 3. Accéder à l'application
# Frontend  → http://localhost:3000
# Backend   → http://localhost:8000/api/overview/
# DB        → localhost:5432
```

### Commandes utiles

```bash
# Arrêter et nettoyer (conserve les volumes)
docker-compose down

# Arrêter et supprimer TOUT (volumes inclus) ⚠️
docker-compose down -v
```

### Architecture des services

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Network: dxc_net              │
│                                                         │
│  ┌───────────────┐   /api/  ┌──────────────────────┐   │
│  │   Frontend    │ ───────► │      Backend         │   │
│  │  React/Nginx  │          │  Django + Gunicorn   │   │
│  │  :3000 → :80  │          │       :8000          │   │
│  └───────────────┘          └──────────┬───────────┘   │
│                                        │                │
│                             ┌──────────▼───────────┐   │
│                             │     PostgreSQL 15     │   │
│                             │        :5432          │   │
│                             └──────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 🔬 Sprint 1 — CI Pipeline (Feb 16 – Mar 6)

### Ce que fait le pipeline `ci.yml`

| Job | Outil | Action |
|-----|-------|--------|
| `lint-backend` | flake8 | Vérification PEP8 du code Python |
| `test-backend` | pytest + coverage | Tests Django avec PostgreSQL de test |
| `test-frontend` | ESLint + Vite build | Lint JS + smoke build |
| `docker-build` | Docker | Vérification que les images buildent |


---

## 🚀 Sprint 2 — CD & IaC (Mar 9 – Mar 27)

### Ce que fait le pipeline `cd.yml`

```
CI réussit sur main
        │
        ▼
┌───────────────┐    ┌─────────────────┐    ┌────────────────┐    ┌──────────────┐
│ Build & Push  │───►│ Deploy Staging  │───►│  Smoke Tests   │───►│ Deploy Prod  │
│ Docker Images │    │  (Terraform)    │    │ (curl health)  │    │ (approbation)│
│ → GHCR        │    │ auto-approve    │    │                │    │  manuelle    │
└───────────────┘    └─────────────────┘    └────────────────┘    └──────────────┘
```

### Secrets GitHub à configurer

```
STAGING_HOST        → IP du serveur staging
STAGING_USER        → Utilisateur SSH
STAGING_SSH_KEY     → Clé privée SSH
DB_PASSWORD_STAGING → Mot de passe BDD staging

PROD_HOST           → IP du serveur production
PROD_USER           → Utilisateur SSH
PROD_SSH_KEY        → Clé privée SSH
```

### Activer l'approbation manuelle pour la production

Dans GitHub → Settings → Environments → `production` → cocher **Required reviewers**

---

## 📊 Sprint 3 — Observabilité (Mar 30 – Apr 17)

### Activer Prometheus + Grafana

1. **Décommenter** les services dans `docker-compose.yml` (section S3)
2. **Ajouter `django-prometheus`** au backend :

```bash
pip install django-prometheus
```

```python
# backend/dxc_backend/settings/base.py
INSTALLED_APPS = [
    'django_prometheus',   # ← Ajouter en premier
    ...
]

MIDDLEWARE = [
    'django_prometheus.middleware.PrometheusBeforeMiddleware',  # ← Début
    ...
    'django_prometheus.middleware.PrometheusAfterMiddleware',   # ← Fin
]
```

```python
# backend/dxc_backend/urls.py
urlpatterns = [
    path('', include('django_prometheus.urls')),  # ← Expose /metrics
    ...
]
```

3. **Redémarrer** et accéder aux dashboards :
   - Prometheus : http://localhost:9090
   - Grafana    : http://localhost:3001 (admin / dxc_grafana_2024)

### Métriques disponibles

| Métrique | Description |
|----------|-------------|
| `django_http_requests_total_by_view_method` | Requêtes par endpoint |
| `django_http_responses_total_by_status` | Réponses par code HTTP |
| `django_http_requests_latency_seconds` | Latence des requêtes |
| `django_db_execute_total` | Requêtes SQL exécutées |
| `pg_stat_activity_count` | Connexions PostgreSQL actives |

---

## 🔐 Variables d'environnement

Copiez `backend/.env.example` → `backend/.env` et renseignez :

```env
DJANGO_SECRET_KEY=votre-clé-secrète-très-longue
DEBUG=False
ALLOWED_HOSTS=localhost 127.0.0.1 votre-domaine.com

DB_NAME=dxc_kpi_db
DB_USER=dxc_user
DB_PASSWORD=mot-de-passe-fort
DB_HOST=db         # ← "db" dans Docker, "localhost" en local
DB_PORT=5432
```

---

## 📋 Roadmap DevOps

| Sprint | Dates | Focus | Status |
|--------|-------|-------|--------|
| S0 | — | Docker + docker-compose | ✅ Prêt |
| S1 | Feb 16 – Mar 16 | CI : tests + SonarQube | ✅ Prêt |
| S2 | Mar 16 – Apr 06 | CD : staging + prod | ✅ Prêt |
| S3 | Apr 06 – Apr 27 | Prometheus + Grafana | ✅ Prêt |