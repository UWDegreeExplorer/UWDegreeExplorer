import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

console.log("Attempting to connect to:", process.env.DATABASE_URL?.replace(/:.*@/, ':****@'));

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

try {
  const client = await pool.connect();
  console.log("SUCCESS: Connected to database!");
  const res = await client.query('SELECT 1 as result');
  console.log("QUERY SUCCESS:", res.rows[0]);
  client.release();
} catch (err) {
  console.error("FAILURE: Could not connect to database.");
  console.error(err);
} finally {
  await pool.end();
}
