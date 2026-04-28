from django.urls import path
from . import views
from api.views import DebugMetricsView

app_name = 'api'

urlpatterns = [
    path('health/',              views.health_check,                    name='health'),
    path('overview/',            views.OverviewView.as_view(),          name='overview'),
    path('accounts/',            views.AccountListView.as_view(),       name='accounts'),
    path('queues/',              views.QueueListView.as_view(),         name='queues'),
    path('hourly/',              views.HourlyTrendView.as_view(),       name='hourly'),
    path('bottom5/',             views.Bottom5View.as_view(),           name='bottom5'),
    path('trend7/',              views.Trend7DaysView.as_view(),        name='trend7'),
    path('snapshots/',           views.DailySnapshotView.as_view(),     name='snapshots'),
    path('sla-config/',          views.SLAConfigView.as_view(),         name='sla-config'),
    path('sla-config/<int:pk>/', views.SLAConfigDetailView.as_view(),   name='sla-config-detail'),
    path('refresh/',             views.trigger_etl,                     name='refresh'),
    path('historical/',          views.HistoricalView.as_view(),        name='historical'),
    path('realtime/',            views.RealtimeView.as_view(),          name='realtime'),
    path('desk-langue/',         views.DeskLangueView.as_view(),        name='desk-langue'),
    path('debug-metrics/',       DebugMetricsView.as_view(),            name='debug-metrics'),
    path('predictions/',         views.PredictionsView.as_view(),       name='predictions'),
]