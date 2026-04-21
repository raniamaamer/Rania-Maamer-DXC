# DXC Tunisia

> Contact Center Analytics — Sprint 1 

## Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React + React Router 6 | 18 |
| Charts | Chart.js | 4.x |
| Build | Vite | 5.x |
| Backend | Django + DRF | 4.2 |
| Database | PostgreSQL | 15+ |
| Data Pipeline | Python (pandas, openpyxl) | 3.9 |
| Machine Learning | scikit-learn, XGBoost, LightGBM | 1.4 / 2.0 / 4.3 |
| Notebooks | Jupyter (VS Code) | 1.0 |

## Démarrage rapide
```bash
# Backend
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py run_etl
python manage.py seed_missing_accounts
python manage.py runserver 8000

# Frontend
cd frontend
npm install
npm run dev        # → http://localhost:3000
```

## Pages

| Page | Route | Description |
|------|-------|-------------|
| Vue Globale | `/` | KPI cards + Bottom5 + Donut + Trend 30j |
| Comptes | `/accounts` | Table SLA + formules + modal détail |
| Files | `/queues` | Table files d'attente filtrables |
| Tendance Horaire | `/hourly` | SLA & abandon par heure |
| Config SLA | `/sla-config` | Paramètres SLA par compte (CRUD) |
| Hist / Temps Réel | `/live-data` | Live cards (15min) + tableau historique |

## Endpoints API

| Endpoint | Description |
|----------|-------------|
| `GET /api/overview/` | KPIs globaux |
| `GET /api/accounts/` | Résumé SLA par compte |
| `GET /api/hourly/` | Tendance horaire |
| `GET /api/bottom5/` | 5 comptes sous-performants (offered > 0) |
| `GET /api/trend7/` | Tendance 7 jours |
| `GET /api/snapshots/` | Snapshots journaliers |
| `GET /api/sla-config/` | Configuration SLA |
| `POST /api/sla-config/` | Créer une configuration SLA |
| `PUT /api/sla-config/<pk>/` | Modifier une configuration SLA |
| `DELETE /api/sla-config/<pk>/` | Supprimer une configuration SLA |
| `GET /api/desk-langue/` | Tableau historique par desk/langue |
| `GET /api/realtime/` | Snapshot temps réel |
| `POST /api/realtime/` | Pousser une métrique live |
| `GET /api/historical/` | Données historiques agrégées |
| `POST /api/refresh/` | Déclencher ETL |

Filtres disponibles sur tous les endpoints : `?year= &month= &week= &day= &language=`


### Notebooks

| Notebook | Description |
|----------|-------------|
| `notebook/data-comprehension.ipynb` | Comprendre les données depuis les fichiers excel |
| `notebook/eda.ipynb` | Exploration et visualisation des données |

### Features utilisées

- **Temporelles** : heure, jour semaine, semaine, mois, trimestre, is_weekend, is_peak
- **Lags** : volume J-1, J-7, moyenne mobile 7j, SLA J-1, J-7, AHT J-1, J-7
- **Configuration** : target_ans_rate, target_abd_rate, timeframe_bh
- **Encodées** : account_enc, queue_enc, language_enc, day_enc

### Données sauvegardées
```
data/output/
├── sla_main.json
├── Metrics_Final.csv
└── Queues_cleaned.csv

```

## Variables d'environnement (.env)
```
DB_NAME=dxc_kpi_db
DB_USER=postgres
DB_PASSWORD=20010430
DB_HOST=localhost
DB_PORT=5432
```

## Structure du projet
```
Rania-Maamer/
├── backend/
│   ├── api/
│   │   ├── models.py
│   │   ├── views.py
│   │   ├── serializers.py
│   │   └── urls.py
│   └── management/
│   │    └── commands/
│   │        └── run_etl.py
│   └── migrations
│   ├── dxc_backend/
│   │    └── base.py
│   │
│   └── dockerfile
│   └──gunicorn.conf.py
│    └──manage.py
├── data/
│   ├── extracted/
│   ├── output/
│   │   ├── Metrics_Final.csv
│   │   ├── Queues_cleaned.csv
│   │   └── sla_main.json
│   └── transformed/
│       ├── Historical_Metrics_Report.csv
│       ├── SLA.xlsx
│       └── ~$SLA.xlsx
├── database/
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Overview.jsx
│       │   ├── Accounts.jsx
│       │   ├── Queues.jsx
│       │   ├── Hourly.jsx
│       │   ├── SLAConfig.jsx
│       │   └── LiveData.jsx
│       ├── utils/
│       │   └── api.js
│       └── hooks/
│           └── useFetch.js
├── notebook/
│   ├── data-comprehension.ipynb
│   └── eda.ipynb
├── cols.txt
├── Jenkinsfile
├── docker-compose.yaml
├── README_DEVOPS.md
├── README_JENKINS.md
├── README.md
├── requirements.txt
└── sonar-project.properties
```
## Notes

