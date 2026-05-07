const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: './backend/.env' });

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true
};

const DB_NAME = process.env.DB_NAME || 'ihrms_db';
const SQL_DIR = path.join(__dirname, 'backend', 'database');

async function reset() {
    let connection;
    try {
        console.log('🚀 Starting Database Reset...');
        
        connection = await mysql.createConnection(dbConfig);
        console.log('✅ Connected to MySQL.');

        // 1. Drop and Recreate Database
        console.log(`🗑️  Dropping database ${DB_NAME}...`);
        await connection.query(`DROP DATABASE IF EXISTS ${DB_NAME}`);
        console.log(`✨ Creating database ${DB_NAME}...`);
        await connection.query(`CREATE DATABASE ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        await connection.query(`USE ${DB_NAME}`);

        // 2. Get and sort SQL files
        const files = fs.readdirSync(SQL_DIR).filter(f => f.startsWith('v') && f.endsWith('.sql'));
        
        const sortedFiles = files.sort((a, b) => {
            const extract = (s) => {
                const m = s.match(/v(\d+)\.(\d+)/);
                return m ? [parseInt(m[1], 10), parseInt(m[2], 10)] : [0, 0];
            };
            const [majA, minA] = extract(a);
            const [majB, minB] = extract(b);
            
            if (majA !== majB) return majA - majB;
            return minA - minB;
        });

        console.log('📦 Migration sequence:', sortedFiles.join(' -> '));

        // 3. Execute Migrations
        for (const file of sortedFiles) {
            console.log(`⌛ Executing ${file}...`);
            const sql = fs.readFileSync(path.join(SQL_DIR, file), 'utf8');
            // Remove 'USE ihrms_db;' if present to avoid conflicts with DB_NAME variable if it's different
            const cleanSql = sql.replace(/USE\s+[`]?\w+[`]?\s*;/gi, '');
            await connection.query(cleanSql);
            console.log(`✅ ${file} completed.`);
        }

        // 4. Run additional seeds if they exist
        const seedFiles = ['seed_test.sql']; 
        for (const seed of seedFiles) {
            const seedPath = path.join(SQL_DIR, seed);
            if (fs.existsSync(seedPath)) {
                console.log(`🌱 Running seed ${seed}...`);
                const seedSql = fs.readFileSync(seedPath, 'utf8');
                await connection.query(seedSql);
                console.log(`✅ Seed ${seed} completed.`);
            }
        }

        console.log('\n🏆 DATABASE RESET SUCCESSFUL! All migrations and seeds applied.');

    } catch (error) {
        console.error('\n❌ DATABASE RESET FAILED:');
        console.error(error.message);
        process.exit(1);
    } finally {
        if (connection) await connection.end();
    }
}

reset();
