# DXC KPI Dashboard — Guide DevOps 🚀

> **Objectif :** Automatiser le déploiement et monitorer la santé du portail Contact Center Analytics de DXC Tunisia.

---

## 📁 Structure du projet

```
Rania-Maamer/
├── backend/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── .env                    # Variables d'environnement (ne pas commiter)
│   ├── gunicorn.conf.py
│   ├── manage.py
│   ├── requirements.txt
│   └── dxc_backend/
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf              # SPA React + reverse proxy /api/ → backend
│   ├── .dockerignore
│   ├── public/
│   │   └── img/
│   │       └── DXC.png        # Logo DXC (doit être dans public/ pour le build)
│   └── src/
│       ├── pages/
│       ├── hooks/
│       ├── utils/
│       └── styles/
├── monitoring/
│   ├── prometheus.yml
│   ├── sonarqube-init.sh
│   └── grafana/
│       ├── provisioning/
│       └── dashboards/
├── data/
│   ├── Historical_Metrics_Report.csv
│   └── SLA.xlsx
├── .env                        # Variables globales (DB_USER, DB_PASSWORD, DB_NAME)
├── docker-compose.yml
├── Jenkinsfile
└── sonar-project.properties
```

---

## 🐳 Sprint 0 — Docker (Fondation)

### Prérequis

- Docker Desktop installé et lancé
- Git

### Démarrage en une commande

```bash
# 1. Cloner le projet
git clone <repo-url>
cd Rania-Maamer

# 2. Configurer les variables d'environnement
# Fichier racine .env
echo "DB_NAME=dxc_kpi_db"     > .env
echo "DB_USER=postgres"       >> .env
echo "DB_PASSWORD=<password>" >> .env

# Fichier backend/.env (déjà présent)
# Vérifier que DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT sont renseignés

# 3. Lancer tous les services
docker compose up --build -d

# 4. Accéder à l'application
# Frontend   → http://localhost
# Backend    → http://localhost:8000/api/
# Grafana    → http://localhost:3000  (admin / admin123)
# Prometheus → http://localhost:7070
# SonarQube  → http://localhost:9000
```

### Watch mode — rebuild automatique

```bash
# Après le premier build, activer le watch
# Chaque modification dans src/ ou backend/ déclenche un rebuild automatique
docker compose watch
```

### Commandes utiles

```bash
# Voir les logs en temps réel
docker compose logs -f

# Voir les logs d'un service spécifique
docker compose logs -f backend
docker compose logs -f frontend

# Arrêter tous les services (conserve les volumes)
docker compose down

# Arrêter et supprimer TOUT (volumes inclus) ⚠️
docker compose down -v

# Rebuild un seul service
docker compose up --build -d frontend
docker compose up --build -d backend

# Vérifier l'état des containers
docker compose ps

# Accéder au shell d'un container
docker exec -it backend bash
docker exec -it frontend sh

# Vérifier que le logo DXC est bien présent dans nginx
docker exec -it frontend ls /usr/share/nginx/html/img/
```

### Architecture des services

```
┌──────────────────────────────────────────────────────────────────┐
│                        Docker Network                            │
│                                                                  │
│  ┌─────────────────┐   /api/   ┌──────────────────────────┐     │
│  │    Frontend      │ ───────► │        Backend           │     │
│  │  React / Nginx   │          │   Django + Gunicorn      │     │
│  │    :80           │          │        :8000             │     │
│  └─────────────────┘          └────────────┬─────────────┘     │
│                                             │                    │
│                               ┌─────────────▼──────────────┐   │
│                               │       PostgreSQL 15         │   │
│                               │          :5433              │   │
│                               └─────────────────────────────┘   │
│                                                                  │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────────┐  │
│  │  Prometheus  │   │   Grafana    │   │     SonarQube      │  │
│  │    :7070     │   │    :3000     │   │       :9000        │  │
│  └──────────────┘   └──────────────┘   └────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🔬 Sprint 1 — CI Pipeline

### Ce que fait le pipeline `Jenkinsfile`

| Job | Outil | Action |
|-----|-------|--------|
| `lint-backend` | flake8 | Vérification PEP8 du code Python |
| `test-backend` | pytest + coverage | Tests Django avec PostgreSQL de test |
| `test-frontend` | ESLint + Vite build | Lint JS + smoke build |
| `sonarqube` | SonarQube | Analyse qualité du code |
| `docker-build` | Docker | Vérification que les images buildent |

### SonarQube

```bash
# Accéder à SonarQube
http://localhost:9000
# Login : admin / admin

# L'analyse est lancée automatiquement via sonarqube-init au démarrage
# Configuration dans sonar-project.properties
```

---

## 🚀 Sprint 2 — CD & Déploiement

### Pipeline de déploiement

```
CI réussit sur main
        │
        ▼
┌───────────────┐    ┌─────────────────┐    ┌────────────────┐    ┌──────────────┐
│ Build & Push  │───►│ Deploy Staging  │───►│  Smoke Tests   │───►│ Deploy Prod  │
│ Docker Images │    │   auto-approve  │    │ (curl health)  │    │  manuelle    │
└───────────────┘    └─────────────────┘    └────────────────┘    └──────────────┘
```

---

## 📊 Sprint 3 — Observabilité (Prometheus + Grafana)

### Accès aux dashboards

| Service | URL | Identifiants |
|---------|-----|--------------|
| Grafana | http://localhost:3000 | admin / admin123 |
| Prometheus | http://localhost:7070 | — |
| postgres-exporter | métrique interne | — |

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

### Fichier racine `.env` (pour docker-compose)

```env
DB_NAME=dxc_kpi_db
DB_USER=postgres
DB_PASSWORD=<mot-de-passe-fort>
```

### Fichier `backend/.env` (pour Django)

```env
DJANGO_SECRET_KEY=votre-clé-secrète-très-longue
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1,backend,frontend,0.0.0.0

DB_NAME=dxc_kpi_db
DB_USER=postgres
DB_PASSWORD=<mot-de-passe-fort>
DB_HOST=db
DB_PORT=5432

DJANGO_LOG_LEVEL=INFO
```

> ⚠️ Ne jamais commiter les fichiers `.env` — vérifier que `.gitignore` les exclut.

---

## ⚠️ Points importants

### Logo DXC
Le fichier `DXC.png` doit être placé dans `frontend/public/img/` pour être inclus dans le build Vite et servi par Nginx :
```
frontend/public/img/DXC.png ✅
```

### Mots de passe
Ne jamais mettre de mots de passe en dur dans `docker-compose.yml` — toujours utiliser les variables `${DB_USER}`, `${DB_PASSWORD}`, `${DB_NAME}` depuis le fichier `.env`.

---

## 📋 Roadmap DevOps

| Sprint | Focus | Status |
|--------|-------|--------|
| S0 | Docker + docker-compose + watch mode | ✅ Terminé |
| S1 | CI : tests + SonarQube + Jenkinsfile | ✅ Terminé |
| S2 | CD : staging + prod | ✅ Terminé |
| S3 | Prometheus + Grafana + postgres-exporter | ✅ Terminé |