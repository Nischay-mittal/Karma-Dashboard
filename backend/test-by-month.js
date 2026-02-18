// Quick test for POST /api/revenue/by-month (run from backend folder: node test-by-month.js)
const http = require('http');
const body = JSON.stringify({ month: '2025-01' });
const req = http.request({
  hostname: 'localhost',
  port: 5002,
  path: '/api/revenue/by-month',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': body.length },
}, (res) => {
  let data = '';
  res.on('data', (c) => data += c);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data.slice(0, 300));
  });
});
req.on('error', (e) => console.error('Error:', e.message));
req.write(body);
req.end();
