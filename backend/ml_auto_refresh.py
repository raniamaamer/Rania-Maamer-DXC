import argparse
import json
import time
import warnings
from datetime import datetime
from pathlib import Path

warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")  # mode sans affichage (headless)
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import seaborn as sns
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, roc_auc_score, roc_curve, confusion_matrix, ConfusionMatrixDisplay
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from prophet import Prophet
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# ── Palette ────────────────────────────────────────────────────────────────────
ORANGE = "#FF6600"
BLUE   = "#0078D4"
RED    = "#DC3545"
GREEN  = "#28A745"
plt.rcParams["figure.figsize"] = (14, 6)
plt.rcParams["font.family"]    = "DejaVu Sans"


# ══════════════════════════════════════════════════════════════════════════════
# PIPELINE PRINCIPAL
# ══════════════════════════════════════════════════════════════════════════════

def run_pipeline(csv_path: Path, out_dir: Path) -> dict:
    """
    Exécute tout le pipeline ML et retourne un dict avec toutes les métriques.
    Appelé automatiquement à chaque modification du CSV.
    """
    print(f"\n{'═'*60}")
    print(f"  🔄  Pipeline démarré — {datetime.now().strftime('%H:%M:%S')}")
    print(f"  📂  CSV : {csv_path}")
    print(f"{'═'*60}")

    out_dir.mkdir(parents=True, exist_ok=True)

    # ── 1. Chargement & feature engineering ──────────────────────────────────
    df = _load_data(csv_path)
    print(f"  📊  {len(df):,} incidents chargés  |  "
          f"{df['taskslatable_has_breached'].mean()*100:.2f}% rupture SLA")

    # ── 2. Modèle Prophet ─────────────────────────────────────────────────────
    prophet_results = _train_prophet(df)
    print(f"  🔮  Prophet  →  MAE={prophet_results['mae']:.1f}  "
          f"RMSE={prophet_results['rmse']:.1f}  MAPE={prophet_results['mape']:.1f}%")

    # ── 3. Modèle Random Forest ───────────────────────────────────────────────
    rf_results = _train_rf(df)
    print(f"  🌲  Random Forest  →  AUC={rf_results['auc']:.3f}")

    # ── 4. Graphiques ─────────────────────────────────────────────────────────
    _plot_vue_globale(df, out_dir)
    _plot_prevision(prophet_results, out_dir)
    _plot_composantes(prophet_results, out_dir)
    _plot_classification(rf_results, out_dir)
    _plot_risques(df, out_dir)
    print("  🖼️   5 graphiques PNG générés")

    # ── 5. Export JSON pour le frontend React ─────────────────────────────────
    payload = _build_json_payload(df, prophet_results, rf_results)
    json_path = out_dir / "ml_data.json"
    json_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"  📦  JSON exporté → {json_path}")

    # ── Résumé console ────────────────────────────────────────────────────────
    _print_summary(df, prophet_results, rf_results)

    return payload


# ══════════════════════════════════════════════════════════════════════════════
# CHARGEMENT
# ══════════════════════════════════════════════════════════════════════════════

def _load_data(csv_path: Path) -> pd.DataFrame:
    df = pd.read_csv(csv_path)
    df["inc_opened_at"] = pd.to_datetime(df["inc_opened_at"], dayfirst=True, errors="coerce")
    df = df.dropna(subset=["inc_opened_at"])
    df["date"]        = df["inc_opened_at"].dt.date
    df["hour"]        = df["inc_opened_at"].dt.hour
    df["day_of_week"] = df["inc_opened_at"].dt.dayofweek
    df["day_name"]    = df["inc_opened_at"].dt.day_name()
    df["week"]        = df["inc_opened_at"].dt.isocalendar().week.astype(int)
    df["month"]       = df["inc_opened_at"].dt.month
    df["year"]        = df["inc_opened_at"].dt.year
    df["is_weekend"]  = (df["day_of_week"] >= 5).astype(int)
    df["inc_cmdb_ci"] = df["inc_cmdb_ci"].fillna("Unknown")
    df["inc_u_escalation_reason"] = df.get(
        "inc_u_escalation_reason", pd.Series("No Escalation", index=df.index)
    ).fillna("No Escalation")
    # S'assurer que la cible est numérique
    df["taskslatable_has_breached"] = pd.to_numeric(
        df["taskslatable_has_breached"], errors="coerce"
    ).fillna(0).astype(int)
    return df


