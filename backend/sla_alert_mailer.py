"""
sla_alert_mailer.py — Alertes SLA automatiques par email
=========================================================
Intégration avec ml_auto_refresh.py (pipeline Prophet + Random Forest)

Usage :
  • Mode test     : python sla_alert_mailer.py --test
  • Mode pipeline : appelé automatiquement depuis run_pipeline()
  • Mode manuel   : python sla_alert_mailer.py --json outputs/ml_data.json

Config via variables d'environnement ou fichier .env :
  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD,
  ALERT_FROM, ALERT_TO, ALERT_CC (optionnel)
"""

import json
import logging
import os
import smtplib
import sys
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

# ── Optionnel : chargement .env ───────────────────────────────────────────────
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # python-dotenv non installé → variables d'env directement

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("sla_mailer")

# ══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ══════════════════════════════════════════════════════════════════════════════

class Config:
    """Lit la config depuis les variables d'environnement."""

    SMTP_HOST     = os.getenv("SMTP_HOST",     "smtp.gmail.com")
    SMTP_PORT     = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER     = os.getenv("SMTP_USER",     "")           # ex: servicedesk@servier.com
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")           # mot de passe ou App Password Gmail
    SMTP_USE_TLS  = os.getenv("SMTP_USE_TLS",  "true").lower() == "true"

    ALERT_FROM    = os.getenv("ALERT_FROM",    SMTP_USER)
    ALERT_TO      = os.getenv("ALERT_TO",      "")          # ex: manager@servier.com
    ALERT_CC      = os.getenv("ALERT_CC",      "")          # ex: team@servier.com (optionnel)
    MANAGER_NAME  = os.getenv("MANAGER_NAME",  "Équipe de direction")

    # ── Seuils d'alerte ───────────────────────────────────────────────────────
    SEUIL_SURVEILLANCE = float(os.getenv("SEUIL_SURVEILLANCE", "0.5"))   # %
    SEUIL_ALERTE       = float(os.getenv("SEUIL_ALERTE",       "2.0"))   # %
    SEUIL_CRITIQUE     = float(os.getenv("SEUIL_CRITIQUE",     "5.0"))   # %

    CI_SEUIL_ROUGE     = float(os.getenv("CI_SEUIL_ROUGE",    "8.0"))    # %
    CI_SEUIL_AMBER     = float(os.getenv("CI_SEUIL_AMBER",    "5.0"))    # %


# ══════════════════════════════════════════════════════════════════════════════
# ANALYSE DE SÉVÉRITÉ
# ══════════════════════════════════════════════════════════════════════════════

def get_severity(breach_rate: float, ci_breach: list) -> str:
    """
    Détermine la sévérité selon le taux global ET les CIs à risque.
    Retourne : 'low' | 'medium' | 'high'
    """
    has_critical_ci = any(c["rate"] >= Config.CI_SEUIL_ROUGE for c in ci_breach)

    if breach_rate >= Config.SEUIL_CRITIQUE or has_critical_ci:
        return "high"
    elif breach_rate >= Config.SEUIL_ALERTE:
        return "medium"
    elif breach_rate >= Config.SEUIL_SURVEILLANCE:
        return "low"
    else:
        return None  # pas d'alerte nécessaire


# ══════════════════════════════════════════════════════════════════════════════
# GÉNÉRATION DU CONTENU EMAIL (HTML + texte brut)
# ══════════════════════════════════════════════════════════════════════════════

def _severity_meta(severity: str) -> dict:
    return {
        "low": {
            "label":      "Surveillance SLA",
            "emoji":      "ℹ️",
            "color":      "#185FA5",
            "bg":         "#E6F1FB",
            "border":     "#378ADD",
            "intro":      "Le taux de rupture SLA global se situe dans une zone de surveillance. "
                          "Aucune action immédiate n'est requise, mais un suivi rapproché est conseillé.",
        },
        "medium": {
            "label":      "Alerte Modérée SLA",
            "emoji":      "⚠️",
            "color":      "#854F0B",
            "bg":         "#FAEEDA",
            "border":     "#BA7517",
            "intro":      "Le taux de rupture SLA global dépasse le seuil de vigilance. "
                          "Plusieurs CIs présentent des taux préoccupants nécessitant une attention prioritaire.",
        },
        "high": {
            "label":      "ALERTE CRITIQUE SLA",
            "emoji":      "🔴",
            "color":      "#791F1F",
            "bg":         "#FCEBEB",
            "border":     "#A32D2D",
            "intro":      "ALERTE CRITIQUE — Des CIs présentent des taux de rupture SLA élevés. "
                          "Une action corrective immédiate est requise.",
        },
    }[severity]


