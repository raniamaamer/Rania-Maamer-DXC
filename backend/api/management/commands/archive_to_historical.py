"""
management/commands/archive_to_historical.py

Déplace les données de plus de 24h de realtime_metrics → historical_metrics.
Ensuite purge les anciennes entrées de realtime_metrics (> 7 jours).

Usage :
    python manage.py archive_to_historical
    python manage.py archive_to_historical --dry-run
    python manage.py archive_to_historical --hours 24   # seuil (defaut 24h)
    python manage.py archive_to_historical --purge-after 7  # purge apres N jours

Planification Windows Task Scheduler :
    Tous les jours à 00:05
    Action : python manage.py archive_to_historical
"""

from datetime import timedelta
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from api.models import RealtimeMetric, HistoricalMetric, SLAConfig


class Command(BaseCommand):
    help = "Archive realtime_metrics (> 24h) → historical_metrics"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run", action="store_true",
            help="Affiche ce qui serait archivé sans rien modifier"
        )
        parser.add_argument(
            "--hours", type=int, default=24,
            help="Archiver les données de plus de N heures (defaut: 24)"
        )
        parser.add_argument(
            "--purge-after", type=int, default=7,
            dest="purge_after",
            help="Purger les realtime_metrics archivés apres N jours (defaut: 7)"
        )

    def log(self, msg):
        self.stdout.write(f"[ARCHIVE] {msg}")

    @transaction.atomic
    def handle(self, *args, **options):
        dry_run     = options["dry_run"]
        hours       = options["hours"]
        purge_after = options["purge_after"]

        cutoff      = timezone.now() - timedelta(hours=hours)
        purge_cutoff= timezone.now() - timedelta(days=purge_after)

        # ── 1. Trouver les lignes à archiver ──────────────────────────────────
        to_archive = RealtimeMetric.objects.filter(
            captured_at__lt=cutoff
        ).select_related("sla_config")

        count = to_archive.count()
        self.log(f"Lignes à archiver (> {hours}h) : {count}")

        if count == 0:
            self.stdout.write(self.style.SUCCESS("[ARCHIVE] ✅ Rien à archiver."))
            return

        if dry_run:
            self.stdout.write(self.style.WARNING(
                f"[ARCHIVE] [DRY-RUN] {count} lignes seraient déplacées vers historical_metrics."
            ))
            # Afficher un échantillon
            for rt in to_archive[:5]:
                self.log(f"  ex: {rt.queue} | {rt.captured_at} | offered={rt.offered}")
            return

        # ── 2. Convertir RealtimeMetric → HistoricalMetric ───────────────────
        sla_map = {s.account: s for s in SLAConfig.objects.all()}
        historical_rows = []
        ids_to_delete   = []

        for rt in to_archive.iterator(chunk_size=500):
            # Eviter les doublons (queue + start_date déjà présents)
            already_exists = HistoricalMetric.objects.filter(
                queue=rt.queue,
                start_date=rt.captured_at,
            ).exists()

            if already_exists:
                ids_to_delete.append(rt.id)
                continue

            historical_rows.append(HistoricalMetric(
                queue=rt.queue,
                account=rt.account,
                language=rt.language,
                sla_config=sla_map.get(rt.account),
                start_date=rt.captured_at,
                end_date=None,
                hour=rt.captured_at.strftime("%H:%M"),
                year=rt.captured_at.year,
                month=rt.captured_at.month,
                week=int(rt.captured_at.isocalendar().week),
                day_of_week=rt.captured_at.strftime("%A"),
                offered=rt.offered,
                abandoned=rt.abandoned,
                answered=rt.answered,
                ans_in_sla=0.0,       # pas disponible dans RealtimeMetric
                abd_in_sla=0.0,       # pas disponible dans RealtimeMetric
                callback_contacts=rt.callback_contacts,
                sla_rate=rt.sla_rate,
                abandon_rate=rt.abandon_rate,
                answer_rate=rt.answer_rate,
                avg_handle_time=rt.avg_handle_time,
                avg_answer_time=rt.avg_answer_time,
                average_hold_time=0.0,  # pas disponible dans RealtimeMetric
                avg_ttc=0.0,            # pas disponible dans RealtimeMetric
                target_ans_rate=rt.target_ans_rate,
                target_abd_rate=rt.target_abd_rate,
                timeframe_bh=rt.timeframe_bh,
                sla_compliant=rt.sla_compliant,
                abd_compliant=rt.abandon_rate <= rt.target_abd_rate,
                source_file="realtime_archive",
            ))
            ids_to_delete.append(rt.id)

        # ── 3. Insérer dans historical_metrics ────────────────────────────────
        if historical_rows:
            HistoricalMetric.objects.bulk_create(historical_rows, batch_size=500)
            self.log(f"✓ {len(historical_rows)} lignes insérées dans historical_metrics")

        skipped = len(ids_to_delete) - len(historical_rows)
        if skipped > 0:
            self.log(f"  {skipped} doublons ignorés (déjà dans historical_metrics)")

        # ── 4. Supprimer de realtime_metrics ──────────────────────────────────
        if ids_to_delete:
            deleted, _ = RealtimeMetric.objects.filter(id__in=ids_to_delete).delete()
            self.log(f"✓ {deleted} lignes supprimées de realtime_metrics")

        # ── 5. Purger les très anciennes réaltime (sécurité) ──────────────────
        old_count = RealtimeMetric.objects.filter(captured_at__lt=purge_cutoff).count()
        if old_count > 0:
            purged, _ = RealtimeMetric.objects.filter(captured_at__lt=purge_cutoff).delete()
            self.log(f"✓ {purged} anciennes lignes purgées de realtime_metrics (> {purge_after} jours)")

        self.stdout.write(self.style.SUCCESS(
            f"[ARCHIVE] ✅ Terminé — {len(historical_rows)} archivées, {len(ids_to_delete)} supprimées de realtime"
        ))