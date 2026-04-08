from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='queuemetric',
            name='language',
            field=models.CharField(
                blank=True,
                db_index=True,
                help_text='Language code, e.g. fr, en, ar, es, de',
                max_length=10,
                null=True,
            ),
        ),
    ]
