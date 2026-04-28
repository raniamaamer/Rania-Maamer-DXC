# ─────────────────────────────────────────────────────────────
#  backend/Dockerfile.ml — Image légère pour le worker ML
#  Prophet + Random Forest + Watchdog
# ─────────────────────────────────────────────────────────────

FROM python:3.11-slim

WORKDIR /app

# Dépendances système nécessaires pour Prophet et matplotlib
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Dépendances Python ML uniquement (image plus légère que le backend complet)
COPY backend/requirements_ml.txt .
RUN pip install --no-cache-dir -r requirements_ml.txt

# Copier le script ML
COPY backend/ml_auto_refresh.py .

# Dossiers de travail
RUN mkdir -p /app/data /app/ml_output

CMD ["python", "ml_auto_refresh.py", \
     "--csv", "/app/data/incident_sla.csv", \
     "--out", "/app/ml_output"]