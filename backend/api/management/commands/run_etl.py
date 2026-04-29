import warnings
import pandas as pd
import numpy as np
from pathlib import Path
from django.core.management.base import BaseCommand
from django.db import transaction
from api.models import (
    HistoricalMetric, AccountSummary, SLAConfig,
    HourlyTrend, DailySnapshot,
)


# ── Constantes colonnes SLA ────────────────────────────────────────────────
COL_TARGET_ANS_RATE = "Target Ans rate"
COL_TARGET_ABD_RATE = "Target Abd rate"
COL_TIMEFRAME_BH    = "Timeframe BH"
COL_TIMEFRAME_OOH   = "Timeframe OOH"
COL_ANS_RATE        = "Ans Rate"
COL_ABD_RATE        = "Abd Rate"
COL_ANS_SLA         = "Ans SLA"
COL_ABD_SLA         = "Abd SLA"
COL_ABD_60          = "Contacts abandoned in 60 seconds"
COL_API_CONTACTS    = "API contacts handled"

# ── Constantes formules SLA ────────────────────────────────────────────────
FORMULA_ANS_SLA1 = "(Ans in SLA /(offered-Abd in SLA))"
FORMULA_ABD_SLA2 = "(Abd out SLA/(offered-Abd in SLA))"
FORMULA_ANS_SLA3 = "(1-Ans out SLA/(offered-Abd in 60))"
FORMULA_ABD_SLA5 = "(1-abd out 60 sec/(Offered-Abd in SLA))"
FORMULA_ABD_SLA1 = "1-(Abd out SLA / Offered)"

# ── Constante Basrah (doit être avant ACCOUNT_KEYWORDS) ───────────────────
ACCOUNT_BASRAH_GAS_EN = "Basrah Gas EN"

# ── Mapping queue → account ────────────────────────────────────────────────
ACCOUNT_KEYWORDS = {
    "viatris":        "Viatris",
    "nissan":         "Nissan",
    "renault":        "Renault",
    "rn_":            "Renault",
    "nestle":         "Nestle",
    "philips":        "Philips",
    "xpo":            "XPO",
    "servier":        "Servier",
    "sonova":         "Sonova",
    "sony":           "Sony",
    "gf":             "GF",
    "connectchat_gf": "GF",
    "benelux":        "Benelux",
    "el store":       "Luxottica",
    "mylan":          "Viatris",
    "spm":            "Saipem",
    "basrah":         ACCOUNT_BASRAH_GAS_EN,
    "german_queue":   "GF",
    "datwayler":      "Datwayler",
}

# ── Constantes noms de comptes ─────────────────────────────────────────────
ACCOUNT_RENAULT_FR          = "Renault FR"
ACCOUNT_RENAULT_SP          = "Renault SP"
ACCOUNT_RENAULT_UK          = "Renault UK"
ACCOUNT_RENAULT_UK_DEALERS  = "Renault UK Dealers"
ACCOUNT_NESTLE_DE           = "Nestle DE"
ACCOUNT_NESTLE_ES           = "Nestle ES"
ACCOUNT_NESTLE_FR           = "Nestle FR"
ACCOUNT_NESTLE_NL           = "Nestle NL"
ACCOUNT_NESTLE_POR          = "Nestle Por"
ACCOUNT_SONY_SP             = "Sony SP"
ACCOUNT_SERVIER_EN          = "Servier English"
ACCOUNT_SERVIER_FR          = "Servier French"
ACCOUNT_SERVIER_FR_PWD      = "Servier French Password"
ACCOUNT_SERVIER_SP          = "Servier Spanish"
ACCOUNT_NISSAN_DU           = "Nissan DU"
ACCOUNT_NISSAN_FR           = "Nissan FR"
ACCOUNT_NISSAN_IT           = "Nissan IT"
ACCOUNT_NISSAN_NMEF         = "Nissan NMEF"
ACCOUNT_NISSAN_SP           = "Nissan SP"
ACCOUNT_GF_GERMAN           = "GF German"
ACCOUNT_GF_ITALIAN          = "GF Italian"
ACCOUNT_SONOVA_DU           = "Sonova DU"
ACCOUNT_SONOVA_ENG          = "Sonova Eng"
ACCOUNT_SONOVA_FR           = "Sonova FR"
ACCOUNT_SONOVA_GER          = "Sonova Ger"
ACCOUNT_SONOVA_IT           = "Sonova IT"
ACCOUNT_SONOVA_POR          = "Sonova Por"
ACCOUNT_SONOVA_SP           = "Sonova SP"
ACCOUNT_XPO_ES              = "XPO ES"
ACCOUNT_XPO_FR              = "XPO FR"

DESK_TO_QUEUES = {
    "Viatris ARABIC": ["Mylan ARABIC"],
    "Viatris Russia": ["Mylan Russia"],
    "Viatris Turkey": ["Mylan Turkey"],
    "Viatris DU":    ["Viatris - Dutch"],
    "viatris FR":    ["Viatris - French"],
    "viatris Ger":   ["Viatris - German"],
    "viatris HU":    ["Viatris - Hungarian"],
    "viatris IT":    ["Viatris - Italian"],
    "viatris Pol":   ["Viatris - Polish"],
    "viatris Por":   ["Viatris - Portuguese"],
    "viatris SP":    ["Viatris - Spanish"],
    "Benelux DU":         ["Benelux_Dutch_Queue"],
    "Benelux ENG":        ["Benelux_ENG_Queue"],
    "Benelux FR":         ["Benelux_French_Queue"],
    "CH_AT_FR":           ["RN_CH_AT_FR"],
    "CH_AT_GER":          ["RN_CH_AT_GER"],
    "Ren German":         ["German_Queue"],
    "Renault Eng":        ["RN_GSD_Eng_Queue"],
    ACCOUNT_RENAULT_FR:   ["RN_Ligne_Rouge VIP", "RN_Importeurs", "Renault_Catalogue_Opt7_Q",
                           "Renault_bureautique_Opt5_Q", "Renault_industriels_Opt2_Q",
                           "Renault_ivr_Appl_metier_Q", "Renault_materiel_Opt4_Q",
                           "Renault_p_ivr_pwd_Tel_srv_1.2_Q", "Renault_pda_palm_Opt3_Q",
                           "Renault_select_Opt0_Q"],
    ACCOUNT_RENAULT_SP:         ["RN_Spain_Normal_Queue", "RN_Spain_VIP_Queue"],
    ACCOUNT_RENAULT_UK:         [ACCOUNT_RENAULT_UK],
    ACCOUNT_RENAULT_UK_DEALERS: [ACCOUNT_RENAULT_UK_DEALERS],
    ACCOUNT_NESTLE_DE:  ["Nestle DE CBA", "Nestle DE Other", "Nestle DE PW", "Nestle DE Status"],
    ACCOUNT_NESTLE_ES:  ["Nestle ES CBA", "Nestle ES Other", "Nestle ES PW", "Nestle ES Status"],
    ACCOUNT_NESTLE_FR:  ["Nestle FR CBA", "Nestle FR Other", "Nestle FR PW", "Nestle FR Status"],
    ACCOUNT_NESTLE_NL:  ["Nestle NL Other", "Nestle NL PW"],
    ACCOUNT_NESTLE_POR: ["Nestle PT CBA", "Nestle PT NB", "Nestle PT Other", "Nestle PT PW", "Nestle PT Status"],
    ACCOUNT_SONY_SP: ["Sony Spanish Existing Issues", "Sony Spanish New Issues"],
    "Luxottica ARB": ["EL Store ARB"],
    "Luxottica EN":  ["EL Store EN"],
    "Luxottica FR":  ["EL Store FR"],
    "Luxottica DE":  ["EL Store DE"],
    "Luxottica IT":  ["EL Store IT"],
    "Luxottica PT":  ["EL Store PT"],
    "Luxottica ES":  ["EL Store ES"],
    "Luxottica TR":  ["EL Store TR"],
    ACCOUNT_SERVIER_EN:     [ACCOUNT_SERVIER_EN],
    ACCOUNT_SERVIER_FR:     [ACCOUNT_SERVIER_FR],
    ACCOUNT_SERVIER_FR_PWD: ["Servier French Password"],
    ACCOUNT_SERVIER_SP:     ["Servier Spanish"],
    ACCOUNT_NISSAN_DU:   ["Nissan DU OF 2", "Nissan DU SHFL 1", "Nissan DU SHFL 2",
                          "Nissan DLR DU Opt 1", "Nissan DLR DU Opt 2"],
    ACCOUNT_NISSAN_FR:   ["Nissan FR App", "Nissan FR Existing", "Nissan FR HW",
                          "Nissan FR Other", "Nissan FR PW"],
    "Nissan Ger":        ["Nissan DE"],
    ACCOUNT_NISSAN_IT:   ["Nissan IT App", "Nissan IT Existing", "Nissan IT HW", "Nissan IT Other",
                          "Nissan IT PW", "Nissan DLR IT Existing", "Nissan DLR IT New"],
    ACCOUNT_NISSAN_NMEF: ["Nissan NMEF - Hardware Issue", "Nissan NMEF - Other", "Nissan NMEF - Password"],
    ACCOUNT_NISSAN_SP:   ["Nissan SP OF Existing", "Nissan SP OF New", "Nissan SP SHFL Existing",
                          "Nissan SP SHFL New", "Nissan DLR SP Existing", "Nissan DLR SP New"],
    ACCOUNT_GF_GERMAN:   [ACCOUNT_GF_GERMAN, "GF German CBA", "German_Queue"],
    ACCOUNT_GF_ITALIAN:  [ACCOUNT_GF_ITALIAN, "GF Italian CBA"],
    "GF Chat Ger": ["ConnectChat_GF_German"],
    "GF Chat ITA": ["ConnectChat_GF_Italian"],
    "Saipem FR":     ["SPM FR QUEUE"],
    "Saipem IT":     ["SPM IT QUEUE"],
    "Saipem ITMyHR": ["SPM It MyHR QUEUE"],
    ACCOUNT_SONOVA_DU:  ["Sonova_Dutch_Other", "Sonova_Dutch_Shop"],
    ACCOUNT_SONOVA_ENG: ["Sonova_English_Other", "Sonova_English_Shop", "Sonova_Priority"],
    ACCOUNT_SONOVA_FR:  ["Sonova_French_Other", "Sonova_French_Shop"],
    ACCOUNT_SONOVA_GER: ["Sonova_German_Other", "Sonova_German_Shop"],
    ACCOUNT_SONOVA_IT:  ["Sonova_Italy_Other", "Sonova_Italy_Shop"],
    ACCOUNT_SONOVA_POR: ["Sonova_Portuguese_Other", "Sonova_Portuguese_Shop"],
    ACCOUNT_SONOVA_SP:  ["Sonova_Spanish_Other", "Sonova_Mexico_Other", "Sonova_Mexico_Shop"],
    ACCOUNT_XPO_ES: ["XPO ES All Other Issues", "XPO ES Default", "XPO ES MFA Password"],
    ACCOUNT_XPO_FR: ["XPO FR All Other Issues", "XPO FR Default", "XPO FR Default OOH",
                     "XPO FR MFA Password", "XPO FR MFA Password OOH"],
    ACCOUNT_BASRAH_GAS_EN: [ACCOUNT_BASRAH_GAS_EN],
}

