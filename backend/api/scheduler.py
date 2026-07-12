import logging
import os
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from django.core.management import call_command
from django_apscheduler.jobstores import DjangoJobStore

logger = logging.getLogger(__name__)
scheduler = None


def archive_realtime_job():
    logger.info("[SCHEDULER] Déclenchement archive_realtime (23:59)")
    try:
        call_command("archive_realtime")
        logger.info("[SCHEDULER] archive_realtime terminé avec succès")
    except Exception as e:
        logger.error(f"[SCHEDULER] Erreur archive_realtime : {e}", exc_info=True)


def refresh_metrics_job():
    logger.info("[SCHEDULER] Rafraîchissement métriques Prometheus")
    try:
        from metrics_exporter import refresh_metrics
        refresh_metrics()
        logger.info("[SCHEDULER] Métriques Prometheus mises à jour avec succès")
    except Exception as e:
        logger.error(f"[SCHEDULER] Erreur refresh_metrics : {e}", exc_info=True)


def start():
    global scheduler

    if os.environ.get("GUNICORN_WORKER") == "true":
        logger.info("[SCHEDULER] Worker gunicorn détecté — scheduler ignoré")
        return

    if scheduler and scheduler.running:
        logger.info("[SCHEDULER] Scheduler déjà actif — ignoré")
        return

    import threading

    def _delayed_start():
        import time
        time.sleep(5)  # laisse Django/Gunicorn stabiliser la connexion DB
        _start_scheduler()

    threading.Thread(target=_delayed_start, daemon=True).start()


def _start_scheduler():
    global scheduler

    scheduler = BackgroundScheduler()
    scheduler.add_jobstore(DjangoJobStore(), "default")

    scheduler.add_job(
        archive_realtime_job,
        trigger=CronTrigger(hour=23, minute=59, timezone="Europe/Paris"),
        id="archive_realtime_daily",
        name="Archive Realtime → Historical (23:59)",
        jobstore="default",
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=300,
        coalesce=True,
    )

    scheduler.add_job(
        refresh_metrics_job,
        trigger=IntervalTrigger(minutes=5),
        id="refresh_prometheus_metrics",
        name="Rafraîchissement métriques Prometheus (5 min)",
        jobstore="default",
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=60,
        coalesce=True,
    )

    scheduler.start()
    logger.info(
        "[SCHEDULER] APScheduler démarré — "
        "archive_realtime @ 23:59 | métriques Prometheus toutes les 5 min"
    )

def stop():
    global scheduler
    if scheduler and scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("[SCHEDULER] APScheduler arrêté")