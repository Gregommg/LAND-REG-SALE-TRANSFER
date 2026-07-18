/**
 * Initializes the PostgreSQL database by executing schema.sql.
 *
 */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
require("dotenv").config();

async function initDb() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
  });

  try {
    await client.connect();
    const schemaPath = path.join(__dirname, "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");

    console.log(`Connecting to database "${process.env.DB_NAME}" ...`);
    await client.query(schema);
    console.log("Database schema created and seed data inserted successfully.");
  } catch (err) {
    console.error("Failed to initialize database:", err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

initDb();
