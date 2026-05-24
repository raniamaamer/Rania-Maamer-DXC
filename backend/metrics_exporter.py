"""
backend/metrics_exporter.py
Exporte les métriques métier DXC Tunisia vers Prometheus.
Appelé automatiquement par le scheduler Django toutes les 5 minutes.
"""

import logging
from prometheus_client import Gauge

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────
#  Définition des métriques Prometheus
# ─────────────────────────────────────────

# --- Vue Globale (DailySnapshot) ---
dxc_sla_rate_global = Gauge(
    'dxc_sla_rate_global',
    'Taux SLA global en %'
)
dxc_abandon_rate_global = Gauge(
    'dxc_abandon_rate_global',
    'Taux abandon global en %'
)
dxc_response_rate_global = Gauge(
    'dxc_response_rate_global',
    'Taux de réponse global en %'
)
dxc_contacts_offered_total = Gauge(
    'dxc_contacts_offered_total',
    'Nombre total de contacts offerts'
)
dxc_avg_aht_seconds = Gauge(
    'dxc_avg_aht_seconds',
    'Durée moyenne de traitement (AHT) en secondes'
)
dxc_avg_asa_seconds = Gauge(
    'dxc_avg_asa_seconds',
    'Vitesse moyenne de réponse (ASA) en secondes'
)
dxc_callbacks_total = Gauge(
    'dxc_callbacks_total',
    'Nombre total de demandes de rappel'
)
dxc_compliant_accounts = Gauge(
    'dxc_compliant_accounts',
    'Nombre de comptes conformes au SLA'
)
dxc_total_accounts = Gauge(
    'dxc_total_accounts',
    'Nombre total de comptes actifs'
)

# --- Par Compte (AccountSummary) ---
dxc_sla_rate_by_account = Gauge(
    'dxc_sla_rate_by_account',
    'Taux SLA par compte en %',
    ['account']
)
dxc_abandon_rate_by_account = Gauge(
    'dxc_abandon_rate_by_account',
    'Taux abandon par compte en %',
    ['account']
)
dxc_contacts_by_account = Gauge(
    'dxc_contacts_by_account',
    'Contacts offerts par compte',
    ['account']
)
dxc_account_sla_compliant = Gauge(
    'dxc_account_sla_compliant',
    '1 si le compte respecte son objectif SLA, 0 sinon',
    ['account']
)
dxc_account_target_ans_rate = Gauge(
    'dxc_account_target_ans_rate',
    'Objectif SLA configuré par compte (0.0-1.0)',
    ['account']
)

# --- Par File d'attente (QueueMetric) ---
dxc_sla_rate_by_queue = Gauge(
    'dxc_sla_rate_by_queue',
    'Taux SLA par file en %',
    ['queue', 'account']
)
dxc_abandon_rate_by_queue = Gauge(
    'dxc_abandon_rate_by_queue',
    'Taux abandon par file en %',
    ['queue', 'account']
)
dxc_contacts_by_queue = Gauge(
    'dxc_contacts_by_queue',
    'Contacts offerts par file',
    ['queue', 'account']
)
dxc_queue_sla_breach = Gauge(
    'dxc_queue_sla_breach',
    '1 si la file est en rupture SLA, 0 sinon',
    ['queue', 'account']
)

# --- Tendance Horaire (HourlyTrend) ---
dxc_peak_hour_contacts = Gauge(
    'dxc_peak_hour_contacts',
    'Nombre de contacts à l\'heure de pointe'
)
dxc_worst_sla_hour = Gauge(
    'dxc_worst_sla_hour',
    'Heure avec le pire SLA (0-23)'
)

# --- Realtime (RealtimeMetric) ---
dxc_realtime_in_queue = Gauge(
    'dxc_realtime_in_queue',
    'Contacts actuellement en attente (toutes files)',
)
dxc_realtime_agents_available = Gauge(
    'dxc_realtime_agents_available',
    'Agents disponibles (toutes files)',
)
dxc_realtime_agents_busy = Gauge(
    'dxc_realtime_agents_busy',
    'Agents occupés (toutes files)',
)

# --- ETL ---
dxc_etl_last_run_timestamp = Gauge(
    'dxc_etl_last_run_timestamp',
    'Timestamp Unix du dernier enregistrement QueueMetric'
)
dxc_total_records_db = Gauge(
    'dxc_total_records_db',
    'Nombre total d\'enregistrements QueueMetric'
)


# ─────────────────────────────────────────
#  Fonction principale
# ─────────────────────────────────────────

def refresh_metrics():
    """
    Calcule et met à jour toutes les métriques Prometheus.
    Appelé depuis scheduler.py toutes les 5 minutes.
    """
    try:
        from api.models import (
            QueueMetric, AccountSummary, HourlyTrend,
            DailySnapshot, RealtimeMetric
        )
        _refresh_global(DailySnapshot)
        _refresh_accounts(AccountSummary)
        _refresh_queues(QueueMetric)
        _refresh_hourly(HourlyTrend)
        _refresh_realtime(RealtimeMetric)
        _refresh_etl(QueueMetric)
        logger.info("[Metrics] Métriques Prometheus mises à jour avec succès.")
    except Exception as e:
        logger.error(f"[Metrics] Erreur lors du rafraîchissement : {e}", exc_info=True)


