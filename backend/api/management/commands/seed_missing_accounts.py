"""
DXC Tunisia — Seed Missing Accounts
==========================================
Crée les entrées AccountSummary + SLAConfig pour les comptes
présents dans SLA.csv mais absents de DB_all_queues.xlsx.
Les KPIs sont initialisés à zéro (pas de données encore).

Usage:
    python manage.py seed_missing_accounts
    python manage.py seed_missing_accounts --dry-run
"""

from django.core.management.base import BaseCommand
from api.models import AccountSummary, SLAConfig


# ── Formula constants (eliminates duplicate literals) ─────────────────────
FORMULA_ABD_OUT_DIV_OFFERED_MINUS_ABD = "Abd out SLA / (Offered − Abd in SLA)"
FORMULA_ANS_IN_SLA_DIV_ANSWERED       = "Ans in SLA / Answered"
FORMULA_ANS_IN_SLA_DIV_OFFERED_MINUS  = "Ans in SLA / (Offered − Abd in SLA)"
FORMULA_ANS_INVERSE_SLA3              = "1 − Ans out SLA / (Offered − Abd in SLA)"
FORMULA_ABD_INVERSE_SLA5              = "1 − Abd out 60s / (Offered − Abd in SLA)"
FORMULA_ABD_OUT_DIV_OFFERED           = "Abd out SLA / Offered"

# ── Données extraites du SLA.csv ─────────────────────────────────────────────
# Format : account -> (target_ans, target_abd, timeframe_bh, ans_formula, abd_formula)
MISSING_ACCOUNTS = {
    "Basrah Gas EN": {
        "target_ans_rate": 0.0,
        "target_abd_rate": 0.0,
        "timeframe_bh":    60,
        "ans_formula":     FORMULA_ANS_IN_SLA_DIV_OFFERED_MINUS,
        "abd_formula":     FORMULA_ABD_OUT_DIV_OFFERED_MINUS_ABD,
        "note": "Pas de target défini (NA) — Timeframe BH = 60s",
    },
    "DXC IT": {
        "target_ans_rate": 0.70,
        "target_abd_rate": 0.05,
        "timeframe_bh":    60,
        "ans_formula":     FORMULA_ANS_IN_SLA_DIV_ANSWERED,
        "abd_formula":     FORMULA_ABD_OUT_DIV_OFFERED_MINUS_ABD,
        "note": "Timeframe BH = 60s — Target Ans >= 70%",
    },
    "HPE": {
        "target_ans_rate": 0.90,
        "target_abd_rate": 0.03,
        "timeframe_bh":    30,
        "ans_formula":     FORMULA_ANS_IN_SLA_DIV_ANSWERED,
        "abd_formula":     FORMULA_ABD_OUT_DIV_OFFERED_MINUS_ABD,
        "note": "Timeframe BH = 30s — Target Abd <= 3%",
    },
    "Luxottica": {
        "target_ans_rate": 0.90,
        "target_abd_rate": 0.05,
        "timeframe_bh":    30,
        "ans_formula":     FORMULA_ANS_INVERSE_SLA3,
        "abd_formula":     FORMULA_ABD_INVERSE_SLA5,
        "note": "Formule inversée (compliance = 1 − breach rate)",
    },
    "Philips": {
        "target_ans_rate": 0.80,
        "target_abd_rate": 0.05,
        "timeframe_bh":    60,
        "ans_formula":     FORMULA_ANS_IN_SLA_DIV_OFFERED_MINUS,
        "abd_formula":     FORMULA_ABD_OUT_DIV_OFFERED_MINUS_ABD,
        "note": "Alt SLA: 1 − Ans out SLA / (Offered − Abd in 60s)",
    },
    "Saipem": {
        "target_ans_rate": 0.85,
        "target_abd_rate": 0.0,
        "timeframe_bh":    45,
        "ans_formula":     FORMULA_ANS_IN_SLA_DIV_ANSWERED,
        "abd_formula":     FORMULA_ABD_OUT_DIV_OFFERED,
        "note": "Timeframe BH = 45s — Target Abd = NA",
    },
}