def _ci_color(rate: float) -> str:
    if rate >= Config.CI_SEUIL_ROUGE:
        return "#A32D2D"
    elif rate >= Config.CI_SEUIL_AMBER:
        return "#854F0B"
    return "#185FA5"


def _ci_badge_html(rate: float) -> str:
    color = _ci_color(rate)
    bg    = "#FCEBEB" if rate >= Config.CI_SEUIL_ROUGE else "#FAEEDA" if rate >= Config.CI_SEUIL_AMBER else "#E6F1FB"
    label = "CRITIQUE" if rate >= Config.CI_SEUIL_ROUGE else "ÉLEVÉ" if rate >= Config.CI_SEUIL_AMBER else "MODÉRÉ"
    return (f'<span style="background:{bg};color:{color};font-size:10px;font-weight:700;'
            f'padding:2px 8px;border-radius:4px;display:inline-block">{label}</span>')


def _recommendations_html(severity: str, data: dict) -> str:
    ci_breach  = data.get("ci_breach", [])
    top_cis    = [c["name"] for c in ci_breach[:3]]
    peak       = data.get("future_7", [{}])[0]
    peak_day   = peak.get("day", "Lundi")
    peak_vol   = peak.get("predicted", "?")
    top_feat   = (data.get("feature_imp") or [{}])[0]
    feat_name  = top_feat.get("feature", "Week-end")
    feat_pct   = top_feat.get("pct", 35.1)

    if severity == "low":
        items = [
            "Surveiller quotidiennement les indicateurs SLA des CIs listés",
            f"Vérifier les configurations de routage pour : <strong>{', '.join(top_cis)}</strong>",
            "Planifier une revue mensuelle des tendances avec l'équipe support",
            f"Anticiper le pic prévu le <strong>{peak_day}</strong> (~{peak_vol} tickets)",
        ]
    elif severity == "medium":
        items = [
            f"Déclencher une analyse de cause racine sur : <strong>{', '.join(top_cis)}</strong>",
            f"Renforcer le staffing le <strong>{peak_day}</strong> (pic prévu : <strong>{peak_vol} tickets</strong>)",
            "Réviser les règles d'escalade pour les CIs affichant >5% de rupture SLA",
            f"La variable <strong>{feat_name}</strong> ({feat_pct:.1f}% d'importance ML) est le facteur le plus prédictif — adapter les gardes en conséquence",
            "Mettre en place des alertes automatiques dès que le seuil de 5% est approché",
        ]
    else:
        items = [
            f"<strong>PRIORITÉ 1</strong> — Mobiliser l'équipe technique sur <strong>{top_cis[0] if top_cis else 'CIs critiques'}</strong> immédiatement",
            f"<strong>PRIORITÉ 2</strong> — Revoir la capacité de traitement avant <strong>{peak_day}</strong> ({peak_vol} tickets prévus)",
            "<strong>PRIORITÉ 3</strong> — Mettre en place un pont de crise pour tous les CIs dépassant 8%",
            "Rapport de remédiation attendu sous <strong>48h</strong>",
            "Escalade vers la direction si aucune amélioration mesurable sous <strong>5 jours ouvrés</strong>",
        ]

    html = "<ul style='margin:0;padding-left:20px;line-height:2'>"
    for item in items:
        html += f"<li style='margin-bottom:4px'>{item}</li>"
    html += "</ul>"
    return html


