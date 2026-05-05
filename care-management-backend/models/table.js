const { Client } = require('pg');
require('dotenv').config();
const pool = require('./db');

// ─── Step 1: Create the database if it doesn't exist ───────────────────────
const createDatabase = async () => {
  const client = new Client({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: 'postgres',
  });

  try {
    await client.connect();
    const dbName = process.env.DB_NAME;
    const result = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName]
    );
    if (result.rowCount === 0) {
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Database '${dbName}' created`);
    } else {
      console.log(`Database '${dbName}' already exists`);
    }
  } catch (err) {
    console.error('Error creating database:', err);
    throw err;
  } finally {
    await client.end();
  }
};

// ─── Step 2: Create tables ──────────────────────────────────────────────────
const createTables = async () => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ── Extensions ──────────────────────────────────────────────────────────
    await client.query(`CREATE EXTENSION IF NOT EXISTS citext;`);

    // ── updated_at auto-trigger function ────────────────────────────────────
    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // ── Organizations ────────────────────────────────────────────────────────
    // Orgs are the top-level entity. Each org has its own timezone.
    await client.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id          SERIAL PRIMARY KEY,
        name        TEXT NOT NULL,
        timezone    TEXT NOT NULL DEFAULT 'America/New_York',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_organizations_name ON organizations(name);

      CREATE OR REPLACE TRIGGER trg_organizations_updated_at
        BEFORE UPDATE ON organizations
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    `);

    // ── Hospitals ─────────────────────────────────────────────────────────────
    // Each hospital belongs to an org and can have its own timezone.
    // Timezone on hospital takes precedence over org timezone for all
    // date/deadline calculations for patients in that hospital.
    await client.query(`
      CREATE TABLE IF NOT EXISTS hospitals (
        id               SERIAL PRIMARY KEY,
        organization_id  INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
        name             TEXT NOT NULL,
        timezone         TEXT NOT NULL DEFAULT 'America/New_York',
        daily_room_cost  NUMERIC(10,2) NOT NULL DEFAULT 2883.00,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_hospitals_organization_id ON hospitals(organization_id);

      CREATE OR REPLACE TRIGGER trg_hospitals_updated_at
        BEFORE UPDATE ON hospitals
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    `);

    // ── Users ─────────────────────────────────────────────────────────────────
    // FIX: Replaced 3 boolean role flags with a single role enum column.
    //      This enforces mutual exclusivity at the DB level.
    // FIX: has_global_access kept for super_admins who can see across orgs.
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id                   SERIAL PRIMARY KEY,
        name                 VARCHAR(100) NOT NULL,
        email                CITEXT UNIQUE NOT NULL,
        password             TEXT NOT NULL,

        role                 VARCHAR(20) NOT NULL DEFAULT 'staff'
                               CHECK (role IN ('super_admin', 'admin', 'staff','administration')),

        is_verified          BOOLEAN NOT NULL DEFAULT FALSE,
        is_approved          BOOLEAN NOT NULL DEFAULT FALSE,
        has_global_access    BOOLEAN NOT NULL DEFAULT FALSE,

        reset_token          TEXT,
        reset_token_expires  TIMESTAMPTZ,

        hospital_id          INTEGER REFERENCES hospitals(id) ON DELETE SET NULL,
        organization_id      INTEGER REFERENCES organizations(id) ON DELETE SET NULL,

        created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_users_hospital_id     ON users(hospital_id);
      CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id);
      CREATE INDEX IF NOT EXISTS idx_users_role            ON users(role);

      CREATE OR REPLACE TRIGGER trg_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    `);

    // ── Patients ──────────────────────────────────────────────────────────────
    // FIX: Removed `age` column — computed dynamically from birth_date.
    // FIX: Removed `selected_algorithms` and `ever_selected_algorithms` TEXT[].
    //      Algorithm history is now tracked in patient_algorithms table below.
    // FIX: Removed `guardianship_court_datetime` and `ltc_court_datetime` flat
    //      columns — court dates are tasks and live in patient_tasks.
    // NOTE: is_behavioral, is_ltc, is_guardianship etc. represent the patient's
    //       CURRENT flags. Historical changes are captured in patient_update_logs.
    await client.query(`
      CREATE TABLE IF NOT EXISTS patients (
        id                         SERIAL PRIMARY KEY,
        first_name                 VARCHAR(50) NOT NULL,
        last_name                  VARCHAR(50) NOT NULL,
        birth_date                 DATE NOT NULL,

        room_no                    VARCHAR(20),
        medical_info               TEXT,
        mrn                        VARCHAR(50),

        status                     VARCHAR(50) NOT NULL DEFAULT 'Admitted'
                                     CHECK (status IN ('Admitted', 'Discharged', 'Archived')),

        admitted_date              TIMESTAMPTZ,
        discharge_date             TIMESTAMPTZ,
        discharge_note             TEXT,

        -- Care type flags (current state only — history in patient_algorithms)
        is_behavioral              BOOLEAN NOT NULL DEFAULT FALSE,
        is_restrained              BOOLEAN NOT NULL DEFAULT FALSE,
        is_geriatric_psych_available BOOLEAN NOT NULL DEFAULT FALSE,
        is_behavioral_team         BOOLEAN NOT NULL DEFAULT FALSE,

        is_ltc                     BOOLEAN NOT NULL DEFAULT FALSE,
        is_ltc_financial           BOOLEAN NOT NULL DEFAULT FALSE,
        is_ltc_medical             BOOLEAN NOT NULL DEFAULT FALSE,

        is_guardianship            BOOLEAN NOT NULL DEFAULT FALSE,
        is_guardianship_financial  BOOLEAN NOT NULL DEFAULT FALSE,
        is_guardianship_person     BOOLEAN NOT NULL DEFAULT FALSE,
        is_guardianship_emergency  BOOLEAN NOT NULL DEFAULT FALSE,

        guardianship_court_date    TIMESTAMPTZ DEFAULT NULL, 
        ltc_court_date             TIMESTAMPTZ DEFAULT NULL, 
        
        -- Archive
        is_archived                BOOLEAN NOT NULL DEFAULT FALSE,
        archived_at                TIMESTAMPTZ,
        archived_by_user_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
        archived_reason            TEXT,

        hospital_id                INTEGER NOT NULL REFERENCES hospitals(id),
        added_by_user_id           INTEGER REFERENCES users(id) ON DELETE SET NULL,

        version                    INTEGER NOT NULL DEFAULT 0,
        created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_patients_hospital_id  ON patients(hospital_id);
      CREATE INDEX IF NOT EXISTS idx_patients_status       ON patients(status);
      CREATE INDEX IF NOT EXISTS idx_patients_is_archived  ON patients(is_archived);
      CREATE INDEX IF NOT EXISTS idx_patients_mrn          ON patients(mrn);

      CREATE OR REPLACE TRIGGER trg_patients_updated_at
        BEFORE UPDATE ON patients
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    `);

    // ── Patient Algorithms (replaces TEXT[] columns) ──────────────────────────
    // FIX: Full history of algorithm assignments with timestamps.
    // removed_at = NULL means currently active.
    // This is what powers the report integrity — we can reconstruct the exact
    // care type at any point in time from this table.
    await client.query(`
      CREATE TABLE IF NOT EXISTS patient_algorithms (
        id                 SERIAL PRIMARY KEY,
        patient_id         INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        algorithm          VARCHAR(50) NOT NULL,
        assigned_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        removed_at         TIMESTAMPTZ DEFAULT NULL,
        assigned_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        removed_by_user_id  INTEGER REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_patient_algorithms_patient_id  ON patient_algorithms(patient_id);
      CREATE INDEX IF NOT EXISTS idx_patient_algorithms_active
        ON patient_algorithms(patient_id, algorithm)
        WHERE removed_at IS NULL;
    `);

    // ── Patient Staff Assignments ─────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS patient_staff (
        patient_id   INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        staff_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        access_level VARCHAR(10) NOT NULL DEFAULT 'view'
                       CHECK (access_level IN ('view', 'edit')),
        assigned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (patient_id, staff_id)
      );

      CREATE INDEX IF NOT EXISTS idx_patient_staff_staff_id ON patient_staff(staff_id);
    `);

    // ── Tasks (master task definitions) ──────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id                           SERIAL PRIMARY KEY,
        name                         VARCHAR(200) NOT NULL,
        description                  TEXT,
        is_repeating                 BOOLEAN NOT NULL DEFAULT FALSE,
        recurrence_interval          INTEGER,
        max_repeats                  INTEGER DEFAULT NULL,
        condition_required           TEXT,
        category                     VARCHAR(100),
        due_in_days_after_dependency INTEGER DEFAULT NULL,
        is_non_blocking              BOOLEAN NOT NULL DEFAULT FALSE,
        algorithm                    VARCHAR(50),
        is_overridable               BOOLEAN NOT NULL DEFAULT FALSE,
        is_court_date                BOOLEAN NOT NULL DEFAULT FALSE,
        is_manual                    BOOLEAN NOT NULL DEFAULT FALSE,
        created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_algorithm ON tasks(algorithm);

      CREATE OR REPLACE TRIGGER trg_tasks_updated_at
        BEFORE UPDATE ON tasks
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    `);

    // ── Task Dependencies ─────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS task_dependencies (
        task_id            INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        depends_on_task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        PRIMARY KEY (task_id, depends_on_task_id)
      );
    `);

    // ── Patient Tasks ─────────────────────────────────────────────────────────
    // FIX: due_date changed from DATE to TIMESTAMPTZ.
    //      Store the exact UTC moment when the task expires:
    //      i.e. "11:59 PM on due date in hospital's timezone" → converted to UTC
    //      at write time. This makes missed-task detection a simple UTC comparison.
    // FIX: ideal_due_date changed to TIMESTAMPTZ for same reason.
    // FIX: status_history JSONB replaced with patient_task_status_history table.
    await client.query(`
      CREATE TABLE IF NOT EXISTS patient_tasks (
        id                      SERIAL PRIMARY KEY,
        patient_id              INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        task_id                 INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

        status                  VARCHAR(50) NOT NULL DEFAULT 'Pending'
                                  CHECK (status IN (
                                    'Pending', 'In Progress', 'Completed',
                                    'Missed', 'Overridden', 'Waived', 'Follow Up', 'Acknowledged','Delayed Completed'
                                  )),

        -- TIMESTAMPTZ: stored as UTC, represents 11:59 PM in hospital's timezone
        due_date                TIMESTAMPTZ DEFAULT NULL,
        ideal_due_date          TIMESTAMPTZ DEFAULT NULL,

        completed_at            TIMESTAMPTZ DEFAULT NULL,
        started_at              TIMESTAMPTZ DEFAULT NULL,

        task_note               TEXT,
        include_note_in_report  BOOLEAN NOT NULL DEFAULT FALSE,
        contact_info            TEXT,

        override_count          INT NOT NULL DEFAULT 0,
        override_count_max      INT NOT NULL DEFAULT 2,
        admin_override_approval BOOLEAN NOT NULL DEFAULT FALSE,

        is_visible              BOOLEAN NOT NULL DEFAULT TRUE,

        version                 INTEGER NOT NULL DEFAULT 0,
        created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_patient_tasks_patient_id ON patient_tasks(patient_id);
      CREATE INDEX IF NOT EXISTS idx_patient_tasks_task_id    ON patient_tasks(task_id);
      CREATE INDEX IF NOT EXISTS idx_patient_tasks_status     ON patient_tasks(status);
      CREATE INDEX IF NOT EXISTS idx_patient_tasks_due_date   ON patient_tasks(due_date);

      -- Partial index: fast lookup of pending/in-progress tasks for cron jobs
      CREATE INDEX IF NOT EXISTS idx_patient_tasks_active
        ON patient_tasks(due_date)
        WHERE status IN ('Pending', 'In Progress');

      CREATE OR REPLACE TRIGGER trg_patient_tasks_updated_at
        BEFORE UPDATE ON patient_tasks
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    `);

    // ── Patient Task Status History (replaces status_history JSONB) ───────────
    // FIX: Queryable, indexable, auditable status change log.
    await client.query(`
      CREATE TABLE IF NOT EXISTS patient_task_status_history (
        id               SERIAL PRIMARY KEY,
        patient_task_id  INTEGER NOT NULL REFERENCES patient_tasks(id) ON DELETE CASCADE,
        old_status       VARCHAR(50),
        new_status       VARCHAR(50) NOT NULL,
        changed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        changed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        note             TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_pt_status_history_task_id
        ON patient_task_status_history(patient_task_id);
    `);

    // ── Task Override Requests ─────────────────────────────────────────────────
    // FIX: requested_date changed from DATE to TIMESTAMPTZ.
    await client.query(`
      CREATE TABLE IF NOT EXISTS task_override_requests (
        id              SERIAL PRIMARY KEY,
        task_id         INTEGER NOT NULL REFERENCES patient_tasks(id) ON DELETE CASCADE,
        requested_by    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        reason          TEXT NOT NULL,
        status          VARCHAR(20) NOT NULL DEFAULT 'Pending'
                          CHECK (status IN ('Pending', 'Approved', 'Rejected')),
        approved_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
        decided_at      TIMESTAMPTZ,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_override_requests_task_id
        ON task_override_requests(task_id);
      CREATE INDEX IF NOT EXISTS idx_override_requests_status
        ON task_override_requests(status)
        WHERE status = 'Pending';
    `);

    // ── Notes ─────────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id          SERIAL PRIMARY KEY,
        patient_id  INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        staff_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
        note_text   TEXT NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_notes_patient_id ON notes(patient_id);

      CREATE OR REPLACE TRIGGER trg_notes_updated_at
        BEFORE UPDATE ON notes
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    `);

    // ── Notifications ─────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id              SERIAL PRIMARY KEY,
        user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE,
        patient_id      INTEGER REFERENCES patients(id) ON DELETE CASCADE,
        patient_task_id INTEGER REFERENCES patient_tasks(id) ON DELETE CASCADE,
        title           TEXT NOT NULL,
        message         TEXT NOT NULL,
        type            TEXT NOT NULL DEFAULT 'general',
        read            BOOLEAN NOT NULL DEFAULT FALSE,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
      -- Fast unread count per user
      CREATE INDEX IF NOT EXISTS idx_notifications_unread
        ON notifications(user_id, read)
        WHERE read = FALSE;
    `);

    // ── Patient Update Logs ───────────────────────────────────────────────────
    // FIX: user_id was NOT NULL + ON DELETE SET NULL — contradiction.
    //      Changed to allow NULL so the log is preserved even if the user
    //      is deleted (audit trail must never be destroyed).
    await client.query(`
      CREATE TABLE IF NOT EXISTS patient_update_logs (
        id          SERIAL PRIMARY KEY,
        patient_id  INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
        reason      TEXT NOT NULL,
        changes     JSONB NOT NULL DEFAULT '{}',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_patient_update_logs_patient_id
        ON patient_update_logs(patient_id);
      CREATE INDEX IF NOT EXISTS idx_patient_update_logs_created_at
        ON patient_update_logs(created_at DESC);
    `);

    await client.query('COMMIT');
    console.log('All tables and indexes created successfully.');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating tables — rolled back:', err);
    throw err;
  } finally {
    client.release();
  }
};

// ─── Step 3: Useful computed column reminder ──────────────────────────────
// DO NOT store age. Query it like this wherever needed:
//
//   SELECT
//     id,
//     first_name,
//     last_name,
//     EXTRACT(YEAR FROM AGE(NOW(), birth_date))::INTEGER AS age
//   FROM patients;
//
// ─── Step 4: Due date timezone helper reminder ────────────────────────────
// When creating/updating a patient_task due_date, always compute it like:
//
//   SELECT (
//     (target_date::TEXT || ' 23:59:59')::TIMESTAMP
//     AT TIME ZONE hospital_timezone
//   ) AT TIME ZONE 'UTC' AS due_date_utc
//
// Then store due_date_utc in patient_tasks.due_date.
// This ensures missed-task detection is a simple: NOW() > due_date
//
// ─── Run ──────────────────────────────────────────────────────────────────
const init = async () => {
  await createDatabase();
  await createTables();
  await pool.end();
};

init().catch((err) => {
  console.error('Init failed:', err);
  process.exit(1);
});