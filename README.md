# DXC KPI Intelligence Dashboard

> Contact Center Analytics Platform — DXC Technology Tunisia

A full-stack KPI monitoring and forecasting platform for Amazon Connect contact centers, serving clients including **Servier**, **Renault**, **Luxottica**, etc.

---

## Table of Contents

- [Stack](#stack)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Pages](#pages)
- [API Endpoints](#api-endpoints)
- [ML & Forecasting](#ml--forecasting)
- [Monitoring](#monitoring)
- [CI/CD](#cicd)
- [Testing](#testing)
- [Environment Variables](#environment-variables)
- [Notes](#notes)

---

## Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend | React + React Router 6 | 18 |
| Charts | Chart.js | 4.x |
| Build | Vite | 5.x |
| Backend | Django + DRF | 4.2 |
| Database | PostgreSQL | 15+ |
| Data Pipeline | Python (pandas, openpyxl) | 3.9 |
| ML / Classification | scikit-learn, XGBoost | 1.5 / 4.3 |
| Forecasting | Prophet, cmdstanpy | 1.1.5 / 1.2.0 |
| Notebooks | Jupyter (VS Code) | 1.0 |
| Containerization | Docker + Docker Compose | — |
| CI/CD | Jenkins + SonarQube | — |
| API Docs | drf-spectacular (OpenAPI) | 0.27.2 |
| Scheduling | APScheduler (django-apscheduler) | 0.6.2 |
| Task runner | Gunicorn | 22.0 |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        DXC KPI Platform                         │
└─────────────────────────────────────────────────────────────────┘

  ┌───────────┐    ┌───────┐    ┌──────────────────┐    ┌──────────────┐
  │React+Vite │───►│ Nginx │───►│ Django REST (DRF) │───►│  PostgreSQL  │
  └───────────┘    └───────┘    └────────┬─────────┘    └──────────────┘
                                         │
                                ┌────────▼────────┐
                                │  APScheduler    │
                                │  (ETL / live)   │
                                └────────┬────────┘
                                         │
                                ┌────────▼────────┐
                                │  ETL Pipeline   │
                                │pandas / openpyxl│
                                └────────┬────────┘
                                         │
                                ┌────────▼────────┐
                                │  data/output/   │
                                │ Metrics_Final   │
                                │ Queues_cleaned  │
                                │  sla_main.json  │
                                └─────────────────┘
```

---

## Quick Start

### Prerequisites

- Python 3.9+
- Node.js 18+
- PostgreSQL 15+
- Docker & Docker Compose (for containerized setup)

### Backend

```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py run_etl
python manage.py seed_missing_accounts
python manage.py runserver 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev        # → http://localhost:3000
```

### Docker (full stack)

```bash
docker compose up --build
```

---

## Project Structure

```
Rania-Maamer/
├── backend/
│   ├── api/
│   │   ├── models.py
│   │   ├── views.py
│   │   ├── serializers.py
│   │   ├── scheduler.py
│   │   ├── urls.py
│   │   └── management/commands/
│   │       ├── run_etl.py
│   │       ├── load_today.py
│   │       ├── archive_realtime.py
│   │       ├── archive_to_historical.py
│   │       └── seed_missing_accounts.py
│   ├── dxc_backend/
│   │   └── settings/base.py
│   ├── gunicorn.conf.py
│   ├── dockerfile
│   └── manage.py
├── data/
│   ├── extracted/
│   │   ├── queues_raw.csv
│   │   └── sla_config_raw.csv
│   ├── transformed/
│   │   ├── Historical_Metrics_Report.csv
│   │   ├── SLA.xlsx
│   │   ├── Servier_KPIs.csv
│   │   ├── Telephony_Data.csv
│   │   └── incident_sla.csv
│   └── output/
│       ├── Metrics_Final.csv
│       ├── Queues_cleaned.csv
│       └── sla_main.json
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Overview.jsx
│       │   ├── Accounts.jsx
│       │   ├── Queues.jsx
│       │   ├── Hourly.jsx
│       │   ├── LiveData.jsx
│       │   ├── SLAConfig.jsx
│       │   ├── Forecasting.jsx
│       │   ├── Analyse.jsx
│       │   └── ChatBot.jsx
│       ├── utils/api.js
│       └── hooks/useFetch.js
├── ml/
├── prediction/
├── notebook/
│   ├── data-comprehension.ipynb
│   └── eda.ipynb
├── postgres-init/
├── docker-compose.yaml
├── Jenkinsfile
└── sonar-project.properties
```

---

## Pages

| Page | Route | Description |
|---|---|---|
| Vue Globale | `/` | KPI cards + Bottom5 + Donut + Trend 30j |
| Comptes | `/accounts` | Table SLA + formules + modal détail |
| Files | `/queues` | Table files d'attente filtrables |
| Tendance Horaire | `/hourly` | SLA & abandon par heure |
| Config SLA | `/sla-config` | Paramètres SLA par compte (CRUD) |
| Hist / Temps Réel | `/live-data` | Live cards (15min) + tableau historique |
| Forecasting | `/forecasting` | Prévisions XGBoost + Prophet (Servier) |
| Analyse | `/analyse` | Analyse exploratoire des données |
| ChatBot | `/chatbot` | Assistant KPI conversationnel |

---

## API Endpoints

Base URL : `http://localhost:8000/api/`

| Endpoint | Method | Description |
|---|---|---|
| `/overview/` | GET | KPIs globaux |
| `/accounts/` | GET | Résumé SLA par compte |
| `/hourly/` | GET | Tendance horaire |
| `/trend7/` | GET | Tendance 7 jours |
| `/snapshots/` | GET | Snapshots journaliers |
| `/sla-config/` | GET, POST | Configuration SLA |
| `/sla-config/<pk>/` | PUT, DELETE | Modifier / supprimer une config SLA |
| `/desk-langue/` | GET | Tableau historique par desk/langue |
| `/realtime/` | GET, POST | Snapshot temps réel |
| `/historical/` | GET | Données historiques agrégées |
| `/refresh/` | POST | Déclencher ETL |
| `/forecast/` | GET | Prévisions pour la file Servier |

**Filtres disponibles sur tous les endpoints :**
```
?year=&month=&week=&day=&language=
```

**Documentation OpenAPI :** `http://localhost:8000/api/schema/` (drf-spectacular)

---

## ML & Forecasting

### Features utilisées

| Catégorie | Features |
|---|---|
| Temporelles | heure, jour semaine, semaine, mois, trimestre, is_weekend, is_peak |
| Lags | volume J-1, J-7, moyenne mobile 7j, SLA J-1, J-7, AHT J-1, J-7 |
| Configuration | target_ans_rate, target_abd_rate, timeframe_bh |
| Encodées | account_enc, queue_enc, language_enc, day_enc |

### Modèles comparés (file Servier)

| Modèle | Statut |
|---|---|
| SARIMA | Baseline |
| XGBoost | ✅ Meilleur (MAE le plus bas) |
| LightGBM | Comparé |
| Prophet | Utilisé en ensemble |

### Stratégie de prévision (ForecastView)

Ensemble XGBoost + Prophet avec pondération dynamique basée sur le MAE :

```
weight_xgb = MAE_prophet / (MAE_xgb + MAE_prophet)
weight_prophet = MAE_xgb / (MAE_xgb + MAE_prophet)
forecast = weight_xgb * pred_xgb + weight_prophet * pred_prophet
```

### Notebooks

| Notebook | Description |
|---|---|
| `prediction/servier_forecasting_v3.ipynb` | Modèle final XGBoost + Prophet |
| `prediction/servier_forecasting.ipynb` | Comparaison SARIMA / XGBoost / LightGBM / Prophet |
| `prediction/servier_prediction.ipynb` | Inférence et export des prévisions |
| `notebook/data-comprehension.ipynb` | Exploration des fichiers Excel sources |
| `notebook/eda.ipynb` | Analyse exploratoire et visualisation |

---


## CI/CD

Pipeline Jenkins défini dans `Jenkinsfile` :

1. **Checkout** — clone du dépôt
2. **Install** — `pip install -r requirements.txt`
3. **Test** — `pytest --cov`
4. **SonarQube** — analyse qualité (sonar-project.properties)
5. **Build Docker** — `docker compose build`
6. **Deploy** — `docker compose up -d`

---

## Testing

```bash
cd backend
pytest --cov=api --cov-report=html
```

Configuration dans `pytest.ini`. Rapport de couverture généré dans `outputs/`.

Dépendances de test : `pytest-django`, `factory-boy`, `pytest-cov`.

---

## Environment Variables

Fichier `.env` à la racine et dans `backend/` :

```env
DB_NAME=dxc_kpi_db
DB_USER=postgres
DB_PASSWORD=<your_password>
DB_HOST=localhost
DB_PORT=5432
```

---

## Notes

- Désactiver le throttling DRF en dev : `DEFAULT_THROTTLE_CLASSES: []`
- Les comptes sans données (HPE, Luxottica, Philips, Saipem, DXC IT, Basrah Gas) sont exclus du Bottom 5 via `offered__gt=0`
- 13 langues supportées : `fr`, `en`, `de`, `it`, `es`, `nl`, `pt`, `ar`, `tr`, `ru`, `hu`, `pl`, `mx`
- Le scheduler APScheduler est initialisé via le hook Gunicorn `on_starting` pour éviter les duplications de workers
- Les métriques SLA/abandon sont calculées en moyenne pondérée par volume (pas de simple moyenne)

---

*Built by Rania Maamer — PFE DXC Technology Tunisia / FSEGT 2026*