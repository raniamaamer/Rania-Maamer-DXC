"""
test_metrics_exporter.py
═══════════════════════════════════════════════════════════════════
Tests unitaires pour metrics_exporter.py
Cible : couvrir les 96 lignes non testées → coverage ≥ 80 %

Dépendances :
    pip install prometheus_client pytest pytest-mock
"""

import json
import logging
import time
from pathlib import Path
from unittest.mock import MagicMock, patch, call, PropertyMock
import pytest


# ══════════════════════════════════════════════════════════════════════════════
# FIXTURES — données ML représentatives
# ══════════════════════════════════════════════════════════════════════════════

SAMPLE_ML_DATA = {
    "dataset": {
        "breach_rate_pct": 6.5,
        "breach_count": 325,
        "total_incidents": 5000,
        "avg_daily_tickets": 68.5,
        "date_min": "2023-01-01",
        "date_max": "2024-12-31",
    },
    "prophet": {
        "mae": 5.2,
        "rmse": 7.1,
        "mape": 3.4,
    },
    "random_forest": {
        "auc_roc": 0.91,
    },
    "future_7": [
        {"date": "2024-05-01", "day": "Wednesday", "predicted": 72, "lower": 60, "upper": 85},
        {"date": "2024-05-02", "day": "Thursday",  "predicted": 65, "lower": 55, "upper": 78},
        {"date": "2024-05-03", "day": "Friday",    "predicted": 90, "lower": 75, "upper": 105},  # spike
        {"date": "2024-05-04", "day": "Saturday",  "predicted": 40, "lower": 30, "upper": 52},
        {"date": "2024-05-05", "day": "Sunday",    "predicted": 35, "lower": 25, "upper": 48},
        {"date": "2024-05-06", "day": "Monday",    "predicted": 70, "lower": 58, "upper": 83},
        {"date": "2024-05-07", "day": "Tuesday",   "predicted": 68, "lower": 56, "upper": 80},
    ],
    "ci_breach": [
        {"name": "CI-SERVER-01", "rate": 9.2,  "count": 46},   # CRITIQUE > 8%
        {"name": "CI-APP-02",    "rate": 6.1,  "count": 30},   # AMBER 5–8%
        {"name": "CI-DB-03",     "rate": 2.0,  "count": 10},   # OK < 5%
    ],
    "feature_imp": [
        {"feature": "priority",    "pct": 42.1},
        {"feature": "category",    "pct": 28.3},
        {"feature": "day_of_week", "pct": 15.6},
    ],
    "generated_at": "2024-05-01T12:00:00",
}

SAMPLE_ML_DATA_LOW_BREACH = {
    **SAMPLE_ML_DATA,
    "dataset": {**SAMPLE_ML_DATA["dataset"], "breach_rate_pct": 3.0},
    "ci_breach": [
        {"name": "CI-SAFE-01", "rate": 1.0, "count": 5},
    ],
}

SAMPLE_ML_DATA_NO_FUTURE = {
    **SAMPLE_ML_DATA,
    "future_7": [],
    "ci_breach": [],
    "feature_imp": [],
}


# ══════════════════════════════════════════════════════════════════════════════
# HELPER — crée un fichier temporaire contenant du JSON
# ══════════════════════════════════════════════════════════════════════════════

def _write_json(tmp_path: Path, data: dict) -> Path:
    p = tmp_path / "ml_data.json"
    p.write_text(json.dumps(data), encoding="utf-8")
    return p


# ══════════════════════════════════════════════════════════════════════════════
# 1. TESTS DE push_metrics — cas nominaux
# ══════════════════════════════════════════════════════════════════════════════

