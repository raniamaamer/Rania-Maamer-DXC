import logging
import os
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
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

def start():
    global scheduler

    # Gunicorn fork : chaque worker hérite du process parent.
    # On ne démarre le scheduler que dans le process master (pid == own pid)
    # en utilisant la variable d'environnement injectée par gunicorn.
    if os.environ.get("GUNICORN_WORKER") == "true":
        logger.info("[SCHEDULER] Worker gunicorn détecté — scheduler ignoré")
        return

    if scheduler and scheduler.running:
        logger.info("[SCHEDULER] Scheduler déjà actif — ignoré")
        return

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
    scheduler.start()
    logger.info("[SCHEDULER] APScheduler démarré — archive_realtime planifiée à 23:59")

def stop():
    global scheduler
    if scheduler and scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("[SCHEDULER] APScheduler arrêté")