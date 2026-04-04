const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 20);
const requestBuckets = new Map();

app.use(express.static(path.join(__dirname, "public")));

function isValidAddress(address) {
  return /^[a-zA-Z0-9.-]+(?::\d{1,5})?$/.test(address);
}

function normalizeEdition(edition) {
  return edition === "bedrock" ? "bedrock" : "java";
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

function rateLimit(req, res, next) {
  const now = Date.now();
  const ip = getClientIp(req);
  const current = requestBuckets.get(ip);

  if (!current || now > current.resetAt) {
    requestBuckets.set(ip, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return next();
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfterSeconds = Math.ceil((current.resetAt - now) / 1000);
    res.set("Retry-After", String(Math.max(retryAfterSeconds, 1)));
    return res.status(429).json({
      error: "Too many requests. Please try again later.",
      retryAfterSeconds: Math.max(retryAfterSeconds, 1),
    });
  }

  current.count += 1;
  return next();
}

app.use("/api", rateLimit);

app.get("/api/mc-status", async (req, res) => {
  const address = (req.query.address || "").trim();
  const edition = normalizeEdition((req.query.edition || "").trim().toLowerCase());

  if (!address) {
    return res.status(400).json({ error: "Missing address query parameter." });
  }

  if (!isValidAddress(address)) {
    return res.status(400).json({ error: "Invalid server address format." });
  }

  try {
    const upstreamPath = edition === "bedrock" ? "bedrock/3" : "3";
    const upstream = await fetch(`https://api.mcsrvstat.us/${upstreamPath}/${encodeURIComponent(address)}`, {
      headers: {
        "User-Agent": "mc-server-query-app/1.0 (+https://localhost)",
      },
    });

    if (!upstream.ok) {
      return res.status(502).json({ error: "Failed to fetch upstream MC status." });
    }

    const raw = await upstream.json();

    const payload = {
      input: address,
      edition,
      online: Boolean(raw.online),
      host: raw.hostname || raw.ip || address.split(":")[0],
      port: raw.port || null,
      iconUrl: `https://api.mcsrvstat.us/icon/${encodeURIComponent(address)}`,
      version: raw.version || null,
      players: {
        online: raw.players?.online ?? 0,
        max: raw.players?.max ?? 0,
        list: raw.players?.list ?? [],
      },
      motd: raw.motd?.clean || [],
      software: raw.software || null,
      protocol: raw.protocol || null,
      raw,
    };

    return res.json(payload);
  } catch (error) {
    return res.status(500).json({
      error: "Unexpected error when querying server status.",
      detail: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`MC status app listening on http://localhost:${PORT}`);
});
