function finite(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

function quote(value, unit, timestamp, source) {
  const v = finite(value);
  if (v === null || !timestamp || !source) return null;

  return {
    value: v,
    unit,
    timestamp,
    source
  };
}

async function fetchJSON(url, key) {
  if (!url || !key) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);

  try {
    const r = await fetch(url, {
      headers: {
        "X-API-Key": key,
        "Accept": "application/json"
      },
      signal: controller.signal
    });

    if (!r.ok) throw new Error(`HTTP_${r.status}`);

    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

function findAsset(data, codes) {
  if (!Array.isArray(data)) return null;

  return data.find(x =>
    x &&
    typeof x.code === "string" &&
    codes.includes(x.code)
  ) || null;
}

function mapAsset(data, codes, unit) {
  const item = findAsset(data, codes);

  if (!item) return null;

  return quote(
    item.value,
    unit,
    item.businessTime,
    "Servix"
  );
}

async function primaryOrNull(cfg, asset) {
  const url = cfg[asset + "PrimaryUrl"];
  const key = cfg[asset + "PrimaryKey"];

  if (!url || !key) return null;

  const data = await fetchJSON(url, key);

  if (asset === "gold") {
    return mapAsset(
      data,
      ["GOLD_18_RLS"],
      "IRR"
    );
  }

  if (asset === "fx") {
    return mapAsset(
      data,
      ["USD_RLS"],
      "IRR"
    );
  }

  if (asset === "crypto") {
    return mapAsset(
      data,
      ["USDT_RLS", "USDT_IRR"],
      "IRR"
    );
  }

  return null;
}

module.exports = {
  quote,
  primaryOrNull
};
