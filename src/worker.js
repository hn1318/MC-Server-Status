const requestBuckets = new Map();

// ===== 工具函数 =====
function getClientIp(request) {
  return request.headers.get("cf-connecting-ip") || "unknown";
}

function isValidAddress(address) {
  return /^[a-zA-Z0-9.-]+(?::\d{1,5})?$/.test(address);
}

function normalizeEdition(edition) {
  return edition === "bedrock" ? "bedrock" : "java";
}

// ===== 限流（简单版）=====
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
    const retryAfter = Math.ceil((current.resetAt - now) / 1000);
    return new Response(JSON.stringify({
      error: "Rate limit exceeded",
      retryAfter
    }), {
      status: 429,
      headers: {
        "content-type": "application/json",
        "retry-after": String(retryAfter)
      }
    });
  }

  current.count++;
  return null;
}

// ===== 核心 API =====
async function handleMcStatus(request, env) {
  const url = new URL(request.url);
  const address = (url.searchParams.get("address") || "").trim();
  const edition = normalizeEdition(url.searchParams.get("edition"));

  if (!address) {
    return new Response(JSON.stringify({ error: "Missing address" }), { status: 400 });
  }

  if (!isValidAddress(address)) {
    return new Response(JSON.stringify({ error: "Invalid address" }), { status: 400 });
  }

  // ===== 限流 =====
  const limit = checkRateLimit(
    getClientIp(request),
    Number(env.RATE_LIMIT_WINDOW_MS),
    Number(env.RATE_LIMIT_MAX_REQUESTS)
  );
  if (limit) return limit;

  // ===== Cache Key =====
  const cacheKey = new Request(request.url, request);
  const cache = caches.default;

  // 查缓存
  let response = await cache.match(cacheKey);
  if (response) {
    return response;
  }

  try {
    const upstreamPath = edition === "bedrock" ? "bedrock/3" : "3";

    const upstream = await fetch(
      `https://api.mcsrvstat.us/${upstreamPath}/${encodeURIComponent(address)}`,
      {
        headers: {
          "User-Agent": "mc-status-pro/1.0"
        },
        cf: {
          cacheTtl: 30 // CDN缓存
        }
      }
    );

    if (!upstream.ok) {
      return new Response(JSON.stringify({ error: "Upstream failed" }), { status: 502 });
    }

    const raw = await upstream.json();

    const payload = {
      success: true,
      data: {
        input: address,
        edition,
        online: Boolean(raw.online),
        host: raw.hostname || raw.ip,
        port: raw.port,
        version: raw.version,
        players: raw.players || {},
        motd: raw.motd?.clean || [],
        icon: `https://api.mcsrvstat.us/icon/${encodeURIComponent(address)}`
      },
      cached: false,
      ts: Date.now()
    };

    response = new Response(JSON.stringify(payload), {
      headers: {
        "content-type": "application/json",
        "cache-control": "public, max-age=30"
      }
    });

    // 写入缓存（真正关键）
    await cache.put(cacheKey, response.clone());

    return response;

  } catch (err) {
    return new Response(JSON.stringify({
      error: "Internal error",
      detail: err.message
    }), { status: 500 });
  }
}

// ===== 主入口 =====
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // API
    if (url.pathname.startsWith("/api/mc-status")) {
      return handleMcStatus(request, env);
    }

    // 静态资源（防炸）
    try {
      const res = await env.ASSETS.fetch(request);
      if (res.status === 404) {
        return new Response("Not Found", { status: 404 });
      }
      return res;
    } catch {
      return new Response("Not Found", { status: 404 });
    }
  }
};