function finite(n) {
  return Number.isFinite(Number(n)) ? Number(n) : null;
}

function quote(value, unit, timestamp, source) {
  const v = finite(value);
  if (v === null || !timestamp || !source) return null;

  const t = new Date(timestamp);
  if (Number.isNaN(t.getTime())) return null;

  return {
    value: v,
    unit,
    timestamp: t.toISOString(),
    source
  };
}

async function fetchJSON(url, key) {
  if (!url || !key) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-API-Key": key,
        "Accept": "application/json"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP_${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function servixQuote(data, unit, source) {
  if (!data || typeof data !== "object") return null;

  const value = finite(data.value);
  const timestamp = data.businessTime;

  if (value === null || !timestamp) return null;

  return quote(value, unit, timestamp, source);
}

async function primaryOrNull(cfg, asset) {
  const url = cfg[asset + "PrimaryUrl"];
  const key = cfg[asset + "PrimaryKey"];

  if (!url || !key) return null;

  try {
    const data = await fetchJSON(url, key);

    if (asset === "gold") {
      return servixQuote(data, "IRR", "Servix:GOLD_18_RLS");
    }

    if (asset === "fx") {
      return servixQuote(data, "IRR", "Servix:USD_RLS");
    }

    if (asset === "crypto") {
      return servixQuote(data, "IRR", "Servix:USDT");
    }

    return null;
  } catch (error) {
    console.error(`Provider error (${asset}):`, error.message);
    return null;
  }
}

module.exports = {
  quote,
  primaryOrNull
};
