# ── DOIT ÊTRE EN TOUT PREMIER AVANT TOUT IMPORT prometheus_client ──
import os
os.environ["PROMETHEUS_MULTIPROC_DIR"] = "/tmp/prometheus_multiproc"
os.makedirs("/tmp/prometheus_multiproc", exist_ok=True)
# ──────────────────────────────────────────────────────────────────

"""
backend/metrics_exporter.py
Exporte les métriques métier DXC Tunisia vers Prometheus.
Appelé automatiquement par le scheduler Django toutes les 5 minutes.

Source principale : HistoricalMetric
Fallback realtime : RealtimeMetric
Fallback horaire  : HourlyTrend

Calculs : moyennes PONDÉRÉES par volume de contacts (cohérence avec dashboard React)
"""

import logging
from prometheus_client import Gauge

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────
#  Définition des métriques Prometheus
# ─────────────────────────────────────────

# --- Vue Globale ---
dxc_sla_rate_global = Gauge("dxc_sla_rate_global", "Taux SLA global en %")
dxc_abandon_rate_global = Gauge("dxc_abandon_rate_global", "Taux abandon global en %")
dxc_response_rate_global = Gauge("dxc_response_rate_global", "Taux de réponse global en %")
dxc_contacts_offered_total = Gauge("dxc_contacts_offered_total", "Nombre total de contacts offerts")
dxc_avg_aht_seconds = Gauge("dxc_avg_aht_seconds", "Durée moyenne de traitement (AHT) en secondes")
dxc_avg_asa_seconds = Gauge("dxc_avg_asa_seconds", "Vitesse moyenne de réponse (ASA) en secondes")
dxc_callbacks_total = Gauge("dxc_callbacks_total", "Nombre total de demandes de rappel")
dxc_compliant_accounts = Gauge("dxc_compliant_accounts", "Nombre de comptes conformes au SLA")
dxc_total_accounts = Gauge("dxc_total_accounts", "Nombre total de comptes actifs")

# --- Par Compte ---
dxc_sla_rate_by_account = Gauge("dxc_sla_rate_by_account", "Taux SLA par compte en %", ["account"])
dxc_abandon_rate_by_account = Gauge("dxc_abandon_rate_by_account", "Taux abandon par compte en %", ["account"])
dxc_contacts_by_account = Gauge("dxc_contacts_by_account", "Contacts offerts par compte", ["account"])
dxc_account_sla_compliant = Gauge("dxc_account_sla_compliant", "1 si le compte respecte son objectif SLA, 0 sinon", ["account"])
dxc_account_target_ans_rate = Gauge("dxc_account_target_ans_rate", "Objectif SLA configuré par compte (0.0-1.0)", ["account"])

# --- Par File d'attente ---
dxc_sla_rate_by_queue = Gauge("dxc_sla_rate_by_queue", "Taux SLA par file en %", ["queue", "account"])
dxc_abandon_rate_by_queue = Gauge("dxc_abandon_rate_by_queue", "Taux abandon par file en %", ["queue", "account"])
dxc_contacts_by_queue = Gauge("dxc_contacts_by_queue", "Contacts offerts par file", ["queue", "account"])
dxc_queue_sla_breach = Gauge("dxc_queue_sla_breach", "1 si la file est en rupture SLA, 0 sinon", ["queue", "account"])

# --- Tendance Horaire ---
dxc_peak_hour_contacts = Gauge("dxc_peak_hour_contacts", "Nombre de contacts a l'heure de pointe")
dxc_worst_sla_hour = Gauge("dxc_worst_sla_hour", "Heure avec le pire SLA (0-23)")

# --- Realtime ---
dxc_realtime_in_queue = Gauge("dxc_realtime_in_queue", "Contacts actuellement en attente (toutes files)")
dxc_realtime_agents_available = Gauge("dxc_realtime_agents_available", "Agents disponibles (toutes files)")
dxc_realtime_agents_busy = Gauge("dxc_realtime_agents_busy", "Agents occupes (toutes files)")

