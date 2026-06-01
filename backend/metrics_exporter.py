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
Formule SLA : ans_in_sla / max(offered - abd_in_sla, 1)  ← identique à _recalc_sla_for_account()
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
#  Helpers
# ─────────────────────────────────────────

def _sla_rate(ans_in_sla, offered, abd_in_sla):
    """
    Formule SLA identique à _recalc_sla_for_account() dans le dashboard React.
    SLA = ans_in_sla / max(offered - abd_in_sla, 1)
    Retourne un float entre 0 et 100.
    """
    denominator = max((offered or 0) - (abd_in_sla or 0), 1)
    return round(((ans_in_sla or 0) / denominator) * 100, 2)


def _abandon_rate(abandoned, offered):
    """Taux d'abandon = abandoned / max(offered, 1) * 100."""
    return round(((abandoned or 0) / max(offered or 1, 1)) * 100, 2)


def _answer_rate(answered, offered):
    """Taux de réponse = answered / max(offered, 1) * 100."""
    return round(((answered or 0) / max(offered or 1, 1)) * 100, 2)


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
    from django.db.models import Sum, Max

    accounts = (
        HistoricalMetric.objects
        .values("account")
        .annotate(
            total_offered=Sum("offered"),
            total_abandoned=Sum("abandoned"),
            total_answered=Sum("answered"),
            total_ans_in_sla=Sum("ans_in_sla"),
            total_abd_in_sla=Sum("abd_in_sla"),
            total_ans_out_sla=Sum("ans_out_sla"),
            total_abd_in_60=Sum("abd_in_60"),
            sum_answer_time=Sum("total_answer_time"),
            sum_handle_time=Sum("handle_time"),
            total_callbacks=Sum("callback_contacts"),
        )
    )

    from api.views import _recalc_sla_for_account, _abandon_rate, _answer_rate

    total_offered   = 0
    total_abandoned = 0
    total_answered  = 0
    total_callbacks = 0
    sum_handle      = 0
    sum_answer      = 0

    weighted_sla    = 0.0  # somme(sla * offered)
    weighted_abd    = 0.0  # somme(abd * offered)

    for a in accounts:
        off  = int(a["total_offered"]  or 0)
        abd  = int(a["total_abandoned"] or 0)
        ans  = int(a["total_answered"]  or 0)
        asa  = round((a["sum_answer_time"] or 0) / max(ans, 1), 1)

        sla = _recalc_sla_for_account(
            a["account"],
            a["total_ans_in_sla"],
            a["total_abd_in_sla"],
            a["total_ans_out_sla"],
            off, ans,
            abd_in_60=float(a["total_abd_in_60"] or 0),
            avg_answer_time=asa,
        )
        abd_rate = _abandon_rate(abd, off, acc_name=a["account"])

        weighted_sla    += sla      * off
        weighted_abd    += abd_rate * off
        total_offered   += off
        total_abandoned += abd
        total_answered  += ans
        total_callbacks += int(a["total_callbacks"] or 0)
        sum_handle      += float(a["sum_handle_time"]  or 0)
        sum_answer      += float(a["sum_answer_time"]  or 0)

    sla_rate     = round((weighted_sla / max(total_offered, 1)) * 100, 2)
    abandon_rate = round((weighted_abd / max(total_offered, 1)) * 100, 2)
    answer_rate  = _answer_rate(total_answered, total_offered) * 100
    aht          = round(sum_handle / max(total_answered, 1), 2)
    asa          = round(sum_answer / max(total_answered, 1), 2)

    # Conformité par compte
    from django.db.models import Max as DMax
    acc_targets = (
        HistoricalMetric.objects
        .filter(target_ans_rate__gt=0)
        .values("account")
        .annotate(
            total_offered=Sum("offered"),
            total_ans_in_sla=Sum("ans_in_sla"),
            total_abd_in_sla=Sum("abd_in_sla"),
            total_ans_out_sla=Sum("ans_out_sla"),
            total_abd_in_60=Sum("abd_in_60"),
            total_answered=Sum("answered"),
            sum_answer_time=Sum("total_answer_time"),
            target=DMax("target_ans_rate"),
        )
    )
    compliant = 0
    for a in acc_targets:
        ans  = int(a["total_answered"] or 0)
        asa_a = round((a["sum_answer_time"] or 0) / max(ans, 1), 1)
        sla = _recalc_sla_for_account(
            a["account"],
            a["total_ans_in_sla"], a["total_abd_in_sla"],
            a["total_ans_out_sla"], a["total_offered"], ans,
            abd_in_60=float(a["total_abd_in_60"] or 0),
            avg_answer_time=asa_a,
        )
        if sla >= (a["target"] or 0.8):
            compliant += 1
    total_accounts = acc_targets.count()

    dxc_sla_rate_global.set(sla_rate)
    dxc_abandon_rate_global.set(abandon_rate)
    dxc_response_rate_global.set(round(answer_rate, 2))
    dxc_contacts_offered_total.set(total_offered)
    dxc_avg_aht_seconds.set(aht)
    dxc_avg_asa_seconds.set(asa)
    dxc_callbacks_total.set(total_callbacks)
    dxc_compliant_accounts.set(compliant)
    dxc_total_accounts.set(total_accounts)

    logger.info(
        f"[Metrics] _refresh_global OK — SLA={sla_rate}% | "
        f"Abandon={abandon_rate}% | Offered={total_offered}"
    )