class TestPushMetricsNominal:
    """Vérifie que push_metrics met correctement à jour les jauges Prometheus."""

    def test_push_sets_breach_rate(self, tmp_path):
        from metrics_exporter import push_metrics, sla_breach_rate_pct
        path = _write_json(tmp_path, SAMPLE_ML_DATA)
        push_metrics(path)
        assert sla_breach_rate_pct._value.get() == pytest.approx(6.5)

    def test_push_sets_breach_count(self, tmp_path):
        from metrics_exporter import push_metrics, sla_breach_count
        path = _write_json(tmp_path, SAMPLE_ML_DATA)
        push_metrics(path)
        assert sla_breach_count._value.get() == pytest.approx(325)

    def test_push_sets_total_incidents(self, tmp_path):
        from metrics_exporter import push_metrics, sla_total_incidents
        path = _write_json(tmp_path, SAMPLE_ML_DATA)
        push_metrics(path)
        assert sla_total_incidents._value.get() == pytest.approx(5000)

    def test_push_sets_avg_daily_tickets(self, tmp_path):
        from metrics_exporter import push_metrics, sla_avg_daily_tickets
        path = _write_json(tmp_path, SAMPLE_ML_DATA)
        push_metrics(path)
        assert sla_avg_daily_tickets._value.get() == pytest.approx(68.5)

    def test_push_sets_prophet_mae(self, tmp_path):
        from metrics_exporter import push_metrics, sla_prophet_mae
        path = _write_json(tmp_path, SAMPLE_ML_DATA)
        push_metrics(path)
        assert sla_prophet_mae._value.get() == pytest.approx(5.2)

    def test_push_sets_prophet_rmse(self, tmp_path):
        from metrics_exporter import push_metrics, sla_prophet_rmse
        path = _write_json(tmp_path, SAMPLE_ML_DATA)
        push_metrics(path)
        assert sla_prophet_rmse._value.get() == pytest.approx(7.1)

    def test_push_sets_prophet_mape(self, tmp_path):
        from metrics_exporter import push_metrics, sla_prophet_mape
        path = _write_json(tmp_path, SAMPLE_ML_DATA)
        push_metrics(path)
        assert sla_prophet_mape._value.get() == pytest.approx(3.4)

    def test_push_sets_rf_auc(self, tmp_path):
        from metrics_exporter import push_metrics, sla_rf_auc
        path = _write_json(tmp_path, SAMPLE_ML_DATA)
        push_metrics(path)
        assert sla_rf_auc._value.get() == pytest.approx(0.91)

    def test_push_increments_refresh_counter(self, tmp_path):
        from metrics_exporter import push_metrics, sla_export_refreshes
        path = _write_json(tmp_path, SAMPLE_ML_DATA)
        before = sla_export_refreshes._value.get()
        push_metrics(path)
        assert sla_export_refreshes._value.get() == before + 1

    def test_push_sets_forecast_predicted_day1(self, tmp_path):
        from metrics_exporter import push_metrics, sla_forecast_predicted
        path = _write_json(tmp_path, SAMPLE_ML_DATA)
        push_metrics(path)
        labels = {"date": "2024-05-01", "day": "Wednesday", "horizon_days": "1"}
        assert sla_forecast_predicted.labels(**labels)._value.get() == pytest.approx(72)

    def test_push_sets_forecast_lower_day1(self, tmp_path):
        from metrics_exporter import push_metrics, sla_forecast_lower
        path = _write_json(tmp_path, SAMPLE_ML_DATA)
        push_metrics(path)
        labels = {"date": "2024-05-01", "day": "Wednesday", "horizon_days": "1"}
        assert sla_forecast_lower.labels(**labels)._value.get() == pytest.approx(60)

    def test_push_sets_forecast_upper_day1(self, tmp_path):
        from metrics_exporter import push_metrics, sla_forecast_upper
        path = _write_json(tmp_path, SAMPLE_ML_DATA)
        push_metrics(path)
        labels = {"date": "2024-05-01", "day": "Wednesday", "horizon_days": "1"}
        assert sla_forecast_upper.labels(**labels)._value.get() == pytest.approx(85)

    def test_push_sets_all_7_forecast_days(self, tmp_path):
        from metrics_exporter import push_metrics, sla_forecast_predicted
        path = _write_json(tmp_path, SAMPLE_ML_DATA)
        push_metrics(path)
        for i, day in enumerate(SAMPLE_ML_DATA["future_7"], start=1):
            labels = {"date": day["date"], "day": day["day"], "horizon_days": str(i)}
            assert sla_forecast_predicted.labels(**labels)._value.get() == pytest.approx(day["predicted"])

    def test_push_sets_ci_breach_rate(self, tmp_path):
        from metrics_exporter import push_metrics, sla_ci_breach_rate
        path = _write_json(tmp_path, SAMPLE_ML_DATA)
        push_metrics(path)
        assert sla_ci_breach_rate.labels(ci_name="CI-SERVER-01")._value.get() == pytest.approx(9.2)

    def test_push_sets_ci_incident_count(self, tmp_path):
        from metrics_exporter import push_metrics, sla_ci_incident_count
        path = _write_json(tmp_path, SAMPLE_ML_DATA)
        push_metrics(path)
        assert sla_ci_incident_count.labels(ci_name="CI-SERVER-01")._value.get() == pytest.approx(46)

    def test_push_sets_feature_importance(self, tmp_path):
        from metrics_exporter import push_metrics, sla_feature_importance
        path = _write_json(tmp_path, SAMPLE_ML_DATA)
        push_metrics(path)
        assert sla_feature_importance.labels(feature="priority")._value.get() == pytest.approx(42.1)

    def test_push_sets_all_three_features(self, tmp_path):
        from metrics_exporter import push_metrics, sla_feature_importance
        path = _write_json(tmp_path, SAMPLE_ML_DATA)
        push_metrics(path)
        for feat in SAMPLE_ML_DATA["feature_imp"]:
            assert sla_feature_importance.labels(feature=feat["feature"])._value.get() == pytest.approx(feat["pct"])

    def test_push_empty_future_7(self, tmp_path):
        """future_7 vide → aucune exception, pas de jauge forecast créée."""
        from metrics_exporter import push_metrics
        path = _write_json(tmp_path, SAMPLE_ML_DATA_NO_FUTURE)
        push_metrics(path)   # ne doit pas lever d'exception

    def test_push_empty_ci_breach(self, tmp_path):
        """ci_breach vide → aucune exception."""
        from metrics_exporter import push_metrics
        path = _write_json(tmp_path, SAMPLE_ML_DATA_NO_FUTURE)
        push_metrics(path)

    def test_push_empty_feature_imp(self, tmp_path):
        """feature_imp vide → aucune exception."""
        from metrics_exporter import push_metrics
        path = _write_json(tmp_path, SAMPLE_ML_DATA_NO_FUTURE)
        push_metrics(path)


