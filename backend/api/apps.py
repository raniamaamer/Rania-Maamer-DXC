import os
import sys
from django.apps import AppConfig

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