def _refresh_accounts(HistoricalMetric):
    """
    KPIs par compte — formule SLA pondérée identique au dashboard React.
    ⚠ Ne jamais utiliser Avg('sla_rate').
    """
    from django.db.models import Sum, Max

    accounts = (
        HistoricalMetric.objects
        .values("account")
        .annotate(
            total_offered=Sum("offered"),
            total_abandoned=Sum("abandoned"),
            total_answered=Sum("answered"),
            total_ans_in_sla=Sum("ans_in_sla"),
            total_abd_in_sla=Sum("abd_in_sla"),
            sum_handle_time=Sum("handle_time"),
            sum_answer_time=Sum("total_answer_time"),
            target=Max("target_ans_rate"),
        )
    )

    for a in accounts:
        name     = a["account"]       or "unknown"
        offered  = a["total_offered"] or 0
        abandoned = a["total_abandoned"] or 0
        answered  = a["total_answered"]  or 0
        ans_in   = a["total_ans_in_sla"] or 0
        abd_in   = a["total_abd_in_sla"] or 0
        target   = a["target"] or 0.8

        sla = _sla_rate(ans_in, offered, abd_in)
        abd = _abandon_rate(abandoned, offered)

        # AHT / ASA pondérés par answered
        aht = round((a["sum_handle_time"] or 0) / max(answered, 1), 2)
        asa = round((a["sum_answer_time"] or 0) / max(answered, 1), 2)

        dxc_sla_rate_by_account.labels(account=name).set(sla)
        dxc_abandon_rate_by_account.labels(account=name).set(abd)
        dxc_contacts_by_account.labels(account=name).set(int(offered))
        dxc_account_sla_compliant.labels(account=name).set(1 if sla / 100 >= target else 0)
        dxc_account_target_ans_rate.labels(account=name).set(target)

    # ── AHT / ASA globaux pondérés ────────────────────────────────
    agg = HistoricalMetric.objects.aggregate(
        total_answered=Sum("answered"),
        sum_handle_time=Sum("handle_time"),
        sum_answer_time=Sum("total_answer_time"),
    )
    answered_total = agg["total_answered"] or 1
    dxc_avg_aht_seconds.set(round((agg["sum_handle_time"] or 0) / answered_total, 2))
    dxc_avg_asa_seconds.set(round((agg["sum_answer_time"] or 0) / answered_total, 2))

    logger.info("[Metrics] _refresh_accounts OK")