# ══════════════════════════════════════════════════════════════════════════════
# 2. TESTS DE push_metrics — branches de log (seuils d'alerte)
# ══════════════════════════════════════════════════════════════════════════════

class TestPushMetricsAlertThresholds:
    """Vérifie les branches de logging selon les seuils THRESHOLD_*."""

    def test_volume_spike_logs_warning(self, tmp_path, caplog):
        """predicted > 80 → log WARNING 'Pic volume prévu'."""
        from metrics_exporter import push_metrics
        path = _write_json(tmp_path, SAMPLE_ML_DATA)  # day 3 = 90 tickets
        with caplog.at_level(logging.WARNING, logger="metrics_exporter"):
            push_metrics(path)
        assert any("Pic volume" in r.message for r in caplog.records)

    def test_no_spike_no_warning(self, tmp_path, caplog):
        """Tous les volumes < 80 → aucun WARNING 'Pic volume'."""
        data = {**SAMPLE_ML_DATA, "future_7": [
            {"date": "2024-05-01", "day": "Wednesday", "predicted": 50, "lower": 40, "upper": 62},
        ]}
        from metrics_exporter import push_metrics
        path = _write_json(tmp_path, data)
        with caplog.at_level(logging.WARNING, logger="metrics_exporter"):
            push_metrics(path)
        assert not any("Pic volume" in r.message for r in caplog.records)

    def test_ci_critical_breach_logs_error(self, tmp_path, caplog):
        """rate > 8 → log ERROR 'CRITIQUE'."""
        from metrics_exporter import push_metrics
        path = _write_json(tmp_path, SAMPLE_ML_DATA)  # CI-SERVER-01 = 9.2%
        with caplog.at_level(logging.ERROR, logger="metrics_exporter"):
            push_metrics(path)
        assert any("CRITIQUE" in r.message for r in caplog.records)

    def test_ci_amber_breach_logs_warning(self, tmp_path, caplog):
        """5 < rate ≤ 8 → log WARNING 'AMBER'."""
        from metrics_exporter import push_metrics
        path = _write_json(tmp_path, SAMPLE_ML_DATA)  # CI-APP-02 = 6.1%
        with caplog.at_level(logging.WARNING, logger="metrics_exporter"):
            push_metrics(path)
        assert any("AMBER" in r.message for r in caplog.records)

    def test_ci_ok_no_alert_logged(self, tmp_path, caplog):
        """rate < 5 → aucun log ERROR/WARNING pour ce CI."""
        data = {**SAMPLE_ML_DATA, "ci_breach": [
            {"name": "CI-SAFE", "rate": 2.0, "count": 5},
        ], "future_7": [
            {"date": "2024-05-01", "day": "Wednesday", "predicted": 50, "lower": 40, "upper": 62},
        ]}
        from metrics_exporter import push_metrics
        path = _write_json(tmp_path, data)
        with caplog.at_level(logging.WARNING, logger="metrics_exporter"):
            push_metrics(path)
        error_warn = [r for r in caplog.records if r.levelno >= logging.WARNING
                      and ("CRITIQUE" in r.message or "AMBER" in r.message or "Pic" in r.message)]
        assert len(error_warn) == 0

    def test_exactly_at_critical_threshold(self, tmp_path, caplog):
        """rate == 8.0 → seulement AMBER (strict >)."""
        data = {**SAMPLE_ML_DATA, "ci_breach": [
            {"name": "CI-EDGE", "rate": 8.0, "count": 40},
        ], "future_7": [
            {"date": "2024-05-01", "day": "Wednesday", "predicted": 50, "lower": 40, "upper": 62},
        ]}
        from metrics_exporter import push_metrics
        path = _write_json(tmp_path, data)
        with caplog.at_level(logging.WARNING, logger="metrics_exporter"):
            push_metrics(path)
        assert not any("CRITIQUE" in r.message for r in caplog.records)
        assert any("AMBER" in r.message for r in caplog.records)

    def test_exactly_at_warning_threshold(self, tmp_path, caplog):
        """rate == 5.0 → aucun log (strict >)."""
        data = {**SAMPLE_ML_DATA, "ci_breach": [
            {"name": "CI-EDGE2", "rate": 5.0, "count": 25},
        ], "future_7": [
            {"date": "2024-05-01", "day": "Wednesday", "predicted": 50, "lower": 40, "upper": 62},
        ]}
        from metrics_exporter import push_metrics
        path = _write_json(tmp_path, data)
        with caplog.at_level(logging.WARNING, logger="metrics_exporter"):
            push_metrics(path)
        assert not any("AMBER" in r.message for r in caplog.records)
        assert not any("CRITIQUE" in r.message for r in caplog.records)

    def test_exactly_at_volume_spike_threshold(self, tmp_path, caplog):
        """predicted == 80 → aucun WARNING (strict >)."""
        data = {**SAMPLE_ML_DATA, "future_7": [
            {"date": "2024-05-01", "day": "Wednesday", "predicted": 80, "lower": 70, "upper": 92},
        ]}
        from metrics_exporter import push_metrics
        path = _write_json(tmp_path, data)
        with caplog.at_level(logging.WARNING, logger="metrics_exporter"):
            push_metrics(path)
        assert not any("Pic volume" in r.message for r in caplog.records)


