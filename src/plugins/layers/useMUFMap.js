import { useState, useEffect, useRef } from 'react';
import { addMinimizeToggle } from './addMinimizeToggle.js';
import { makeDraggable } from './makeDraggable.js';

/**
 * MUF (Maximum Usable Frequency) Map Layer
 *
 * Shows the estimated MUF from your DE location to every point on the globe,
 * computed from solar indices (SSN/SFI) and path geometry. Color-coded from
 * purple (low MUF, < 5 MHz) through green (14 MHz) to red (> 28 MHz).
 *
 * Data source: /api/propagation/mufmap (server-side, solar-index model)
 * Update interval: 5 minutes
 */

export const metadata = {
  id: 'muf-map',
  name: 'MUF Map',
  description: 'Estimated Maximum Usable Frequency from your station to the world',
  icon: '📡',
  category: 'propagation',
  defaultEnabled: false,
  defaultOpacity: 0.5,
};

// MUF frequency → RGBA color
// Purple (very low) → Blue → Cyan → Green → Yellow → Orange → Red (very high)
function mufColor(mhz) {
  if (mhz <= 0) return { r: 0, g: 0, b: 0, a: 0 };

  let r, g, b, a;

  if (mhz < 3) {
    // < 3 MHz: dark purple (160m barely open)
    r = 60;
    g = 20;
    b = 100;
    a = 0.4;
  } else if (mhz < 5) {
    // 3-5 MHz: purple → blue (80m range)
    const t = (mhz - 3) / 2;
    r = Math.round(60 - t * 60);
    g = Math.round(20 + t * 40);
    b = Math.round(100 + t * 55);
    a = 0.5;
  } else if (mhz < 10) {
    // 5-10 MHz: blue → cyan (40m range)
    const t = (mhz - 5) / 5;
    r = 0;
    g = Math.round(60 + t * 180);
    b = Math.round(155 + t * 40);
    a = 0.55;
  } else if (mhz < 14) {
    // 10-14 MHz: cyan → green (30m-20m)
    const t = (mhz - 10) / 4;
    r = 0;
    g = Math.round(240 - t * 20);
    b = Math.round(195 - t * 195);
    a = 0.6;
  } else if (mhz < 21) {
    // 14-21 MHz: green → yellow (20m-15m)
    const t = (mhz - 14) / 7;
    r = Math.round(t * 255);
    g = 220;
    b = 0;
    a = 0.6;
  } else if (mhz < 28) {
    // 21-28 MHz: yellow → orange (15m-10m)
    const t = (mhz - 21) / 7;
    r = 255;
    g = Math.round(220 - t * 100);
    b = 0;
    a = 0.6;
  } else {
    // >= 28 MHz: orange → red (10m+ wide open)
    const t = Math.min(1, (mhz - 28) / 7);
    r = 255;
    g = Math.round(120 - t * 100);
    b = Math.round(t * 30);
    a = 0.65;
  }

  return { r, g, b, a };
}

// Legend color stops for the control panel
const LEGEND_STOPS = [
  { mhz: 3, label: '3' },
  { mhz: 7, label: '7' },
  { mhz: 10, label: '10' },
  { mhz: 14, label: '14' },
  { mhz: 21, label: '21' },
  { mhz: 28, label: '28' },
  { mhz: 35, label: '35+' },
];