ANS_COL_BY_TF = {
    20: "Contacts answered in 20 seconds",
    30: "Contacts answered in 30 seconds",
    40: "Contacts answered 40 seconds",
    45: "Contacts answered in 45 seconds",
    60: "Contacts answered in 60 seconds",
    90: "Contacts answered in 90 seconds",
}
ABD_COL_BY_TF = {
    20: "Contacts abandoned in 20 seconds",
    30: "Contacts abandoned in 30 seconds",
    40: "Contacts abandoned 40 seconds",
    45: "Contacts abandoned in 45 seconds",
    60: COL_ABD_60,
    90: "Contacts abandoned in 90 seconds",
}

# ── SLA / ABD account keyword sets ────────────────────────────────────────
SLA3_ACC = {'luxottica'}
SLA2_ACC = {'gf', 'dxc it', 'dxc', 'hpe', 'saipem'}
ABD5_ACC = {'luxottica'}
ABD4_ACC = {'saipem', 'sonova', 'servier'}
ABD3_ACC = {'gf'}
ABD2_ACC = {'mylan', 'viatris', 'xpo', 'dxc', 'hpe', 'spm', 'basrah', 'philips', 'sony'}
ABD1_ACC = {'renault', 'nissan', 'benelux'}

# ── Queue CSV → desk dashboard mapping ────────────────────────────────────
QUEUE_TO_DESK = {
    "EL Store ARB": "Luxottica ARB", "EL Store EN": "Luxottica EN",
    "EL Store FR":  "Luxottica FR",  "EL Store DE": "Luxottica DE",
    "EL Store IT":  "Luxottica IT",  "EL Store PT": "Luxottica PT",
    "EL Store ES":  "Luxottica ES",  "EL Store TR": "Luxottica TR",
    "Mylan ARABIC":        "Viatris ARABIC",  "Mylan Russia":        "Viatris Russia",
    "Mylan Turkey":        "Viatris Turkey",  "Viatris - Dutch":     "Viatris DU",
    "Viatris - French":    "viatris FR",    "Viatris - German":    "viatris Ger",
    "Viatris - Hungarian": "viatris HU",    "Viatris - Italian":   "viatris IT",
    "Viatris - Polish":    "viatris Pol",   "Viatris - Portuguese":"viatris Por",
    "Viatris - Spanish":   "viatris SP",
    "Benelux_Dutch_Queue":             "Benelux DU",
    "Benelux_ENG_Queue":               "Benelux ENG",
    "Benelux_French_Queue":            "Benelux FR",
    "RN_CH_AT_FR":                     "CH_AT_FR",
    "RN_CH_AT_GER":                    "CH_AT_GER",
    "German_Queue":                    "Ren German",
    "RN_GSD_Eng_Queue":                "Renault Eng",
    "RN_Ligne_Rouge VIP":              ACCOUNT_RENAULT_FR,
    "RN_Importeurs":                   ACCOUNT_RENAULT_FR,
    "Renault_Catalogue_Opt7_Q":        ACCOUNT_RENAULT_FR,
    "Renault_bureautique_Opt5_Q":      ACCOUNT_RENAULT_FR,
    "Renault_industriels_Opt2_Q":      ACCOUNT_RENAULT_FR,
    "Renault_ivr_Appl_metier_Q":       ACCOUNT_RENAULT_FR,
    "Renault_materiel_Opt4_Q":         ACCOUNT_RENAULT_FR,
    "Renault_p_ivr_pwd_Tel_srv_1.2_Q": ACCOUNT_RENAULT_FR,
    "Renault_pda_palm_Opt3_Q":         ACCOUNT_RENAULT_FR,
    "Renault_select_Opt0_Q":           ACCOUNT_RENAULT_FR,
    "RN_Spain_Normal_Queue":           ACCOUNT_RENAULT_SP,
    "RN_Spain_VIP_Queue":              ACCOUNT_RENAULT_SP,
    ACCOUNT_RENAULT_UK:                ACCOUNT_RENAULT_UK,
    ACCOUNT_RENAULT_UK_DEALERS:        ACCOUNT_RENAULT_UK_DEALERS,
    "Nestle DE CBA":    ACCOUNT_NESTLE_DE,  "Nestle DE Other":  ACCOUNT_NESTLE_DE,
    "Nestle DE PW":     ACCOUNT_NESTLE_DE,  "Nestle DE Status": ACCOUNT_NESTLE_DE,
    "Nestle ES CBA":    ACCOUNT_NESTLE_ES,  "Nestle ES Other":  ACCOUNT_NESTLE_ES,
    "Nestle ES PW":     ACCOUNT_NESTLE_ES,  "Nestle ES Status": ACCOUNT_NESTLE_ES,
    "Nestle FR CBA":    ACCOUNT_NESTLE_FR,  "Nestle FR Other":  ACCOUNT_NESTLE_FR,
    "Nestle FR PW":     ACCOUNT_NESTLE_FR,  "Nestle FR Status": ACCOUNT_NESTLE_FR,
    "Nestle NL Other":  ACCOUNT_NESTLE_NL,  "Nestle NL PW":     ACCOUNT_NESTLE_NL,
    "Nestle PT CBA":    ACCOUNT_NESTLE_POR, "Nestle PT NB":     ACCOUNT_NESTLE_POR,
    "Nestle PT Other":  ACCOUNT_NESTLE_POR, "Nestle PT PW":     ACCOUNT_NESTLE_POR,
    "Nestle PT Status": ACCOUNT_NESTLE_POR,
    "Sony Spanish Existing Issues": ACCOUNT_SONY_SP,
    "Sony Spanish New Issues":      ACCOUNT_SONY_SP,
    ACCOUNT_SERVIER_EN:         ACCOUNT_SERVIER_EN,
    ACCOUNT_SERVIER_FR:         ACCOUNT_SERVIER_FR,
    ACCOUNT_SERVIER_FR_PWD:     ACCOUNT_SERVIER_FR_PWD,
    ACCOUNT_SERVIER_SP:         ACCOUNT_SERVIER_SP,
    "Nissan DU OF 2":          ACCOUNT_NISSAN_DU,  "Nissan DU SHFL 1":        ACCOUNT_NISSAN_DU,
    "Nissan DU SHFL 2":        ACCOUNT_NISSAN_DU,  "Nissan DLR DU Opt 1":     ACCOUNT_NISSAN_DU,
    "Nissan DLR DU Opt 2":     ACCOUNT_NISSAN_DU,
    "Nissan FR App":           ACCOUNT_NISSAN_FR,  "Nissan FR Existing":      ACCOUNT_NISSAN_FR,
    "Nissan FR HW":            ACCOUNT_NISSAN_FR,  "Nissan FR Other":         ACCOUNT_NISSAN_FR,
    "Nissan FR PW":            ACCOUNT_NISSAN_FR,
    "Nissan DE":               "Nissan Ger",
    "Nissan IT App":           ACCOUNT_NISSAN_IT,  "Nissan IT Existing":      ACCOUNT_NISSAN_IT,
    "Nissan IT HW":            ACCOUNT_NISSAN_IT,  "Nissan IT Other":         ACCOUNT_NISSAN_IT,
    "Nissan IT PW":            ACCOUNT_NISSAN_IT,
    "Nissan DLR IT Existing":  ACCOUNT_NISSAN_IT,  "Nissan DLR IT New":       ACCOUNT_NISSAN_IT,
    "Nissan NMEF - Hardware Issue": ACCOUNT_NISSAN_NMEF,
    "Nissan NMEF - Other":          ACCOUNT_NISSAN_NMEF,
    "Nissan NMEF - Password":       ACCOUNT_NISSAN_NMEF,
    "Nissan SP OF Existing":   ACCOUNT_NISSAN_SP,  "Nissan SP OF New":        ACCOUNT_NISSAN_SP,
    "Nissan SP SHFL Existing": ACCOUNT_NISSAN_SP,  "Nissan SP SHFL New":      ACCOUNT_NISSAN_SP,
    "Nissan DLR SP Existing":  ACCOUNT_NISSAN_SP,  "Nissan DLR SP New":       ACCOUNT_NISSAN_SP,
    "GF German":              ACCOUNT_GF_GERMAN,   "GF German CBA":          ACCOUNT_GF_GERMAN,
    ACCOUNT_GF_ITALIAN:       ACCOUNT_GF_ITALIAN,  "GF Italian CBA":         ACCOUNT_GF_ITALIAN,
    "ConnectChat_GF_German":  "GF Chat Ger", "ConnectChat_GF_Italian": "GF Chat ITA",
    "SPM FR QUEUE":      "Saipem FR",   "SPM IT QUEUE":      "Saipem IT",
    "SPM It MyHR QUEUE": "Saipem ITMyHR",
    "Sonova_Dutch_Other":      ACCOUNT_SONOVA_DU,  "Sonova_Dutch_Shop":       ACCOUNT_SONOVA_DU,
    "Sonova_English_Other":    ACCOUNT_SONOVA_ENG, "Sonova_English_Shop":     ACCOUNT_SONOVA_ENG,
    "Sonova_Priority":         ACCOUNT_SONOVA_ENG,
    "Sonova_French_Other":     ACCOUNT_SONOVA_FR,  "Sonova_French_Shop":      ACCOUNT_SONOVA_FR,
    "Sonova_German_Other":     ACCOUNT_SONOVA_GER, "Sonova_German_Shop":      ACCOUNT_SONOVA_GER,
    "Sonova_Italy_Other":      ACCOUNT_SONOVA_IT,  "Sonova_Italy_Shop":       ACCOUNT_SONOVA_IT,
    "Sonova_Portuguese_Other": ACCOUNT_SONOVA_POR, "Sonova_Portuguese_Shop":  ACCOUNT_SONOVA_POR,
    "Sonova_Spanish_Other":    ACCOUNT_SONOVA_SP,  "Sonova_Mexico_Other":     ACCOUNT_SONOVA_SP,
    "Sonova_Mexico_Shop":      ACCOUNT_SONOVA_SP,
    "XPO ES All Other Issues": ACCOUNT_XPO_ES, "XPO ES Default":          ACCOUNT_XPO_ES,
    "XPO ES MFA Password":     ACCOUNT_XPO_ES,
    "XPO FR All Other Issues": ACCOUNT_XPO_FR, "XPO FR Default":          ACCOUNT_XPO_FR,
    "XPO FR Default OOH":      ACCOUNT_XPO_FR, "XPO FR MFA Password":     ACCOUNT_XPO_FR,
    "XPO FR MFA Password OOH": ACCOUNT_XPO_FR,
    ACCOUNT_BASRAH_GAS_EN: ACCOUNT_BASRAH_GAS_EN,
}