# --- ETL ---
dxc_etl_last_run_timestamp = Gauge("dxc_etl_last_run_timestamp", "Timestamp Unix du dernier enregistrement HistoricalMetric")
dxc_total_records_db = Gauge("dxc_total_records_db", "Nombre total d'enregistrements HistoricalMetric")


# ─────────────────────────────────────────
#  Fonction principale
# ─────────────────────────────────────────

def refresh_metrics():
    try:
        from api.models import HistoricalMetric, HourlyTrend, RealtimeMetric
        _refresh_global(HistoricalMetric)
        _refresh_accounts(HistoricalMetric)
        _refresh_queues(HistoricalMetric)
        _refresh_hourly(HourlyTrend)
        _refresh_realtime(RealtimeMetric)
        _refresh_etl(HistoricalMetric)
        logger.info("[Metrics] Métriques Prometheus mises à jour avec succès.")
    except Exception as e:
        logger.error(f"[Metrics] Erreur lors du rafraîchissement : {e}", exc_info=True)


# ─────────────────────────────────────────
#  Fonctions internes
# ─────────────────────────────────────────

def _refresh_global(HistoricalMetric):
    """
    Vue Globale — moyennes PONDÉRÉES par volume de contacts.
    Cohérent avec le dashboard React (évite la distorsion des petits comptes).
    Ex: Nordic (50% abandon, 11 contacts) ne tire plus la moyenne vers le haut.
    """
    from django.db.models import Sum, Avg, Max

    agg = HistoricalMetric.objects.aggregate(
        total_offered=Sum("offered"),
        total_abandoned=Sum("abandoned"),
        total_answered=Sum("answered"),
        total_callbacks=Sum("callback_contacts"),
        # AHT/ASA : moyenne pondérée via somme × offered / total_offered
        # Approximation acceptable avec Avg pondéré manuellement ci-dessous
        avg_aht=Avg("avg_handle_time"),
        avg_asa=Avg("avg_answer_time"),
    )

    offered  = agg["total_offered"]  or 1  # évite division par zéro
    abandoned = agg["total_abandoned"] or 0
    answered  = agg["total_answered"]  or 0

    # ── Moyennes pondérées par volume ──────────────────────────────
    sla_rate     = round((answered  / offered) * 100, 2)
    abandon_rate = round((abandoned / offered) * 100, 2)
    answer_rate  = round((answered  / offered) * 100, 2)

    # ── Conformité SLA par compte ──────────────────────────────────
    accounts = (
        HistoricalMetric.objects
        .filter(target_ans_rate__gt=0)
        .values("account")
        .annotate(avg_sla=Avg("sla_rate"), target=Max("target_ans_rate"))
    )
    total_accounts = accounts.count()
    compliant = sum(1 for a in accounts if (a["avg_sla"] or 0) >= (a["target"] or 0.8))

    dxc_sla_rate_global.set(sla_rate)
    dxc_abandon_rate_global.set(abandon_rate)
    dxc_response_rate_global.set(answer_rate)
    dxc_contacts_offered_total.set(int(offered))
    dxc_avg_aht_seconds.set(round(agg["avg_aht"] or 0, 2))
    dxc_avg_asa_seconds.set(round(agg["avg_asa"] or 0, 2))
    dxc_callbacks_total.set(int(agg["total_callbacks"] or 0))
    dxc_compliant_accounts.set(compliant)
    dxc_total_accounts.set(total_accounts)

    logger.info(
        f"[Metrics] _refresh_global OK — SLA={sla_rate}% | "
        f"Abandon={abandon_rate}% | Offered={int(offered)}"
    )


