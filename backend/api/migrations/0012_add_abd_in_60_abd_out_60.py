from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0010_historicalmetric_handle_time_historicalmetric_is_ooh_and_more'),
    ]

    operations = [
        # ✅ FIX: Ajout des champs abd_in_60 et abd_out_60
        # Nécessaires pour les formules SLA3 (Luxottica/EL Store)
        # ANS Rate : 1 - ans_out_sla / (offered - abd_in_60)
        # ABD Rate : 1 - abd_out_60 / (offered - abd_in_sla)
        migrations.AddField(
            model_name='queuemetric',
            name='abd_in_60',
            field=models.FloatField(default=0.0, help_text='Abandons dans les 60 premières secondes'),
        ),
        migrations.AddField(
            model_name='queuemetric',
            name='abd_out_60',
            field=models.FloatField(default=0.0, help_text='Abandons après 60 secondes'),
        ),
        migrations.AddField(
            model_name='historicalmetric',
            name='abd_in_60',
            field=models.FloatField(default=0.0, help_text='Abandons dans les 60 premières secondes'),
        ),
        migrations.AddField(
            model_name='historicalmetric',
            name='abd_out_60',
            field=models.FloatField(default=0.0, help_text='Abandons après 60 secondes'),
        ),
    ]