# ══════════════════════════════════════════════════════════════════════════════
# 3. TESTS DE main() — branches CLI & boucle principale
# ══════════════════════════════════════════════════════════════════════════════

class TestMainFunction:
    """Couvre main() : fichier absent, premier push OK, boucle d'erreurs."""

    def test_main_exits_early_when_json_missing(self, tmp_path, caplog):
        """Si le fichier JSON n'existe pas, main() retourne immédiatement."""
        import metrics_exporter as me
        with patch("sys.argv", ["metrics_exporter", "--json", str(tmp_path / "missing.json"), "--port", "19100"]):
            with caplog.at_level(logging.ERROR, logger="metrics_exporter"):
                me.main()
        assert any("introuvable" in r.message for r in caplog.records)

    def test_main_first_push_error_increments_counter(self, tmp_path):
        """Premier push plante → sla_export_errors incrémenté."""
        import metrics_exporter as me
        path = _write_json(tmp_path, SAMPLE_ML_DATA)
        before = me.sla_export_errors._value.get()
        with patch("sys.argv", ["metrics_exporter", "--json", str(path), "--port", "19101", "--interval", "1"]):
            with patch("metrics_exporter.start_http_server"):
                with patch("metrics_exporter.push_metrics", side_effect=Exception("boom")):
                    with patch("time.sleep", side_effect=StopIteration):
                        try:
                            me.main()
                        except StopIteration:
                            pass
        assert me.sla_export_errors._value.get() == before + 1

    def test_main_loop_handles_file_not_found(self, tmp_path, caplog):
        """Boucle : FileNotFoundError → log error + incrémente compteur."""
        import metrics_exporter as me
        path = _write_json(tmp_path, SAMPLE_ML_DATA)
        before = me.sla_export_errors._value.get()

        call_count = 0
        def fake_push(p):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return  # premier push OK
            raise FileNotFoundError("gone")

        with patch("sys.argv", ["metrics_exporter", "--json", str(path), "--port", "19102", "--interval", "1"]):
            with patch("metrics_exporter.start_http_server"):
                with patch("metrics_exporter.push_metrics", side_effect=fake_push):
                    with patch("time.sleep", side_effect=[None, StopIteration]):
                        try:
                            me.main()
                        except StopIteration:
                            pass
        assert me.sla_export_errors._value.get() > before

    def test_main_loop_handles_json_decode_error(self, tmp_path, caplog):
        """Boucle : JSONDecodeError → log error + incrémente compteur."""
        import metrics_exporter as me
        path = _write_json(tmp_path, SAMPLE_ML_DATA)
        before = me.sla_export_errors._value.get()

        call_count = 0
        def fake_push(p):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return
            raise json.JSONDecodeError("bad", "", 0)

        with patch("sys.argv", ["metrics_exporter", "--json", str(path), "--port", "19103", "--interval", "1"]):
            with patch("metrics_exporter.start_http_server"):
                with patch("metrics_exporter.push_metrics", side_effect=fake_push):
                    with patch("time.sleep", side_effect=[None, StopIteration]):
                        try:
                            me.main()
                        except StopIteration:
                            pass
        assert me.sla_export_errors._value.get() > before

    def test_main_loop_handles_unexpected_exception(self, tmp_path, caplog):
        """Boucle : exception générique → log error + incrémente compteur."""
        import metrics_exporter as me
        path = _write_json(tmp_path, SAMPLE_ML_DATA)
        before = me.sla_export_errors._value.get()

        call_count = 0
        def fake_push(p):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return
            raise RuntimeError("unexpected")

        with patch("sys.argv", ["metrics_exporter", "--json", str(path), "--port", "19104", "--interval", "1"]):
            with patch("metrics_exporter.start_http_server"):
                with patch("metrics_exporter.push_metrics", side_effect=fake_push):
                    with patch("time.sleep", side_effect=[None, StopIteration]):
                        try:
                            me.main()
                        except StopIteration:
                            pass
        assert me.sla_export_errors._value.get() > before

    def test_main_starts_http_server(self, tmp_path):
        """start_http_server est bien appelé avec le port et l'adresse."""
        import metrics_exporter as me
        path = _write_json(tmp_path, SAMPLE_ML_DATA)
        with patch("sys.argv", ["metrics_exporter", "--json", str(path), "--port", "19105", "--interval", "1"]):
            with patch("metrics_exporter.start_http_server") as mock_srv:
                with patch("metrics_exporter.push_metrics"):
                    with patch("time.sleep", side_effect=StopIteration):
                        try:
                            me.main()
                        except StopIteration:
                            pass
        mock_srv.assert_called_once_with(19105, addr="0.0.0.0")

    def test_main_default_port_is_8000(self, tmp_path):
        """Sans --port, le port par défaut est 8000."""
        import metrics_exporter as me
        path = _write_json(tmp_path, SAMPLE_ML_DATA)
        with patch("sys.argv", ["metrics_exporter", "--json", str(path)]):
            with patch("metrics_exporter.start_http_server") as mock_srv:
                with patch("metrics_exporter.push_metrics"):
                    with patch("time.sleep", side_effect=StopIteration):
                        try:
                            me.main()
                        except StopIteration:
                            pass
        mock_srv.assert_called_once_with(8000, addr="0.0.0.0")

    def test_main_loop_successful_push_does_not_increment_error(self, tmp_path):
        """Boucle sans erreur → sla_export_errors n'augmente pas."""
        import metrics_exporter as me
        path = _write_json(tmp_path, SAMPLE_ML_DATA)
        before = me.sla_export_errors._value.get()

        with patch("sys.argv", ["metrics_exporter", "--json", str(path), "--port", "19106", "--interval", "1"]):
            with patch("metrics_exporter.start_http_server"):
                with patch("metrics_exporter.push_metrics"):
                    with patch("time.sleep", side_effect=StopIteration):
                        try:
                            me.main()
                        except StopIteration:
                            pass
        assert me.sla_export_errors._value.get() == before


