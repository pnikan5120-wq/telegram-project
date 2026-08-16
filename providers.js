function finite(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

function quote(value, unit, timestamp, source) {
  const v = finite(value);

  if (v === null || !timestamp || !source) {
    return null;
  }

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
    const response = await fetch(url, {
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

function getAssets(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (data && Array.isArray(data.assets)) {
    return data.assets;
  }

  if (data && typeof data.code === "string") {
    return [data];
  }

  return [];
}

function findAsset(data, code) {
  return getAssets(data).find(item =>
    item &&
    item.code === code
  ) || null;
}

function mapAsset(data, code, unit) {
  const item = findAsset(data, code);

  if (!item) {
    return null;
  }

  return quote(
    item.value,
    unit,
    item.businessTime,
    "Servix"
  );
}

async function primaryOrNull(cfg, asset) {
  const key = cfg[asset + "PrimaryKey"];

  if (!key) {
    return null;
  }

  let code;

  if (asset === "gold") {
    code = "GOLD_18_RLS";
  } else if (asset === "fx") {
    code = "USD_RLS";
  } else if (asset === "crypto") {
    code = "USDT_USD";
  } else {
    return null;
  }

  /*
    Servix documented single-asset endpoint:
    GET /api/v1/assets/{assetName}
  */
  const url =
    "https://servix.cc/api/v1/assets/" +
    encodeURIComponent(code);

  const data = await fetchJSON(url, key);

  if (asset === "gold") {
    return mapAsset(
      data,
      "GOLD_18_RLS",
      "IRR"
    );
  }

  if (asset === "fx") {
    return mapAsset(
      data,
      "USD_RLS",
      "IRR"
    );
  }

  /*
    USDT_USD alone is a USD-denominated price.
    We do NOT convert it to IRR here because
    that would require a second USD_RLS quote
    with compatible businessTime.
  */
  if (asset === "crypto") {
    return mapAsset(
      data,
      "USDT_USD",
      "USD"
    );
  }

  return null;
}

module.exports = {
  quote,
  primaryOrNull
};