# ── Shared scalar helpers ──────────────────────────────────────────────────
def _safe_float(v, default=0.0):
    try:
        r = float(v)
        return default if pd.isna(r) else r
    except Exception:
        return default


def _safe_int(v, default=0):
    try:
        f = float(v)
        return default if pd.isna(f) else int(f)
    except Exception:
        return default


def extract_account(queue_name: str) -> str:
    q = queue_name.lower()
    for kw, acc in ACCOUNT_KEYWORDS.items():
        if q.startswith(kw) or f" {kw}" in q or f"_{kw}" in q:
            return acc
    return queue_name.split()[0].split("_")[0]


def extract_language(queue_name: str) -> str:
    q = queue_name.strip().lower()
    EXACT = {
        "el store arb": "ar", "el store en": "en", "el store fr": "fr", "el store de": "de",
        "el store es": "es", "el store it": "it", "el store pt": "pt", "el store tr": "tr",
        "viatris arabic": "ar", "viatris russia": "ru", "viatris turkey": "tr", "german_queue": "de",
        "xpo es default": "es", "xpo es all other issues": "es", "xpo es mfa password": "es",
        "renault uk": "en", "renault uk dealers": "en",
        "spm fr queue": "fr", "spm it queue": "it", "spm it myhr queue": "it",
        "rn_ligne_rouge vip": "fr", "rn_importeurs": "pt", "rn_ch_at_fr": "fr", "rn_ch_at_ger": "de",
        "rn_gsd_eng_queue": "en", "rn_spain_normal_queue": "es", "rn_spain_vip_queue": "es",
        "nissan nmef - other": "en", "nissan nmef - password": "en", "sonova_priority": "en",
        "renault_catalogue_opt7_q": "fr", "renault_bureautique_opt5_q": "fr",
        "renault_industriels_opt2_q": "fr", "renault_ivr_appl_metier_q": "fr",
        "renault_materiel_opt4_q": "fr", "renault_p_ivr_pwd_tel_srv_1.2_q": "fr",
        "renault_pda_palm_opt3_q": "fr", "renault_select_opt0_q": "fr",
        "nestle de cba": "de", "nestle de other": "de", "nestle de pw": "de", "nestle de status": "de",
        "nestle es cba": "es", "nestle es other": "es", "nestle es pw": "es", "nestle es status": "es",
        "nestle fr cba": "fr", "nestle fr other": "fr", "nestle fr pw": "fr", "nestle fr status": "fr",
        "nestle nl other": "nl", "nestle nl pw": "nl",
        "nestle pt cba": "pt", "nestle pt nb": "pt", "nestle pt other": "pt",
        "nestle pt pw": "pt", "nestle pt status": "pt",
        "nissan de": "de",
        "nissan du of 2": "nl", "nissan du shfl 1": "nl", "nissan du shfl 2": "nl",
        "nissan dlr du opt 1": "nl", "nissan dlr du opt 2": "nl",
        "nissan fr app": "fr", "nissan fr existing": "fr", "nissan fr hw": "fr",
        "nissan fr other": "fr", "nissan fr pw": "fr",
        "nissan it app": "it", "nissan it existing": "it", "nissan it hw": "it",
        "nissan it other": "it", "nissan it pw": "it",
        "nissan dlr it existing": "it", "nissan dlr it new": "it",
        "nissan nmef - hardware issue": "en",
        "nissan sp of existing": "es", "nissan sp of new": "es",
        "nissan sp shfl existing": "es", "nissan sp shfl new": "es",
        "nissan dlr sp existing": "es", "nissan dlr sp new": "es",
        "basrah gas en": "en",
    }
    if q in EXACT:
        return EXACT[q]
    patterns = [
        ("arabic", "ar"), ("arb", "ar"), ("french", "fr"), ("- french", "fr"),
        ("german", "de"), ("deutsch", "de"), ("italian", "it"), ("italy", "it"),
        ("spanish", "es"), ("spain", "es"), ("dutch", "nl"), ("english", "en"),
        ("portuguese", "pt"), ("turkish", "tr"), ("turkey", "tr"),
        ("russian", "ru"), ("russia", "ru"), ("polish", "pl"), ("hungarian", "hu"),
        ("mexico", "es-mx"), ("mexican", "es-mx"),
        ("_fr_", "fr"), ("_fr", "fr"), ("_ger", "de"), ("_de_", "de"), ("_de", "de"),
        ("_it_", "it"), ("_it", "it"), ("_sp_", "es"), ("_sp", "es"), ("_es_", "es"), ("_es", "es"),
        ("_nl_", "nl"), ("_nl", "nl"), ("_du_", "nl"), ("_du", "nl"),
        ("_eng_", "en"), ("_eng", "en"), ("_en_", "en"), ("_en", "en"),
        ("_pt_", "pt"), ("_pt", "pt"), ("_tr_", "tr"), ("_tr", "tr"),
        (" de ", "de"), (" de", "de"), (" fr ", "fr"), (" fr", "fr"),
        (" it ", "it"), (" it", "it"), (" sp ", "es"), (" sp", "es"),
        (" es ", "es"), (" es", "es"), (" nl ", "nl"), (" nl", "nl"),
        (" du ", "nl"), (" du", "nl"), (" en ", "en"), (" en", "en"),
        (" pt ", "pt"), (" pt", "pt"), (" tr ", "tr"), (" tr", "tr"), (" ger", "de"),
    ]
    for pat, lang in patterns:
        if pat in q:
            return lang
    return ""