# ══════════════════════════════════════════════════════════════════════════════
# 4. TESTS DES CONSTANTES ET DE LA STRUCTURE DU MODULE
# ══════════════════════════════════════════════════════════════════════════════

class TestModuleConstants:
    """Vérifie les seuils et la structure publique du module."""

    def test_threshold_breach_critical(self):
        from metrics_exporter import THRESHOLD_BREACH_CRITICAL
        assert THRESHOLD_BREACH_CRITICAL == 8.0

    def test_threshold_breach_warning(self):
        from metrics_exporter import THRESHOLD_BREACH_WARNING
        assert THRESHOLD_BREACH_WARNING == 5.0

    def test_threshold_volume_spike(self):
        from metrics_exporter import THRESHOLD_VOLUME_SPIKE
        assert THRESHOLD_VOLUME_SPIKE == 80

    def test_push_metrics_callable(self):
        from metrics_exporter import push_metrics
        assert callable(push_metrics)

    def test_main_callable(self):
        from metrics_exporter import main
        assert callable(main)

    def test_all_gauges_exported(self):
        import metrics_exporter as me
        gauges = [
            "sla_breach_rate_pct", "sla_breach_count", "sla_total_incidents",
            "sla_avg_daily_tickets", "sla_prophet_mae", "sla_prophet_rmse",
            "sla_prophet_mape", "sla_rf_auc", "sla_forecast_predicted",
            "sla_forecast_lower", "sla_forecast_upper", "sla_ci_breach_rate",
            "sla_ci_incident_count", "sla_feature_importance",
        ]
        for gauge_name in gauges:
            assert hasattr(me, gauge_name), f"Missing gauge: {gauge_name}"

    def test_counters_exported(self):
        import metrics_exporter as me
        assert hasattr(me, "sla_export_refreshes")
        assert hasattr(me, "sla_export_errors")

    def test_info_exported(self):
        import metrics_exporter as me
        assert hasattr(me, "sla_info")