def build_html(data: dict, severity: str, manager_name: str) -> str:
    meta       = _severity_meta(severity)
    ci_breach  = data.get("ci_breach", [])
    dataset    = data.get("dataset", {})
    prophet    = data.get("prophet", {})
    rf         = data.get("random_forest", {})
    feature_imp = data.get("feature_imp", [])
    future_7   = data.get("future_7", [])
    today_str  = datetime.now().strftime("%A %d %B %Y")

    # CIs table rows
    ci_rows = ""
    for ci in ci_breach:
        color     = _ci_color(ci["rate"])
        badge_html = _ci_badge_html(ci["rate"])
        bar_width  = min(100, ci["rate"] / Config.CI_SEUIL_ROUGE * 100)
        bar_color  = color
        ci_rows += f"""
        <tr style="border-bottom:0.5px solid #E5E7EB">
          <td style="padding:8px 12px;font-weight:500;color:#1A1D2E">{ci["name"]}</td>
          <td style="padding:8px 12px;text-align:center">{ci["count"]}</td>
          <td style="padding:8px 12px">
            <div style="display:flex;align-items:center;gap:8px">
              <div style="flex:1;height:6px;background:#F1EFE8;border-radius:3px;overflow:hidden">
                <div style="height:100%;width:{bar_width:.0f}%;background:{bar_color};border-radius:3px"></div>
              </div>
              <span style="font-weight:700;color:{color};min-width:40px;text-align:right">{ci["rate"]:.1f}%</span>
            </div>
          </td>
          <td style="padding:8px 12px;text-align:center">{badge_html}</td>
        </tr>"""

    # Feature importance rows (top 5)
    fi_rows = ""
    for fi in feature_imp[:5]:
        fi_rows += f"""
        <tr style="border-bottom:0.5px solid #F1EFE8">
          <td style="padding:6px 12px;color:#6B7280;font-size:13px">{fi["feature"]}</td>
          <td style="padding:6px 12px">
            <div style="display:flex;align-items:center;gap:8px">
              <div style="flex:1;height:4px;background:#F1EFE8;border-radius:2px;overflow:hidden">
                <div style="height:100%;width:{fi["pct"]}%;background:#3B6AC8;border-radius:2px"></div>
              </div>
              <span style="font-size:12px;font-weight:700;color:#3B6AC8;min-width:36px">{fi["pct"]:.1f}%</span>
            </div>
          </td>
        </tr>"""

    # J+7 forecast cards
    forecast_cards = ""
    for d in future_7:
        is_high = d["predicted"] > 100
        is_low  = d["predicted"] < 40
        bg      = "#E6F1FB" if is_high else "#EAF3DE" if is_low else "#F7F9FC"
        color   = "#185FA5" if is_high else "#3B6D11" if is_low else "#1A1D2E"
        forecast_cards += f"""
        <td style="padding:4px">
          <div style="background:{bg};border-radius:8px;padding:10px 8px;text-align:center;min-width:70px">
            <div style="font-size:10px;font-weight:700;color:#6B7280;text-transform:uppercase;margin-bottom:4px">{d["day"]}</div>
            <div style="font-size:11px;color:#6B7280;margin-bottom:6px">{d["date"][5:]}</div>
            <div style="font-size:20px;font-weight:800;color:{color};line-height:1">{d["predicted"]}</div>
            <div style="font-size:9px;color:#6B7280;margin-top:4px">{d["lower"]}–{d["upper"]}</div>
          </div>
        </td>"""

    recos_html = _recommendations_html(severity, data)

    return f"""<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>[Service Desk] {meta["emoji"]} {meta["label"]}</title></head>
<body style="margin:0;padding:0;background:#F7F9FC;font-family:Arial,Helvetica,sans-serif;color:#1A1D2E">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F9FC;padding:24px 0">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #E5E7EB">

        <!-- HEADER -->
        <tr><td style="background:{meta['bg']};border-bottom:3px solid {meta['border']};padding:20px 28px">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <div style="font-size:11px;font-weight:700;color:{meta['color']};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">
                  DXC Tunisia · Service Desk Servier
                </div>
                <div style="font-size:20px;font-weight:700;color:{meta['color']}">{meta['emoji']} {meta['label']}</div>
                <div style="font-size:12px;color:{meta['color']};margin-top:4px;opacity:0.8">{today_str}</div>
              </td>
              <td align="right" style="vertical-align:top">
                <div style="background:{meta['border']};color:#fff;font-size:11px;font-weight:700;padding:6px 14px;border-radius:20px;white-space:nowrap">
                  AUC-ROC = {rf.get("auc_roc","?")} &nbsp;·&nbsp; MAE = {prophet.get("mae","?")} tickets/j
                </div>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- SALUTATION + INTRO -->
        <tr><td style="padding:24px 28px 0">
          <p style="margin:0 0 12px;font-size:15px">Bonjour <strong>{manager_name}</strong>,</p>
          <p style="margin:0;font-size:14px;line-height:1.7;color:#444">{meta['intro']}</p>
        </td></tr>

        <!-- KPIs -->
        <tr><td style="padding:20px 28px">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="25%" style="padding:4px">
                <div style="background:#F7F9FC;border:0.5px solid #E5E7EB;border-top:3px solid #3B6AC8;border-radius:8px;padding:12px;text-align:center">
                  <div style="font-size:10px;color:#6B7280;font-weight:700;text-transform:uppercase">Incidents total</div>
                  <div style="font-size:22px;font-weight:800;color:#3B6AC8;margin-top:4px">{dataset.get("total_incidents",0):,}</div>
                </div>
              </td>
              <td width="25%" style="padding:4px">
                <div style="background:{meta['bg']};border:0.5px solid {meta['border']};border-top:3px solid {meta['border']};border-radius:8px;padding:12px;text-align:center">
                  <div style="font-size:10px;color:{meta['color']};font-weight:700;text-transform:uppercase">Rupture SLA</div>
                  <div style="font-size:22px;font-weight:800;color:{meta['color']};margin-top:4px">{dataset.get("breach_rate_pct","?")}%</div>
                </div>
              </td>
              <td width="25%" style="padding:4px">
                <div style="background:#F7F9FC;border:0.5px solid #E5E7EB;border-top:3px solid #1A9E6E;border-radius:8px;padding:12px;text-align:center">
                  <div style="font-size:10px;color:#6B7280;font-weight:700;text-transform:uppercase">Moy. journalière</div>
                  <div style="font-size:22px;font-weight:800;color:#1A9E6E;margin-top:4px">{dataset.get("avg_daily_tickets","?")}</div>
                </div>
              </td>
              <td width="25%" style="padding:4px">
                <div style="background:#F7F9FC;border:0.5px solid #E5E7EB;border-top:3px solid #7B6FC8;border-radius:8px;padding:12px;text-align:center">
                  <div style="font-size:10px;color:#6B7280;font-weight:700;text-transform:uppercase">Incidents rompus</div>
                  <div style="font-size:22px;font-weight:800;color:#7B6FC8;margin-top:4px">{dataset.get("breach_count",0):,}</div>
                </div>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- CIs À RISQUE -->
        <tr><td style="padding:0 28px 20px">
          <div style="font-size:13px;font-weight:700;color:#E8845A;margin-bottom:10px">⚠️ Top CIs à risque de rupture SLA</div>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:0.5px solid #E5E7EB;border-radius:8px;overflow:hidden">
            <tr style="background:#F7F9FC">
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6B7280;font-weight:700;text-transform:uppercase">CI</th>
              <th style="padding:8px 12px;text-align:center;font-size:11px;color:#6B7280;font-weight:700;text-transform:uppercase">Incidents</th>
              <th style="padding:8px 12px;text-align:left;font-size:11px;color:#6B7280;font-weight:700;text-transform:uppercase">Taux rupture SLA</th>
              <th style="padding:8px 12px;text-align:center;font-size:11px;color:#6B7280;font-weight:700;text-transform:uppercase">Niveau</th>
            </tr>
            {ci_rows}
          </table>
          <div style="font-size:11px;color:#6B7280;margin-top:6px">
            Rouge &gt; {Config.CI_SEUIL_ROUGE}% &nbsp;·&nbsp; Amber &gt; {Config.CI_SEUIL_AMBER}% &nbsp;·&nbsp; Seuil global = {dataset.get("breach_rate_pct","?")}%
          </div>
        </td></tr>

        <!-- PRÉVISION J+7 -->
        <tr><td style="padding:0 28px 20px">
          <div style="font-size:13px;font-weight:700;color:#3B6AC8;margin-bottom:10px">📅 Prévision J+7 — Volume attendu (Prophet)</div>
          <table cellpadding="0" cellspacing="0"><tr>{forecast_cards}</tr></table>
          <div style="font-size:11px;color:#6B7280;margin-top:8px">
            Bleu foncé = pic prévu (&gt;100 tickets) · Vert = creux (&lt;40 tickets) · Intervalle de confiance 95%
          </div>
        </td></tr>

        <!-- FEATURE IMPORTANCE -->
        <tr><td style="padding:0 28px 20px">
          <div style="font-size:13px;font-weight:700;color:#3B6AC8;margin-bottom:10px">🧠 Variables prédictives — Random Forest (top 5)</div>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:0.5px solid #E5E7EB;border-radius:8px;overflow:hidden">
            {fi_rows}
          </table>
        </td></tr>

        <!-- RECOMMANDATIONS -->
        <tr><td style="padding:0 28px 20px">
          <div style="background:{meta['bg']};border-left:3px solid {meta['border']};border-radius:0 8px 8px 0;padding:16px 18px">
            <div style="font-size:13px;font-weight:700;color:{meta['color']};margin-bottom:10px">
              {"🚨 Actions immédiates requises" if severity == "high" else "✅ Recommandations"}
            </div>
            <div style="font-size:13px;color:{meta['color']};line-height:1.8">{recos_html}</div>
          </div>
        </td></tr>

        <!-- FOOTER -->
        <tr><td style="background:#F7F9FC;border-top:0.5px solid #E5E7EB;padding:16px 28px;text-align:center">
          <div style="font-size:11px;color:#6B7280;line-height:1.7">
            Rapport généré automatiquement le {today_str} par le pipeline ML Service Desk<br>
            <strong>Prophet (Meta) + Random Forest</strong> · {dataset.get("total_incidents",0):,} incidents · {dataset.get("date_min","?")} – {dataset.get("date_max","?")}<br>
            DXC Tunisia / Servier Service Desk — Ne pas répondre à cet email
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>"""