- Désactiver le throttling DRF en dev (`DEFAULT_THROTTLE_CLASSES: []`)
- Les comptes sans données (HPE, Luxottica, Philips, Saipem, DXC IT, Basrah Gas) sont exclus du Bottom 5 via `offered__gt=0`
- 13 langues supportées : fr, en, de, it, es, nl, pt, ar, tr, ru, hu, pl, mx

```
Rania-Maamer
├─ .env
├─ backend
│  ├─ .dockerignore
│  ├─ .env
│  ├─ api
│  │  ├─ apps.py
│  │  ├─ management
│  │  │  ├─ commands
│  │  │  │  ├─ archive_realtime.py
│  │  │  │  ├─ archive_to_historical.py
│  │  │  │  ├─ load_today.py
│  │  │  │  ├─ run_etl.py
│  │  │  │  ├─ seed_missing_accounts.py
│  │  │  │  ├─ __init__.py
│  │  │  │  └─ __pycache__
│  │  │  │     ├─ run_etl.cpython-39.pyc
│  │  │  │     └─ __init__.cpython-39.pyc
│  │  │  ├─ __init__.py
│  │  │  └─ __pycache__
│  │  │     └─ __init__.cpython-39.pyc
│  │  ├─ migrations
│  │  │  ├─ 0001_initial.py
│  │  │  ├─ 0002_queuemetric_language.py
│  │  │  ├─ 0003_queuemetric_avg_ttc_realtimemetric_historicalmetric.py
│  │  │  ├─ 0004_accountsummary_abd_in_sla_accountsummary_ans_in_sla.py
│  │  │  ├─ 0005_accountsummary_avg_answer_time_and_more.py
│  │  │  ├─ 0006_hourlytrend_abd_in_sla_hourlytrend_ans_in_sla_and_more.py
│  │  │  ├─ 0007_rename_customer_hold_time_queuemetric_average_hold_time.py
│  │  │  ├─ 0008_rename_historicalmetric_customer_hold_time.py
│  │  │  ├─ 0009_historicalmetric_abd_out_sla_and_more.py
│  │  │  ├─ 0010_historicalmetric_handle_time_historicalmetric_is_ooh_and_more.py
│  │  │  ├─ 0011_prediction.py
│  │  │  ├─ 0012_add_abd_in_60_abd_out_60.py
│  │  │  ├─ 0013_merge_0011_prediction_0012_add_abd_in_60_abd_out_60.py
│  │  │  ├─ 0014 add desk field.py
│  │  │  ├─ 0015_remove_historicalmetric_abd_in_60_and_more.py
│  │  │  ├─ 0016_historicalmetric_abd_in_60_and_more.py
│  │  │  ├─ 0017_historicalmetric_answered_with_hold.py
│  │  │  ├─ 0018_historicalmetric_total_ttc_time_and_more.py
│  │  │  ├─ 0019_remove_historicalmetric_total_ttc_time.py
│  │  │  ├─ 0020_alter_historicalmetric_abd_in_60_and_more.py
│  │  │  ├─ 0021_accountsummary_avg_hold_time_and_more.py
│  │  │  ├─ 0022_add_contacts_put_on_hold.py
│  │  │  ├─ 0023_delete_prediction_slaconfig_other_sla_and_more.py
│  │  │  ├─ 0024_remove_slaconfig_other_sla.py
│  │  │  ├─ 0025_alter_historicalmetric_account_and_more.py
│  │  │  ├─ 0026_alter_historicalmetric_account_and_more.py
│  │  │  ├─ __init__.py
│  │  │  └─ __pycache__
│  │  │     ├─ 0001_initial.cpython-39.pyc
│  │  │     ├─ 0002_queuemetric_language.cpython-39.pyc
│  │  │     ├─ 0003_queuemetric_avg_ttc_realtimemetric_historicalmetric.cpython-39.pyc
│  │  │     ├─ 0004_accountsummary_abd_in_sla_accountsummary_ans_in_sla.cpython-39.pyc
│  │  │     ├─ 0005_accountsummary_avg_answer_time_and_more.cpython-39.pyc
│  │  │     ├─ 0006_hourlytrend_abd_in_sla_hourlytrend_ans_in_sla_and_more.cpython-39.pyc
│  │  │     ├─ 0007_rename_customer_hold_time_queuemetric_average_hold_time.cpython-39.pyc
│  │  │     ├─ 0008_rename_historicalmetric_customer_hold_time.cpython-39.pyc
│  │  │     ├─ 0009_historicalmetric_abd_out_sla_and_more.cpython-39.pyc
│  │  │     ├─ 0010_historicalmetric_handle_time_historicalmetric_is_ooh_and_more.cpython-39.pyc
│  │  │     ├─ 0011_prediction.cpython-39.pyc
│  │  │     ├─ 0012_add_abd_in_60_abd_out_60.cpython-39.pyc
│  │  │     ├─ 0013_merge_0011_prediction_0012_add_abd_in_60_abd_out_60.cpython-39.pyc
│  │  │     ├─ 0014 add desk field.cpython-39.pyc
│  │  │     ├─ 0015_remove_historicalmetric_abd_in_60_and_more.cpython-39.pyc
│  │  │     ├─ 0016_historicalmetric_abd_in_60_and_more.cpython-39.pyc
│  │  │     ├─ 0017_historicalmetric_answered_with_hold.cpython-39.pyc
│  │  │     ├─ 0018_historicalmetric_total_ttc_time_and_more.cpython-39.pyc
│  │  │     ├─ 0019_remove_historicalmetric_total_ttc_time.cpython-39.pyc
│  │  │     ├─ 0020 fix abd60 integerfield.py
│  │  │     ├─ 0020_alter_historicalmetric_abd_in_60_and_more.cpython-39.pyc
│  │  │     ├─ 0021_accountsummary_avg_hold_time_and_more.cpython-39.pyc
│  │  │     ├─ 0022_add_contacts_put_on_hold.cpython-39.pyc
│  │  │     ├─ 0023_delete_prediction_slaconfig_other_sla_and_more.cpython-39.pyc
│  │  │     ├─ 0024_remove_slaconfig_other_sla.cpython-39.pyc
│  │  │     ├─ 0025_alter_historicalmetric_account_and_more.cpython-39.pyc
│  │  │     └─ __init__.cpython-39.pyc
│  │  ├─ models.py
│  │  ├─ scheduler.py
│  │  ├─ serializers.py
│  │  ├─ tests.py
│  │  ├─ urls.py
│  │  ├─ views.py
│  │  ├─ __init__.py
│  │  └─ __pycache__
│  │     ├─ apps.cpython-39.pyc
│  │     ├─ models.cpython-39.pyc
│  │     ├─ predictor.cpython-39.pyc
│  │     ├─ scheduler.cpython-39.pyc
│  │     ├─ serializers.cpython-39.pyc
│  │     ├─ urls.cpython-39.pyc
│  │     ├─ views.cpython-39.pyc
│  │     └─ __init__.cpython-39.pyc
│  ├─ dockerfile
│  ├─ dxc_backend
│  │  ├─ settings
│  │  │  ├─ base.py
│  │  │  ├─ __init__.py
│  │  │  └─ __pycache__
│  │  │     ├─ base.cpython-39.pyc
│  │  │     └─ __init__.cpython-39.pyc
│  │  ├─ urls.py
│  │  ├─ wsgi.py
│  │  ├─ __init__.py
│  │  └─ __pycache__
│  │     ├─ urls.cpython-39.pyc
│  │     ├─ wsgi.cpython-39.pyc
│  │     └─ __init__.cpython-39.pyc
│  ├─ gunicorn.conf.py
│  └─ manage.py
├─ cols.txt
├─ data
│  ├─ extracted
│  │  ├─ queues_raw.csv
│  │  └─ sla_config_raw.csv
│  ├─ Historical_Metrics_Report.csv
│  ├─ output
│  │  ├─ Metrics_Final.csv
│  │  ├─ Queues_cleaned.csv
│  │  └─ sla_main.json
│  ├─ SLA.xlsx
│  ├─ transformed
│  │  ├─ aggregated_metrics.json
│  │  └─ queues_transformed.csv
│  └─ ~$SLA.xlsx
├─ database
│  └─ schema.sql
├─ direct.json
├─ docker-compose.yaml
├─ frontend
│  ├─ .dockerignore
│  ├─ dist
│  │  ├─ assets
│  │  │  ├─ index-BGPg9vvl.js
│  │  │  └─ index-CHyAC7rX.css
│  │  └─ index.html
│  ├─ dockerfile
│  ├─ index.html
│  ├─ nginx.conf
│  ├─ package-lock.json
│  ├─ package.json
│  ├─ public
│  │  └─ img
│  │     └─ DXC.png
│  ├─ src
│  │  ├─ App.jsx
│  │  ├─ hooks
│  │  │  └─ useFetch.js
│  │  ├─ main.jsx
│  │  ├─ pages
│  │  │  ├─ Accounts.jsx
│  │  │  ├─ Hourly.jsx
│  │  │  ├─ LiveData.jsx
│  │  │  ├─ Overview.jsx
│  │  │  ├─ Queues.jsx
│  │  │  └─ SLAConfig.jsx
│  │  ├─ styles
│  │  │  └─ index.css
│  │  └─ utils
│  │     └─ api.js
│  └─ vite.config.js
├─ Jenkinsfile
├─ monitoring
│  ├─ grafana
│  │  ├─ dashboards
│  │  │  └─ django.json
│  │  └─ provisioning
│  │     ├─ dashboards
│  │     │  └─ dashboard.yml
│  │     └─ datasources
│  │        └─ datasource.yml
│  ├─ prometheus.yml
│  └─ sonarqube-init.sh
├─ nginx.json
├─ notebook
│  ├─ data-comprehension.ipynb
│  └─ eda.ipynb
├─ PROMETHEUS_SETUP.md
├─ README.md
├─ README_DEVOPS.md
├─ README_JENKINS.md
├─ requirements.txt
└─ sonar-project.properties

```