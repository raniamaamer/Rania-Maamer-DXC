-- ============================================================
--  DXC KPI Intelligence Dashboard — PostgreSQL Schema
--  Sprint 1 | Migrated from SQLite → PostgreSQL
--  Compatible with Django ORM (managed tables)
-- ============================================================

-- ── Extensions ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- for fuzzy queue/account search

-- ── Database & User ────────────────────────────────────────
-- Run as superuser before Django setup:
-- CREATE DATABASE dxc_kpi_db;
-- CREATE USER dxc_user WITH ENCRYPTED PASSWORD 'dxc_secure_pass';
-- GRANT ALL PRIVILEGES ON DATABASE dxc_kpi_db TO dxc_user;
-- ALTER USER dxc_user CREATEDB;  -- needed for test runner

-- ── Table: sla_config ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS sla_config (
    id                  BIGSERIAL       PRIMARY KEY,
    account             VARCHAR(100)    NOT NULL UNIQUE,
    ans_rate_formula    VARCHAR(200),
    abd_rate_formula    VARCHAR(200),
    timeframe_bh        INTEGER         NOT NULL DEFAULT 40
                            CHECK (timeframe_bh BETWEEN 10 AND 120),
    ooh                 INTEGER         DEFAULT 0,
    ans_sla             VARCHAR(100),
    abd_sla             VARCHAR(100),
    target_ans_rate     DOUBLE PRECISION NOT NULL DEFAULT 0.8
                            CHECK (target_ans_rate BETWEEN 0 AND 1),
    target_abd_rate     DOUBLE PRECISION NOT NULL DEFAULT 0.05
                            CHECK (target_abd_rate BETWEEN 0 AND 1),
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sla_account ON sla_config USING btree (account);

-- ── Table: queue_metrics (main fact table) ─────────────────
CREATE TABLE IF NOT EXISTS queue_metrics (
    id                  BIGSERIAL       PRIMARY KEY,
    queue               VARCHAR(200)    NOT NULL,
    account             VARCHAR(100),
    sla_config_id       BIGINT          REFERENCES sla_config(id) ON DELETE SET NULL,

    -- Time dimensions
    start_date          TIMESTAMPTZ     NOT NULL,
    end_date            TIMESTAMPTZ,
    hour                VARCHAR(5),                        -- HH:MM
    year                INTEGER         NOT NULL,
    month               INTEGER         NOT NULL CHECK (month BETWEEN 1 AND 12),
    week                INTEGER         CHECK (week BETWEEN 1 AND 53),
    day_of_week         VARCHAR(20),

    -- Volume
    offered             INTEGER         NOT NULL DEFAULT 0,
    abandoned           INTEGER         NOT NULL DEFAULT 0,
    answered            INTEGER         NOT NULL DEFAULT 0,
    ans_in_sla          DOUBLE PRECISION DEFAULT 0.0,
    abd_in_sla          DOUBLE PRECISION DEFAULT 0.0,
    callback_contacts   INTEGER         DEFAULT 0,

    -- Rates (0.0 – 1.0)
    sla_rate            DOUBLE PRECISION NOT NULL DEFAULT 0.0
                            CHECK (sla_rate BETWEEN 0 AND 1),
    abandon_rate        DOUBLE PRECISION NOT NULL DEFAULT 0.0
                            CHECK (abandon_rate BETWEEN 0 AND 1),
    answer_rate         DOUBLE PRECISION NOT NULL DEFAULT 0.0
                            CHECK (answer_rate BETWEEN 0 AND 1),

    -- Time metrics (seconds)
    avg_handle_time     DOUBLE PRECISION DEFAULT 0.0,
    avg_answer_time     DOUBLE PRECISION DEFAULT 0.0,
    customer_hold_time  DOUBLE PRECISION DEFAULT 0.0,

    -- Denormalized SLA targets (for fast queries without JOIN)
    target_ans_rate     DOUBLE PRECISION DEFAULT 0.8,
    target_abd_rate     DOUBLE PRECISION DEFAULT 0.05,
    timeframe_bh        INTEGER         DEFAULT 40,

    -- Compliance flags
    sla_compliant       BOOLEAN         NOT NULL DEFAULT FALSE,
    abd_compliant       BOOLEAN         NOT NULL DEFAULT FALSE,

    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Composite indexes for dashboard queries
CREATE INDEX IF NOT EXISTS idx_qm_account_period   ON queue_metrics (account, year, month);
CREATE INDEX IF NOT EXISTS idx_qm_date_account     ON queue_metrics (start_date, account);
CREATE INDEX IF NOT EXISTS idx_qm_compliance       ON queue_metrics (sla_compliant, account);
CREATE INDEX IF NOT EXISTS idx_qm_period           ON queue_metrics (year, month, week);
CREATE INDEX IF NOT EXISTS idx_qm_queue_trgm       ON queue_metrics USING gin (queue gin_trgm_ops);

-- Partial index: non-compliant records (for alerts)
CREATE INDEX IF NOT EXISTS idx_qm_breached ON queue_metrics (account, sla_rate)
    WHERE sla_compliant = FALSE;

-- ── Table: account_summary (pre-aggregated) ────────────────
CREATE TABLE IF NOT EXISTS account_summary (
    id                  BIGSERIAL       PRIMARY KEY,
    account             VARCHAR(100)    NOT NULL UNIQUE,
    offered             INTEGER         NOT NULL DEFAULT 0,
    abandoned           INTEGER         NOT NULL DEFAULT 0,
    answered            INTEGER         NOT NULL DEFAULT 0,
    sla_rate            DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    abandon_rate        DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    answer_rate         DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    avg_handle_time     DOUBLE PRECISION DEFAULT 0.0,
    target_ans_rate     DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    target_abd_rate     DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    sla_compliant       BOOLEAN         NOT NULL DEFAULT FALSE,
    abd_compliant       BOOLEAN         NOT NULL DEFAULT FALSE,
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Generated column: SLA gap
ALTER TABLE account_summary
    ADD COLUMN IF NOT EXISTS sla_gap DOUBLE PRECISION
    GENERATED ALWAYS AS (sla_rate - target_ans_rate) STORED;

CREATE INDEX IF NOT EXISTS idx_as_sla_gap ON account_summary (sla_gap);

-- ── Table: hourly_trends ───────────────────────────────────
CREATE TABLE IF NOT EXISTS hourly_trends (
    id                  BIGSERIAL       PRIMARY KEY,
    hour                VARCHAR(5)      NOT NULL,           -- HH:MM
    date                DATE            NOT NULL,
    account             VARCHAR(100)    NOT NULL,
    offered             INTEGER         NOT NULL DEFAULT 0,
    abandoned           INTEGER         NOT NULL DEFAULT 0,
    answered            INTEGER         DEFAULT 0,
    sla_rate            DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    abandon_rate        DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    UNIQUE (date, hour, account)
);

CREATE INDEX IF NOT EXISTS idx_ht_date_account ON hourly_trends (date, account);
CREATE INDEX IF NOT EXISTS idx_ht_hour         ON hourly_trends (hour);

-- ── Table: daily_snapshots ─────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_snapshots (
    id                  BIGSERIAL       PRIMARY KEY,
    date                DATE            NOT NULL UNIQUE,
    total_offered       INTEGER         NOT NULL DEFAULT 0,
    total_abandoned     INTEGER         NOT NULL DEFAULT 0,
    total_answered      INTEGER         NOT NULL DEFAULT 0,
    global_sla_rate     DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    global_abandon_rate DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    global_answer_rate  DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    compliant_accounts  INTEGER         NOT NULL DEFAULT 0,
    total_accounts      INTEGER         NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ds_date ON daily_snapshots (date DESC);

-- ── View: account_kpi_view ─────────────────────────────────
-- Materialized view for fast dashboard reads
CREATE MATERIALIZED VIEW IF NOT EXISTS account_kpi_view AS
SELECT
    account,
    SUM(offered)        AS total_offered,
    SUM(abandoned)      AS total_abandoned,
    SUM(answered)       AS total_answered,
    AVG(sla_rate)       AS avg_sla_rate,
    AVG(abandon_rate)   AS avg_abandon_rate,
    AVG(answer_rate)    AS avg_answer_rate,
    MAX(target_ans_rate) AS target_ans_rate,
    MAX(target_abd_rate) AS target_abd_rate,
    AVG(avg_handle_time) AS avg_handle_time,
    BOOL_AND(sla_compliant) AS sla_compliant,
    COUNT(DISTINCT queue) AS unique_queues,
    MAX(start_date)     AS last_data_date
FROM queue_metrics
GROUP BY account;

CREATE UNIQUE INDEX IF NOT EXISTS idx_akv_account ON account_kpi_view (account);

-- Refresh command (run after ETL):
-- REFRESH MATERIALIZED VIEW CONCURRENTLY account_kpi_view;

-- ── Trigger: update sla_config updated_at ──────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_sla_config_updated_at ON sla_config;
CREATE TRIGGER update_sla_config_updated_at
    BEFORE UPDATE ON sla_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Grants ──────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO dxc_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO dxc_user;
GRANT SELECT ON account_kpi_view TO dxc_user;
