bind = "0.0.0.0:8000"
workers = 1
worker_class = "gthread"
threads = 4

def on_starting(_server):
    import os
    os.environ.setdefault("PROMETHEUS_MULTIPROC_DIR", "/tmp/prometheus_multiproc")
    os.makedirs("/tmp/prometheus_multiproc", exist_ok=True)
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "dxc_backend.settings")
    import django
    django.setup()
    from api import scheduler
    scheduler.start()

def post_fork(_server, worker):
    import os
    os.environ["GUNICORN_WORKER"] = "true"
    os.environ.setdefault("PROMETHEUS_MULTIPROC_DIR", "/tmp/prometheus_multiproc")