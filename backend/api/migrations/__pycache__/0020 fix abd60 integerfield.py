from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0019_remove_historicalmetric_total_ttc_time'),
    ]

    operations = [
        # QueueMetric
        migrations.AlterField(
            model_name='queuemetric',
            name='abd_in_60',
            field=models.IntegerField(default=0, help_text='Abandons dans les 60 premières secondes'),
        ),
        migrations.AlterField(
            model_name='queuemetric',
            name='abd_out_60',
            field=models.IntegerField(default=0, help_text='Abandons après 60 secondes'),
        ),
        # HistoricalMetric
        migrations.AlterField(
            model_name='historicalmetric',
            name='abd_in_60',
            field=models.IntegerField(default=0, help_text='Abandons dans les 60 premières secondes'),
        ),
        migrations.AlterField(
            model_name='historicalmetric',
            name='abd_out_60',
            field=models.IntegerField(default=0, help_text='Abandons après 60 secondes'),
        ),
    ]