def _refresh_queues(HistoricalMetric):
    """KPIs par file d'attente — formule SLA pondérée identique au dashboard React."""
    from django.db.models import Sum, Max

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
                total_ans_in_sla=Sum("ans_in_sla"),
                total_abd_in_sla=Sum("abd_in_sla"),
                target=Max("target_ans_rate"),
            )
        )
        total_callbacks = 0
        for q in queues:
            q_name   = q["queue"]   or "unknown"
            a_name   = q["account"] or "unknown"
            offered   = q["total_offered"]    or 0
            abandoned = q["total_abandoned"]  or 0
            ans_in    = q["total_ans_in_sla"] or 0
            abd_in    = q["total_abd_in_sla"] or 0
            target    = (q["target"] or 0.8) * 100
            total_callbacks += int(q["total_callbacks"] or 0)

            sla_rate = _sla_rate(ans_in, offered, abd_in)
            abd_rate = _abandon_rate(abandoned, offered)

            dxc_sla_rate_by_queue.labels(queue=q_name, account=a_name).set(sla_rate)
            dxc_abandon_rate_by_queue.labels(queue=q_name, account=a_name).set(abd_rate)
            dxc_contacts_by_queue.labels(queue=q_name, account=a_name).set(int(offered))
            dxc_queue_sla_breach.labels(queue=q_name, account=a_name).set(
                1 if sla_rate < target else 0
            )
        dxc_callbacks_total.set(total_callbacks)
        logger.info("[Metrics] _refresh_queues OK (champ queue détecté)")

    else:
        # Fallback : agrégation par compte utilisée comme queue
        accounts = (
            HistoricalMetric.objects
            .values("account")
            .annotate(
                total_offered=Sum("offered"),
                total_abandoned=Sum("abandoned"),
                total_answered=Sum("answered"),
                total_callbacks=Sum("callback_contacts"),
                total_ans_in_sla=Sum("ans_in_sla"),
                total_abd_in_sla=Sum("abd_in_sla"),
                target=Max("target_ans_rate"),
            )
        )
        total_callbacks = 0
        for a in accounts:
            a_name   = a["account"] or "unknown"
            offered   = a["total_offered"]    or 0
            abandoned = a["total_abandoned"]  or 0
            ans_in    = a["total_ans_in_sla"] or 0
            abd_in    = a["total_abd_in_sla"] or 0
            target    = (a["target"] or 0.8) * 100
            total_callbacks += int(a["total_callbacks"] or 0)

            sla_rate = _sla_rate(ans_in, offered, abd_in)
            abd_rate = _abandon_rate(abandoned, offered)

            dxc_sla_rate_by_queue.labels(queue=a_name, account=a_name).set(sla_rate)
            dxc_abandon_rate_by_queue.labels(queue=a_name, account=a_name).set(abd_rate)
            dxc_contacts_by_queue.labels(queue=a_name, account=a_name).set(int(offered))
            dxc_queue_sla_breach.labels(queue=a_name, account=a_name).set(
                1 if sla_rate < target else 0
            )
        dxc_callbacks_total.set(total_callbacks)
        logger.info("[Metrics] _refresh_queues OK (fallback compte -> queue)")


def _refresh_hourly(HourlyTrend):
    """
    Heure de pointe et pire heure SLA depuis HourlyTrend.
    SLA horaire recalculé depuis les colonnes brutes si disponibles,
    sinon fallback sur sla_rate stocké.
    """
    from django.db.models import Sum, Avg

    field_names = [f.name for f in HourlyTrend._meta.get_fields()]
    has_raw = "ans_in_sla" in field_names and "abd_in_sla" in field_names

    if has_raw:
        hourly = (
            HourlyTrend.objects
            .values("hour")
            .annotate(
                total_offered=Sum("offered"),
                total_ans_in_sla=Sum("ans_in_sla"),
                total_abd_in_sla=Sum("abd_in_sla"),
            )
            .order_by("-total_offered")
        )
        # Calcul SLA pondéré par heure
        hourly_list = list(hourly)
        for row in hourly_list:
            row["_sla"] = _sla_rate(
                row["total_ans_in_sla"],
                row["total_offered"],
                row["total_abd_in_sla"],
            )
    else:
        # Fallback : sla_rate stocké (moins précis mais acceptable pour HourlyTrend)
        hourly = (
            HourlyTrend.objects
            .values("hour")
            .annotate(total_offered=Sum("offered"), avg_sla=Avg("sla_rate"))
            .order_by("-total_offered")
        )
        hourly_list = [
            {**row, "_sla": (row.get("avg_sla") or 0) * 100}
            for row in hourly
        ]

    if not hourly_list:
        logger.warning("[Metrics] _refresh_hourly : aucune donnée HourlyTrend.")
        return

    dxc_peak_hour_contacts.set(int(hourly_list[0]["total_offered"] or 0))

    worst = min(hourly_list, key=lambda x: x["_sla"])
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