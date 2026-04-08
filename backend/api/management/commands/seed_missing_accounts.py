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


# ── Données extraites du SLA.csv ─────────────────────────────────────────────
# Format : account -> (target_ans, target_abd, timeframe_bh, ans_formula, abd_formula)
MISSING_ACCOUNTS = {
    "Basrah Gas EN": {
        "target_ans_rate": 0.0,       # NA dans SLA.csv
        "target_abd_rate": 0.0,       # NA dans SLA.csv
        "timeframe_bh": 60,
        "ans_formula": "Ans in SLA / (Offered − Abd in SLA)",
        "abd_formula": "Abd out SLA / (Offered − Abd in SLA)",
        "note": "Pas de target défini (NA) — Timeframe BH = 60s",
    },
    "DXC IT": {
        "target_ans_rate": 0.70,
        "target_abd_rate": 0.05,
        "timeframe_bh": 60,
        "ans_formula": "Ans in SLA / Answered",
        "abd_formula": "Abd out SLA / (Offered − Abd in SLA)",
        "note": "Timeframe BH = 60s — Target Ans >= 70%",
    },
    "HPE": {
        "target_ans_rate": 0.90,
        "target_abd_rate": 0.03,
        "timeframe_bh": 30,
        "ans_formula": "Ans in SLA / Answered",
        "abd_formula": "Abd out SLA / (Offered − Abd in SLA)",
        "note": "Timeframe BH = 30s — Target Abd <= 3%",
    },
    "Luxottica": {
        "target_ans_rate": 0.90,
        "target_abd_rate": 0.05,      # 95% = 1 - 5% breach
        "timeframe_bh": 30,
        "ans_formula": "1 − Ans out SLA / (Offered − Abd in SLA)",
        "abd_formula": "1 − Abd out 60s / (Offered − Abd in SLA)",
        "note": "Formule inversée (compliance = 1 − breach rate)",
    },
    "Philips": {
        "target_ans_rate": 0.80,
        "target_abd_rate": 0.05,
        "timeframe_bh": 60,
        "ans_formula": "Ans in SLA / (Offered − Abd in SLA)",
        "abd_formula": "Abd out SLA / (Offered − Abd in SLA)",
        "note": "Alt SLA: 1 − Ans out SLA / (Offered − Abd in 60s)",
    },
    "Saipem": {
        "target_ans_rate": 0.85,
        "target_abd_rate": 0.0,       # NA dans SLA.csv
        "timeframe_bh": 45,
        "ans_formula": "Ans in SLA / Answered",
        "abd_formula": "Abd out SLA / Offered",
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
        dry_run = options["dry_run"]
        overwrite = options["overwrite"]

        if dry_run:
            self.stdout.write(self.style.WARNING("⚠️  MODE DRY-RUN — aucune modification en base\n"))

        created_summary = 0
        updated_summary = 0
        created_config = 0
        updated_config = 0
        skipped = 0

        for account, cfg in MISSING_ACCOUNTS.items():
            self.stdout.write(f"\n📋 Traitement : {self.style.MIGRATE_HEADING(account)}")

            # ── 1. SLAConfig ──────────────────────────────────────────────────
            existing_config = SLAConfig.objects.filter(account=account).first()

            if existing_config and not overwrite:
                self.stdout.write(f"   SLAConfig  → déjà présent, skip (--overwrite pour forcer)")
            else:
                if not dry_run:
                    sla_obj, created = SLAConfig.objects.update_or_create(
                        account=account,
                        defaults={
                            "target_ans_rate": cfg["target_ans_rate"],
                            "target_abd_rate": cfg["target_abd_rate"],
                            "timeframe_bh": cfg["timeframe_bh"],
                            "ans_sla": cfg["ans_formula"],
                            "abd_sla": cfg["abd_formula"],
                        },
                    )
                    if created:
                        created_config += 1
                        self.stdout.write(self.style.SUCCESS(f"   SLAConfig  → ✅ créé"))
                    else:
                        updated_config += 1
                        self.stdout.write(self.style.SUCCESS(f"   SLAConfig  → 🔄 mis à jour"))
                else:
                    action = "créer" if not existing_config else "mettre à jour"
                    self.stdout.write(f"   SLAConfig  → [DRY] {action}")
                    self.stdout.write(f"               target_ans={cfg['target_ans_rate']:.0%} | "
                                      f"target_abd={cfg['target_abd_rate']:.0%} | "
                                      f"timeframe={cfg['timeframe_bh']}s")

            # ── 2. AccountSummary ─────────────────────────────────────────────
            existing_summary = AccountSummary.objects.filter(account=account).first()

            if existing_summary and not overwrite:
                self.stdout.write(f"   AccountSummary → déjà présent, skip")
                skipped += 1
                continue

            summary_data = {
                # KPIs à zéro (pas de données)
                "offered": 0,
                "abandoned": 0,
                "answered": 0,
                "ans_in_sla": 0.0,
                "abd_in_sla": 0.0,
                "sla_rate": 0.0,
                "abandon_rate": 0.0,
                "answer_rate": 0.0,
                "avg_handle_time": 0.0,
                "avg_answer_time": 0.0,
                "avg_ttc": 0.0,
                # Targets depuis SLA.csv
                "target_ans_rate": cfg["target_ans_rate"],
                "target_abd_rate": cfg["target_abd_rate"],
                "timeframe_bh": cfg["timeframe_bh"],
                # Conformité : False car pas de données
                "sla_compliant": False,
                "abd_compliant": False,
            }

            if not dry_run:
                obj, created = AccountSummary.objects.update_or_create(
                    account=account,
                    defaults=summary_data,
                )
                if created:
                    created_summary += 1
                    self.stdout.write(self.style.SUCCESS(f"   AccountSummary → ✅ créé (KPIs=0, targets chargés)"))
                else:
                    updated_summary += 1
                    self.stdout.write(self.style.SUCCESS(f"   AccountSummary → 🔄 mis à jour"))
            else:
                action = "créer" if not existing_summary else "mettre à jour"
                self.stdout.write(f"   AccountSummary → [DRY] {action}")
                self.stdout.write(f"               KPIs=0 | target_ans={cfg['target_ans_rate']:.0%} | "
                                  f"target_abd={cfg['target_abd_rate']:.0%} | "
                                  f"timeframe={cfg['timeframe_bh']}s")
                self.stdout.write(f"               Note: {cfg['note']}")

        # ── Résumé ────────────────────────────────────────────────────────────
        self.stdout.write("\n" + "─" * 60)
        if dry_run:
            self.stdout.write(self.style.WARNING(
                f"DRY-RUN terminé — {len(MISSING_ACCOUNTS)} comptes à traiter"
            ))
            self.stdout.write("Lance sans --dry-run pour appliquer les changements.")
        else:
            self.stdout.write(self.style.SUCCESS(
                f"\n✅ Terminé !"
                f"\n   AccountSummary : {created_summary} créés | {updated_summary} mis à jour | {skipped} skippés"
                f"\n   SLAConfig      : {created_config} créés | {updated_config} mis à jour"
            ))
            self.stdout.write(
                "\n💡 Ces comptes apparaissent maintenant dans le dashboard avec KPIs=0."
                "\n   Quand leurs fichiers Excel seront importés via run_etl, les données se mettront à jour."
            )