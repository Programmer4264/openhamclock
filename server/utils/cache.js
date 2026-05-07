const maintainCache = (cache, ttlMs, maxEntries, label = 'Cache') => {
  const now = Date.now();
  let purged = 0;

  // Remove stale entries
  for (const key of Object.keys(cache)) {
    if (now - cache[key].timestamp > ttlMs * 2) {
      delete cache[key];
      purged++;
    }
  }

  // Enforce max size by evicting oldest
  const remaining = Object.keys(cache);
  if (remaining.length > maxEntries) {
    remaining
      .sort((a, b) => cache[a].timestamp - cache[b].timestamp)
      .slice(0, remaining.length - maxEntries)
      .forEach((key) => {
        delete cache[key];
        purged++;
      });
  }
};

module.exports = { maintainCache };
