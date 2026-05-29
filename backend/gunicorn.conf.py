bind = "0.0.0.0:8000"
workers = 3
worker_class = "gthread"
threads = 4

def post_fork(server, worker):
    import os
    os.environ["GUNICORN_WORKER"] = "true"

def on_starting(server):
    """Appelé une seule fois dans le master — avant le fork des workers."""
    import django
    import os
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "dxc_backend.settings")
    django.setup()
    from api import scheduler
    scheduler.start()