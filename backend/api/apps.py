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
        from django.test.client import RequestFactory  
        from api.views import ForecastView              

        time.sleep(8)
        logger = logging.getLogger("api")
        try:
            factory = RequestFactory()
            view = ForecastView.as_view()
            queues = [
                "Servier French",
                "Servier English",
                "Servier French Password",
                "Servier Spanish",
            ]
            for q in queues:
                try:
                    request = factory.get("/api/forecast/", {"queue": q})
                    view(request)
                    logger.info(f"Cache warmup OK: '{q}'")
                except Exception as e:
                    logger.warning(f"Cache warmup failed for '{q}': {e}")
        except Exception as e:
            logger.warning(f"Cache warmup global error: {e}")