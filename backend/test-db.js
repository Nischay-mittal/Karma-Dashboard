require('dotenv').config();
const pool = require('./src/config/db');

(async () => {
  try {
    const [rows] = await pool.execute('SELECT 1+1 AS result');
    console.log('DB test successful:', rows);
  } catch (err) {
    console.error('DB test error:', err);
  } finally {
    process.exit();
  }
})();
