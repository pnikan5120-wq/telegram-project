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

function items(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && data.code) return [data];
  if (data && Array.isArray(data.assets)) return data.assets;
  return [];
}

function findAsset(data, codes) {
  return items(data).find(x =>
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
    const usdt = findAsset(data, ["USDT_USD"]);
    const usd = findAsset(data, ["USD_RLS"]);

    if (!usdt || !usd) return null;

    const usdtUsd = finite(usdt.value);
    const usdRls = finite(usd.value);

    if (usdtUsd === null || usdRls === null) return null;
    if (!usdt.businessTime || !usd.businessTime) return null;

    const timestamp =
      new Date(usdt.businessTime) > new Date(usd.businessTime)
        ? usdt.businessTime
        : usd.businessTime;

    return quote(
      usdtUsd * usdRls,
      "IRR",
      timestamp,
      "Servix-derived"
    );
  }

  return null;
}

module.exports = {
  quote,
  primaryOrNull
};