def build_plain(data: dict, severity: str, manager_name: str) -> str:
    """Version texte brut pour clients email sans HTML."""
    meta      = _severity_meta(severity)
    dataset   = data.get("dataset", {})
    prophet   = data.get("prophet", {})
    rf        = data.get("random_forest", {})
    ci_breach = data.get("ci_breach", [])
    future_7  = data.get("future_7", [])
    today_str = datetime.now().strftime("%A %d %B %Y")

    ci_lines = "\n".join(
        f"  • {c['name']:30s} {c['rate']:.1f}%  ({c['count']} incidents)"
        for c in ci_breach
    )
    fc_lines = "\n".join(
        f"  {d['day']:4s} {d['date'][5:]}  →  {d['predicted']:3d} tickets  [{d['lower']}–{d['upper']}]"
        for d in future_7
    )

    return f"""[{meta['emoji']}] {meta['label']} — Service Desk Servier
{today_str}
{'='*60}

Bonjour {manager_name},

{meta['intro']}

KPIs
  • Total incidents   : {dataset.get('total_incidents',0):,}
  • Rupture SLA       : {dataset.get('breach_rate_pct','?')}%  ({dataset.get('breach_count',0):,} incidents)
  • Moy. journalière  : {dataset.get('avg_daily_tickets','?')} tickets/j
  • AUC-ROC (RF)      : {rf.get('auc_roc','?')}
  • MAE (Prophet)     : {prophet.get('mae','?')} tickets/j

TOP CIs À RISQUE
{ci_lines or '  Aucun CI à risque identifié'}

PRÉVISION J+7
{fc_lines or '  Données non disponibles'}

Pour les recommandations détaillées, consulter la version HTML de cet email.

--
Pipeline ML Service Desk · DXC Tunisia / Servier
"""