export function useLayer({ map, enabled, opacity, locator }) {
  const [data, setData] = useState(null);
  const [gridSize, setGridSize] = useState(10);
  const [loading, setLoading] = useState(false);

  const layersRef = useRef([]);
  const controlRef = useRef(null);
  const intervalRef = useRef(null);

  // Parse DE location from locator
  const deLocation = (() => {
    if (!locator || locator.length < 4) return null;
    const g = locator.toUpperCase();
    const lon = (g.charCodeAt(0) - 65) * 20 - 180;
    const lat = (g.charCodeAt(1) - 65) * 10 - 90;
    const lonMin = parseInt(g[2]) * 2;
    const latMin = parseInt(g[3]) * 1;
    return { lat: lat + latMin + 0.5, lon: lon + lonMin + 1 };
  })();

  // Fetch MUF data
  useEffect(() => {
    if (!enabled || !deLocation) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const url = `/api/propagation/mufmap?deLat=${deLocation.lat.toFixed(1)}&deLon=${deLocation.lon.toFixed(1)}&grid=${gridSize}`;
        const res = await fetch(url);
        if (res.ok) {
          setData(await res.json());
        }
      } catch (err) {
        console.error('[MUF Map] Fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    intervalRef.current = setInterval(fetchData, 5 * 60 * 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, deLocation?.lat, deLocation?.lon, gridSize]);

  // Render grid rectangles on map
  useEffect(() => {
    if (!map || !enabled || !data?.cells) return;

    // Clear previous
    layersRef.current.forEach((layer) => {
      try {
        map.removeLayer(layer);
      } catch (e) {}
    });
    layersRef.current = [];

    const half = (data.gridSize || gridSize) / 2;

    for (const cell of data.cells) {
      const color = mufColor(cell.muf);
      if (color.a === 0) continue;

      const bounds = [
        [cell.lat - half, cell.lon - half],
        [cell.lat + half, cell.lon + half],
      ];

      const rect = L.rectangle(bounds, {
        color: 'transparent',
        weight: 0,
        fillColor: `rgb(${color.r},${color.g},${color.b})`,
        fillOpacity: color.a * (opacity ?? 0.5),
        interactive: false,
      });

      rect.addTo(map);
      layersRef.current.push(rect);
    }

    return () => {
      layersRef.current.forEach((layer) => {
        try {
          map.removeLayer(layer);
        } catch (e) {}
      });
      layersRef.current = [];
    };
  }, [map, enabled, data, opacity]);

  // Update opacity on existing layers
  useEffect(() => {
    layersRef.current.forEach((layer) => {
      try {
        const baseOpacity = layer.options._baseAlpha || 0.5;
        layer.setStyle({ fillOpacity: baseOpacity * (opacity ?? 0.5) });
      } catch (e) {}
    });
  }, [opacity]);

  // Control panel
  useEffect(() => {
    if (!enabled || !map || controlRef.current) return;

    const MUFControl = L.Control.extend({
      options: { position: 'topright' },
      onAdd: function () {
        const panelWrapper = L.DomUtil.create('div', 'panel-wrapper');
        const container = L.DomUtil.create('div', 'muf-map-control', panelWrapper);

        const gridOptions = [5, 10, 15, 20]
          .map((g) => `<option value="${g}" ${g === gridSize ? 'selected' : ''}>${g}\u00B0</option>`)
          .join('');

        // Build gradient bar for legend
        const gradientStops = LEGEND_STOPS.map((s) => {
          const c = mufColor(s.mhz);
          return `rgb(${c.r},${c.g},${c.b})`;
        }).join(', ');

        container.innerHTML = `
          <div class="floating-panel-header">📡 MUF Map</div>
          <div style="margin-bottom: 6px;">
            <label style="color: var(--text-secondary); font-size: 10px;">Grid Resolution</label>
            <select id="muf-grid-select" style="
              width: 100%; margin-top: 2px; padding: 4px;
              background: var(--bg-tertiary); color: var(--text-primary);
              border: 1px solid var(--border-color); border-radius: 3px;
              font-family: var(--font-mono); font-size: 11px;
            ">${gridOptions}</select>
          </div>
          <div style="margin-bottom: 4px;">
            <div style="
              height: 10px; border-radius: 3px;
              background: linear-gradient(to right, ${gradientStops});
            "></div>
            <div style="display: flex; justify-content: space-between; font-size: 9px; color: var(--text-muted); margin-top: 2px;">
              ${LEGEND_STOPS.map((s) => `<span>${s.label}</span>`).join('')}
            </div>
            <div style="text-align: center; font-size: 9px; color: var(--text-muted);">MHz</div>
          </div>
          <div id="muf-status" style="font-size: 10px; color: var(--text-muted); text-align: center;">
            ${data ? `SFI=${data.solarData?.sfi} SSN=${data.solarData?.ssn}` : 'Loading...'}
          </div>
        `;

        container.style.cssText =
          'background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 6px; padding: 8px; min-width: 160px; font-family: var(--font-mono); font-size: 11px; color: var(--text-primary);';

        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);

        setTimeout(() => {
          const gridSelect = container.querySelector('#muf-grid-select');
          if (gridSelect) {
            gridSelect.addEventListener('change', (e) => {
              setGridSize(parseInt(e.target.value));
            });
          }
          addMinimizeToggle(container, 'muf-map');
          makeDraggable(panelWrapper, container.querySelector('.floating-panel-header'));
        }, 0);

        return panelWrapper;
      },
    });

    controlRef.current = new MUFControl();
    map.addControl(controlRef.current);

    return () => {
      if (controlRef.current && map) {
        try {
          map.removeControl(controlRef.current);
        } catch (e) {}
        controlRef.current = null;
      }
    };
  }, [enabled, map]);

  // Update status text in control
  useEffect(() => {
    const el = document.getElementById('muf-status');
    if (!el) return;
    if (loading) {
      el.textContent = 'Loading...';
    } else if (data) {
      el.textContent = `SFI=${data.solarData?.sfi} SSN=${data.solarData?.ssn}`;
    }
  }, [data, loading]);

  // Cleanup on disable
  useEffect(() => {
    if (enabled) return;
    layersRef.current.forEach((layer) => {
      try {
        map?.removeLayer(layer);
      } catch (e) {}
    });
    layersRef.current = [];
    if (controlRef.current && map) {
      try {
        map.removeControl(controlRef.current);
      } catch (e) {}
      controlRef.current = null;
    }
  }, [enabled]);
}