class Command(BaseCommand):
    help = "Seed AccountSummary + SLAConfig pour les comptes sans données dans DB_all_queues"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Affiche ce qui serait créé sans toucher la base",
        )
        parser.add_argument(
            "--overwrite",
            action="store_true",
            help="Met à jour les entrées existantes (sinon skip si déjà présent)",
        )

    def handle(self, *args, **options):
        dry_run   = options["dry_run"]
        overwrite = options["overwrite"]

        if dry_run:
            self.stdout.write(self.style.WARNING("⚠️  MODE DRY-RUN — aucune modification en base\n"))

        counters = {"created_summary": 0, "updated_summary": 0,
                    "created_config": 0,  "updated_config": 0, "skipped": 0}

        for account, cfg in MISSING_ACCOUNTS.items():
            self.stdout.write(f"\n📋 Traitement : {self.style.MIGRATE_HEADING(account)}")
            self._process_sla_config(account, cfg, dry_run, overwrite, counters)
            skipped = self._process_account_summary(account, cfg, dry_run, overwrite, counters)
            if skipped:
                continue

        self._print_summary(dry_run, counters)

    # ── SLAConfig ─────────────────────────────────────────────────────────

    def _process_sla_config(self, account, cfg, dry_run, overwrite, counters):
        existing = SLAConfig.objects.filter(account=account).first()

        if existing and not overwrite:
            self.stdout.write("   SLAConfig  → déjà présent, skip (--overwrite pour forcer)")
            return

        if dry_run:
            action = "créer" if not existing else "mettre à jour"
            self.stdout.write(f"   SLAConfig  → [DRY] {action}")
            self.stdout.write(
                f"               target_ans={cfg['target_ans_rate']:.0%} | "
                f"target_abd={cfg['target_abd_rate']:.0%} | "
                f"timeframe={cfg['timeframe_bh']}s"
            )
            return

        _, created = SLAConfig.objects.update_or_create(
            account=account,
            defaults={
                "target_ans_rate": cfg["target_ans_rate"],
                "target_abd_rate": cfg["target_abd_rate"],
                "timeframe_bh":    cfg["timeframe_bh"],
                "ans_sla":         cfg["ans_formula"],
                "abd_sla":         cfg["abd_formula"],
            },
        )
        if created:
            counters["created_config"] += 1
            self.stdout.write(self.style.SUCCESS("   SLAConfig  → ✅ créé"))
        else:
            counters["updated_config"] += 1
            self.stdout.write(self.style.SUCCESS("   SLAConfig  → 🔄 mis à jour"))

    # ── AccountSummary ────────────────────────────────────────────────────

    def _process_account_summary(self, account, cfg, dry_run, overwrite, counters):
        """Returns True if the entry was skipped."""
        existing = AccountSummary.objects.filter(account=account).first()

        if existing and not overwrite:
            self.stdout.write("   AccountSummary → déjà présent, skip")
            counters["skipped"] += 1
            return True

        summary_data = self._build_summary_data(cfg)

        if dry_run:
            action = "créer" if not existing else "mettre à jour"
            self.stdout.write(f"   AccountSummary → [DRY] {action}")
            self.stdout.write(
                f"               KPIs=0 | target_ans={cfg['target_ans_rate']:.0%} | "
                f"target_abd={cfg['target_abd_rate']:.0%} | "
                f"timeframe={cfg['timeframe_bh']}s"
            )
            self.stdout.write(f"               Note: {cfg['note']}")
            return False

        _, created = AccountSummary.objects.update_or_create(
            account=account,
            defaults=summary_data,
        )
        if created:
            counters["created_summary"] += 1
            self.stdout.write(self.style.SUCCESS(
                "   AccountSummary → ✅ créé (KPIs=0, targets chargés)"
            ))
        else:
            counters["updated_summary"] += 1
            self.stdout.write(self.style.SUCCESS("   AccountSummary → 🔄 mis à jour"))

        return False

    @staticmethod
    def _build_summary_data(cfg):
        return {
            "offered":          0,
            "abandoned":        0,
            "answered":         0,
            "ans_in_sla":       0.0,
            "abd_in_sla":       0.0,
            "sla_rate":         0.0,
            "abandon_rate":     0.0,
            "answer_rate":      0.0,
            "avg_handle_time":  0.0,
            "avg_answer_time":  0.0,
            "avg_ttc":          0.0,
            "target_ans_rate":  cfg["target_ans_rate"],
            "target_abd_rate":  cfg["target_abd_rate"],
            "timeframe_bh":     cfg["timeframe_bh"],
            "sla_compliant":    False,
            "abd_compliant":    False,
        }

    # ── Summary output ────────────────────────────────────────────────────

    def _print_summary(self, dry_run, counters):
        self.stdout.write("\n" + "─" * 60)
        if dry_run:
            self.stdout.write(self.style.WARNING(
                f"DRY-RUN terminé — {len(MISSING_ACCOUNTS)} comptes à traiter"
            ))
            self.stdout.write("Lance sans --dry-run pour appliquer les changements.")
        else:
            self.stdout.write(self.style.SUCCESS(
                f"\n✅ Terminé !"
                f"\n   AccountSummary : {counters['created_summary']} créés | "
                f"{counters['updated_summary']} mis à jour | {counters['skipped']} skippés"
                f"\n   SLAConfig      : {counters['created_config']} créés | "
                f"{counters['updated_config']} mis à jour"
            ))
            self.stdout.write(
                "\n💡 Ces comptes apparaissent maintenant dans le dashboard avec KPIs=0."
                "\n   Quand leurs fichiers Excel seront importés via run_etl, "
                "les données se mettront à jour."
            )