# ══════════════════════════════════════════════════════════════════════════════
# PROPHET
# ══════════════════════════════════════════════════════════════════════════════

def _train_prophet(df: pd.DataFrame) -> dict:
    daily = df.groupby("date").size().reset_index(name="y")
    daily.columns = ["ds", "y"]
    daily["ds"] = pd.to_datetime(daily["ds"])

    cutoff = daily["ds"].max() - pd.Timedelta(days=30)
    train  = daily[daily["ds"] <= cutoff]
    test   = daily[daily["ds"] >  cutoff]

    model = Prophet(
        yearly_seasonality=True,
        weekly_seasonality=True,
        daily_seasonality=False,
        changepoint_prior_scale=0.05,
        seasonality_prior_scale=10,
        interval_width=0.95,
    )
    model.add_seasonality(name="monthly", period=30.5, fourier_order=5)
    model.fit(train)

    future   = model.make_future_dataframe(periods=37)
    forecast = model.predict(future)

    # Évaluation
    test_fc = forecast[forecast["ds"].isin(test["ds"])][["ds", "yhat", "yhat_lower", "yhat_upper"]]
    merged  = test.merge(test_fc, on="ds")
    merged["yhat"] = merged["yhat"].clip(lower=0)

    mae  = float(np.mean(np.abs(merged["y"] - merged["yhat"])))
    rmse = float(np.sqrt(np.mean((merged["y"] - merged["yhat"]) ** 2)))
    mape = float(np.mean(np.abs((merged["y"] - merged["yhat"]) / merged["y"].clip(lower=1))) * 100)

    # Prévision J+7
    future_7 = forecast[forecast["ds"] > daily["ds"].max()].head(7).copy()
    future_7["yhat"]       = future_7["yhat"].clip(lower=0)
    future_7["yhat_lower"] = future_7["yhat_lower"].clip(lower=0)

    return {
        "mae": mae, "rmse": rmse, "mape": mape,
        "model": model,
        "forecast": forecast,
        "daily": daily,
        "test_merged": merged,
        "future_7": future_7,
    }


# ══════════════════════════════════════════════════════════════════════════════
# RANDOM FOREST
# ══════════════════════════════════════════════════════════════════════════════

