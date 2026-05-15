# Dockerfile.ml — multi-stage
FROM python:3.11-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements_ml.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --prefix=/install -r requirements_ml.txt

# ── Image finale (sans gcc/g++) ──
FROM python:3.11-slim

WORKDIR /app
COPY --from=builder /install /usr/local
COPY --from=builder /usr/lib/x86_64-linux-gnu/libgomp* /usr/lib/x86_64-linux-gnu/

COPY backend/ml_auto_refresh.py .
COPY backend/sla_alert_mailer.py .

RUN mkdir -p /app/data /app/ml_output

CMD ["python", "ml_auto_refresh.py", \
     "--csv", "/app/data/incident_sla.csv", \
     "--out", "/app/ml_output"]