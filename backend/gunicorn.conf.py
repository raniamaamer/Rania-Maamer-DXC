import os
import shutil

PROMETHEUS_MULTIPROC_DIR = "/tmp/prometheus_multiproc"

bind = "0.0.0.0:8000"
workers = 3
worker_class = "gthread"
threads = 4

def on_starting(_server):
    if os.path.exists(PROMETHEUS_MULTIPROC_DIR):
        shutil.rmtree(PROMETHEUS_MULTIPROC_DIR)
    os.makedirs(PROMETHEUS_MULTIPROC_DIR, exist_ok=True)
    os.environ["PROMETHEUS_MULTIPROC_DIR"] = PROMETHEUS_MULTIPROC_DIR
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "dxc_backend.settings")
    import django
    django.setup()
    from api import scheduler
    scheduler.start()

def post_fork(_server, _worker):
    # NE PAS marquer comme worker — laisser le scheduler tourner
    os.environ["PROMETHEUS_MULTIPROC_DIR"] = PROMETHEUS_MULTIPROC_DIR