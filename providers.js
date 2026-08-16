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
  const timer = setTimeout(() => controller.abort(), 8000);

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
  if (Array.isArray(data)) return data;

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
    typeof item.code === "string" &&
    item.code === code
  ) || null;
}

function mapAsset(data, code, unit) {
  const item = findAsset(data, code);

  if (!item) return null;

  return quote(
    item.value,
    unit,
    item.businessTime,
    "Servix"
  );
}

function buildUrl(baseUrl, codes) {
  if (!baseUrl) return null;

  const separator =
    baseUrl.includes("?") ? "&" : "?";

  return (
    baseUrl +
    separator +
    "codes=" +
    encodeURIComponent(codes.join(","))
  );
}

async function primaryOrNull(cfg, asset) {
  let key = null;
  let baseUrl = null;
  let codes = [];

  if (asset === "gold") {
    key = cfg.goldPrimaryKey;
    baseUrl =
      cfg.goldPrimaryUrl ||
      "https://servix.cc/api/v1/assets";

    codes = [
      "GOLD_18_RLS",
      "GOLD_MESGHAL_RLS"
    ];
  }

  else if (asset === "fx") {
    key = cfg.fxPrimaryKey;
    baseUrl =
      cfg.fxPrimaryUrl ||
      "https://servix.cc/api/v1/assets";

    codes = [
      "USD_RLS"
    ];
  }

  else if (asset === "crypto") {
    key = cfg.cryptoPrimaryKey;
    baseUrl =
      cfg.cryptoPrimaryUrl ||
      "https://servix.cc/api/v1/assets";

    codes = [
      "USDT_USD",
      "USD_RLS"
    ];
  }

  else {
    return null;
  }

  if (!key || !baseUrl) {
    return null;
  }

  const url = buildUrl(baseUrl, codes);

  if (!url) {
    return null;
  }

  const data = await fetchJSON(url, key);

  if (!data) {
    return null;
  }

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

  if (asset === "crypto") {
    const usdt =
      findAsset(data, "USDT_USD");

    const usd =
      findAsset(data, "USD_RLS");

    if (!usdt || !usd) {
      return null;
    }

    const usdtUsd =
      finite(usdt.value);

    const usdRls =
      finite(usd.value);

    if (
      usdtUsd === null ||
      usdRls === null
    ) {
      return null;
    }

    if (
      !usdt.businessTime ||
      !usd.businessTime
    ) {
      return null;
    }

    const usdtTime =
      new Date(
        usdt.businessTime
      ).getTime();

    const usdTime =
      new Date(
        usd.businessTime
      ).getTime();

    if (
      !Number.isFinite(usdtTime) ||
      !Number.isFinite(usdTime)
    ) {
      return null;
    }

    const ageDifference =
      Math.abs(
        usdtTime - usdTime
      );

    if (
      ageDifference >
      5 * 60 * 1000
    ) {
      return null;
    }

    return quote(
      usdtUsd * usdRls,
      "IRR",
      new Date(
        Math.max(
          usdtTime,
          usdTime
        )
      ).toISOString(),
      "Servix-derived"
    );
  }

  return null;
}

module.exports = {
  quote,
  primaryOrNull
};