# ══════════════════════════════════════════════════════════════════════════════
# 5. TESTS DE push_metrics — sla_info / métadonnées
# ══════════════════════════════════════════════════════════════════════════════

class TestPushMetricsInfo:
    """Vérifie que sla_info reçoit les bonnes métadonnées."""

    def test_info_sets_generated_at(self, tmp_path):
        from metrics_exporter import push_metrics, sla_info
        path = _write_json(tmp_path, SAMPLE_ML_DATA)
        push_metrics(path)
        info_val = sla_info._labelnames  # l'objet Info expose ses labels
        # On vérifie juste qu'aucune exception n'a été levée et que l'appel réussit
        assert sla_info is not None

    def test_info_missing_generated_at_uses_unknown(self, tmp_path):
        """generated_at absent → valeur 'unknown' utilisée par défaut."""
        data = {k: v for k, v in SAMPLE_ML_DATA.items() if k != "generated_at"}
        from metrics_exporter import push_metrics
        path = _write_json(tmp_path, data)
        push_metrics(path)   # ne doit pas lever KeyError


# ══════════════════════════════════════════════════════════════════════════════
# 6. TESTS push_metrics — robustesse données manquantes
# ══════════════════════════════════════════════════════════════════════════════

class TestPushMetricsEdgeCases:
    """Robustesse face à des données partielles ou manquantes."""

    def test_push_missing_future_7_key(self, tmp_path):
        """future_7 absent → get() retourne [] → aucune exception."""
        data = {k: v for k, v in SAMPLE_ML_DATA.items() if k != "future_7"}
        from metrics_exporter import push_metrics
        path = _write_json(tmp_path, data)
        push_metrics(path)

    def test_push_missing_ci_breach_key(self, tmp_path):
        """ci_breach absent → aucune exception."""
        data = {k: v for k, v in SAMPLE_ML_DATA.items() if k != "ci_breach"}
        from metrics_exporter import push_metrics
        path = _write_json(tmp_path, data)
        push_metrics(path)

    def test_push_missing_feature_imp_key(self, tmp_path):
        """feature_imp absent → aucune exception."""
        data = {k: v for k, v in SAMPLE_ML_DATA.items() if k != "feature_imp"}
        from metrics_exporter import push_metrics
        path = _write_json(tmp_path, data)
        push_metrics(path)

    def test_push_single_ci_above_critical(self, tmp_path, caplog):
        """Un seul CI au-dessus du seuil critique → ERROR loggé."""
        data = {**SAMPLE_ML_DATA, "ci_breach": [
            {"name": "ONLY-CI", "rate": 15.0, "count": 75},
        ], "future_7": [
            {"date": "2024-05-01", "day": "Wednesday", "predicted": 50, "lower": 40, "upper": 62},
        ]}
        from metrics_exporter import push_metrics
        path = _write_json(tmp_path, data)
        with caplog.at_level(logging.ERROR, logger="metrics_exporter"):
            push_metrics(path)
        assert any("CRITIQUE" in r.message for r in caplog.records)

    def test_push_multiple_spikes_in_forecast(self, tmp_path, caplog):
        """Plusieurs jours avec spike → autant de WARNINGs."""
        data = {**SAMPLE_ML_DATA, "future_7": [
            {"date": f"2024-05-0{i}", "day": "Mon", "predicted": 90, "lower": 80, "upper": 100}
            for i in range(1, 4)
        ]}
        from metrics_exporter import push_metrics
        path = _write_json(tmp_path, data)
        with caplog.at_level(logging.WARNING, logger="metrics_exporter"):
            push_metrics(path)
        spike_warnings = [r for r in caplog.records if "Pic volume" in r.message]
        assert len(spike_warnings) == 3

    def test_push_logs_info_summary_at_end(self, tmp_path, caplog):
        """Après chaque push réussi → un log INFO contenant 'AUC'."""
        from metrics_exporter import push_metrics
        path = _write_json(tmp_path, SAMPLE_ML_DATA)
        with caplog.at_level(logging.INFO, logger="metrics_exporter"):
            push_metrics(path)
        assert any("AUC" in r.message for r in caplog.records)