def _train_rf(df: pd.DataFrame) -> dict:
    df_ml = df.copy()

    le_ci    = LabelEncoder()
    le_group = LabelEncoder()
    le_esc   = LabelEncoder()

    df_ml["ci_encoded"]    = le_ci.fit_transform(df_ml["inc_cmdb_ci"])
    df_ml["group_encoded"] = le_group.fit_transform(df_ml["inc_assignment_group"])
    df_ml["esc_encoded"]   = le_esc.fit_transform(df_ml["inc_u_escalation_reason"])

    daily_vol = df_ml.groupby("date").size().reset_index(name="daily_volume")
    df_ml = df_ml.merge(daily_vol, on="date", how="left")

    ci_breach_rate = df_ml.groupby("inc_cmdb_ci")["taskslatable_has_breached"].mean()
    df_ml["ci_breach_rate"] = df_ml["inc_cmdb_ci"].map(ci_breach_rate)

    FEATURES = [
        "ci_encoded", "group_encoded", "esc_encoded",
        "hour", "day_of_week", "month", "is_weekend",
        "daily_volume", "ci_breach_rate",
    ]
    FEATURE_LABELS = [
        "Taux rupture CI (historique)", "Volume journalier", "Raison escalade",
        "Groupe assignation", "Type CI (encodé)", "Heure ouverture",
        "Mois", "Jour de semaine", "Week-end",
    ]

    X = df_ml[FEATURES]
    y = df_ml["taskslatable_has_breached"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    rf = RandomForestClassifier(
        n_estimators=200,
        max_depth=10,
        min_samples_leaf=5,
        max_features="sqrt",
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )
    rf.fit(X_train, y_train)

    y_pred  = rf.predict(X_test)
    y_proba = rf.predict_proba(X_test)[:, 1]
    auc     = float(roc_auc_score(y_test, y_proba))
    fpr, tpr, _ = roc_curve(y_test, y_proba)

    importances = pd.Series(rf.feature_importances_, index=FEATURE_LABELS).sort_values(ascending=True)

    # CIs les plus à risque
    breach_analysis = df.groupby("inc_cmdb_ci").agg(
        total=("inc_number", "count"),
        breached=("taskslatable_has_breached", "sum"),
    ).reset_index()
    breach_analysis["breach_rate"] = breach_analysis["breached"] / breach_analysis["total"] * 100
    breach_analysis = breach_analysis[breach_analysis["total"] >= 20]
    top_risk = breach_analysis.nlargest(15, "breach_rate")

    return {
        "auc": auc, "fpr": fpr, "tpr": tpr,
        "y_test": y_test, "y_pred": y_pred,
        "importances": importances,
        "report": classification_report(y_test, y_pred, target_names=["Non-rupture", "Rupture SLA"]),
        "top_risk": top_risk,
        "df_ml": df_ml,
    }


# ══════════════════════════════════════════════════════════════════════════════
# GRAPHIQUES
# ══════════════════════════════════════════════════════════════════════════════

def _plot_vue_globale(df: pd.DataFrame, out: Path):
    fig, axes = plt.subplots(2, 3, figsize=(18, 10))
    fig.suptitle("Vue Globale — Incidents Service Desk Servier", fontsize=16, fontweight="bold", color=BLUE)

    daily = df.groupby("date").size().reset_index(name="count")
    daily["date"] = pd.to_datetime(daily["date"])
    axes[0,0].fill_between(daily["date"], daily["count"], alpha=0.4, color=BLUE)
    axes[0,0].plot(daily["date"], daily["count"], color=BLUE, linewidth=1)
    axes[0,0].axhline(daily["count"].mean(), color=ORANGE, linestyle="--",
                      label=f"Moyenne : {daily['count'].mean():.0f}/j")
    axes[0,0].set_title("Volume Quotidien des Incidents")
    axes[0,0].legend()
    axes[0,0].xaxis.set_major_formatter(mdates.DateFormatter("%b %Y"))
    plt.setp(axes[0,0].xaxis.get_majorticklabels(), rotation=45)

    order = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]
    day_counts = df.groupby("day_name").size().reindex([d for d in order if d in df["day_name"].unique()])
    colors_bar = [RED if d in ["Saturday","Sunday"] else BLUE for d in day_counts.index]
    axes[0,1].bar(day_counts.index, day_counts.values, color=colors_bar, edgecolor="white")
    axes[0,1].set_title("Volume par Jour de la Semaine")
    axes[0,1].set_xticklabels(day_counts.index, rotation=45)

    hour_counts = df.groupby("hour").size()
    axes[0,2].bar(hour_counts.index, hour_counts.values, color=ORANGE, edgecolor="white")
    axes[0,2].set_title("Distribution Horaire")
    axes[0,2].set_xlabel("Heure")

    top_ci = df["inc_cmdb_ci"].value_counts().head(10)
    axes[1,0].barh(top_ci.index[::-1], top_ci.values[::-1], color=BLUE)
    axes[1,0].set_title("Top 10 CIs")

    grp = df["inc_assignment_group"].value_counts()
    axes[1,1].pie(grp.values, labels=grp.index, autopct="%1.1f%%", colors=[BLUE, ORANGE, GREEN])
    axes[1,1].set_title("Répartition par Groupe")

    breach_ci = df.groupby("inc_cmdb_ci")["taskslatable_has_breached"].agg(["sum","count"])
    breach_ci["rate"] = breach_ci["sum"] / breach_ci["count"] * 100
    breach_ci = breach_ci[breach_ci["count"] >= 20].nlargest(10, "rate")
    axes[1,2].barh(breach_ci.index[::-1], breach_ci["rate"][::-1], color=RED)
    axes[1,2].set_title("Taux Rupture SLA par CI (min 20 incidents)")
    axes[1,2].set_xlabel("Taux (%)")

    plt.tight_layout()
    plt.savefig(out / "01_vue_globale.png", dpi=150, bbox_inches="tight")
    plt.close()


