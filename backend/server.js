require('dotenv').config();
const cors = require("cors");

const app = require('./src/app');
app.use(cors());
const pool = require('./src/config/db');

// Import controllers directly and register routes here to ensure they work
const { getDivisions, getCentres } = require('./src/controllers/revenuecontroller');
app.get('/api/revenue/divisions', getDivisions);
app.get('/api/revenue/centres', getCentres);

// Use 5002 so this dashboard doesn't conflict with another app on 5001
const PORT = 5002;

// expose a simple health endpoint to check DB connectivity
app.get('/api/health', async (req, res) => {
  try {
    await pool.testConnection();
    res.json({ ok: true, db: 'connected', message: 'Finance Dashboard API' });
  } catch (err) {
    res.status(500).json({ ok: false, dbError: err.message });
  }
});

app.listen(PORT, async () => {
  console.log(`Backend running on port ${PORT}`);
  console.log('Routes registered:');
  console.log('  GET  /api/revenue/divisions ✓');
  console.log('  GET  /api/revenue/centres ✓');
  console.log('  POST /api/revenue');
  console.log('  POST /api/revenue/excel');
  console.log('  POST /api/footfall');
  console.log('  POST /api/footfall/by-month ✓');
  try {
    await pool.testConnection();
    console.log('DB connection: OK');
  } catch (err) {
    console.error('DB connection test failed at startup:', err.message);
  }
});
