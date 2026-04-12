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
│       └── commands/
│           └── run_etl.py
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
├── docker-compose.yaml
├── README_DEVOPS.md
├── README.md
└── requirements.txt
```
## Notes

- Désactiver le throttling DRF en dev (`DEFAULT_THROTTLE_CLASSES: []`)
- Les comptes sans données (HPE, Luxottica, Philips, Saipem, DXC IT, Basrah Gas) sont exclus du Bottom 5 via `offered__gt=0`
- 13 langues supportées : fr, en, de, it, es, nl, pt, ar, tr, ru, hu, pl, mx
