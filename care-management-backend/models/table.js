const { Client } = require('pg');
require('dotenv').config();
const pool = require('./db'); 

// Step 1: Create the main database if not exists
const createDatabase = async () => {
  const client = new Client({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: 'postgres' // Connect to default to check for existence
  });

  try {
    await client.connect();
    const dbName = process.env.DB_NAME;

    const result = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName]
    );

    if (result.rowCount === 0) {
      await client.query(`CREATE DATABASE ${dbName}`);
      console.log(`✅ Database '${dbName}' created`);
    } else {
      console.log(`ℹ️ Database '${dbName}' already exists`);
    }
  } catch (err) {
    console.error('❌ Error creating database:', err);
  } finally {
    await client.end();
  }
};

// Step 2: Create tables inside the target database
const createTables = async () => {
  try {
    await pool.query(`CREATE EXTENSION IF NOT EXISTS citext;`);

    
    await pool.query(`

        CREATE TABLE hospitals (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );


      
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email CITEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        is_admin BOOLEAN DEFAULT FALSE,
        is_staff BOOLEAN DEFAULT TRUE,
        is_super_admin BOOLEAN DEFAULT FALSE,
        is_verified BOOLEAN DEFAULT FALSE,
         is_approved BOOLEAN DEFAULT FALSE, 
        reset_token TEXT,
        reset_token_expires TIMESTAMP  WITH TIME ZONE,
        created_at TIMESTAMP  WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        hospital_id INTEGER NOT NULL REFERENCES hospitals(id),
        has_global_access BOOLEAN DEFAULT FALSE;
      );

  CREATE TABLE IF NOT EXISTS patients (
          id SERIAL PRIMARY KEY,
          first_name VARCHAR(50) NOT NULL,
          last_name VARCHAR(50) NOT NULL,
          birth_date DATE NOT NULL,
          age INTEGER, 
          bed_id VARCHAR(20),
          medical_info TEXT,
          status VARCHAR(50) DEFAULT 'Admitted',
          discharge_date TIMESTAMP WITH TIME ZONE,
          discharge_note TEXT,
          mrn VARCHAR(50),
          admitted_date TIMESTAMP WITH TIME ZONE,

          is_behavioral BOOLEAN DEFAULT FALSE,
          is_restrained BOOLEAN DEFAULT FALSE, 
          is_geriatric_psych_available BOOLEAN DEFAULT FALSE,
          is_behavioral_team  BOOLEAN DEFAULT FALSE,


          is_ltc BOOLEAN DEFAULT FALSE,
          is_ltc_financial BOOLEAN DEFAULT FALSE,
          is_ltc_medical BOOLEAN DEFAULT FALSE,
       
          is_guardianship BOOLEAN DEFAULT FALSE,
          is_guardianship_financial BOOLEAN DEFAULT FALSE,
          is_guardianship_person  BOOLEAN DEFAULT FALSE,
          is_guardianship_emergency BOOLEAN DEFAULT FALSE,
          guardianship_court_datetime TIMESTAMP WITH TIME ZONE DEFAULT NULL,
          ltc_court_datetime TIMESTAMP WITH TIME ZONE DEFAULT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          added_by_user_id INTEGER REFERENCES users(id),
          selected_algorithms TEXT[] DEFAULT '{}',
          hospital_id INTEGER NOT NULL REFERENCES hospitals(id),
      );


      CREATE TABLE IF NOT EXISTS patient_staff (
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        staff_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (patient_id, staff_id)
    );

      CREATE TABLE IF NOT EXISTS tasks (
          id SERIAL PRIMARY KEY,
          name VARCHAR(200) NOT NULL UNIQUE,
          description TEXT,
          is_repeating BOOLEAN DEFAULT FALSE,  -- Determines if the task should repeat
          recurrence_interval INTEGER,  -- Number of days before it repeats (e.g., 7 for weekly)
          max_repeats INTEGER DEFAULT NULL,  -- Maximum times a task can repeat (NULL = unlimited)
          condition_required TEXT,  -- e.g., "If patient is > 65", "If restrained"
          category VARCHAR(100),  -- e.g., "Medication", "Psychiatry", "Documentation"
          due_in_days_after_dependency INTEGER DEFAULT NULL,
          is_non_blocking BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP  WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          algorithm VARCHAR(50),
          is_overridable BOOLEAN DEFAULT FALSE,
          is_court_date BOOLEAN DEFAULT FALSE
      );

     
      CREATE TABLE IF NOT EXISTS patient_tasks (
          id SERIAL PRIMARY KEY,
          patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
          task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          status VARCHAR(50) DEFAULT 'Pending',  -- Pending, In Progress, Completed, Missed, FollowUp,Completed with Delay
          due_date TIMESTAMP  WITH TIME ZONE ,
          completed_at TIMESTAMP  WITH TIME ZONE ,
           ideal_due_date TIMESTAMP  WITH TIME ZONE ,
          status_history JSONB DEFAULT '[]',
          started_at TIMESTAMP  WITH TIME ZONE ,
          created_at TIMESTAMP  WITH TIME ZONE  DEFAULT CURRENT_TIMESTAMP,
          task_note TEXT,
          include_note_in_report BOOLEAN DEFAULT false,
          contact_info TEXT,
          override_due_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
          is_visible BOOLEAN DEFAULT TRUE,
          );

        CREATE TABLE IF NOT EXISTS notes (
            id SERIAL PRIMARY KEY,
            patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
            staff_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            note_text TEXT NOT NULL,
            created_at TIMESTAMP  WITH TIME ZONE  DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE task_dependencies (
          task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
          depends_on_task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
          PRIMARY KEY (task_id, depends_on_task_id)
        );

        CREATE TABLE notifications (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          patient_id INTEGER REFERENCES patients(id),
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          created_at TIMESTAMP  WITH TIME ZONE DEFAULT NOW(),
          read BOOLEAN DEFAULT FALSE
        );

    
    `);

    console.log('Tables created successfully');
  } catch (err) {
    console.error('Error creating tables:', err);
  } finally {
    await pool.end();
  }
};

// Step 3: Run init
const init = async () => {
  await createTables();
};

init();
