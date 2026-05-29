bind = "0.0.0.0:8000"
workers = 1
worker_class = "gthread"
threads = 4

def on_starting(_server):
    import os, shutil
    mp_dir = "/tmp/prometheus_multiproc"
    if os.path.exists(mp_dir):
        shutil.rmtree(mp_dir)        # wipe stale .db files from dead workers
    os.makedirs(mp_dir, exist_ok=True)
    
    os.environ.setdefault("PROMETHEUS_MULTIPROC_DIR", mp_dir)
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