def _refresh_accounts(HistoricalMetric):
    """
    KPIs par compte — moyennes pondérées par volume de contacts.
    sla_rate  = answered / offered
    abd_rate  = abandoned / offered
    """
    from django.db.models import Sum, Avg, Max

    accounts = (
        HistoricalMetric.objects
        .values("account")
        .annotate(
            total_offered=Sum("offered"),
            total_abandoned=Sum("abandoned"),
            total_answered=Sum("answered"),
            avg_aht=Avg("avg_handle_time"),
            avg_asa=Avg("avg_answer_time"),
            target=Max("target_ans_rate"),
        )
    )

    for a in accounts:
        name    = a["account"] or "unknown"
        offered  = a["total_offered"]  or 1
        abandoned = a["total_abandoned"] or 0
        answered  = a["total_answered"]  or 0
        target   = a["target"] or 0.8

        sla = round((answered  / offered) * 100, 2)
        abd = round((abandoned / offered) * 100, 2)

        dxc_sla_rate_by_account.labels(account=name).set(sla)
        dxc_abandon_rate_by_account.labels(account=name).set(abd)
        dxc_contacts_by_account.labels(account=name).set(int(offered))
        dxc_account_sla_compliant.labels(account=name).set(1 if sla / 100 >= target else 0)
        dxc_account_target_ans_rate.labels(account=name).set(target)

    # AHT / ASA globaux (moyenne simple — acceptable car granularité secondaire)
    agg = HistoricalMetric.objects.aggregate(
        aht=Avg("avg_handle_time"),
        asa=Avg("avg_answer_time"),
    )
    dxc_avg_aht_seconds.set(round(agg["aht"] or 0, 2))
    dxc_avg_asa_seconds.set(round(agg["asa"] or 0, 2))

    logger.info("[Metrics] _refresh_accounts OK")


def _refresh_queues(HistoricalMetric):
    """KPIs par file d'attente — moyennes pondérées par volume."""
    from django.db.models import Sum, Avg, Max

    field_names = [f.name for f in HistoricalMetric._meta.get_fields()]
    has_queue = "queue" in field_names

    if has_queue:
        queues = (
            HistoricalMetric.objects
            .values("queue", "account")
            .annotate(
                total_offered=Sum("offered"),
                total_abandoned=Sum("abandoned"),
                total_answered=Sum("answered"),
                total_callbacks=Sum("callback_contacts"),
                target=Max("target_ans_rate"),
            )
        )
        total_callbacks = 0
        for q in queues:
            q_name   = q["queue"]   or "unknown"
            a_name   = q["account"] or "unknown"
            offered   = q["total_offered"]  or 1
            abandoned = q["total_abandoned"] or 0
            answered  = q["total_answered"]  or 0
            target    = (q["target"] or 0.8) * 100
            total_callbacks += int(q["total_callbacks"] or 0)

            sla_rate = round((answered  / offered) * 100, 2)
            abd_rate = round((abandoned / offered) * 100, 2)

            dxc_sla_rate_by_queue.labels(queue=q_name, account=a_name).set(sla_rate)
            dxc_abandon_rate_by_queue.labels(queue=q_name, account=a_name).set(abd_rate)
            dxc_contacts_by_queue.labels(queue=q_name, account=a_name).set(int(offered))
            dxc_queue_sla_breach.labels(queue=q_name, account=a_name).set(
                1 if sla_rate < target else 0
            )
        dxc_callbacks_total.set(total_callbacks)
        logger.info("[Metrics] _refresh_queues OK (champ queue détecté)")

    else:
        # Fallback : agrégation par compte
        accounts = (
            HistoricalMetric.objects
            .values("account")
            .annotate(
                total_offered=Sum("offered"),
                total_abandoned=Sum("abandoned"),
                total_answered=Sum("answered"),
                total_callbacks=Sum("callback_contacts"),
                target=Max("target_ans_rate"),
            )
        )
        total_callbacks = 0
        for a in accounts:
            a_name   = a["account"] or "unknown"
            offered   = a["total_offered"]  or 1
            abandoned = a["total_abandoned"] or 0
            answered  = a["total_answered"]  or 0
            target    = (a["target"] or 0.8) * 100
            total_callbacks += int(a["total_callbacks"] or 0)

            sla_rate = round((answered  / offered) * 100, 2)
            abd_rate = round((abandoned / offered) * 100, 2)

            dxc_sla_rate_by_queue.labels(queue=a_name, account=a_name).set(sla_rate)
            dxc_abandon_rate_by_queue.labels(queue=a_name, account=a_name).set(abd_rate)
            dxc_contacts_by_queue.labels(queue=a_name, account=a_name).set(int(offered))
            dxc_queue_sla_breach.labels(queue=a_name, account=a_name).set(
                1 if sla_rate < target else 0
            )
        dxc_callbacks_total.set(total_callbacks)
        logger.info("[Metrics] _refresh_queues OK (fallback compte -> queue)")


