"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrateDatabase = migrateDatabase;
const pg_1 = require("pg");
const pool = new pg_1.Pool({
    user: process.env.DB_USER || 'triasluthfiana',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'ai_email_sorter',
    password: process.env.DB_PASSWORD || '',
    port: parseInt(process.env.DB_PORT || '5432'),
});
// Function to migrate database schema
async function migrateDatabase() {
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
        }
        else {
            console.log('✅ clean_text column already exists');
        }
    }
    catch (error) {
        console.error('Error during database migration:', error);
        throw error;
    }
}
exports.default = pool;
//# sourceMappingURL=database.js.map