def _plot_prevision(pr: dict, out: Path):
    fig, axes = plt.subplots(2, 1, figsize=(16, 12))

    m = pr["test_merged"]
    axes[0].fill_between(m["ds"], m["yhat_lower"].clip(0), m["yhat_upper"],
                         alpha=0.2, color=ORANGE, label="Intervalle 95%")
    axes[0].plot(m["ds"], m["yhat"], color=ORANGE, linewidth=2.5,
                 label=f"Prévision Prophet (MAE={pr['mae']:.1f})", marker="o", markersize=4)
    axes[0].plot(m["ds"], m["y"], color=BLUE, linewidth=2.5,
                 label="Réel", marker="s", markersize=4)
    axes[0].set_title("Réel vs Prévisionnel — 30 derniers jours (période de test)",
                      fontsize=14, fontweight="bold")
    axes[0].legend(fontsize=12)
    axes[0].set_ylabel("Nombre de tickets")
    axes[0].grid(True, alpha=0.3)
    axes[0].xaxis.set_major_formatter(mdates.DateFormatter("%d/%m"))

    f7 = pr["future_7"]
    colors_f = [RED if d.weekday() >= 5 else BLUE for d in f7["ds"]]
    bars = axes[1].bar(f7["ds"].dt.strftime("%a %d/%m"), f7["yhat"].clip(0),
                       color=colors_f, edgecolor="white", linewidth=1.5)
    axes[1].errorbar(range(len(f7)), f7["yhat"].clip(0),
                     yerr=[f7["yhat"].clip(0) - f7["yhat_lower"].clip(0),
                           f7["yhat_upper"] - f7["yhat"].clip(0)],
                     fmt="none", color="black", capsize=5)
    for bar, val in zip(bars, f7["yhat"].clip(0)):
        axes[1].text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 1,
                     f"{val:.0f}", ha="center", va="bottom", fontweight="bold")
    axes[1].set_title("🔮 Prévision J+7 — Volume de tickets attendu",
                      fontsize=14, fontweight="bold")
    axes[1].set_ylabel("Nombre de tickets prévu")
    axes[1].set_xlabel("Jour")
    axes[1].legend(handles=[
        plt.Rectangle((0,0),1,1,color=BLUE, label="Jour ouvré"),
        plt.Rectangle((0,0),1,1,color=RED,  label="Week-end"),
    ])
    axes[1].grid(True, alpha=0.3, axis="y")

    plt.tight_layout()
    plt.savefig(out / "02_prevision_prophet.png", dpi=150, bbox_inches="tight")
    plt.close()


def _plot_composantes(pr: dict, out: Path):
    fig = pr["model"].plot_components(pr["forecast"])
    plt.suptitle("Composantes Prophet — Tendance & Saisonnalités",
                 fontsize=14, fontweight="bold")
    plt.tight_layout()
    plt.savefig(out / "03_composantes_prophet.png", dpi=150, bbox_inches="tight")
    plt.close()


def _plot_classification(rf: dict, out: Path):
    fig, axes = plt.subplots(1, 3, figsize=(20, 6))
    fig.suptitle("Modèle de Classification SLA — Random Forest",
                 fontsize=15, fontweight="bold", color=BLUE)

    cm = confusion_matrix(rf["y_test"], rf["y_pred"])
    ConfusionMatrixDisplay(cm, display_labels=["Non-rupture","Rupture SLA"]).plot(
        ax=axes[0], cmap="Blues", colorbar=False)
    axes[0].set_title("Matrice de Confusion", fontweight="bold")

    axes[1].plot(rf["fpr"], rf["tpr"], color=ORANGE, linewidth=2.5,
                 label=f"AUC = {rf['auc']:.3f}")
    axes[1].plot([0,1],[0,1], "k--", linewidth=1, label="Aléatoire")
    axes[1].fill_between(rf["fpr"], rf["tpr"], alpha=0.1, color=ORANGE)
    axes[1].set_xlabel("Faux Positifs (FPR)")
    axes[1].set_ylabel("Vrais Positifs (TPR)")
    axes[1].set_title("Courbe ROC", fontweight="bold")
    axes[1].legend(fontsize=12)
    axes[1].grid(True, alpha=0.3)

    imp = rf["importances"]
    colors_imp = [ORANGE if v == imp.max() else BLUE for v in imp.values]
    axes[2].barh(imp.index, imp.values, color=colors_imp)
    axes[2].set_title("Importance des Variables", fontweight="bold")
    axes[2].set_xlabel("Importance")
    for i, (idx, val) in enumerate(imp.items()):
        axes[2].text(val + 0.002, i, f"{val:.3f}", va="center", fontsize=9)

    plt.tight_layout()
    plt.savefig(out / "04_classification_sla.png", dpi=150, bbox_inches="tight")
    plt.close()


