from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
class SLAConfig(models.Model):
    account = models.CharField(max_length=100, unique=True, db_index=True)
    ans_rate_formula = models.CharField(max_length=200, blank=True, null=True)
    abd_rate_formula = models.CharField(max_length=200, blank=True, null=True)
    timeframe_bh = models.IntegerField(
        default=40,
        validators=[MinValueValidator(10), MaxValueValidator(120)],
        help_text="SLA answer timeframe in seconds (Business Hours)"
    )
    ooh = models.IntegerField(default=0, help_text="Out-of-hours timeframe")
    ans_sla = models.CharField(max_length=100, blank=True, null=True)
    abd_sla = models.CharField(max_length=100, blank=True, null=True)
    target_ans_rate = models.FloatField(
        default=0.8,
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
        help_text="Target answer rate (0.0 - 1.0)"
    )
    target_abd_rate = models.FloatField(
        default=0.05,
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
        help_text="Target abandon rate (0.0 - 1.0)"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        db_table = 'sla_config'
        verbose_name = 'SLA Configuration'
        verbose_name_plural = 'SLA Configurations'
        ordering = ['account']

    def __str__(self):
        return f"{self.account} (Target: {self.target_ans_rate:.0%})"
class QueueMetric(models.Model):
    """Per-queue, per-time-slot metrics (main fact table)."""
    queue = models.CharField(max_length=200, db_index=True)
    desk = models.CharField(max_length=200, db_index=True, blank=True, null=True,
                            help_text="Desk logique (depuis SLA.xlsx Sheet1 colonne Desk)")
    account = models.CharField(max_length=100, db_index=True, blank=True, null=True)
    language = models.CharField(max_length=10, db_index=True, blank=True, null=True,
                                help_text="Language code, e.g. fr, en, ar, es, de")
    sla_config = models.ForeignKey(
        SLAConfig, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='queue_metrics'
    )
    start_date = models.DateTimeField(db_index=True)
    end_date = models.DateTimeField(null=True, blank=True)
    hour = models.CharField(max_length=5, db_index=True, help_text="HH:MM format")
    year = models.IntegerField(db_index=True)
    month = models.IntegerField(db_index=True, validators=[MinValueValidator(1), MaxValueValidator(12)])
    week = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(53)])
    day_of_week = models.CharField(max_length=20, blank=True, null=True)
    offered = models.IntegerField(default=0)
    abandoned = models.IntegerField(default=0)
    answered = models.IntegerField(default=0)
    ans_in_sla = models.FloatField(default=0.0)
    abd_in_sla = models.FloatField(default=0.0)
    ans_out_sla = models.IntegerField(default=0)   # answered - ans_in_sla
    abd_out_sla = models.IntegerField(default=0)   # abandoned - abd_in_sla
    abd_in_60   = models.IntegerField(default=0, help_text="Abandons dans les 60 premières secondes")
    abd_out_60  = models.IntegerField(default=0, help_text="Abandons après 60 secondes")
    callback_contacts = models.IntegerField(default=0)
    sla_rate = models.FloatField(
        default=0.0,
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)]
    )
    abandon_rate = models.FloatField(
        default=0.0,
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)]
    )
    answer_rate = models.FloatField(
        default=0.0,
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)]
    )
    avg_handle_time = models.FloatField(default=0.0)
    avg_answer_time = models.FloatField(default=0.0)  # ASA
    average_hold_time = models.FloatField(default=0.0)
    avg_ttc = models.FloatField(default=0.0, help_text='Avg TTC = Agent interaction time / handled (sec)')
    handle_time       = models.FloatField(default=0.0, help_text='AHT x answered')
    total_answer_time = models.FloatField(default=0.0, help_text='ASA x answered')
    total_hold_time   = models.FloatField(default=0.0, help_text='Agent interaction time x answered')
    target_ans_rate = models.FloatField(default=0.8)
    target_abd_rate = models.FloatField(default=0.05)
    timeframe_bh  = models.IntegerField(default=40)
    timeframe_ooh = models.IntegerField(default=40, help_text='Timeframe hors heures ouvrées (sec)')
    is_ooh = models.BooleanField(default=False, help_text='True si weekend ou entre 19h et 7h')
    sla_compliant = models.BooleanField(default=False, db_index=True)
    abd_compliant = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        db_table = 'queue_metrics'
        verbose_name = 'Queue Metric'
        verbose_name_plural = 'Queue Metrics'
        indexes = [
            models.Index(fields=['account', 'year', 'month'], name='idx_account_period'),
            models.Index(fields=['start_date', 'account'], name='idx_date_account'),
            models.Index(fields=['sla_compliant', 'account'], name='idx_compliance_account'),
            models.Index(fields=['year', 'month', 'week'], name='idx_period'),
        ]
    def __str__(self):
        return f"{self.queue} | {self.start_date:%Y-%m-%d %H:%M} | SLA: {self.sla_rate:.1%}"
