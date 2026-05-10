/**
 * usePOTASpots Hook
 * Fetches Parks on the Air activations via server proxy (for caching)
 */
import { useState, useEffect, useRef } from 'react';
import { useVisibilityRefresh } from './useVisibilityRefresh';
import { apiFetch } from '../utils/apiFetch';
import { latLonToMaidenhead, maidenheadToLatLon } from '../utils/geo';
import { getBandFromFreq } from '../utils/callsign';

export const usePOTASpots = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);
  const lastNewestSpotRef = useRef(null);
  const fetchRefPOTA = useRef(null);

  useEffect(() => {
    const fetchPOTA = async () => {
      try {
        // Use server proxy for caching - reduces external API calls
        // Server sets Cache-Control: no-store; fetch no-store bypasses browser cache
        const res = await apiFetch('/api/pota/spots', { cache: 'no-store' });
        if (res?.ok) {
          const spots = await res.json();
          console.info(`[POTA] Fetched ${Array.isArray(spots) ? spots.length : 0} spots`);

          // Log newest spot time for staleness debugging
          let newestTime = null;
          if (Array.isArray(spots) && spots.length > 0) {
            const times = spots
              .map((s) => s.spotTime)
              .filter(Boolean)
              .sort()
              .reverse();
            newestTime = times[0] || null;
          }

          // Only mark as "updated" when data content actually changes
          // (POTA API may return same stale spots for extended periods)
          if (newestTime !== lastNewestSpotRef.current || lastNewestSpotRef.current === null) {
            lastNewestSpotRef.current = newestTime;
            setLastUpdated(Date.now());
          }

          // Filter out QRT spots and nearly-expired spots, then sort by most recent
          const validSpots = spots
            .filter((s) => {
              // Filter out QRT (operator signed off)
              if (/\bQRT\b/.test((s.comments || '').toUpperCase().trim())) return false;

              // Filter out spots expiring within 60 seconds
              if (typeof s.expire === 'number' && s.expire < 60) return false;

              // Filter out spots older than 60 minutes
              if (s.spotTime) {
                const ts = s.spotTime.endsWith('Z') || s.spotTime.endsWith('z') ? s.spotTime : s.spotTime + 'Z';
                const ageMs = Date.now() - new Date(ts).getTime();
                if (ageMs > 60 * 60 * 1000) return false;
              }

              return true;
            })
            .sort((a, b) => {
              // Sort by spotTime descending (newest first)
              const timeA = a.spotTime ? new Date(a.spotTime).getTime() : 0;
              const timeB = b.spotTime ? new Date(b.spotTime).getTime() : 0;
              return timeB - timeA;
            });

          setData(
            validSpots.map((s) => {
              // Use API coordinates, fall back to grid square
              let lat = s.latitude != null ? parseFloat(s.latitude) : null;
              let lon = s.longitude != null ? parseFloat(s.longitude) : null;

              if ((lat == null || lon == null) && s.grid6) {
                const loc = maidenheadToLatLon(s.grid6);
                if (loc) {
                  lat = loc.lat;
                  lon = loc.lon;
                }
              }
              if ((lat == null || lon == null) && s.grid4) {
                const loc = maidenheadToLatLon(s.grid4);
                if (loc) {
                  lat = loc.lat;
                  lon = loc.lon;
                }
              }

              // POTA API returns frequency in kHz as a string (e.g., "7160" or "433240")
              // Convert to MHz for consistency with SOTA and proper rig control
              const freqKhz = parseFloat(s.frequency);
              const freqMhz = !isNaN(freqKhz) ? freqKhz / 1000 : null;

              return {
                call: s.activator,
                ref: s.reference,
                freq: freqMhz ? freqMhz.toString() : s.frequency, // Convert to MHz string
                band: getBandFromFreq(s.frequency),
                mode: s.mode,
                name: s.name || s.locationDesc,
                comments: (s.comments || '').trim(),
                locationDesc: s.locationDesc,
                lat,
                lon,
                // POTA API returns UTC timestamps without 'Z' suffix, violating ISO 8601
                // JavaScript interprets timestamps without timezone as local time
                // Defensively append 'Z' if not present to force UTC interpretation
                time: s.spotTime
                  ? (() => {
                      const ts = s.spotTime.endsWith('Z') || s.spotTime.endsWith('z') ? s.spotTime : s.spotTime + 'Z';
                      return new Date(ts).toISOString().substr(11, 5) + 'z';
                    })()
                  : '',
                expire: s.expire || 0,
                grid: s.grid6 ? s.grid6 : s.grid4 ? s.grid4 : latLonToMaidenhead({ lat, lon }),
              };
            }),
          );
        } else {
          console.warn(`[POTA] Fetch failed: ${res?.status || 'no response'} ${res?.statusText || ''}`);
        }
      } catch (err) {
        console.error('[POTA] Fetch error:', err.message || err);
      } finally {
        setLastChecked(Date.now());
        setLoading(false);
      }
    };

    fetchPOTA();
    const interval = setInterval(fetchPOTA, 120 * 1000); // 2 minutes
    fetchRefPOTA.current = fetchPOTA;
    return () => clearInterval(interval);
  }, []);

  // Refresh immediately when tab becomes visible (handles browser throttling)
  useVisibilityRefresh(() => fetchRefPOTA.current?.(), 10000);

  return { data, loading, lastUpdated, lastChecked };
};

export default usePOTASpots;
