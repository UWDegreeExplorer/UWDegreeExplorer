import { pool } from "./packages/db/src/index";
import dotenv from "dotenv";
dotenv.config();

async function check() {
  const client = await pool.connect();
  try {
    const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log("Tables:", res.rows.map(r => r.table_name));
    
    const migrations = await client.query("SELECT * FROM drizzle_migrations");
    console.log("Migrations count:", migrations.rowCount);
    console.log("Last migration:", migrations.rows[migrations.rowCount - 1]);
  } catch (err) {
    console.error(err);
  } finally {
    client.release();
    process.exit();
  }
}

check();
