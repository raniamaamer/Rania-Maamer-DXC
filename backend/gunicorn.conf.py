bind = "0.0.0.0:8000"
workers = 3
worker_class = "sync"

def post_fork(server, worker):
    import os
    os.environ["GUNICORN_WORKER"] = "true"