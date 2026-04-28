import warnings
import pandas as pd
from pathlib import Path
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from api.models import RealtimeMetric, SLAConfig
from api.management.commands.run_etl import extract_account, extract_language, load_sla_dataframe

# ── Constantes colonnes SLA ────────────────────────────────────────────────
COL_ANS_40 = "Contacts answered 40 seconds"
COL_ABD_40 = "Contacts abandoned 40 seconds"
COL_ANS_60 = "Contacts answered in 60 seconds"
COL_ABD_60 = "Contacts abandoned in 60 seconds"
COL_TF_BH  = "Timeframe BH"


class Command(BaseCommand):
    help = "Charge le fichier Excel du jour dans realtime_metrics"

    def add_arguments(self, parser):
        parser.add_argument(
            "--file", default=None,
            help="Chemin vers le fichier source (defaut: data/Historical Metrics Report .csv)"
        )
        parser.add_argument(
            "--mode", default="replace",
            choices=["replace", "append"],
            help="replace = efface le jour courant et recharge | append = ajoute"
        )

    def log(self, msg):
        self.stdout.write(f"[LOAD_TODAY] {msg}")

    # ── Helpers ───────────────────────────────────────────────────────────────
    @staticmethod
    def _num(series, default=0.0):
        return pd.to_numeric(series, errors="coerce").fillna(default)

    # ── Main ──────────────────────────────────────────────────────────────────
    @transaction.atomic
    def handle(self, *args, **options):
        BASE_DIR = Path(__file__).resolve().parents[4]
        data_dir = BASE_DIR / "data"
        custom_file = options.get("file")
        mode = options["mode"]

        # ── 1. Lire le fichier Excel ──────────────────────────────────────────
        xlsx_file = Path(custom_file) if custom_file else data_dir / "Telephony_Data.csv"
        sla_file  = data_dir / "SLA.xlsx"

        if not xlsx_file.exists():
            self.stderr.write(f"[ERREUR] Fichier introuvable : {xlsx_file}")
            return

        self.log(f"Lecture : {xlsx_file.name}")
        if str(xlsx_file).endswith(".csv"):
            df = pd.read_csv(xlsx_file, sep=";", dtype=str)
        else:
            df = pd.read_excel(xlsx_file, dtype=str)
        df.columns = df.columns.str.strip()

        # ── 2. Renommer les colonnes → noms internes ──────────────────────────
        COLUMN_MAP = {
            "Contacts queued":            "offered",
            "Contacts handled incoming":  "answered",
            "Contacts abandoned":         "abandoned",
            "Average handle time":        "avg_handle_time",
            "Average queue answer time":  "avg_answer_time",
            "Average hold time":          "avg_hold_time",
            "Average customer hold time": "avg_hold_time",
            "Callback contacts":          "callback_contacts",
        }
        df = df.rename(columns=COLUMN_MAP)

        # ── 3. Convertir les colonnes numeriques ──────────────────────────────
        numeric_cols = [
            "offered", "answered", "abandoned",
            "avg_handle_time", "avg_answer_time", "avg_hold_time",
            "callback_contacts", "Agent interaction time",
            COL_ANS_40, COL_ABD_40, COL_ANS_60, COL_ABD_60,
            "Service level 60 seconds", "Service level 120 seconds",
        ]
        for col in numeric_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(
                    df[col].astype(str).str.replace("%", "").str.replace(",", ".").str.strip(),
                    errors="coerce"
                ).fillna(0)

        # Service level % → 0.xx
        for col in ["Service level 60 seconds", "Service level 120 seconds"]:
            if col in df.columns:
                df[col] = df[col].where(df[col] <= 1, df[col] / 100.0)

        # ── 4. Extraire account / langue ──────────────────────────────────────
        df["account"]  = df["Queue"].apply(extract_account)
        df["language"] = df["Queue"].apply(extract_language)

        # ── 5. Merge SLA config ───────────────────────────────────────────────
        if sla_file.exists():
            df_sla = load_sla_dataframe(sla_file)
            df = df.merge(
                df_sla[["account", "target_ans_rate", "target_abd_rate", "timeframe_bh"]].rename(columns={
                    "target_ans_rate": "Target Ans rate",
                    "target_abd_rate": "Target Abd rate",
                    "timeframe_bh":    COL_TF_BH,
                }),
                on="account", how="left", validate="many_to_one"
            )

        self.log(f"{len(df)} lignes | {df['Queue'].nunique()} files | {df['account'].nunique()} comptes")

        # ── 6. Calculer les volumes et taux ───────────────────────────────────
        df["offered"]   = self._num(df.get("offered"))
        df["answered"]  = self._num(df.get("answered"))
        df["abandoned"] = self._num(df.get("abandoned"))

        # Fallback offered = answered + abandoned si 0
        mask = df["offered"] == 0
        df.loc[mask, "offered"] = df.loc[mask, "answered"] + df.loc[mask, "abandoned"]

        # SLA contacts
        if COL_ANS_40 in df.columns:
            df["ans_in_sla"] = self._num(df[COL_ANS_40])
        elif COL_ANS_60 in df.columns:
            df["ans_in_sla"] = self._num(df[COL_ANS_60])
        else:
            df["ans_in_sla"] = df["answered"]

        if COL_ABD_40 in df.columns:
            df["abd_in_sla"] = self._num(df[COL_ABD_40])
        elif COL_ABD_60 in df.columns:
            df["abd_in_sla"] = self._num(df[COL_ABD_60])
        else:
            df["abd_in_sla"] = 0.0

        # Out-of-SLA volumes
        df["ans_out_sla"] = (df["answered"]  - df["ans_in_sla"]).clip(lower=0).astype(int)
        df["abd_out_sla"] = (df["abandoned"] - df["abd_in_sla"]).clip(lower=0).astype(int)

        df["answer_rate"]  = df["answered"]  / df["offered"].replace(0, 1)
        df["abandon_rate"] = df["abandoned"] / df["offered"].replace(0, 1)

        denom = (df["offered"] - df["abd_in_sla"]).replace(0, 1)
        df["sla_rate"] = (df["ans_in_sla"] / denom).clip(0, 1)

        df["target_ans_rate"] = pd.to_numeric(df.get("Target Ans rate"), errors="coerce").fillna(0.0)
        df["target_abd_rate"] = pd.to_numeric(df.get("Target Abd rate"), errors="coerce").fillna(0.0)

        if COL_TF_BH in df.columns:
            df["timeframe_bh"] = pd.to_numeric(df[COL_TF_BH], errors="coerce").fillna(40).astype(int)
        else:
            df["timeframe_bh"] = 40

        df["sla_compliant"] = df["sla_rate"] >= df["target_ans_rate"]

        # ── 7. Charger le SLA map depuis la DB ────────────────────────────────
        sla_map = {s.account: s for s in SLAConfig.objects.all()}  # type: ignore

        # ── 8. Mode replace → supprimer les donnees du jour courant ──────────
        today = timezone.now().date()
        if mode == "replace":
            deleted, _ = RealtimeMetric.objects.filter(
                captured_at__date=today
            ).delete()
            self.log(f"Mode replace : {deleted} lignes supprimees pour aujourd'hui ({today})")

        # ── 9. Construire et inserer les objets ───────────────────────────────
        now = timezone.now()
        objects = []

        for _, row in df.iterrows():
            queue_name = str(row.get("Queue") or "").strip()
            account    = str(row.get("account") or "").strip()
            language   = str(row.get("language") or "").strip() or None

            if not queue_name or not account or account == "nan":
                continue

            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                start = pd.to_datetime(row.get("StartInterval"), errors="coerce", utc=True)
                captured_at = start.to_pydatetime() if not pd.isna(start) else now

            def _f(k, d=0.0):
                v = row.get(k, d)
                try:
                    return float(v) if not pd.isna(v) else d
                except (TypeError, ValueError):
                    return d

            def _i(k, d=0):
                v = row.get(k, d)
                try:
                    return int(v) if not pd.isna(v) else d
                except (TypeError, ValueError):
                    return d

            objects.append(RealtimeMetric(
                queue=queue_name,
                account=account,
                language=language,
                sla_config=sla_map.get(account),
                captured_at=captured_at,
                hour=captured_at.strftime("%H:%M"),
                day_of_week=captured_at.strftime("%A"),
                offered=_i("offered"),
                abandoned=_i("abandoned"),
                answered=_i("answered"),
                in_queue=0,
                agents_available=0,
                agents_busy=0,
                callback_contacts=_i("callback_contacts"),
                sla_rate=min(max(_f("sla_rate"), 0.0), 1.0),
                abandon_rate=min(max(_f("abandon_rate"), 0.0), 1.0),
                answer_rate=min(max(_f("answer_rate"), 0.0), 1.0),
                avg_handle_time=_f("avg_handle_time"),
                avg_answer_time=_f("avg_answer_time"),
                longest_wait_time=0.0,
                target_ans_rate=_f("target_ans_rate", 0.0),
                target_abd_rate=_f("target_abd_rate", 0.0),
                timeframe_bh=_i("timeframe_bh", 40),
                sla_compliant=bool(_f("sla_rate") >= _f("target_ans_rate", 0.0)),
                source="xlsx_manual",
            ))

        RealtimeMetric.objects.bulk_create(objects, batch_size=500)
        self.log(f"[OK] {len(objects)} lignes inserees dans realtime_metrics")
        self.stdout.write(self.style.SUCCESS(
            f"[LOAD_TODAY] [OK] Termine — {len(objects)} lignes chargees pour {today}"
        ))