class AccountSummary(models.Model):
    """Aggregated account-level KPI summary (materialized for fast dashboard queries)."""
    account = models.CharField(max_length=100, unique=True, db_index=True)
    offered = models.IntegerField(default=0)
    abandoned = models.IntegerField(default=0)
    answered = models.IntegerField(default=0)
    ans_in_sla = models.FloatField(default=0.0)
    abd_in_sla = models.FloatField(default=0.0)
    sla_rate = models.FloatField(default=0.0)
    abandon_rate = models.FloatField(default=0.0)
    answer_rate = models.FloatField(default=0.0)
    avg_handle_time = models.FloatField(default=0.0)
    target_ans_rate = models.FloatField(default=0.8)
    target_abd_rate = models.FloatField(default=0.05)
    sla_compliant = models.BooleanField(default=False)
    abd_compliant = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)
    timeframe_bh = models.IntegerField(default=40)
    avg_answer_time = models.FloatField(default=0.0)
    avg_ttc = models.FloatField(default=0.0)
    class Meta:
        db_table = 'account_summary'
        verbose_name = 'Account Summary'
        verbose_name_plural = 'Account Summaries'
        ordering = ['sla_rate']
    def __str__(self):
        status = "✅" if self.sla_compliant else "❌"
        return f"{status} {self.account} (SLA: {self.sla_rate:.1%})"
    @property
    def sla_gap(self):
        return round(self.sla_rate - self.target_ans_rate, 4)
class HourlyTrend(models.Model):
    hour = models.CharField(max_length=5, db_index=True)
    date = models.DateField(db_index=True)
    account = models.CharField(max_length=100, db_index=True)
    offered = models.IntegerField(default=0)
    abandoned = models.IntegerField(default=0)
    answered = models.IntegerField(default=0)
    ans_in_sla = models.FloatField(default=0.0)
    abd_in_sla = models.FloatField(default=0.0)
    sla_rate = models.FloatField(default=0.0)
    abandon_rate = models.FloatField(default=0.0)
    answer_rate = models.FloatField(default=0.0)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        db_table = 'hourly_trends'
        verbose_name = 'Hourly Trend'
        verbose_name_plural = 'Hourly Trends'
        unique_together = [['date', 'hour', 'account']]
        indexes = [
            models.Index(fields=['date', 'account'], name='idx_hourly_date_account'),
        ]
    def __str__(self):
        return f"{self.account} | {self.date} {self.hour} | SLA: {self.sla_rate:.1%}"
class DailySnapshot(models.Model):
    date = models.DateField(db_index=True, unique=True)
    total_offered = models.IntegerField(default=0)
    total_abandoned = models.IntegerField(default=0)
    total_answered = models.IntegerField(default=0)
    global_sla_rate = models.FloatField(default=0.0)
    global_abandon_rate = models.FloatField(default=0.0)
    global_answer_rate = models.FloatField(default=0.0)
    compliant_accounts = models.IntegerField(default=0)
    total_accounts = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        db_table = 'daily_snapshots'
        verbose_name = 'Daily Snapshot'
        verbose_name_plural = 'Daily Snapshots'
        ordering = ['-date']
    def __str__(self):
        return f"{self.date} | SLA: {self.global_sla_rate:.1%}"
    @property
    def compliance_rate(self):
        if self.total_accounts == 0:
            return 0
        return self.compliant_accounts / self.total_accounts
