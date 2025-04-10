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
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password TEXT NOT NULL,
        is_admin BOOLEAN DEFAULT FALSE,
        is_staff BOOLEAN DEFAULT TRUE,
        is_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

  CREATE TABLE IF NOT EXISTS patients (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          birth_date DATE NOT NULL,
          age INTEGER, 
          bed_id VARCHAR(20),
          medical_info TEXT,
          status VARCHAR(50) DEFAULT 'Admitted',
          assigned_staff_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          is_behavioral BOOLEAN DEFAULT FALSE,
          is_restrained BOOLEAN DEFAULT FALSE,  -- Auto-calculated
          is_geriatric_psych_available BOOLEAN DEFAULT FALSE,
          is_behavioral_team  BOOLEAN DEFAULT FALSE,
          is_ltc BOOLEAN DEFAULT FALSE,
          is_guardianship BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tasks (
          id SERIAL PRIMARY KEY,
          name VARCHAR(150) NOT NULL UNIQUE,
          description TEXT,
          is_repeating BOOLEAN DEFAULT FALSE,  -- Determines if the task should repeat
          recurrence_interval INTEGER,  -- Number of days before it repeats (e.g., 7 for weekly)
          max_repeats INTEGER DEFAULT NULL,  -- Maximum times a task can repeat (NULL = unlimited)
          condition_required TEXT,  -- e.g., "If patient is > 65", "If restrained"
          category VARCHAR(100),  -- e.g., "Medication", "Psychiatry", "Documentation"
          dependency_task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,  -- Links tasks that should be moved if a related task is missed
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          
        
      );

     
      CREATE TABLE IF NOT EXISTS patient_tasks (
          id SERIAL PRIMARY KEY,
          patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
          task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
         assigned_staff_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          status VARCHAR(50) DEFAULT 'Pending',  -- Pending, In Progress, Completed, Missed
          due_date DATE,
          completed_at TIMESTAMP,
          status_history JSONB DEFAULT '[]',
          started_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
CREATE TABLE IF NOT EXISTS notes (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
    staff_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    note_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
  await createDatabase();
  await createTables();
};

init();