# ══════════════════════════════════════════════════════════════════════════════
# ENVOI EMAIL
# ══════════════════════════════════════════════════════════════════════════════

def send_alert(data: dict, manager_name: str = None, dry_run: bool = False) -> bool:
    """
    Analyse les données ML, détermine la sévérité et envoie l'email si nécessaire.

    Args:
        data        : payload JSON issu de ml_auto_refresh.py
        manager_name: override du nom du manager (sinon Config.MANAGER_NAME)
        dry_run     : si True, affiche l'email sans l'envoyer

    Returns:
        True si email envoyé (ou dry_run OK), False sinon
    """
    manager_name = manager_name or Config.MANAGER_NAME
    breach_rate  = data.get("dataset", {}).get("breach_rate_pct", 0.0)
    ci_breach    = data.get("ci_breach", [])

    severity = get_severity(breach_rate, ci_breach)

    if severity is None:
        log.info(f"✅ Taux SLA {breach_rate}% sous les seuils — aucune alerte envoyée")
        return False

    meta    = _severity_meta(severity)
    subject = (f"{meta['emoji']} [Service Desk Servier] {meta['label']} — "
               f"{datetime.now().strftime('%d/%m/%Y')}")

    html_body  = build_html(data, severity, manager_name)
    plain_body = build_plain(data, severity, manager_name)

    if dry_run:
        log.info(f"[DRY RUN] Sévérité : {severity.upper()}")
        log.info(f"[DRY RUN] Sujet    : {subject}")
        log.info(f"[DRY RUN] Destinataire : {Config.ALERT_TO}")
        print("\n" + "="*60)
        print("APERÇU TEXTE BRUT :")
        print("="*60)
        print(plain_body)
        return True

    # ── Validation config ─────────────────────────────────────────────────────
    if not Config.SMTP_USER or not Config.SMTP_PASSWORD:
        log.error("❌ SMTP_USER ou SMTP_PASSWORD non configuré (variable d'environnement manquante)")
        return False
    if not Config.ALERT_TO:
        log.error("❌ ALERT_TO non configuré")
        return False

    # ── Construction du message MIME ─────────────────────────────────────────
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"Service Desk ML <{Config.ALERT_FROM}>"
    msg["To"]      = Config.ALERT_TO
    if Config.ALERT_CC:
        msg["Cc"]  = Config.ALERT_CC

    msg.attach(MIMEText(plain_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body,  "html",  "utf-8"))

    recipients = [Config.ALERT_TO]
    if Config.ALERT_CC:
        recipients += [r.strip() for r in Config.ALERT_CC.split(",") if r.strip()]

    # ── Envoi SMTP ────────────────────────────────────────────────────────────
    try:
        if Config.SMTP_USE_TLS:
            server = smtplib.SMTP(Config.SMTP_HOST, Config.SMTP_PORT, timeout=15)
            server.ehlo()
            server.starttls()
            server.ehlo()
        else:
            server = smtplib.SMTP_SSL(Config.SMTP_HOST, Config.SMTP_PORT, timeout=15)

        server.login(Config.SMTP_USER, Config.SMTP_PASSWORD)
        server.sendmail(Config.ALERT_FROM, recipients, msg.as_string())
        server.quit()

        log.info(f"✅ Email [{severity.upper()}] envoyé à {Config.ALERT_TO}  |  Sujet : {subject}")
        return True

    except smtplib.SMTPAuthenticationError:
        log.error("❌ Échec authentification SMTP — vérifiez SMTP_USER et SMTP_PASSWORD")
    except smtplib.SMTPConnectError as e:
        log.error(f"❌ Connexion SMTP impossible : {e}")
    except smtplib.SMTPException as e:
        log.error(f"❌ Erreur SMTP : {e}")
    except Exception as e:
        log.error(f"❌ Erreur inattendue : {e}")

    return False