def _refresh_hourly(HourlyTrend):
    """Heure de pointe et pire heure SLA depuis HourlyTrend."""
    from django.db.models import Sum, Avg

    hourly = (
        HourlyTrend.objects
        .values("hour")
        .annotate(total_offered=Sum("offered"), avg_sla=Avg("sla_rate"))
        .order_by("-total_offered")
    )

    if not hourly:
        logger.warning("[Metrics] _refresh_hourly : aucune donnée HourlyTrend.")
        return

    dxc_peak_hour_contacts.set(int(hourly[0]["total_offered"] or 0))

    worst = min(hourly, key=lambda x: x["avg_sla"] or 1.0)
    try:
        dxc_worst_sla_hour.set(int(str(worst["hour"]).split(":")[0]))
    except (ValueError, IndexError, TypeError):
        logger.warning(f"[Metrics] Impossible de parser l'heure : {worst.get('hour')}")

    logger.info("[Metrics] _refresh_hourly OK")


def _refresh_realtime(RealtimeMetric):
    """Métriques temps réel depuis les dernières entrées RealtimeMetric."""
    from django.db.models import Sum

    latest = (
        RealtimeMetric.objects
        .order_by("-captured_at")
        .values("captured_at")
        .first()
    )
    if not latest:
        logger.warning("[Metrics] _refresh_realtime : aucune donnée RealtimeMetric.")
        return

    agg = RealtimeMetric.objects.filter(
        captured_at=latest["captured_at"]
    ).aggregate(
        in_queue=Sum("in_queue"),
        available=Sum("agents_available"),
        busy=Sum("agents_busy"),
    )

    dxc_realtime_in_queue.set(int(agg["in_queue"] or 0))
    dxc_realtime_agents_available.set(int(agg["available"] or 0))
    dxc_realtime_agents_busy.set(int(agg["busy"] or 0))

    logger.info("[Metrics] _refresh_realtime OK")


def _refresh_etl(HistoricalMetric):
    """Timestamp du dernier enregistrement et total records."""
    from django.db.models import Max
    from api.models import HourlyTrend

    count = HistoricalMetric.objects.count()
    if count > 0:
        field_names = [f.name for f in HistoricalMetric._meta.get_fields()]
        date_field = next(
            (f for f in ("created_at", "updated_at", "start_date", "date") if f in field_names),
            None
        )
        if date_field:
            latest = HistoricalMetric.objects.aggregate(t=Max(date_field))["t"]
            if latest and hasattr(latest, "timestamp"):
                dxc_etl_last_run_timestamp.set(latest.timestamp())
        dxc_total_records_db.set(count)
    else:
        # Fallback HourlyTrend
        ht_count = HourlyTrend.objects.count()
        dxc_total_records_db.set(ht_count)
        latest_ht = HourlyTrend.objects.order_by("-date").values("date").first()
        if latest_ht and latest_ht.get("date") and hasattr(latest_ht["date"], "timestamp"):
            dxc_etl_last_run_timestamp.set(latest_ht["date"].timestamp())
        logger.info("[Metrics] _refresh_etl: fallback HourlyTrend utilisé.")

    logger.info("[Metrics] _refresh_etl OK")