class HistoricalMetric(models.Model):
    queue = models.CharField(max_length=200, db_index=True)
    desk = models.CharField(max_length=200, db_index=True, blank=True, null=True,
                            help_text="Desk logique (depuis SLA.xlsx Sheet1 colonne Desk)")
    account = models.CharField(max_length=100, db_index=True, blank=True, null=True)
    language = models.CharField(max_length=10, db_index=True, blank=True, null=True,
                                help_text="Language code, e.g. fr, en, ar, es, de")
    sla_config = models.ForeignKey(
        SLAConfig, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='historical_metrics'
    )
    start_date = models.DateTimeField(db_index=True)
    end_date = models.DateTimeField(null=True, blank=True)
    hour = models.CharField(max_length=5, help_text="HH:MM format")
    year = models.IntegerField(db_index=True)
    month = models.IntegerField(db_index=True,
        validators=[MinValueValidator(1), MaxValueValidator(12)])
    week = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(53)])
    day_of_week = models.CharField(max_length=20, blank=True, null=True)
    offered = models.IntegerField(default=0)
    abandoned = models.IntegerField(default=0)
    answered = models.IntegerField(default=0)
    ans_in_sla = models.FloatField(default=0.0)
    abd_in_sla = models.FloatField(default=0.0)
    ans_out_sla = models.IntegerField(default=0)   # answered - ans_in_sla
    abd_out_sla = models.IntegerField(default=0)   # abandoned - abd_in_sla
    abd_in_60   = models.IntegerField(default=0, help_text="Abandons dans les 60 premières secondes")
    abd_out_60  = models.IntegerField(default=0, help_text="Abandons après 60 secondes")
    callback_contacts = models.IntegerField(default=0)
    sla_rate = models.FloatField(default=0.0,
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)])
    abandon_rate = models.FloatField(default=0.0,
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)])
    answer_rate = models.FloatField(default=0.0,
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)])
    avg_handle_time = models.FloatField(default=0.0)
    avg_answer_time = models.FloatField(default=0.0)  # ASA
    average_hold_time = models.FloatField(default=0.0)
    contacts_put_on_hold = models.IntegerField(default=0, help_text="Number of contacts that were put on hold")
    avg_ttc = models.FloatField(default=0.0, help_text='Avg TTC = Agent interaction / handled (sec)')
    handle_time       = models.FloatField(default=0.0, help_text='AHT x answered')
    total_answer_time = models.FloatField(default=0.0, help_text='ASA x answered')
    total_hold_time   = models.FloatField(default=0.0, help_text='Hold x answered (NaN→0, pas de dilution)')
    answered_with_hold = models.IntegerField(default=0, help_text='Nbre appels avec une valeur hold réelle (dénominateur correct pour avg_hold)')
    target_ans_rate = models.FloatField(default=0.8)
    target_abd_rate = models.FloatField(default=0.05)
    timeframe_bh  = models.IntegerField(default=40)
    timeframe_ooh = models.IntegerField(default=40, help_text='Timeframe hors heures ouvrées (sec)')
    is_ooh = models.BooleanField(default=False, help_text='True si weekend ou entre 19h et 7h')
    sla_compliant = models.BooleanField(default=False, db_index=True)
    abd_compliant = models.BooleanField(default=False)
    source_file = models.CharField(max_length=255, blank=True, null=True,
                                   help_text="Source Excel/CSV filename")
    loaded_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        db_table = 'historical_metrics'
        verbose_name = 'Historical Metric'
        verbose_name_plural = 'Historical Metrics'
        ordering = ['-start_date']
        indexes = [
            models.Index(fields=['account', 'year', 'month'], name='idx_hist_account_period'),
            models.Index(fields=['start_date', 'account'],    name='idx_hist_date_account'),
            models.Index(fields=['year', 'month', 'week'],    name='idx_hist_period'),
            models.Index(fields=['sla_compliant', 'account'], name='idx_hist_compliance'),
        ]
    def __str__(self):
        return f"[HIST] {self.queue} | {self.start_date:%Y-%m-%d %H:%M} | SLA: {self.sla_rate:.1%}"
class RealtimeMetric(models.Model):
    queue = models.CharField(max_length=200, db_index=True)
    desk = models.CharField(max_length=200, db_index=True, blank=True, null=True,
                            help_text="Desk logique (depuis SLA.xlsx Sheet1 colonne Desk)")
    account = models.CharField(max_length=100, db_index=True, blank=True, null=True)
    language = models.CharField(max_length=10, db_index=True, blank=True, null=True)
    sla_config = models.ForeignKey(
        SLAConfig, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='realtime_metrics'
    )
    captured_at = models.DateTimeField(db_index=True,
        help_text="Exact moment this metric was captured")
    hour = models.CharField(max_length=5, help_text="HH:MM format")
    day_of_week = models.CharField(max_length=20, blank=True, null=True)
    offered = models.IntegerField(default=0)
    abandoned = models.IntegerField(default=0)
    answered = models.IntegerField(default=0)
    in_queue = models.IntegerField(default=0,
        help_text="Contacts currently waiting in queue")
    agents_available = models.IntegerField(default=0)
    agents_busy = models.IntegerField(default=0)
    callback_contacts = models.IntegerField(default=0)
    sla_rate = models.FloatField(default=0.0,
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)])
    abandon_rate = models.FloatField(default=0.0,
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)])
    answer_rate = models.FloatField(default=0.0,
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)])
    avg_handle_time = models.FloatField(default=0.0)
    avg_answer_time = models.FloatField(default=0.0)
    longest_wait_time = models.FloatField(default=0.0,
        help_text="Longest current wait time in seconds")
    target_ans_rate = models.FloatField(default=0.8)
    target_abd_rate = models.FloatField(default=0.05)
    timeframe_bh = models.IntegerField(default=40)
    sla_compliant = models.BooleanField(default=False, db_index=True)
    source = models.CharField(max_length=50, default='polling',
        help_text="Data source: polling | webhook | manual")
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        db_table = 'realtime_metrics'
        verbose_name = 'Realtime Metric'
        verbose_name_plural = 'Realtime Metrics'
        ordering = ['-captured_at']
        indexes = [
            models.Index(fields=['captured_at', 'account'], name='idx_rt_captured_account'),
            models.Index(fields=['account', 'sla_compliant'], name='idx_rt_compliance'),
            models.Index(fields=['queue', 'captured_at'],    name='idx_rt_queue_time'),
        ]
    def __str__(self):
        return f"[RT] {self.queue} | {self.captured_at:%H:%M:%S} | in_queue={self.in_queue}"