def _plot_risques(df: pd.DataFrame, out: Path):
    breach = df.groupby("inc_cmdb_ci").agg(
        total=("inc_number","count"),
        breached=("taskslatable_has_breached","sum"),
    ).reset_index()
    breach["breach_rate"] = breach["breached"] / breach["total"] * 100
    top_risk = breach[breach["total"] >= 20].nlargest(15, "breach_rate")

    fig, axes = plt.subplots(1, 2, figsize=(18, 7))
    fig.suptitle("Analyse des Risques SLA par CI et Groupe",
                 fontsize=15, fontweight="bold", color=BLUE)

    colors_r = [RED if r > 5 else ORANGE if r > 2 else BLUE for r in top_risk["breach_rate"]]
    bars = axes[0].barh(top_risk["inc_cmdb_ci"][::-1], top_risk["breach_rate"][::-1],
                        color=colors_r[::-1])
    axes[0].set_xlabel("Taux de Rupture SLA (%)")
    axes[0].set_title("Top 15 CIs — Taux de Rupture SLA\n(min. 20 incidents)", fontweight="bold")
    global_rate = df["taskslatable_has_breached"].mean() * 100
    axes[0].axvline(x=global_rate, color="black", linestyle="--", linewidth=1.5,
                    label=f"Moyenne globale ({global_rate:.2f}%)")
    axes[0].legend()
    for bar, val, total in zip(bars[::-1], top_risk["breach_rate"], top_risk["total"]):
        axes[0].text(bar.get_width() + 0.05, bar.get_y() + bar.get_height() / 2,
                     f"{val:.1f}% ({total} inc.)", va="center", fontsize=8)

    pivot = df.groupby(["day_of_week","hour"])["taskslatable_has_breached"].mean().unstack(fill_value=0) * 100
    pivot.index = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"][:len(pivot)]
    sns.heatmap(pivot, ax=axes[1], cmap="YlOrRd", fmt=".1f",
                cbar_kws={"label": "Taux Rupture SLA (%)"}, linewidths=0.5)
    axes[1].set_title("Heatmap Rupture SLA — Heure × Jour", fontweight="bold")
    axes[1].set_xlabel("Heure")
    axes[1].set_ylabel("Jour")

    plt.tight_layout()
    plt.savefig(out / "05_analyse_risques.png", dpi=150, bbox_inches="tight")
    plt.close()


# ══════════════════════════════════════════════════════════════════════════════
# JSON EXPORT (pour le frontend React / Predictions.jsx)
# ══════════════════════════════════════════════════════════════════════════════

def _build_json_payload(df: pd.DataFrame, pr: dict, rf: dict) -> dict:
    """
    Construit le JSON ml_data.json que le frontend peut importer
    directement pour remplacer les constantes hardcodées.
    """

    # Prévision J+7
    f7 = pr["future_7"]
    future_7 = [
        {
            "date": row["ds"].strftime("%Y-%m-%d"),
            "day":  row["ds"].strftime("%a"),
            "predicted": int(round(row["yhat"])),
            "lower":     max(0, int(round(row["yhat_lower"]))),
            "upper":     int(round(row["yhat_upper"])),
        }
        for _, row in f7.iterrows()
    ]

    # Historique 30j
    hist_30 = [
        {
            "date":      row["ds"].strftime("%d/%m"),
            "actual":    int(row["y"]),
            "predicted": int(round(row["yhat"])),
        }
        for _, row in pr["test_merged"].iterrows()
    ]

    # Top CIs à risque
    ci_breach = [
        {
            "name":  row["inc_cmdb_ci"],
            "rate":  round(float(row["breach_rate"]), 2),
            "count": int(row["total"]),
        }
        for _, row in rf["top_risk"].head(10).iterrows()
    ]

    # Feature importance
    imp = rf["importances"]
    feature_imp = [
        {"feature": feat, "pct": round(float(val) * 100, 1)}
        for feat, val in zip(imp.index[::-1], imp.values[::-1])
    ]

    return {
        "generated_at":   datetime.now().isoformat(),
        "dataset": {
            "total_incidents":   len(df),
            "date_min":          str(df["inc_opened_at"].min().date()),
            "date_max":          str(df["inc_opened_at"].max().date()),
            "breach_rate_pct":   round(df["taskslatable_has_breached"].mean() * 100, 2),
            "breach_count":      int(df["taskslatable_has_breached"].sum()),
            "avg_daily_tickets": round(df.groupby("date").size().mean(), 1),
        },
        "prophet": {
            "mae":  round(pr["mae"], 1),
            "rmse": round(pr["rmse"], 1),
            "mape": round(pr["mape"], 1),
        },
        "random_forest": {
            "auc_roc": round(rf["auc"], 3),
        },
        "future_7":    future_7,
        "hist_30":     hist_30,
        "ci_breach":   ci_breach,
        "feature_imp": feature_imp,
    }


