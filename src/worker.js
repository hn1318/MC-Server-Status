const requestBuckets = new Map();

function isValidAddress(address) {
  return /^[a-zA-Z0-9.-]+(?::\d{1,5})?$/.test(address);
}

function normalizeEdition(edition) {
  return edition === "bedrock" ? "bedrock" : "java";
}

function getClientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return "unknown";
}

function checkRateLimit(ip, windowMs, maxRequests) {
  const now = Date.now();
  const current = requestBuckets.get(ip);

  if (!current || now > current.resetAt) {
    requestBuckets.set(ip, {
      count: 1,
      resetAt: now + windowMs,
    });
    return null;
  }

  if (current.count >= maxRequests) {
    const retryAfterSeconds = Math.ceil((current.resetAt - now) / 1000);
    const waitSeconds = Math.max(retryAfterSeconds, 1);
    return new Response(
      JSON.stringify({
        error: "Too many requests. Please try again later.",
        retryAfterSeconds: waitSeconds,
      }),
      {
        status: 429,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "retry-after": String(waitSeconds),
        },
      }
    );
  }

  current.count += 1;
  return null;
}

async function handleMcStatus(request, env) {
  const url = new URL(request.url);
  const address = (url.searchParams.get("address") || "").trim();
  const edition = normalizeEdition((url.searchParams.get("edition") || "").trim().toLowerCase());

  if (!address) {
    return new Response(JSON.stringify({ error: "Missing address query parameter." }), {
      status: 400,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  if (!isValidAddress(address)) {
    return new Response(JSON.stringify({ error: "Invalid server address format." }), {
      status: 400,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }

  const windowMs = Number(env.RATE_LIMIT_WINDOW_MS || 60_000);
  const maxRequests = Number(env.RATE_LIMIT_MAX_REQUESTS || 20);
  const ip = getClientIp(request);
  const limitResponse = checkRateLimit(ip, windowMs, maxRequests);
  if (limitResponse) {
    return limitResponse;
  }

  try {
    const upstreamPath = edition === "bedrock" ? "bedrock/3" : "3";
    const upstream = await fetch(`https://api.mcsrvstat.us/${upstreamPath}/${encodeURIComponent(address)}`, {
      headers: {
        "User-Agent": "mc-server-query-app/1.0 (+https://workers.dev)",
      },
    });

    if (!upstream.ok) {
      return new Response(JSON.stringify({ error: "Failed to fetch upstream MC status." }), {
        status: 502,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
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

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Unexpected error when querying server status.",
        detail: error?.message || String(error),
      }),
      {
        status: 500,
        headers: { "content-type": "application/json; charset=utf-8" },
      }
    );
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/mc-status") {
      return handleMcStatus(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
