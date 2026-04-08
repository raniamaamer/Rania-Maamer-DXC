from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0016_historicalmetric_abd_in_60_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='historicalmetric',
            name='answered_with_hold',
            field=models.IntegerField(
                default=0,
                help_text='Nbre appels avec une valeur hold réelle (dénominateur correct pour avg_hold)'
            ),
        ),
    ]