# ─────────────────────────────────────────
#  Fonctions internes
# ─────────────────────────────────────────

def _refresh_global(DailySnapshot):
    """Vue Globale depuis le dernier DailySnapshot."""
    snap = DailySnapshot.objects.order_by('-date').first()
    if not snap:
        return

    dxc_sla_rate_global.set(round(snap.global_sla_rate * 100, 2))
    dxc_abandon_rate_global.set(round(snap.global_abandon_rate * 100, 2))
    dxc_response_rate_global.set(round(snap.global_answer_rate * 100, 2))
    dxc_contacts_offered_total.set(snap.total_offered)
    dxc_compliant_accounts.set(snap.compliant_accounts)
    dxc_total_accounts.set(snap.total_accounts)


def _refresh_accounts(AccountSummary):
    """KPIs par compte depuis AccountSummary."""
    for acc in AccountSummary.objects.all():
        name = acc.account

        dxc_sla_rate_by_account.labels(account=name).set(
            round(acc.sla_rate * 100, 2)
        )
        dxc_abandon_rate_by_account.labels(account=name).set(
            round(acc.abandon_rate * 100, 2)
        )
        dxc_contacts_by_account.labels(account=name).set(acc.offered)
        dxc_account_sla_compliant.labels(account=name).set(
            1 if acc.sla_compliant else 0
        )
        dxc_account_target_ans_rate.labels(account=name).set(
            acc.target_ans_rate
        )

    # AHT / ASA globaux depuis AccountSummary (moyenne pondérée)
    from django.db.models import Avg
    agg = AccountSummary.objects.aggregate(
        aht=Avg('avg_handle_time'),
        asa=Avg('avg_answer_time')
    )
    dxc_avg_aht_seconds.set(round(agg['aht'] or 0, 2))
    dxc_avg_asa_seconds.set(round(agg['asa'] or 0, 2))


def _refresh_queues(QueueMetric):
    """KPIs par file depuis QueueMetric (agrégés)."""
    from django.db.models import Sum, Avg

    queues = (
        QueueMetric.objects
        .values('queue', 'account')
        .annotate(
            total_offered=Sum('offered'),
            total_abandoned=Sum('abandoned'),
            total_ans_in_sla=Sum('ans_in_sla'),
            total_callbacks=Sum('callback_contacts'),
            avg_sla=Avg('sla_rate'),
            avg_abd=Avg('abandon_rate'),
            target=Avg('target_ans_rate'),
        )
    )

    total_callbacks = 0
    for q in queues:
        q_name = q['queue']
        a_name = q['account'] or 'unknown'
        offered = q['total_offered'] or 0
        sla_rate = round((q['avg_sla'] or 0) * 100, 2)
        abd_rate = round((q['avg_abd'] or 0) * 100, 2)
        target = (q['target'] or 0.8) * 100
        total_callbacks += q['total_callbacks'] or 0

        dxc_sla_rate_by_queue.labels(queue=q_name, account=a_name).set(sla_rate)
        dxc_abandon_rate_by_queue.labels(queue=q_name, account=a_name).set(abd_rate)
        dxc_contacts_by_queue.labels(queue=q_name, account=a_name).set(offered)
        dxc_queue_sla_breach.labels(queue=q_name, account=a_name).set(
            1 if sla_rate < target else 0
        )

    dxc_callbacks_total.set(total_callbacks)


def _refresh_hourly(HourlyTrend):
    """Heure de pointe et pire heure SLA depuis HourlyTrend."""
    from django.db.models import Sum, Avg

    hourly = (
        HourlyTrend.objects
        .values('hour')
        .annotate(
            total_offered=Sum('offered'),
            avg_sla=Avg('sla_rate')
        )
        .order_by('-total_offered')
    )

    if not hourly:
        return

    # Heure de pointe (plus de contacts)
    peak = hourly[0]
    dxc_peak_hour_contacts.set(peak['total_offered'] or 0)

    # Pire heure SLA
    worst = min(hourly, key=lambda x: x['avg_sla'] or 1)
    try:
        hour_int = int(str(worst['hour']).split(':')[0])
        dxc_worst_sla_hour.set(hour_int)
    except (ValueError, IndexError):
        pass


def _refresh_realtime(RealtimeMetric):
    """Métriques temps réel depuis les dernières entrées RealtimeMetric."""
    from django.db.models import Sum

    latest = (
        RealtimeMetric.objects
        .order_by('-captured_at')
        .values('captured_at')
        .first()
    )
    if not latest:
        return

    agg = RealtimeMetric.objects.filter(
        captured_at=latest['captured_at']
    ).aggregate(
        in_queue=Sum('in_queue'),
        available=Sum('agents_available'),
        busy=Sum('agents_busy'),
    )

    dxc_realtime_in_queue.set(agg['in_queue'] or 0)
    dxc_realtime_agents_available.set(agg['available'] or 0)
    dxc_realtime_agents_busy.set(agg['busy'] or 0)


def _refresh_etl(QueueMetric):
    """Timestamp dernier enregistrement et total records."""
    from django.db.models import Max

    latest = QueueMetric.objects.aggregate(t=Max('created_at'))['t']
    if latest:
        dxc_etl_last_run_timestamp.set(latest.timestamp())

    dxc_total_records_db.set(QueueMetric.objects.count())