import os
import sys

try:
    from django.apps import AppConfig
except ImportError:  # pragma: no cover
    AppConfig = type("AppConfig", (), {})


class ApiConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "api"

    def ready(self):
        if any(cmd in sys.argv for cmd in ["migrate", "makemigrations", "collectstatic", "shell"]):
            return
        if os.environ.get("DJANGO_SCHEDULER") == "off":
            return
        if os.environ.get("GUNICORN_WORKER") == "true":
            return
        from api import scheduler
        scheduler.start()

        # ── Pré-chauffer le cache forecast en background ──────────────
        from threading import Thread
        Thread(target=self._warm_forecast_cache, daemon=True).start()

    def _warm_forecast_cache(self):
        import time
        import logging
        import requests

        time.sleep(15)  # attendre que Gunicorn soit complètement prêt
        logger = logging.getLogger("api")

        queues = [
            "Servier French",
            "Servier English",
            "Servier French Password",
            "Servier Spanish",
        ]
        for q in queues:
            try:
                requests.get(
                    "http://localhost:8000/api/forecast/",
                    params={"queue": q},
                    timeout=300,
                )
                logger.info(f"Cache warmup OK: '{q}'")
            except Exception as e:
                logger.warning(f"Cache warmup failed for '{q}': {e}")