# ══════════════════════════════════════════════════════════════════════════════
# INTÉGRATION DANS ml_auto_refresh.py
# ══════════════════════════════════════════════════════════════════════════════
#
# Dans run_pipeline(), après la ligne :
#   json_path.write_text(json.dumps(payload, ...))
#
# Ajouter :
#   from sla_alert_mailer import send_alert
#   send_alert(payload, manager_name="Sami Ben Ali")
#
# ══════════════════════════════════════════════════════════════════════════════


# ══════════════════════════════════════════════════════════════════════════════
# POINT D'ENTRÉE
# ══════════════════════════════════════════════════════════════════════════════

def main():
    import argparse
    parser = argparse.ArgumentParser(description="SLA Alert Mailer — DXC Tunisia / Servier")
    parser.add_argument("--json",    default="outputs/ml_data.json", help="Chemin vers ml_data.json")
    parser.add_argument("--manager", default=None,                   help="Nom du manager destinataire")
    parser.add_argument("--test",    action="store_true",            help="Mode dry-run (pas d'envoi réel)")
    parser.add_argument("--force",   action="store_true",            help="Envoyer même si sous les seuils")
    args = parser.parse_args()

    json_path = Path(args.json)
    if not json_path.exists():
        log.error(f"❌ Fichier introuvable : {json_path}")
        sys.exit(1)

    data = json.loads(json_path.read_text(encoding="utf-8"))
    log.info(f"📦 ml_data.json chargé — {data['dataset']['total_incidents']:,} incidents")
    log.info(f"   Rupture SLA : {data['dataset']['breach_rate_pct']}%")

    if args.force:
        # Forcer l'envoi en gonflant artificiellement le taux (test uniquement)
        data["dataset"]["breach_rate_pct"] = max(
            data["dataset"]["breach_rate_pct"],
            Config.SEUIL_SURVEILLANCE + 0.01
        )

    sent = send_alert(data, manager_name=args.manager, dry_run=args.test)
    sys.exit(0 if sent else 1)


if __name__ == "__main__":
    main()