def sec_to_mmss(s) -> str:
    try:
        s = int(round(float(s)))
        return f"{s // 60:02d}:{s % 60:02d}"
    except Exception:
        return "00:00"


def load_sla_queue_level(sla_file: Path) -> pd.DataFrame:
    df = pd.read_excel(sla_file, sheet_name="Sheet1")
    df.columns = df.columns.str.strip()

    def clean_target(val):
        if pd.isna(val):
            return None
        s = str(val).strip().upper()
        if s in ("NA", "N/A", "", "30 SEC", "ASA"):
            return None
        try:
            n = float(s.replace("%", "").replace(",", "."))
            return n / 100 if n > 1 else n
        except Exception:
            return None

    df["target_ans_rate"] = df[COL_TARGET_ANS_RATE].apply(clean_target)
    df["target_abd_rate"] = df[COL_TARGET_ABD_RATE].apply(clean_target)
    df["timeframe_bh"]    = pd.to_numeric(df[COL_TIMEFRAME_BH],  errors="coerce").fillna(40).astype(int)
    df["timeframe_ooh"]   = pd.to_numeric(df[COL_TIMEFRAME_OOH], errors="coerce").fillna(df["timeframe_bh"]).astype(int)
    df["queue_name_norm"] = df["Queue name"].str.strip().str.lower()
    df = df.drop_duplicates(subset=["queue_name_norm"], keep="first")
    return df[["queue_name_norm", "account", "target_ans_rate", "target_abd_rate",
               "timeframe_bh", "timeframe_ooh"]]


def load_sla_dataframe_raw(sla_file: Path) -> pd.DataFrame:
    df = pd.read_excel(sla_file)
    df.columns = df.columns.str.strip()
    NRM = {"nestlé": "Nestle", "nestle": "Nestle"}
    df["account"] = df["account"].apply(
        lambda v: NRM.get(str(v).strip().lower(), str(v).strip()) if pd.notna(v) else None
    )
    df = df[df["account"].notna() & (df["account"] != "nan")].copy()

    def ct(val):
        if pd.isna(val):
            return None
        s = str(val).strip().upper()
        if s in ("NA", "N/A", "", "30 SEC", "ASA"):
            return None
        try:
            n = float(s.replace("%", "").replace(",", "."))
            return n / 100 if n > 1 else n
        except Exception:
            return None

    def ctf(val, d=40):
        if pd.isna(val):
            return d
        try:
            return int(float(str(val).replace('"', '').replace("sec", "").strip()))
        except Exception:
            return d

    def ci(val, d=0):
        try:
            f = float(val)
            return d if pd.isna(f) else int(f)
        except Exception:
            return d

    df["target_ans_rate"]  = df[COL_TARGET_ANS_RATE].apply(ct)
    df["target_abd_rate"]  = df[COL_TARGET_ABD_RATE].apply(ct)
    df["timeframe_bh"]     = df[COL_TIMEFRAME_BH].apply(ctf)
    df["ooh"]              = df["OOH"].apply(lambda v: ci(v, 0))
    df["ans_rate_formula"] = df.get(COL_ANS_RATE, pd.Series(dtype=str))
    df["abd_rate_formula"] = df.get(COL_ABD_RATE, pd.Series(dtype=str))
    df["ans_sla"]          = df.get(COL_ANS_SLA,  pd.Series(dtype=str))
    df["abd_sla"]          = df.get(COL_ABD_SLA,  pd.Series(dtype=str))
    base = df[["account", "target_ans_rate", "target_abd_rate", "timeframe_bh", "ooh",
               "ans_sla", "abd_sla", "ans_rate_formula", "abd_rate_formula"]]
    extra = pd.DataFrame([
        {"account": "Viatris",   "target_ans_rate": 0.80, "target_abd_rate": 0.05,
         "timeframe_bh": 60, "ooh": 60, "ans_sla": "SLA1", "abd_sla": "Abd2",
         "ans_rate_formula": FORMULA_ANS_SLA1, "abd_rate_formula": FORMULA_ABD_SLA2},
        {"account": "Benelux",   "target_ans_rate": 0.90, "target_abd_rate": 0.95,
         "timeframe_bh": 40, "ooh": 40, "ans_sla": "SLA1", "abd_sla": "Abd1",
         "ans_rate_formula": FORMULA_ANS_SLA1, "abd_rate_formula": FORMULA_ABD_SLA1},
        {"account": "Luxottica", "target_ans_rate": 0.90, "target_abd_rate": 0.95,
         "timeframe_bh": 30, "ooh": 30, "ans_sla": "SLA3", "abd_sla": "Abd5",
         "ans_rate_formula": FORMULA_ANS_SLA3, "abd_rate_formula": FORMULA_ABD_SLA5},
    ])
    return pd.concat([base, extra], ignore_index=True)


def load_sla_dataframe(sla_file: Path) -> pd.DataFrame:
    df = pd.read_excel(sla_file)
    df.columns = df.columns.str.strip()
    NRM = {
        "datwayler (voice)": "Datwayler", "datwayler(chat)": "Datwayler",
        "datwayler (chat)":  "Datwayler", "nestlé": "Nestle", "nestle": "Nestle",
    }
    df["account"] = df["account"].apply(
        lambda v: NRM.get(str(v).strip().lower(), str(v).strip()) if pd.notna(v) else None
    )
    df = df[df["account"].notna() & (df["account"] != "nan")].copy()

    def ct(val, d=None):
        if pd.isna(val):
            return None
        s = str(val).strip().upper()
        if s in ("NA", "N/A", "", "30 SEC", "ASA"):
            return None
        try:
            n = float(s.replace("%", "").replace(",", "."))
            return n / 100 if n > 1 else n
        except Exception:
            return None

    def ctf(val, d=40):
        if pd.isna(val):
            return d
        try:
            return int(float(str(val).replace('"', '').replace("sec", "").strip()))
        except Exception:
            return d

    df["_ta"]  = df[COL_TARGET_ANS_RATE].apply(ct)
    df["_td"]  = df[COL_TARGET_ABD_RATE].apply(ct)
    df["_tf"]  = df[COL_TIMEFRAME_BH].apply(ctf)
    df["_ooh"] = df["OOH"].apply(lambda v: int(float(v)) if pd.notna(v) else 0)
    for col in [COL_ANS_RATE, COL_ABD_RATE, COL_ANS_SLA, COL_ABD_SLA]:
        if col not in df.columns:
            df[col] = None
    extra = pd.DataFrame([
        {"account": "Viatris",   "_ta": 0.80, "_td": 0.05, "_tf": 60, "_ooh": 60,
         COL_ANS_RATE: FORMULA_ANS_SLA1, COL_ABD_RATE: FORMULA_ABD_SLA2,
         COL_ANS_SLA: "SLA1", COL_ABD_SLA: "Abd2"},
        {"account": "Benelux",   "_ta": 0.90, "_td": 0.95, "_tf": 40, "_ooh": 40,
         COL_ANS_RATE: FORMULA_ANS_SLA1, COL_ABD_RATE: FORMULA_ABD_SLA1,
         COL_ANS_SLA: "SLA1", COL_ABD_SLA: "Abd1"},
        {"account": "Luxottica", "_ta": 0.90, "_td": 0.95, "_tf": 30, "_ooh": 30,
         COL_ANS_RATE: FORMULA_ANS_SLA3, COL_ABD_RATE: FORMULA_ABD_SLA5,
         COL_ANS_SLA: "SLA3", COL_ABD_SLA: "Abd5"},
    ])
    df = pd.concat([df, extra], ignore_index=True)

    def merge_dup(group):
        return pd.Series({
            "ans_rate_formula": next((v for v in group.get(COL_ANS_RATE, []) if pd.notna(v)), None),
            "abd_rate_formula": next((v for v in group.get(COL_ABD_RATE, []) if pd.notna(v)), None),
            "timeframe_bh":     int(group["_tf"].min()),
            "ooh":              int(group["_ooh"].max()),
            "ans_sla":          next((v for v in group.get(COL_ANS_SLA, []) if pd.notna(v)), None),
            "abd_sla":          next((v for v in group.get(COL_ABD_SLA, []) if pd.notna(v)), None),
            "target_ans_rate":  group["_ta"].max(),
            "target_abd_rate":  group["_td"].min(),
        })

    return df.groupby("account", sort=False).apply(merge_dup).reset_index()


