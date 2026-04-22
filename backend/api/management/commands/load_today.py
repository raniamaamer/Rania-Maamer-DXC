import warnings
import pandas as pd
from pathlib import Path
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from api.models import RealtimeMetric, SLAConfig
from api.management.commands.run_etl import extract_account, extract_language, load_sla_dataframe

# ── Column name constants ──────────────────────────────────────────────────
COL_ANS_40 = "Contacts answered 40 seconds"
COL_ABD_40 = "Contacts abandoned 40 seconds"
COL_ANS_60 = "Contacts answered in 60 seconds"
COL_ABD_60 = "Contacts abandoned in 60 seconds"
COL_TF_BH  = "Timeframe BH"

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

NUMERIC_COLS = [
    "offered", "answered", "abandoned",
    "avg_handle_time", "avg_answer_time", "avg_hold_time",
    "callback_contacts", "Agent interaction time",
    COL_ANS_40, COL_ABD_40, COL_ANS_60, COL_ABD_60,
    "Service level 60 seconds", "Service level 120 seconds",
]

PERCENT_COLS = ["Service level 60 seconds", "Service level 120 seconds"]


class Command(BaseCommand):
    help = "Charge le fichier Excel du jour dans realtime_metrics"

    def add_arguments(self, parser):
        parser.add_argument(
            "--file", default=None,
            help="Chemin vers le fichier source (defaut: data/Historical Metrics Report .csv)",
        )
        parser.add_argument(
            "--mode", default="replace",
            choices=["replace", "append"],
            help="replace = efface le jour courant et recharge | append = ajoute",
        )

    def log(self, msg):
        self.stdout.write(f"[LOAD_TODAY] {msg}")

    @staticmethod
    def _to_numeric(series, default=0.0):
        return pd.to_numeric(series, errors="coerce").fillna(default)

    # ── Main ──────────────────────────────────────────────────────────────

    @transaction.atomic
    def handle(self, *args, **options):
        BASE_DIR = Path(__file__).resolve().parents[4]
        data_dir = BASE_DIR / "data"

        df = self._load_and_prepare(data_dir, options.get("file"))
        df = self._compute_metrics(df, data_dir)
        self._persist(df, options["mode"])

        self.stdout.write(self.style.SUCCESS(
            f"[LOAD_TODAY] [OK] Termine — {len(df)} lignes traitées pour {timezone.now().date()}"
        ))

    # ── Step 1 : Load & prepare ───────────────────────────────────────────

    def _load_and_prepare(self, data_dir: Path, custom_file) -> pd.DataFrame:
        """Read source file, rename columns, parse numerics, add account/language."""
        xlsx_file = Path(custom_file) if custom_file else data_dir / "Historical_Metrics_Report .csv"

        if not xlsx_file.exists():
            self.stderr.write(f"[ERREUR] Fichier introuvable : {xlsx_file}")
            raise FileNotFoundError(xlsx_file)

        self.log(f"Lecture : {xlsx_file.name}")
        df = self._read_source(xlsx_file)
        df = df.rename(columns=COLUMN_MAP)
        df = self._parse_numeric_columns(df)

        df["account"]  = df["Queue"].apply(extract_account)
        df["language"] = df["Queue"].apply(extract_language)
        self.log(f"{len(df)} lignes | {df['Queue'].nunique()} files | {df['account'].nunique()} comptes")
        return df

    @staticmethod
    def _read_source(path: Path) -> pd.DataFrame:
        if str(path).endswith(".csv"):
            df = pd.read_csv(path, sep=";", dtype=str)
        else:
            df = pd.read_excel(path, dtype=str)
        df.columns = df.columns.str.strip()
        return df

    def _parse_numeric_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        for col in NUMERIC_COLS:
            if col not in df.columns:
                continue
            series = df[col].astype(str).str.replace("%", "").str.replace(",", ".").str.strip()
            df[col] = pd.to_numeric(series, errors="coerce").fillna(0)

        for col in PERCENT_COLS:
            if col in df.columns:
                df[col] = df[col].where(df[col] <= 1, df[col] / 100.0)

        return df

    # ── Step 2 : Compute metrics ──────────────────────────────────────────

    def _compute_metrics(self, df: pd.DataFrame, data_dir: Path) -> pd.DataFrame:
        """Merge SLA config, compute volumes, rates, and compliance flag."""
        df = self._merge_sla_config(df, data_dir)
        df = self._compute_volumes(df)
        df = self._compute_rates(df)
        return df

    def _merge_sla_config(self, df: pd.DataFrame, data_dir: Path) -> pd.DataFrame:
        sla_file = data_dir / "SLA.xlsx"
        if not sla_file.exists():
            return df

        df_sla = load_sla_dataframe(sla_file)
        df = df.merge(
            df_sla[["account", "target_ans_rate", "target_abd_rate", "timeframe_bh"]].rename(columns={
                "target_ans_rate": "Target Ans rate",
                "target_abd_rate": "Target Abd rate",
                "timeframe_bh":    COL_TF_BH,
            }),
            on="account", how="left", validate="many_to_one",
        )
        return df

    def _compute_volumes(self, df: pd.DataFrame) -> pd.DataFrame:
        df["offered"]   = self._to_numeric(df.get("offered"))
        df["answered"]  = self._to_numeric(df.get("answered"))
        df["abandoned"] = self._to_numeric(df.get("abandoned"))

        # Fallback: offered = answered + abandoned if 0
        mask = df["offered"] == 0
        df.loc[mask, "offered"] = df.loc[mask, "answered"] + df.loc[mask, "abandoned"]

        df["ans_in_sla"] = self._pick_sla_col(df, COL_ANS_40, COL_ANS_60, fallback_col="answered")
        df["abd_in_sla"] = self._pick_sla_col(df, COL_ABD_40, COL_ABD_60, fallback_value=0.0)

        df["ans_out_sla"] = (df["answered"]  - df["ans_in_sla"]).clip(lower=0).astype(int)
        df["abd_out_sla"] = (df["abandoned"] - df["abd_in_sla"]).clip(lower=0).astype(int)
        return df

    def _pick_sla_col(self, df, primary_col, fallback_col, fallback_value=None, fallback_col2=None):
        """Return the first available SLA column, or a fallback series."""
        if primary_col in df.columns:
            return self._to_numeric(df[primary_col])
        if fallback_col in df.columns:
            return self._to_numeric(df[fallback_col])
        if fallback_value is not None:
            return pd.Series(fallback_value, index=df.index)
        return self._to_numeric(df.get(fallback_col2, pd.Series(dtype=float)))

    def _compute_rates(self, df: pd.DataFrame) -> pd.DataFrame:
        safe_offered = df["offered"].replace(0, 1)
        df["answer_rate"]  = df["answered"]  / safe_offered
        df["abandon_rate"] = df["abandoned"] / safe_offered

        denom      = (df["offered"] - df["abd_in_sla"]).replace(0, 1)
        df["sla_rate"] = (df["ans_in_sla"] / denom).clip(0, 1)

        df["target_ans_rate"] = pd.to_numeric(df.get("Target Ans rate"), errors="coerce").fillna(0.0)
        df["target_abd_rate"] = pd.to_numeric(df.get("Target Abd rate"), errors="coerce").fillna(0.0)
        df["timeframe_bh"]    = (
            pd.to_numeric(df[COL_TF_BH], errors="coerce").fillna(40).astype(int)
            if COL_TF_BH in df.columns else 40
        )
        df["sla_compliant"] = df["sla_rate"] >= df["target_ans_rate"]
        return df

    # ── Step 3 : Persist ──────────────────────────────────────────────────

    def _persist(self, df: pd.DataFrame, mode: str) -> None:
        sla_map = {s.account: s for s in SLAConfig.objects.all()}  # type: ignore
        today   = timezone.now().date()

        if mode == "replace":
            deleted, _ = RealtimeMetric.objects.filter(captured_at__date=today).delete()
            self.log(f"Mode replace : {deleted} lignes supprimées pour aujourd'hui ({today})")

        objects = self._build_objects(df, sla_map)
        RealtimeMetric.objects.bulk_create(objects, batch_size=500)
        self.log(f"[OK] {len(objects)} lignes insérées dans realtime_metrics")

    def _build_objects(self, df: pd.DataFrame, sla_map: dict) -> list:
        now     = timezone.now()
        objects = []

        for _, row in df.iterrows():
            obj = self._row_to_realtime_metric(row, sla_map, now)
            if obj is not None:
                objects.append(obj)

        return objects

    def _row_to_realtime_metric(self, row, sla_map: dict, now):
        queue_name = str(row.get("Queue") or "").strip()
        account    = str(row.get("account") or "").strip()
        language   = str(row.get("language") or "").strip() or None

        if not queue_name or not account or account == "nan":
            return None

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            start = pd.to_datetime(row.get("StartInterval"), errors="coerce", utc=True)
            captured_at = start.to_pydatetime() if not pd.isna(start) else now

        _f = lambda k, d=0.0: self._safe_float(row.get(k, d))
        _i = lambda k, d=0:   self._safe_int(row.get(k, d))

        sla_rate   = min(max(_f("sla_rate"),   0.0), 1.0)
        target_ans = _f("target_ans_rate", 0.0)

        return RealtimeMetric(
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
            sla_rate=sla_rate,
            abandon_rate=min(max(_f("abandon_rate"), 0.0), 1.0),
            answer_rate=min(max(_f("answer_rate"),  0.0), 1.0),
            avg_handle_time=_f("avg_handle_time"),
            avg_answer_time=_f("avg_answer_time"),
            longest_wait_time=0.0,
            target_ans_rate=target_ans,
            target_abd_rate=_f("target_abd_rate", 0.0),
            timeframe_bh=_i("timeframe_bh", 40),
            sla_compliant=sla_rate >= target_ans,
            source="xlsx_manual",
        )

    @staticmethod
    def _safe_float(v, default=0.0):
        try:
            f = float(v)
            return default if pd.isna(f) else f
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _safe_int(v, default=0):
        try:
            f = float(v)
            return default if pd.isna(f) else int(f)
        except (TypeError, ValueError):
            return default