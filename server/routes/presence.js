/**
 * User Presence routes — active OpenHamClock user map layer.
 * Users opt-in by enabling the layer, which periodically reports
 * their callsign and grid square. Other users see them on the map.
 */

module.exports = function (app, ctx) {
  const { logDebug, logInfo } = ctx;

  // In-memory presence store: callsign → { call, lat, lon, grid, lastSeen }
  const activeUsers = new Map();
  const PRESENCE_TTL = 5 * 60 * 1000; // 5 minutes — users heartbeat every 2 min
  const MAX_USERS = 5000;

  // Periodic cleanup of stale users
  setInterval(() => {
    const cutoff = Date.now() - PRESENCE_TTL;
    for (const [key, user] of activeUsers) {
      if (user.lastSeen < cutoff) activeUsers.delete(key);
    }
  }, 60 * 1000); // every minute

  // map of POST operation IP remote addresses, with periodic cleanup
  const remoteAddresses = new Map();
  const remoteAddress_TTL = 60 * 60 * 1000; // 60 minutes
  setInterval(
    () => {
      const cutoff = Date.now() - remoteAddress_TTL;
      for (const [key, remoteAddress] of remoteAddresses)
        if (Date.now() >= remoteAddress.createTime + remoteAddress_TTL) remoteAddresses.delete(key);
    },
    10 * 60 * 1000,
  ); // every ten minutes

  // POST /api/presence — heartbeat from a user
  app.post('/api/presence', (req, res) => {
    const { callsign, lat, lon, grid } = req.body || {};

    // POST remote address, lockout if repeat activity within remoteAddress_lockout_period
    const remoteAddress_lockout_period = 1 * 60 * 1000; // 1 minute
    const remoteAddress = req.ip || {};
    let remoteAddressLockout = remoteAddresses.has(remoteAddress)
      ? Date.now() < remoteAddresses.get(remoteAddress).createTime + remoteAddress_lockout_period
      : false;
    if (remoteAddressLockout) return res.status(429).json({ error: 'IP Address lockout until timeout' });

    if (!callsign || typeof callsign !== 'string' || callsign.length < 3 || callsign.length > 12) {
      return res.status(400).json({ error: 'Valid callsign required' });
    }
    if (typeof lat !== 'number' || typeof lon !== 'number' || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      return res.status(400).json({ error: 'Valid lat/lon required' });
    }

    const call = callsign.toUpperCase().replace(/[^A-Z0-9/\-]/g, '');
    if (call.length < 3) return res.status(400).json({ error: 'Invalid callsign' });

    // if remote address has been used previously but with another callsign then purge that other callsign
    if (remoteAddresses.has(remoteAddress)) {
      const callOnRecord = remoteAddresses.get(remoteAddress).call;
      if (callOnRecord != call && activeUsers.has(callOnRecord)) activeUsers.delete(callOnRecord);
    }

    remoteAddresses.set(remoteAddress, {
      remoteAddress,
      createTime: Date.now(),
      call, // callsign related to remote address
    });

    activeUsers.set(call, {
      call,
      lat: Math.round(lat * 100) / 100, // ~1km precision — don't expose exact location
      lon: Math.round(lon * 100) / 100,
      grid: (grid || '').substring(0, 6).toUpperCase(),
      lastSeen: Date.now(),
      remoteAddress, // remote address related to this callsign
    });

    // Prune if over limit (keep most recent)
    if (activeUsers.size > MAX_USERS) {
      const sorted = [...activeUsers.entries()].sort((a, b) => b[1].lastSeen - a[1].lastSeen);
      activeUsers.clear();
      for (const [k, v] of sorted.slice(0, MAX_USERS)) {
        activeUsers.set(k, v);
      }
    }

    res.json({ ok: true, active: activeUsers.size });
  });

  // POST /api/presence/leave — user closing tab
  app.post('/api/presence/leave', (req, res) => {
    const { callsign } = req.body || {};
    if (!callsign) return res.status(400).json({ error: 'callsign required' });
    const call = String(callsign)
      .toUpperCase()
      .replace(/[^A-Z0-9/\-]/g, '');
    if (activeUsers.delete(call)) {
      logDebug(`[Presence] ${call} left`);
    }
    res.json({ ok: true });
  });

  // GET /api/presence — get all active users
  app.get('/api/presence', (req, res) => {
    const cutoff = Date.now() - PRESENCE_TTL;
    const users = [];
    for (const [, user] of activeUsers) {
      if (user.lastSeen >= cutoff) {
        users.push({
          call: user.call,
          lat: user.lat,
          lon: user.lon,
          grid: user.grid,
          age: Math.floor((Date.now() - user.lastSeen) / 60000),
        });
      }
    }
    res.json({
      count: users.length,
      users,
    });
  });

  logInfo('[Presence] User presence endpoints registered');
};