# ══════════════════════════════════════════════════════════════════════════════
# RÉSUMÉ CONSOLE
# ══════════════════════════════════════════════════════════════════════════════

def _print_summary(df, pr, rf):
    print(f"\n{'═'*60}")
    print("  RÉSUMÉ EXÉCUTIF")
    print(f"{'═'*60}")
    print(f"  📊 Incidents    : {len(df):,}")
    print(f"  🚨 Rupture SLA  : {df['taskslatable_has_breached'].mean()*100:.2f}%")
    print(f"  🔮 Prophet MAE  : {pr['mae']:.1f} tickets/jour")
    print(f"  🌲 RF AUC-ROC   : {rf['auc']:.3f}")
    print(f"\n  📅 Prévision J+7 :")
    for _, row in pr["future_7"].iterrows():
        flag = "🔴" if row["ds"].weekday() >= 5 else "🟢"
        print(f"     {flag} {row['ds'].strftime('%A %d/%m'):20s} : "
              f"{max(0,row['yhat']):5.0f} tickets  "
              f"[{max(0,row['yhat_lower']):.0f} – {row['yhat_upper']:.0f}]")
    print(f"\n  ⚠️  Top 5 CIs à risque :")
    for _, row in rf["top_risk"].head(5).iterrows():
        print(f"     • {row['inc_cmdb_ci']:30s} : {row['breach_rate']:.1f}% ({row['total']} inc.)")
    print(f"{'═'*60}\n")


# ══════════════════════════════════════════════════════════════════════════════
# WATCHDOG — surveillance du fichier CSV
# ══════════════════════════════════════════════════════════════════════════════

class CSVChangeHandler(FileSystemEventHandler):
    def __init__(self, csv_path: Path, out_dir: Path):
        self.csv_path = csv_path
        self.out_dir  = out_dir
        self._last_run = 0.0  # anti-double-trigger

    def on_modified(self, event):
        if Path(event.src_path).resolve() != self.csv_path.resolve():
            return
        now = time.time()
        if now - self._last_run < 5:  # debounce 5 secondes
            return
        self._last_run = now
        print(f"\n  📝  CSV modifié détecté → relance du pipeline...")
        try:
            run_pipeline(self.csv_path, self.out_dir)
        except Exception as e:
            print(f"  ❌  Erreur pipeline : {e}")


# ══════════════════════════════════════════════════════════════════════════════
# POINT D'ENTRÉE
# ══════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="ML Auto-Refresh — Servier Service Desk")
    parser.add_argument(
        "--csv", default="../data/incident_sla.csv",
        help="Chemin vers incident_sla.csv"
    )
    parser.add_argument(
        "--out", default="./outputs",
        help="Dossier de sortie pour les PNG et le JSON"
    )
    parser.add_argument(
        "--once", action="store_true",
        help="Exécuter une seule fois sans surveillance (mode CI/CD)"
    )
    args = parser.parse_args()

    csv_path = Path(args.csv).resolve()
    out_dir  = Path(args.out).resolve()

    if not csv_path.exists():
        print(f"❌  Fichier introuvable : {csv_path}")
        return

    # Premier run immédiat
    run_pipeline(csv_path, out_dir)

    if args.once:
        print("  ✅  Mode --once : terminé.")
        return

    # Mode surveillance continue
    print(f"\n  👁️   Surveillance active sur : {csv_path}")
    print("  Modifie le CSV pour déclencher une nouvelle analyse.")
    print("  Ctrl+C pour arrêter.\n")

    handler  = CSVChangeHandler(csv_path, out_dir)
    observer = Observer()
    observer.schedule(handler, str(csv_path.parent), recursive=False)
    observer.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
        print("\n  🛑  Surveillance arrêtée.")
    observer.join()


if __name__ == "__main__":
    main()