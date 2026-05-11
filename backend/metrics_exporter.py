"""
metrics_exporter.py
═══════════════════
Expose les métriques ML (Prophet + Random Forest) vers Prometheus.
Scrappe automatiquement ml_data.json toutes les 5 minutes.

Installation :
    pip install prometheus_client

Lancement :
    python metrics_exporter.py --json ./outputs/ml_data.json --port 8000

Prometheus scrappe ensuite : http://localhost:8000/metrics
"""

import argparse
import json
import logging
import time
from pathlib import Path

from prometheus_client import Gauge, Counter, Info, start_http_server, REGISTRY

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

# ══════════════════════════════════════════════════════════════════════════════
# DÉFINITION DES MÉTRIQUES PROMETHEUS
# ══════════════════════════════════════════════════════════════════════════════

# ── Métriques globales dataset ─────────────────────────────────────────────────
sla_breach_rate_pct = Gauge(
    "sla_breach_rate_pct",
    "Taux global de rupture SLA (%)",
)
sla_breach_count = Gauge(
    "sla_breach_count_total",
    "Nombre total d'incidents en rupture SLA",
)
sla_total_incidents = Gauge(
    "sla_total_incidents",
    "Nombre total d'incidents dans le dataset",
)
sla_avg_daily_tickets = Gauge(
    "sla_avg_daily_tickets",
    "Moyenne quotidienne de tickets",
)

# ── Métriques modèle Prophet ───────────────────────────────────────────────────
sla_prophet_mae = Gauge(
    "sla_prophet_mae",
    "Prophet — Erreur absolue moyenne (MAE) en tickets/jour",
)
sla_prophet_rmse = Gauge(
    "sla_prophet_rmse",
    "Prophet — Erreur quadratique moyenne (RMSE)",
)
sla_prophet_mape = Gauge(
    "sla_prophet_mape_pct",
    "Prophet — Erreur absolue moyenne en pourcentage (MAPE %)",
)

# ── Métriques modèle Random Forest ────────────────────────────────────────────
sla_rf_auc = Gauge(
    "sla_rf_auc_roc",
    "Random Forest — Score AUC-ROC (0-1)",
)

# ── Prévision J+7 (une jauge par jour) ────────────────────────────────────────
sla_forecast_predicted = Gauge(
    "sla_forecast_tickets_predicted",
    "Volume de tickets prévu par Prophet",
    ["date", "day", "horizon_days"],
)
sla_forecast_lower = Gauge(
    "sla_forecast_tickets_lower",
    "Borne inférieure intervalle 95% Prophet",
    ["date", "day", "horizon_days"],
)
sla_forecast_upper = Gauge(
    "sla_forecast_tickets_upper",
    "Borne supérieure intervalle 95% Prophet",
    ["date", "day", "horizon_days"],
)

# ── Taux de rupture SLA par CI ─────────────────────────────────────────────────
sla_ci_breach_rate = Gauge(
    "sla_ci_breach_rate_pct",
    "Taux de rupture SLA par Configuration Item (%)",
    ["ci_name"],
)
sla_ci_incident_count = Gauge(
    "sla_ci_incident_count",
    "Nombre d'incidents par Configuration Item",
    ["ci_name"],
)

# ── Importance des variables Random Forest ────────────────────────────────────
sla_feature_importance = Gauge(
    "sla_feature_importance_pct",
    "Importance de la variable dans le modèle Random Forest (%)",
    ["feature"],
)

# ── Compteur de refreshs ──────────────────────────────────────────────────────
sla_export_refreshes = Counter(
    "sla_export_refreshes_total",
    "Nombre de fois que ml_data.json a été relu",
)
sla_export_errors = Counter(
    "sla_export_errors_total",
    "Nombre d'erreurs lors de la lecture de ml_data.json",
)

# ── Info build ────────────────────────────────────────────────────────────────
sla_info = Info(
    "sla_pipeline",
    "Métadonnées du pipeline ML SLA",
)


# ══════════════════════════════════════════════════════════════════════════════
# SEUILS D'ALERTE (utilisés dans les logs — les règles Grafana sont dans YAML)
# ══════════════════════════════════════════════════════════════════════════════

THRESHOLD_BREACH_CRITICAL = 8.0   # % → alerte rouge
THRESHOLD_BREACH_WARNING  = 5.0   # % → alerte amber
THRESHOLD_VOLUME_SPIKE    = 80    # tickets/jour → pic anormal


# ══════════════════════════════════════════════════════════════════════════════
# LECTURE ET PUSH DES MÉTRIQUES
# ══════════════════════════════════════════════════════════════════════════════

