"""
Management command : archive_realtime
--------------------------------------
Déclenché automatiquement à 23:59 par le scheduler APScheduler.

Ce qu'il fait :
  1. Lit toutes les lignes de realtime_metrics pour AUJOURD'HUI
  2. Les copie dans historical_metrics (archivage)
  3. Vide realtime_metrics → prêt pour les données du lendemain (00:00)

Usage manuel (pour test) :
  python manage.py archive_realtime
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction

from api.models import RealtimeMetric, HistoricalMetric, SLAConfig


class Command(BaseCommand):
    help = "Archive les données realtime du jour dans historical_metrics et vide realtime_metrics"

    def add_arguments(self, parser):
        parser.add_argument(
            "--date",
            type=str,
            default=None,
            help="Date à archiver (YYYY-MM-DD). Défaut : aujourd'hui",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            default=False,
            help="Simule sans écrire en base",
        )

    def log(self, msg):
        self.stdout.write(f"[ARCHIVE] {msg}")

    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        # ── 1. Déterminer la date à archiver ──────────────────────────────────
        if options["date"]:
            from datetime import datetime
            target_date = datetime.strptime(options["date"], "%Y-%m-%d").date()
        else:
            target_date = timezone.now().date()

        self.log(f"Date cible : {target_date}" + (" [DRY RUN]" if dry_run else ""))

        # ── 2. Récupérer les lignes realtime du jour ───────────────────────────
        realtime_qs = RealtimeMetric.objects.filter(
            captured_at__date=target_date
        ).select_related("sla_config")

        count = realtime_qs.count()
        if count == 0:
            self.log("Aucune donnée realtime à archiver pour cette date.")
            return

        self.log(f"{count} lignes trouvées dans realtime_metrics")

        # ── 3. Construire les objets HistoricalMetric ─────────────────────────
        historical_rows = []

        for rt in realtime_qs:
            captured = rt.captured_at

            # ans_in_sla / abd_in_sla : pas stockés dans realtime →
            # on estime via sla_rate × (offered - 0) si pas dispo
            # Pour l'instant on met 0 — à améliorer si realtime pousse ces valeurs
            ans_in_sla = getattr(rt, "ans_in_sla", 0.0)
            abd_in_sla = getattr(rt, "abd_in_sla", 0.0)

            historical_rows.append(HistoricalMetric(
                queue=rt.queue,
                account=rt.account,
                language=rt.language,
                sla_config=rt.sla_config,

                # Temps
                start_date=captured,
                end_date=None,
                hour=captured.strftime("%H:%M"),
                year=captured.year,
                month=captured.month,
                week=int(captured.isocalendar().week),
                day_of_week=captured.strftime("%A"),

                # Volumes
                offered=rt.offered,
                abandoned=rt.abandoned,
                answered=rt.answered,
                ans_in_sla=ans_in_sla,
                abd_in_sla=abd_in_sla,
                ans_out_sla=max(0, rt.answered - int(ans_in_sla)),
                abd_out_sla=max(0, rt.abandoned - int(abd_in_sla)),
                callback_contacts=rt.callback_contacts,

                # Taux
                sla_rate=rt.sla_rate,
                abandon_rate=rt.abandon_rate,
                answer_rate=rt.answer_rate,

                # Temps moyens
                avg_handle_time=rt.avg_handle_time,
                avg_answer_time=rt.avg_answer_time,
                average_hold_time=0.0,   # pas dans RealtimeMetric
                avg_ttc=0.0,             # pas dans RealtimeMetric

                # Targets SLA
                target_ans_rate=rt.target_ans_rate,
                target_abd_rate=rt.target_abd_rate,
                timeframe_bh=rt.timeframe_bh,

                # Conformité
                sla_compliant=rt.sla_compliant,
                abd_compliant=(rt.abandon_rate <= rt.target_abd_rate),

                # Metadata
                source_file=f"realtime_archive_{target_date}",
            ))

        # ── 4. Insérer + vider en transaction atomique ────────────────────────
        if dry_run:
            self.log(f"[DRY RUN] {len(historical_rows)} lignes seraient archivées")
            self.log("[DRY RUN] realtime_metrics NE serait PAS vidé")
            return

        with transaction.atomic():
            # Insérer dans historical
            HistoricalMetric.objects.bulk_create(historical_rows, batch_size=500)
            self.log(f"[OK] {len(historical_rows)} lignes archivées → historical_metrics")

            # Vider realtime pour aujourd'hui seulement
            deleted, _ = RealtimeMetric.objects.filter(
                captured_at__date=target_date
            ).delete()
            self.log(f"[OK] {deleted} lignes supprimées de realtime_metrics")

        self.stdout.write(self.style.SUCCESS(
            f"[ARCHIVE] Terminé — {len(historical_rows)} lignes archivées, "
            f"realtime vidé pour {target_date}"
        ))