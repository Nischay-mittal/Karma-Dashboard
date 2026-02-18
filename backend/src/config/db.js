const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
});
console.log({
  DB_HOST: process.env.DB_HOST,
  DB_USER: process.env.DB_USER,
  DB_NAME: process.env.DB_NAME
});
// attach a helper to test DB connectivity
pool.testConnection = async function testConnection() {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.ping();
    return true;
  } finally {
    if (conn) conn.release();
  }
};

module.exports = pool;

