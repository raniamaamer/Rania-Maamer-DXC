from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        # Dépend de la dernière migration existante (ajuster le nom si nécessaire)
        ('api', '0013_merge_0011_prediction_0012_add_abd_in_60_abd_out_60'),
    ]

    operations = [
        # ✅ FIX: Ajout du champ "desk" pour grouper les queues par desk logique
        # Source : SLA.xlsx Sheet1 colonne "Desk"
        # Exemple : Nestle DE CBA, Nestle DE Other, Nestle DE PW → desk = "Nestle DE"
        migrations.AddField(
            model_name='queuemetric',
            name='desk',
            field=models.CharField(
                max_length=200, db_index=True, blank=True, null=True,
                help_text="Desk logique (depuis SLA.xlsx Sheet1 colonne Desk)"
            ),
        ),
        migrations.AddField(
            model_name='historicalmetric',
            name='desk',
            field=models.CharField(
                max_length=200, db_index=True, blank=True, null=True,
                help_text="Desk logique (depuis SLA.xlsx Sheet1 colonne Desk)"
            ),
        ),
    ]