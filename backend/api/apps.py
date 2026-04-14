import os
import sys
from django.apps import AppConfig

class ApiConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "api"

    def ready(self):
        # Never start scheduler during management commands like migrate, makemigrations, etc.
        if any(cmd in sys.argv for cmd in ["migrate", "makemigrations", "collectstatic", "shell"]):
            return

        # Never start scheduler when Django's auto-reloader parent process is running
        if os.environ.get("RUN_MAIN") != "true":
            return

        # Allow manual kill switch via environment variable
        if os.environ.get("DJANGO_SCHEDULER") == "off":
            return

        from api import scheduler
        scheduler.start()