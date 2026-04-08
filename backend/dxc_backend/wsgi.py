"""WSGI config for DXC KPI Dashboard."""
import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'dxc_backend.settings')
application = get_wsgi_application()
