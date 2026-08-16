require("dotenv").config();

const express = require("express");
const crypto = require("crypto");

const {
  saveQuote,
  history,
  addAlert
} = require("./db");

const {
  primaryOrNull
} = require("./providers");

const app = express();

app.use(express.json({ limit: "32kb" }));
app.use(express.static(__dirname));

const cfg = {
  port: Number(process.env.PORT) || 3000,

  botToken: process.env.BOT_TOKEN || "",

  goldPrimaryKey: process.env.GOLD_PRIMARY_KEY || "",
  fxPrimaryKey: process.env.FX_PRIMARY_KEY || "",
  cryptoPrimaryKey: process.env.CRYPTO_PRIMARY_KEY || "",

maxAgeGold: Number(process.env.MAX_AGE_GOLD) || 7200,
maxAgeFx: Number(process.env.MAX_AGE_FX) || 7200,
maxAgeCrypto: Number(process.env.MAX_AGE_CRYPTO) || 7200
};

function validate(initData) {
  if (!initData || !cfg.botToken) return false;

  const p = new URLSearchParams(initData);
  const hash = p.get("hash");
  const auth = Number(p.get("auth_date"));

  if (!hash || !auth) return false;

  if (Date.now() / 1000 - auth > 86400) {
    return false;
  }

  const s = [...p.entries()]
    .filter(x => x[0] !== "hash")
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(x => x[0] + "=" + x[1])
    .join("\n");

  const key = crypto
    .createHmac("sha256", "WebAppData")
    .update(cfg.botToken)
    .digest();

  const exp = crypto
    .createHmac("sha256", key)
    .update(s)
    .digest("hex");

  return (
    exp.length === hash.length &&
    crypto.timingSafeEqual(
      Buffer.from(exp),
      Buffer.from(hash)
    )
  );
}

/*
  Strict freshness validation.

  A quote is valid only when:
  1. value is numeric
  2. timestamp exists
  3. timestamp is a valid date
  4. timestamp is not too old
  5. timestamp is not materially in the future
*/
function isFreshQuote(q, maxAgeSeconds) {
  if (!q) return false;

  const value = Number(q.value);

  if (!Number.isFinite(value)) {
    return false;
  }

  if (!q.timestamp) {
    return false;
  }

  const timestamp = new Date(q.timestamp).getTime();

  if (!Number.isFinite(timestamp)) {
    return false;
  }

  const now = Date.now();

  /*
    Reject timestamps more than 60 seconds
    in the future. This protects against bad
    provider clocks without rejecting tiny
    clock differences.
  */
  if (timestamp > now + 60 * 1000) {
    return false;
  }

  const age = (now - timestamp) / 1000;

  if (age > maxAgeSeconds) {
    return false;
  }

  return true;
}

function maxAgeFor(asset) {
  if (asset === "gold18") {
    return cfg.maxAgeGold;
  }

  if (asset === "usd") {
    return cfg.maxAgeFx;
  }

  if (asset === "usdt") {
    return cfg.maxAgeCrypto;
  }

  return 180;
}

const cache = new Map();

async function getAsset(asset) {
  const maxAge = maxAgeFor(asset);

  const hit = cache.get(asset);

  /*
    Never return a cached quote unless it is
    still fresh according to its provider timestamp.
  */
  if (
    hit &&
    Date.now() - hit.time < 5000 &&
    isFreshQuote(hit.q, maxAge)
  ) {
    return hit.q;
  }

  let q = null;

  try {
    if (asset === "gold18") {
      q = await primaryOrNull(cfg, "gold");
    }

    if (asset === "usd") {
      q = await primaryOrNull(cfg, "fx");
    }

    if (asset === "usdt") {
      q = await primaryOrNull(cfg, "crypto");
    }
  } catch (error) {
    console.error(
      `Provider error for ${asset}:`,
      error.message
    );
    return null;
  }

  /*
    Fail closed:
    invalid or stale data is NEVER displayed
    and NEVER saved as a valid quote.
  */
  if (!isFreshQuote(q, maxAge)) {
    cache.delete(asset);
    return null;
  }

  saveQuote(asset, q);

  cache.set(asset, {
    q,
    time: Date.now()
  });

  return q;
}

app.get("/api/market", async (req, res) => {
  const out = {
    status: "UNVERIFIED",
    quotes: {},
    serverTime: new Date().toISOString()
  };

  for (const asset of ["gold18", "usd", "usdt"]) {
    const q = await getAsset(asset);

    if (q) {
      out.quotes[asset] = q;
    }
  }

  /*
    Mesghal is derived from the validated 18K quote.
    It is only shown when the source quote is valid.
  */
  if (out.quotes.gold18) {
    out.quotes.mesghal = {
      value:
        out.quotes.gold18.value *
        4.6083 *
        (17 / 18),

      unit: "IRR",

      timestamp:
        out.quotes.gold18.timestamp,

      source: "derived"
    };
  }

  /*
    Four values are required for LIVE:
    gold18 + mesghal + usd + usdt
  */
  out.status =
    Object.keys(out.quotes).length >= 4
      ? "LIVE"
      : "PARTIAL";

  res.set("Cache-Control", "no-store");

  res.json(out);
});

app.get("/api/history/:asset", (req, res) => {
  res.json(
    history(req.params.asset, 200)
  );
});

app.post("/api/alerts", (req, res) => {
  if (!validate(req.body?.initData)) {
    return res.status(401).json({
      ok: false,
      error: "invalid_telegram_data"
    });
  }

  const p = new URLSearchParams(
    req.body.initData
  );

  const u = JSON.parse(
    p.get("user") || "{}"
  );

  const asset = req.body.asset;

  const target = Number(
    req.body.target
  );

  const direction =
    req.body.direction === "below"
      ? "below"
      : "above";

  if (
    !["gold18", "usd", "usdt"].includes(asset) ||
    !Number.isFinite(target)
  ) {
    return res.status(400).json({
      ok: false,
      error: "invalid_alert"
    });
  }

  const id = crypto.randomUUID();

  addAlert({
    id,
    userId: String(u.id),
    asset,
    target,
    direction,
    createdAt: new Date().toISOString()
  });

  res.json({
    ok: true,
    id
  });
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    time: new Date().toISOString()
  });
});

app.listen(
  cfg.port,
  () => console.log(
    "Nebze Bazar v5 on",
    cfg.port
  )
);