class Command(BaseCommand):
    help = "ETL DXC v7 — charge Telephony_Data.csv → PostgreSQL (optimisé bulk + vectorisé)"

    def add_arguments(self, parser):
        parser.add_argument("--step", default="all", choices=["extract", "transform", "load", "all"])
        parser.add_argument("--file", default=None)
        parser.add_argument("--mode", default="replace", choices=["replace", "append"])
        # ✅ NOUVEAU : batch-size configurable depuis docker-compose
        parser.add_argument("--batch-size", type=int, default=1000,
                            help="Taille des batches pour bulk_create (défaut: 1000)")

    def handle(self, *args, **options):
        step        = options["step"]
        mode        = options["mode"]
        custom_file = options.get("file")
        self.batch_size = options["batch_size"]  # ✅ stocké pour _load()

        BASE_DIR = Path(__file__).resolve().parents[3]
        data_dir = BASE_DIR / "data"
        if not data_dir.exists():
            data_dir = Path("/app/data")
        self.log(f"[DIR] {data_dir}  |  step={step}  mode={mode}  batch_size={self.batch_size}")

        df = agg = None
        if step in ("extract", "all"):
            df = self._extract(data_dir, custom_file)
        if step in ("transform", "all"):
            if df is None:
                df = self._extract(data_dir, custom_file)
            df, agg = self._transform(df)
        if step in ("load", "all"):
            if df is None:
                df = self._extract(data_dir, custom_file)
                df, agg = self._transform(df)
            src = str(custom_file or (data_dir / "Telephony_Data.csv"))
            self._load(df, agg, data_dir, mode=mode, source_file=src)
        self.stdout.write(self.style.SUCCESS("[ETL] ✅ Pipeline terminé."))

    def log(self, msg):
        self.stdout.write(f"[ETL] {msg}")

    # ── EXTRACT ────────────────────────────────────────────────────────────
    def _extract(self, data_dir, custom_file=None):
        queue_file = Path(custom_file) if custom_file else data_dir / "Telephony_Data.csv"
        sla_file   = data_dir / "SLA.xlsx"
        if not queue_file.exists():
            raise FileNotFoundError(f"Introuvable : {queue_file}")
        self.log(f"[>] Lecture : {queue_file.name}")
        with open(queue_file, 'r', encoding='utf-8', errors='ignore') as f:
            sample = f.read(2048)
        sep = ';' if sample.count(';') > sample.count(',') else ','
        self.log(f"  -> Séparateur détecté : '{sep}'")

        # ✅ OPTIMISATION : dtype=str évite les conversions implicites lentes
        df = pd.read_csv(queue_file, sep=sep, dtype=str, low_memory=False)
        df.columns = df.columns.str.strip().str.lstrip('\ufeff')
        self.log(f"  -> Colonnes : {df.columns.tolist()}")

        COLUMN_MAP = {
            "Contacts queued":            "offered",
            "Contacts handled incoming":  "answered",
            "Contacts abandoned":         "abandoned",
            "Average handle time":        "avg_handle_time",
            "Average queue answer time":  "avg_answer_time",
            "Average hold time":          "avg_hold_time",
            "Average customer hold time": "avg_hold_time",
            "Callback contacts":          "callback_contacts",
            "Contacts put on hold":       "contacts_put_on_hold",
        }
        df = df.rename(columns=COLUMN_MAP)
        df = self._clean_hold_columns(df)

        numeric_cols = [
            "offered", "answered", "abandoned", "avg_handle_time", "avg_answer_time",
            "avg_hold_time", "callback_contacts", "contacts_put_on_hold", "Agent interaction time",
            COL_API_CONTACTS, "Contacts handled outbound",
            "Contacts abandoned in 20 seconds", "Contacts abandoned in 30 seconds",
            "Contacts abandoned 40 seconds", "Contacts abandoned in 45 seconds",
            COL_ABD_60, "Contacts abandoned in 90 seconds",
            "Contacts answered in 20 seconds", "Contacts answered in 30 seconds",
            "Contacts answered 40 seconds", "Contacts answered in 45 seconds",
            "Contacts answered in 60 seconds", "Contacts answered in 90 seconds",
        ]
        # ✅ OPTIMISATION : conversion vectorisée en une passe par colonne
        for col in numeric_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(
                    df[col].str.replace(",", ".", regex=False).str.strip(),
                    errors="coerce"
                ).fillna(0)

        for col in ["Service level 60 seconds", "Service level 120 seconds"]:
            if col in df.columns:
                df[col] = pd.to_numeric(
                    df[col].str.replace("%", "", regex=False).str.strip(),
                    errors="coerce"
                ).fillna(0) / 100.0

        # ✅ OPTIMISATION : map vectorisé au lieu de apply() ligne par ligne
        df["account"]  = df["Queue"].apply(extract_account)
        df["language"] = df["Queue"].apply(extract_language)

        self.log(f"  -> {len(df)} lignes | {df['Queue'].nunique()} queues | {df['account'].nunique()} comptes")
        if sla_file.exists():
            df = self._merge_sla(df, sla_file)
        self.log(f"[OK] Extract : {len(df)} lignes")
        return df

    def _clean_hold_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        df['contacts_put_on_hold'] = (
            pd.to_numeric(
                df.get('contacts_put_on_hold', pd.Series(0, index=df.index))
                  .astype(str).str.replace(',', '.', regex=False).str.strip().replace('', '0'),
                errors='coerce'
            ).fillna(0).astype(int)
        )
        df['avg_hold_time'] = (
            pd.to_numeric(
                df.get('avg_hold_time', pd.Series(dtype=str))
                  .astype(str).str.replace(',', '.', regex=False).str.strip().replace('', '0'),
                errors='coerce'
            ).fillna(0.0)
        )
        return df

    def _merge_sla(self, df: pd.DataFrame, sla_file: Path) -> pd.DataFrame:
        self.log(f"[>] Lecture : {sla_file.name}")
        df_sla = load_sla_dataframe(sla_file)
        df = df.merge(
            df_sla[["account", "target_ans_rate", "target_abd_rate", "timeframe_bh", "ooh",
                     "ans_sla", "abd_sla", "ans_rate_formula", "abd_rate_formula"]].rename(columns={
                "target_ans_rate":  COL_TARGET_ANS_RATE,
                "target_abd_rate":  COL_TARGET_ABD_RATE,
                "timeframe_bh":     COL_TIMEFRAME_BH,
                "ooh":              "OOH",
                "ans_sla":          COL_ANS_SLA,
                "abd_sla":          COL_ABD_SLA,
                "ans_rate_formula": COL_ANS_RATE,
                "abd_rate_formula": COL_ABD_RATE,
            }),
            on="account", how="left", validate="many_to_one"
        )
        df_queue_sla = load_sla_queue_level(sla_file)
        df["queue_name_norm"] = df["Queue"].str.strip().str.lower()
        n_before = len(df)
        df = df.merge(
            df_queue_sla.rename(columns={
                "target_ans_rate": "_q_ta", "target_abd_rate": "_q_td",
                "timeframe_bh": "_q_tf", "timeframe_ooh": "_q_tf_ooh", "account": "_q_acc",
            }),
            on="queue_name_norm", how="left", validate="many_to_one"
        )
        if len(df) != n_before:
            self.log(f"  ⚠️ Doublons détectés ({len(df) - n_before}) → déduplication")
            df = df.drop_duplicates(subset=["Queue", "StartInterval"], keep="first")
        mask = df["_q_ta"].notna()
        df.loc[mask, COL_TARGET_ANS_RATE] = df.loc[mask, "_q_ta"]
        df.loc[mask, COL_TARGET_ABD_RATE] = df.loc[mask, "_q_td"]
        df.loc[mask, COL_TIMEFRAME_BH]    = df.loc[mask, "_q_tf"]
        df.loc[mask, COL_TIMEFRAME_OOH]   = df.loc[mask, "_q_tf_ooh"]
        df.drop(columns=["_q_ta", "_q_td", "_q_tf", "_q_tf_ooh", "_q_acc", "queue_name_norm"],
                inplace=True, errors="ignore")
        self.log(f"  -> SLA queue-level : {mask.sum()} queues configurées")
        return df

    # ── TRANSFORM ──────────────────────────────────────────────────────────
    def _transform(self, df):
        def _num(s, d=0.0):
            return pd.to_numeric(s, errors="coerce").fillna(d)

        df["offered"]   = _num(df.get("offered"))
        df["answered"]  = _num(df.get("answered"))
        df["abandoned"] = _num(df.get("abandoned"))

        if COL_API_CONTACTS in df.columns:
            api = _num(df[COL_API_CONTACTS])
            chat_mask = (df["answered"] == 0) & (api > 0)
            df.loc[chat_mask, "answered"] = api[chat_mask]

        df = self._apply_sla_timeframe(df, _num)
        df = self._compute_sla_rates(df)
        df = self._compute_time_fields(df, _num)
        df = self._apply_db_config_override(df)
        df = self._apply_ooh_flag(df)

        df["handle_time"]          = df["avg_handle_time"] * df["answered"]
        df["total_answer_time"]    = df["avg_answer_time"] * df["answered"]
        df["contacts_put_on_hold"] = _num(df.get("contacts_put_on_hold"))
        df["total_hold_time"]      = df["avg_hold_time"] * df["contacts_put_on_hold"]

        # ✅ OPTIMISATION : np.where vectorisé au lieu de apply() ligne par ligne
        df["sla_compliant"] = np.where(
            df["target_ans_rate"].notna(),
            df["sla_rate"] >= df["target_ans_rate"],
            False
        )
        df["abd_compliant"] = np.where(
            df["target_abd_rate"].notna(),
            df["abandon_rate"] <= df["target_abd_rate"],
            True
        )

        agg = self._aggregate(df)
        self.log(f"[OK] Transform : {len(df)} lignes | {agg['account'].nunique()} comptes")
        return df, agg

    def _apply_sla_timeframe(self, df, _num):
        if COL_TIMEFRAME_BH in df.columns:
            tf_series = pd.to_numeric(df[COL_TIMEFRAME_BH], errors="coerce").fillna(40).astype(int)
            lux_mask = df["account"].str.lower().str.contains("luxottica", na=False)
            tf_series.loc[lux_mask] = 30
        else:
            tf_series = pd.Series(40, index=df.index)

        df_cols  = set(df.columns)
        ans_vals = pd.Series(0.0, index=df.index)
        abd_vals = pd.Series(0.0, index=df.index)
        for tf in tf_series.unique():
            mask    = tf_series == tf
            ans_col = ANS_COL_BY_TF.get(tf)
            abd_col = ABD_COL_BY_TF.get(tf)
            ans_vals.loc[mask] = _num(df.loc[mask, ans_col]) if ans_col and ans_col in df_cols else 0
            abd_vals.loc[mask] = _num(df.loc[mask, abd_col]) if abd_col and abd_col in df_cols else 0

        df["ans_in_sla"] = ans_vals
        df["abd_in_sla"] = abd_vals
        self.log(f"  -> Timeframes présents : {sorted(tf_series.unique().tolist())}")

        if COL_ABD_60 in df.columns:
            df["abd_in_60"] = _num(df[COL_ABD_60])
        else:
            df["abd_in_60"] = df["abd_in_sla"]

        df["ans_out_sla"] = (df["answered"]  - df["ans_in_sla"]).clip(lower=0).astype(int)
        df["abd_out_sla"] = (df["abandoned"] - df["abd_in_sla"]).clip(lower=0).astype(int)
        df["abd_out_60"]  = (df["abandoned"] - df["abd_in_60"]).clip(lower=0).round().astype(int)
        df["answer_rate"] = df["answered"] / df["offered"].replace(0, 1)
        return df

    def _compute_sla_rates(self, df):
        q = "Queue"
        SLA2_KW = ['gf', 'connectchat_gf', 'german_queue', 'dxc', 'hpe', 'saipem', 'spm']
        SLA3_KW = ['el store', 'luxottica']
        ABD2_KW = ['gf', 'connectchat_gf', 'dxc', 'hpe', 'saipem', 'spm',
                   'mylan', 'viatris', 'basrah', 'philips', 'sony']
        ABD3_KW = ['gf', 'connectchat_gf']
        ABD4_KW = ['sonova', 'servier']
        ABD5_KW = ['el store', 'luxottica']
        ABD1_KW = ['renault', 'nissan', 'benelux', 'rn_', 'rn_ch', 'rn_gsd',
                   'rn_spain', 'rn_ligne', 'rn_importeurs']

        def _match(name, kws):
            nl = str(name).lower()
            return any(k in nl for k in kws)

        mask_sla2 = df[q].apply(lambda x: _match(x, SLA2_KW))
        mask_sla3 = df[q].apply(lambda x: _match(x, SLA3_KW))
        mask_abd5 = df[q].apply(lambda x: _match(x, ABD5_KW))
        mask_abd4 = df[q].apply(lambda x: _match(x, ABD4_KW)) & ~mask_abd5
        mask_abd3 = df[q].apply(lambda x: _match(x, ABD3_KW))
        mask_abd2 = df[q].apply(lambda x: _match(x, ABD2_KW)) & ~mask_abd3 & ~mask_abd4 & ~mask_abd5
        mask_abd1 = df[q].apply(lambda x: _match(x, ABD1_KW)) & ~mask_abd2 & ~mask_abd3 & ~mask_abd4 & ~mask_abd5

        sla1 = (df["ans_in_sla"] / (df["offered"] - df["abd_in_sla"]).clip(lower=1)).clip(0, 1)
        sla2 = (df["ans_in_sla"] / df["answered"].clip(lower=1)).clip(0, 1)
        sla3 = (1 - df["ans_out_sla"] / (df["offered"] - df["abd_in_60"]).clip(lower=1)).clip(0, 1)
        df["sla_rate"] = sla1
        df.loc[mask_sla2, "sla_rate"] = sla2[mask_sla2]
        df.loc[mask_sla3, "sla_rate"] = sla3[mask_sla3]

        abd1 = (1 - df["abd_out_sla"] / df["offered"].clip(lower=1)).clip(0, 1)
        abd2 = (df["abd_out_sla"] / (df["offered"] - df["abd_in_sla"]).clip(lower=1)).clip(0, 1)
        abd3 = (df["abd_out_sla"] / df["answered"].clip(lower=1)).clip(0, 1)
        abd4 = (df["abd_out_sla"] / df["offered"].clip(lower=1)).clip(0, 1)
        abd5 = (1 - df["abd_out_60"] / (df["offered"] - df["abd_in_sla"]).clip(lower=1)).clip(0, 1)
        df["abandon_rate"] = df["abandoned"] / df["offered"].replace(0, 1)
        df.loc[mask_abd1, "abandon_rate"] = abd1[mask_abd1]
        df.loc[mask_abd2, "abandon_rate"] = abd2[mask_abd2]
        df.loc[mask_abd3, "abandon_rate"] = abd3[mask_abd3]
        df.loc[mask_abd4, "abandon_rate"] = abd4[mask_abd4]
        df.loc[mask_abd5, "abandon_rate"] = abd5[mask_abd5]
        return df

    def _compute_time_fields(self, df, _num):
        df["avg_answer_time"]   = _num(df.get("avg_answer_time"))
        df["avg_hold_time"]     = _num(df.get("avg_hold_time"))
        df["avg_handle_time"]   = _num(df.get("avg_handle_time"))
        df["callback_contacts"] = _num(df.get("callback_contacts")).astype(int)
        if "Average agent interaction time" in df.columns:
            df["avg_ttc"] = _num(df["Average agent interaction time"])
        else:
            df["avg_ttc"] = df["avg_handle_time"]
        df["total_ttc_time"]  = df["avg_ttc"] * df["answered"]
        df["target_ans_rate"] = pd.to_numeric(df.get(COL_TARGET_ANS_RATE), errors="coerce")
        df["target_abd_rate"] = pd.to_numeric(df.get(COL_TARGET_ABD_RATE), errors="coerce")
        df["timeframe_bh"] = (
            pd.to_numeric(df[COL_TIMEFRAME_BH], errors="coerce").fillna(40).astype(int)
            if COL_TIMEFRAME_BH in df.columns else 40
        )
        df["timeframe_ooh"] = (
            pd.to_numeric(df[COL_TIMEFRAME_OOH], errors="coerce").fillna(df["timeframe_bh"]).astype(int)
            if COL_TIMEFRAME_OOH in df.columns else df["timeframe_bh"]
        )
        return df

    def _apply_db_config_override(self, df):
        try:
            db_configs = {
                s.account.strip().lower(): s
                for s in SLAConfig.objects.all()
            }
            if not db_configs:
                return df

            # ✅ OPTIMISATION : map vectorisé au lieu de apply() ligne par ligne
            acc_lower = df["account"].str.strip().str.lower()
            for acc_key, cfg in db_configs.items():
                mask = acc_lower == acc_key
                if mask.any():
                    if cfg.target_ans_rate is not None:
                        df.loc[mask, "target_ans_rate"] = cfg.target_ans_rate
                    if cfg.target_abd_rate is not None:
                        df.loc[mask, "target_abd_rate"] = cfg.target_abd_rate
                    df.loc[mask, "timeframe_bh"]  = cfg.timeframe_bh
                    df.loc[mask, "timeframe_ooh"] = cfg.ooh if cfg.ooh else df.loc[mask, "timeframe_bh"]

            self.log(f"  [OK] DB override SLAConfig appliqué sur {len(db_configs)} comptes")
        except Exception as e:
            self.log(f"  ⚠️ DB override SLAConfig ignoré : {e}")
        return df

    def _apply_ooh_flag(self, df):
        """Tag chaque ligne is_ooh — vectorisé via tz_convert."""
        df["_start_dt"] = pd.to_datetime(df["StartInterval"], errors="coerce", utc=True)
        # ✅ OPTIMISATION : tz_convert vectorisé + conditions numpy
        local = df["_start_dt"].dt.tz_convert('Europe/Paris')
        df["is_ooh"] = (local.dt.weekday >= 5) | (local.dt.hour < 7) | (local.dt.hour >= 19)
        df["is_ooh"] = df["is_ooh"].fillna(False)
        return df

    def _aggregate(self, df) -> pd.DataFrame:
        agg = (
            df.groupby("account")
            .agg(
                offered=("offered", "sum"),
                abandoned=("abandoned", "sum"),
                answered=("answered", "sum"),
                ans_in_sla=("ans_in_sla", "sum"),
                abd_in_sla=("abd_in_sla", "sum"),
                abd_in_60=("abd_in_60", "sum"),
                abd_out_60=("abd_out_60", "sum"),
                ans_out_sla=("ans_out_sla", "sum"),
                abd_out_sla=("abd_out_sla", "sum"),
                handle_time=("handle_time", "sum"),
                total_answer_time=("total_answer_time", "sum"),
                total_hold_time=("total_hold_time", "sum"),
                contacts_put_on_hold=("contacts_put_on_hold", "sum"),
                total_ttc_time=("total_ttc_time", "sum"),
                callback_contacts=("callback_contacts", "sum"),
                target_ans_rate=("target_ans_rate", "max"),
                target_abd_rate=("target_abd_rate", "min"),
            ).reset_index()
        )
        agg['sla_rate']     = agg.apply(self._calc_account_sla, axis=1)
        agg['abandon_rate'] = agg.apply(self._calc_account_abd, axis=1)
        agg['answer_rate']  = agg['answered'] / agg['offered'].clip(lower=1)
        ac = agg['answered'].clip(lower=1)
        agg['avg_handle_time'] = agg['handle_time']       / ac
        agg['avg_answer_time'] = agg['total_answer_time'] / ac
        agg['avg_hold_time']   = (agg['total_hold_time']  / agg['contacts_put_on_hold'].clip(lower=1)).fillna(0)
        agg['avg_ttc']         = agg['total_ttc_time']    / ac

        # ✅ OPTIMISATION : np.where vectorisé
        agg['sla_compliant'] = np.where(
            agg['target_ans_rate'].notna(),
            agg['sla_rate'] >= agg['target_ans_rate'],
            False
        )
        agg['abd_compliant'] = np.where(
            agg['target_abd_rate'].notna(),
            agg['abandon_rate'] <= agg['target_abd_rate'],
            True
        )
        agg.fillna({
            "offered": 0, "abandoned": 0, "answered": 0,
            "ans_in_sla": 0.0, "abd_in_sla": 0.0,
            "sla_rate": 0.0, "abandon_rate": 0.0, "answer_rate": 0.0,
            "avg_handle_time": 0.0, "avg_answer_time": 0.0,
            "avg_ttc": 0.0, "avg_hold_time": 0.0,
            "callback_contacts": 0,
        }, inplace=True)
        return agg

    @staticmethod
    def _calc_account_sla(r) -> float:
        ans     = float(r['ans_in_sla']  or 0)
        ans_out = float(r['ans_out_sla'] or 0)
        abd60   = float(r['abd_in_60']   or 0)
        abd     = float(r['abd_in_sla']  or 0)
        off     = float(r['offered']     or 0)
        ans_d   = float(r['answered']    or 0)
        a = str(r['account']).lower()
        if any(k in a for k in SLA3_ACC):
            return min(1 - ans_out / max(off - abd60, 1), 1.0)
        if any(k in a for k in SLA2_ACC):
            return min(ans / max(ans_d, 1), 1.0)
        return min(ans / max(off - abd, 1), 1.0)

    @staticmethod
    def _calc_account_abd(r) -> float:
        abd_out = float(r['abd_out_sla'] or 0)
        abd60   = float(r['abd_out_60']  or 0)
        abd_in  = float(r['abd_in_sla']  or 0)
        off     = float(r['offered']     or 0)
        ans_d   = float(r['answered']    or 0)
        abd_raw = float(r['abandoned']   or 0)
        a = str(r['account']).lower()
        if any(k in a for k in ABD5_ACC):
            return min(1 - abd60  / max(off - abd_in, 1), 1.0)
        if any(k in a for k in ABD4_ACC):
            return min(abd_out / max(off, 1), 1.0)
        if any(k in a for k in ABD3_ACC):
            return min(abd_out / max(ans_d, 1), 1.0)
        if any(k in a for k in ABD2_ACC):
            return min(abd_out / max(off - abd_in, 1), 1.0)
        if any(k in a for k in ABD1_ACC):
            return min(1 - abd_out / max(off, 1), 1.0)
        return min(abd_raw / max(off, 1), 1.0)

    # ── LOAD ───────────────────────────────────────────────────────────────
    @transaction.atomic
    def _load(self, df, agg, data_dir, mode="replace", source_file=""):
        self.log(f"[*] Mode : {mode}  |  batch_size={self.batch_size}")
        if mode == "replace":
            for model in [HistoricalMetric, AccountSummary, HourlyTrend, DailySnapshot]:
                model.objects.all().delete()
            self.log("  [OK] Tables vidées")

        sla_map   = self._load_sla_configs(data_dir)
        hist_rows = self._build_historical_metrics(df, sla_map, source_file)
        acc_objs  = self._build_account_summaries(agg)
        hourly    = self._build_hourly_trends(df)
        snaps     = self._build_daily_snapshots(df)

        # ✅ OPTIMISATION : bulk_create avec batch_size configurable
        self.log(f"-> Insertion historical_metrics ({len(hist_rows)} lignes)…")
        if hist_rows:
            for i in range(0, len(hist_rows), self.batch_size):
                batch = hist_rows[i:i + self.batch_size]
                HistoricalMetric.objects.bulk_create(batch, batch_size=self.batch_size, ignore_conflicts=True)
                self.log(f"   batch {i // self.batch_size + 1}/{-(-len(hist_rows) // self.batch_size)} inséré")

        self.log("-> Insertion account_summary…")
        if acc_objs:
            AccountSummary.objects.bulk_create(acc_objs, batch_size=self.batch_size, ignore_conflicts=True)
        self.log(f"  [OK] {len(acc_objs)} comptes → account_summary")

        self.log("-> Insertion hourly_trends…")
        if hourly:
            HourlyTrend.objects.bulk_create(hourly, batch_size=self.batch_size, ignore_conflicts=True)
        self.log(f"  [OK] {len(hourly)} lignes → hourly_trends")

        self.log("-> Insertion daily_snapshots…")
        if snaps:
            DailySnapshot.objects.bulk_create(snaps, batch_size=365, ignore_conflicts=True)
        self.log(f"  [OK] {len(snaps)} jours → daily_snapshots")

        self.stdout.write(self.style.SUCCESS(
            f"\n[ETL] ✅ Chargement terminé :\n"
            f"       - historical_metrics : {len(hist_rows):>6} lignes\n"
            f"       - account_summary    : {len(acc_objs):>6} comptes\n"
            f"       - hourly_trends      : {len(hourly):>6} lignes\n"
            f"       - daily_snapshots    : {len(snaps):>6} jours"
        ))

    def _load_sla_configs(self, data_dir: Path) -> dict:
        sla_file = data_dir / "SLA.xlsx"
        n_sla = 0
        if sla_file.exists():
            df_sla = load_sla_dataframe_raw(sla_file)
            for _, row in df_sla.iterrows():
                acc = str(row.get("account") or "").strip()
                if not acc or acc == "nan":
                    continue
                ta = _safe_float(row.get("target_ans_rate"), None)
                td = _safe_float(row.get("target_abd_rate"), None)
                SLAConfig.objects.get_or_create(
                    account=acc,
                    defaults={
                        "ans_rate_formula": str(row.get("ans_rate_formula") or "") or None,
                        "abd_rate_formula": str(row.get("abd_rate_formula") or "") or None,
                        "timeframe_bh":     _safe_int(row.get("timeframe_bh"), 40),
                        "ooh":              _safe_int(row.get("ooh"), 0),
                        "ans_sla":          str(row.get("ans_sla") or "") or None,
                        "abd_sla":          str(row.get("abd_sla") or "") or None,
                        "target_ans_rate":  ta if ta is not None else 0.0,
                        "target_abd_rate":  td if td is not None else 0.0,
                    }
                )
                n_sla += 1
        self.log(f"  [OK] {n_sla} comptes → sla_config")
        return {s.account: s for s in SLAConfig.objects.all()}

    def _build_historical_metrics(self, df, sla_map: dict, source_file: str) -> list:
        """✅ OPTIMISATION : construction vectorisée avec itertuples() au lieu de iterrows()."""
        rows = []
        source_name = Path(source_file).name if source_file else None

        # Pré-calcul vectorisé des dates pour éviter la conversion dans la boucle
        df = df.copy()
        df["_start_parsed"] = pd.to_datetime(df["StartInterval"], errors="coerce", utc=True)
        df["_end_parsed"]   = pd.to_datetime(df.get("EndInterval"), errors="coerce", utc=True)
        df = df.dropna(subset=["_start_parsed"])
        df = df[df["Queue"].notna() & df["account"].notna() & (df["account"] != "nan")]

        # Conversion locale vectorisée
        df["_sn"] = df["_start_parsed"].dt.tz_convert(None)
        df["_en"] = df["_end_parsed"].dt.tz_convert(None)

        # Champs dérivés vectorisés
        df["_hour"]        = df["_sn"].dt.strftime("%H:%M")
        df["_year"]        = df["_sn"].dt.year.astype(int)
        df["_month"]       = df["_sn"].dt.month.astype(int)
        df["_week"]        = df["_sn"].dt.isocalendar().week.astype(int)
        df["_day_of_week"] = df["_sn"].dt.strftime("%A")

        for row in df.itertuples(index=False):
            qn_raw = str(getattr(row, "Queue", "") or "").strip()
            acc    = str(getattr(row, "account", "") or "").strip()
            if not qn_raw or not acc:
                continue
            sn = getattr(row, "_sn", None)
            en = getattr(row, "_en", None)

            def _f(attr, d=0.0):
                v = getattr(row, attr, d)
                try:
                    return float(v) if not pd.isna(v) else d
                except Exception:
                    return d

            def _i(attr, d=0):
                v = getattr(row, attr, d)
                try:
                    return int(float(v)) if not pd.isna(v) else d
                except Exception:
                    return d

            rows.append(HistoricalMetric(
                queue=qn_raw,
                desk=QUEUE_TO_DESK.get(qn_raw, qn_raw),
                account=acc,
                language=str(getattr(row, "language", "") or "").strip() or None,
                sla_config=sla_map.get(acc),
                start_date=sn, end_date=en,
                hour=getattr(row, "_hour", "00:00"),
                year=getattr(row, "_year", 0),
                month=getattr(row, "_month", 0),
                week=getattr(row, "_week", 0),
                day_of_week=getattr(row, "_day_of_week", ""),
                offered=_i("offered"), abandoned=_i("abandoned"), answered=_i("answered"),
                ans_in_sla=_f("ans_in_sla"), abd_in_sla=_f("abd_in_sla"),
                ans_out_sla=int(_f("ans_out_sla")), abd_out_sla=int(_f("abd_out_sla")),
                abd_in_60=_i("abd_in_60"), abd_out_60=_i("abd_out_60"),
                callback_contacts=_i("callback_contacts"),
                sla_rate=min(max(_f("sla_rate"), 0), 1),
                abandon_rate=min(max(_f("abandon_rate"), 0), 1),
                answer_rate=min(max(_f("answer_rate"), 0), 1),
                avg_handle_time=_f("avg_handle_time"),
                avg_answer_time=_f("avg_answer_time"),
                average_hold_time=_f("avg_hold_time"),
                avg_ttc=_f("avg_ttc"),
                handle_time=_f("handle_time"),
                total_answer_time=_f("total_answer_time"),
                contacts_put_on_hold=_i("contacts_put_on_hold"),
                total_hold_time=_f("total_hold_time"),
                target_ans_rate=_f("target_ans_rate", 0),
                target_abd_rate=_f("target_abd_rate", 0),
                timeframe_bh=_i("timeframe_bh", 40),
                timeframe_ooh=_i("timeframe_ooh", 40),
                is_ooh=bool(getattr(row, "is_ooh", False)),
                sla_compliant=bool(getattr(row, "sla_compliant", False)),
                abd_compliant=bool(getattr(row, "abd_compliant", True)),
                source_file=source_name,
            ))
        return rows

    def _build_account_summaries(self, agg) -> list:
        return [
            AccountSummary(
                account=str(r["account"]),
                offered=_safe_int(r.get("offered")),
                abandoned=_safe_int(r.get("abandoned")),
                answered=_safe_int(r.get("answered")),
                ans_in_sla=_safe_float(r.get("ans_in_sla")),
                abd_in_sla=_safe_float(r.get("abd_in_sla")),
                sla_rate=_safe_float(r.get("sla_rate")),
                abandon_rate=_safe_float(r.get("abandon_rate")),
                answer_rate=_safe_float(r.get("answer_rate")),
                avg_handle_time=_safe_float(r.get("avg_handle_time")),
                target_ans_rate=_safe_float(r.get("target_ans_rate")),
                target_abd_rate=_safe_float(r.get("target_abd_rate")),
                sla_compliant=bool(r.get("sla_compliant", False)),
                abd_compliant=bool(r.get("abd_compliant", True)),
                timeframe_bh=_safe_int(r.get("timeframe_bh"), 40),
                avg_answer_time=_safe_float(r.get("avg_answer_time")),
                avg_ttc=_safe_float(r.get("avg_ttc")),
            )
            for _, r in agg.iterrows()
        ]

    def _build_hourly_trends(self, df) -> list:
        df_t = df.copy()
        df_t["_dt"]   = pd.to_datetime(df_t.get("StartInterval"), errors="coerce", utc=True)
        df_t          = df_t.dropna(subset=["_dt"])
        df_t["_date"] = df_t["_dt"].dt.tz_convert(None).dt.date
        df_t["_hour"] = df_t["_dt"].dt.tz_convert(None).dt.strftime("%H:%M")
        hagg = (
            df_t.groupby(["_date", "_hour", "account"])
            .agg(
                offered=("offered", "sum"), abandoned=("abandoned", "sum"),
                answered=("answered", "sum"),
                ans_in_sla=("ans_in_sla", "sum"), abd_in_sla=("abd_in_sla", "sum"),
                handle_time=("handle_time", "sum"),
                total_answer_time=("total_answer_time", "sum"),
            ).reset_index()
        )
        hagg["sla_rate"]     = (hagg["ans_in_sla"] / (hagg["offered"] - hagg["abd_in_sla"]).clip(lower=1)).clip(0, 1)
        hagg["abandon_rate"] = (hagg["abandoned"]  / hagg["offered"].clip(lower=1)).clip(0, 1)
        return [
            HourlyTrend(
                hour=r["_hour"], date=r["_date"], account=str(r["account"]),
                offered=int(r.get("offered", 0) or 0),
                abandoned=int(r.get("abandoned", 0) or 0),
                answered=int(r.get("answered", 0) or 0),
                sla_rate=_safe_float(r.get("sla_rate")),
                abandon_rate=_safe_float(r.get("abandon_rate")),
                ans_in_sla=_safe_float(r.get("ans_in_sla")),
                abd_in_sla=_safe_float(r.get("abd_in_sla")),
            )
            for _, r in hagg.iterrows()
        ]

    def _build_daily_snapshots(self, df) -> list:
        df_t = df.copy()
        df_t["_dt"]   = pd.to_datetime(df_t.get("StartInterval"), errors="coerce", utc=True)
        df_t          = df_t.dropna(subset=["_dt"])
        df_t["_date"] = df_t["_dt"].dt.tz_convert(None).dt.date
        dagg = (
            df_t.groupby("_date")
            .agg(
                total_offered=("offered", "sum"),
                total_abandoned=("abandoned", "sum"),
                total_answered=("answered", "sum"),
                ans_in_sla=("ans_in_sla", "sum"),
                abd_in_sla=("abd_in_sla", "sum"),
            ).reset_index()
        )
        dagg["global_sla_rate"]     = (dagg["ans_in_sla"] / (dagg["total_offered"] - dagg["abd_in_sla"]).clip(lower=1)).clip(0, 1)
        dagg["global_abandon_rate"] = (dagg["total_abandoned"] / dagg["total_offered"].clip(lower=1)).clip(0, 1)
        dagg["global_answer_rate"]  = (dagg["total_answered"]  / dagg["total_offered"].clip(lower=1)).clip(0, 1)
        apd = (
            df_t.groupby(["_date", "account"])
            .agg(sla_rate=("sla_rate", "mean"), target=("target_ans_rate", "max"))
            .reset_index()
        )
        snaps = []
        for _, r in dagg.iterrows():
            d   = r["_date"]
            sub = apd[apd["_date"] == d]
            swt = sub[sub["target"].notna()]
            snaps.append(DailySnapshot(
                date=d,
                total_offered=int(r.get("total_offered", 0) or 0),
                total_abandoned=int(r.get("total_abandoned", 0) or 0),
                total_answered=int(r.get("total_answered", 0) or 0),
                global_sla_rate=float(r.get("global_sla_rate", 0) or 0),
                global_abandon_rate=float(r.get("global_abandon_rate", 0) or 0),
                global_answer_rate=float(r.get("global_answer_rate", 0) or 0),
                compliant_accounts=int((swt["sla_rate"] >= swt["target"]).sum()),
                total_accounts=sub["account"].nunique(),
            ))
        return snaps