const fs = require('fs');
const db = require('./backend/config/db');

const seedFile = 'c:\\Users\\Win 11\\HTQL\\backend\\database\\v1.12.sql';
const sql = fs.readFileSync(seedFile, 'utf8');

// Split by semicolon and execute each statement
const statements = sql.split(';').filter(s => s.trim().length > 0);

async function runSeed() {
  try {
    console.log(`Executing ${statements.length} SQL statements...`);
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim();
      if (stmt.length > 0) {
        console.log(`[${i + 1}/${statements.length}] Executing...`);
        await db.query(stmt);
      }
    }
    console.log('✅ Seed v1.12 completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  }
}

runSeed();
