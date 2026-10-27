'use strict';

/** In-memory sliding window per IP. Fine for one server; use Redis if you ever run several. */
function createLimiter(max, windowMs) {
  const hits = new Map();
  const sweep = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [ip, list] of hits) {
      const fresh = list.filter((t) => t > cutoff);
      if (fresh.length) hits.set(ip, fresh); else hits.delete(ip);
    }
  }, 60000);
  sweep.unref();
  return {
    check(ip) {
      const now = Date.now();
      const list = (hits.get(ip) || []).filter((t) => t > now - windowMs);
      if (list.length >= max) return { allowed: false, retryAfter: Math.ceil((list[0] + windowMs - now) / 1000) };
      list.push(now);
      hits.set(ip, list);
      return { allowed: true };
    },
    stop() { clearInterval(sweep); },
  };
}

module.exports = { createLimiter };