def push_metrics(json_path: Path) -> None:
    """
    Lit ml_data.json et met à jour toutes les jauges Prometheus.
    Appelée toutes les REFRESH_INTERVAL secondes.
    """
    data = json.loads(json_path.read_text(encoding="utf-8"))

    # ── Dataset global ─────────────────────────────────────────────────────────
    ds = data["dataset"]
    sla_breach_rate_pct.set(ds["breach_rate_pct"])
    sla_breach_count.set(ds["breach_count"])
    sla_total_incidents.set(ds["total_incidents"])
    sla_avg_daily_tickets.set(ds["avg_daily_tickets"])

    sla_info.info({
        "date_min":       ds["date_min"],
        "date_max":       ds["date_max"],
        "generated_at":   data.get("generated_at", "unknown"),
    })

    # ── Prophet ────────────────────────────────────────────────────────────────
    p = data["prophet"]
    sla_prophet_mae.set(p["mae"])
    sla_prophet_rmse.set(p["rmse"])
    sla_prophet_mape.set(p["mape"])

    # ── Random Forest ──────────────────────────────────────────────────────────
    sla_rf_auc.set(data["random_forest"]["auc_roc"])

    # ── Prévision J+7 ──────────────────────────────────────────────────────────
    for i, day in enumerate(data.get("future_7", []), start=1):
        labels = {
            "date":         day["date"],
            "day":          day["day"],
            "horizon_days": str(i),
        }
        sla_forecast_predicted.labels(**labels).set(day["predicted"])
        sla_forecast_lower.labels(**labels).set(day["lower"])
        sla_forecast_upper.labels(**labels).set(day["upper"])

        # Log si pic prévu
        if day["predicted"] > THRESHOLD_VOLUME_SPIKE:
            log.warning(
                "Pic volume prévu : %d tickets le %s (%s)",
                day["predicted"], day["date"], day["day"],
            )

    # ── CIs à risque ───────────────────────────────────────────────────────────
    for ci in data.get("ci_breach", []):
        name = ci["name"]
        rate = ci["rate"]
        sla_ci_breach_rate.labels(ci_name=name).set(rate)
        sla_ci_incident_count.labels(ci_name=name).set(ci["count"])

        # Log console selon niveau de risque
        if rate > THRESHOLD_BREACH_CRITICAL:
            log.error(
                "CRITIQUE  %-30s  %.1f%%  (%d incidents)",
                name, rate, ci["count"],
            )
        elif rate > THRESHOLD_BREACH_WARNING:
            log.warning(
                "AMBER     %-30s  %.1f%%  (%d incidents)",
                name, rate, ci["count"],
            )

    # ── Importance des variables ───────────────────────────────────────────────
    for feat in data.get("feature_imp", []):
        sla_feature_importance.labels(feature=feat["feature"]).set(feat["pct"])

    sla_export_refreshes.inc()
    log.info(
        "Métriques mises à jour — breach=%.2f%%  AUC=%.3f  J+1=%d tickets",
        ds["breach_rate_pct"],
        data["random_forest"]["auc_roc"],
        data["future_7"][0]["predicted"] if data.get("future_7") else 0,
    )


# ══════════════════════════════════════════════════════════════════════════════
# BOUCLE PRINCIPALE
# ══════════════════════════════════════════════════════════════════════════════

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Prometheus exporter — ML Pipeline SLA Servier"
    )
    parser.add_argument(
        "--json",
        default="./outputs/ml_data.json",
        help="Chemin vers ml_data.json (défaut: ./outputs/ml_data.json)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="Port HTTP Prometheus (défaut: 8000)",
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=300,
        help="Intervalle de refresh en secondes (défaut: 300 = 5 min)",
    )
    args = parser.parse_args()

    json_path = Path(args.json).resolve()
    if not json_path.exists():
        log.error("Fichier introuvable : %s", json_path)
        return

    # Démarrer le serveur HTTP Prometheus
    start_http_server(args.port, addr="0.0.0.0")
    log.info("Serveur Prometheus démarré sur http://localhost:%d/metrics", args.port)
    log.info("Lecture de : %s", json_path)
    log.info("Refresh toutes les %ds", args.interval)
    log.info("─" * 55)

    # Premier push immédiat
    try:
        push_metrics(json_path)
    except Exception as exc:
        sla_export_errors.inc()
        log.error("Erreur premier push : %s", exc)

    # Boucle de refresh
    while True:
        time.sleep(args.interval)
        try:
            push_metrics(json_path)
        except FileNotFoundError:
            sla_export_errors.inc()
            log.error("ml_data.json introuvable — pipeline ML pas encore lancé ?")
        except json.JSONDecodeError as exc:
            sla_export_errors.inc()
            log.error("JSON invalide : %s", exc)
        except Exception as exc:
            sla_export_errors.inc()
            log.error("Erreur inattendue : %s", exc)


if __name__ == "__main__":
    main()