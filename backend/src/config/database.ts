import { Pool } from 'pg';

const pool = new Pool({
  user: process.env.DB_USER || 'triasluthfiana',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'ai_email_sorter',
  password: process.env.DB_PASSWORD || '',
  port: parseInt(process.env.DB_PORT || '5432'),
});

// Function to migrate database schema
export async function migrateDatabase() {
  try {
    console.log('Checking database schema...');
    
    // Check if clean_text column exists
    const checkColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'emails' AND column_name = 'clean_text'
    `);
    
    if (checkColumn.rows.length === 0) {
      console.log('Adding clean_text column to emails table...');
      await pool.query(`
        ALTER TABLE emails 
        ADD COLUMN clean_text TEXT
      `);
      console.log('✅ clean_text column added successfully');
    } else {
      console.log('✅ clean_text column already exists');
    }
    
  } catch (error) {
    console.error('Error during database migration:', error);
    throw error;
  }
}

export default pool; 