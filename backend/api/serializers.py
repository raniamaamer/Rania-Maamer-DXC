from rest_framework import serializers
from .models import QueueMetric, AccountSummary, HourlyTrend, SLAConfig, DailySnapshot
from .models import QueueMetric, AccountSummary, HourlyTrend, SLAConfig, DailySnapshot


class SLAConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = SLAConfig
        fields = '__all__'
class QueueMetricSerializer(serializers.ModelSerializer):
    sla_gap = serializers.SerializerMethodField()

    class Meta:
        model = QueueMetric
        fields = [
            'id', 'queue', 'account', 'start_date', 'hour',
            'year', 'month', 'week', 'day_of_week',
            'offered', 'abandoned', 'answered',
            'sla_rate', 'abandon_rate', 'answer_rate',
            'avg_handle_time', 'avg_answer_time', 'callback_contacts',
            'target_ans_rate', 'target_abd_rate', 'timeframe_bh',
            'sla_compliant', 'abd_compliant', 'sla_gap',
        ]

    def get_sla_gap(self, obj):
        return round(obj.sla_rate - obj.target_ans_rate, 4)
class AccountSummarySerializer(serializers.ModelSerializer):
    sla_gap = serializers.FloatField(read_only=True)
    class Meta:
        model = AccountSummary
        fields = [
            'account', 'offered', 'abandoned', 'answered',
            'ans_in_sla', 'abd_in_sla',
            'sla_rate', 'abandon_rate', 'answer_rate', 'avg_handle_time',
            'target_ans_rate', 'target_abd_rate', 'timeframe_bh',
            'sla_compliant', 'abd_compliant', 'sla_gap', 'updated_at',
        ]
class HourlyTrendSerializer(serializers.ModelSerializer):
    class Meta:
        model = HourlyTrend
        fields = ['hour', 'date', 'account', 'offered', 'abandoned', 'answered', 'sla_rate', 'abandon_rate']

class DailySnapshotSerializer(serializers.ModelSerializer):
    compliance_rate = serializers.FloatField(read_only=True)
    class Meta:
        model = DailySnapshot
        fields = '__all__'
class OverviewSerializer(serializers.Serializer):
    """Global KPI overview payload."""
    answered_rate = serializers.FloatField()
    abandon_rate = serializers.FloatField()
    sla_rate = serializers.FloatField()
    total_offered = serializers.IntegerField()
    total_abandoned = serializers.IntegerField()
    total_answered = serializers.IntegerField()
    total_queues = serializers.IntegerField()
    total_accounts = serializers.IntegerField()
    compliant_accounts = serializers.IntegerField()
    breached_accounts = serializers.IntegerField()
    avg_handle_time = serializers.FloatField()
    asa = serializers.FloatField(help_text="Average Speed of Answer in seconds")
    total_callbacks = serializers.IntegerField()
    compliance_rate = serializers.FloatField()
class Bottom5Serializer(serializers.Serializer):
    account = serializers.CharField()
    sla_rate = serializers.FloatField()
    target_ans_rate = serializers.FloatField()
    gap = serializers.FloatField()
    avg_handle_time = serializers.FloatField()
    abandon_rate = serializers.FloatField()