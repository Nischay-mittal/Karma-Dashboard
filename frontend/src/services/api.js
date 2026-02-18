// Always hit backend directly so it works from any dev URL (e.g. localhost:5175/frontend)
export const API_BASE = "http://localhost:5002";

async function handleResponse(response, context = "data") {
  const text = await response.text();
  if (!response.ok) {
    let message = `Failed to fetch ${context} (${response.status})`;
    try {
      const body = JSON.parse(text);
      if (body?.message) message += `: ${body.message}`;
      if (body?.error) message += `: ${body.error}`;
    } catch (_) {
      if (text) message += `: ${text.slice(0, 100)}`;
    }
    throw new Error(message);
  }
  try {
    return text ? JSON.parse(text) : null;
  } catch (_) {
    throw new Error(`Invalid JSON from ${context}`);
  }
}

function wrapFetch(url, options, context) {
  return fetch(url, options).then(
    (res) => handleResponse(res, context),
    (err) => {
      if (err?.message === "Failed to fetch" || err?.name === "TypeError") {
        throw new Error(
          `Cannot reach server. Start the backend: cd backend then node server.js (runs on port 5002)`
        );
      }
      throw err;
    }
  );
}

export async function fetchRevenue({ from, to, type, divisionName, centreId, skipDetails = false }) {
  return wrapFetch(
    `${API_BASE}/api/revenue`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, type, divisionName, centreId, skipDetails }),
    },
    "revenue data"
  );
}

export async function fetchDivisions() {
  return wrapFetch(
    `${API_BASE}/api/revenue/divisions`,
    { method: "GET" },
    "divisions"
  );
}

export async function fetchCentres(divisionName) {
  const url = divisionName ? `${API_BASE}/api/revenue/centres?divisionName=${encodeURIComponent(divisionName)}` : `${API_BASE}/api/revenue/centres`;
  return wrapFetch(
    url,
    { method: "GET" },
    "centres"
  );
}

export async function fetchFootfall({ from, to }) {
  return wrapFetch(
    `${API_BASE}/api/footfall`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, to }),
    },
    "footfall data"
  );
}

export async function fetchFootfallByMonth({ from, to, type, divisionName, centreId, skipDetails = false }) {
  return wrapFetch(
    `${API_BASE}/api/footfall/by-month`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, type, divisionName, centreId, skipDetails }),
    },
    "footfall by month data"
  );
}
