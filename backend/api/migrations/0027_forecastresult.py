from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0026_alter_historicalmetric_account_and_more'),
    ]

    operations = [
        migrations.RunSQL(
            sql="SELECT 1",
            reverse_sql="DROP TABLE IF EXISTS forecast_results;",
            state_operations=[
                migrations.CreateModel(
                    name='ForecastResult',
                    fields=[
                        ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('queue', models.CharField(db_index=True, max_length=200)),
                        ('horizon', models.CharField(max_length=10)),
                        ('forecast_date', models.DateField()),
                        ('predicted', models.IntegerField()),
                        ('lower', models.IntegerField()),
                        ('upper', models.IntegerField()),
                        ('is_weekend', models.BooleanField(default=False)),
                        ('is_holiday', models.BooleanField(default=False)),
                        ('created_at', models.DateTimeField(auto_now_add=True)),
                    ],
                    options={
                        'ordering': ['forecast_date'],
                        'unique_together': {('queue', 'horizon', 'forecast_date')},
                    },
                ),
            ],
        ),
    ]