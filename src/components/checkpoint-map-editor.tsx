"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { gpx } from "@tmcw/togeojson";
import type { FeatureCollection, GeoJSON, LineString, MultiLineString } from "geojson";

// ─── types ────────────────────────────────────────────────────────────────────

export type CheckpointFeatureProperties = {
  name: string;
  cutoff: string;
  notes: string;
  trackPointIndex: number;
};

type Checkpoint = {
  id: string;
  trackPointIndex: number;
  lngLat: [number, number];
  name: string;
  cutoff: string;
  notes: string;
  marker: maplibregl.Marker;
};

export type CheckpointMapEditorProps = {
  gpxText: string;
  onChange: (geojson: string | null) => void;
};

// ─── geo helpers ──────────────────────────────────────────────────────────────

function haversineMetres(
  a: [number, number],
  b: [number, number],
): number {
  const R = 6_371_000;
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** Returns the index of the closest point in `coords` to `click`. */
function nearestIndex(
  click: [number, number],
  coords: [number, number][],
): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const d = haversineMetres(click, coords[i]);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

/** Extracts all [lng, lat] track coordinates from a parsed GeoJSON object. */
function extractRouteCoords(geojson: GeoJSON): [number, number][] {
  const coords: [number, number][] = [];
  function collect(obj: GeoJSON) {
    if (obj.type === "FeatureCollection") {
      obj.features.forEach(collect);
    } else if (obj.type === "Feature") {
      collect(obj.geometry);
    } else if (obj.type === "LineString") {
      (obj as LineString).coordinates.forEach((c) =>
        coords.push([c[0], c[1]]),
      );
    } else if (obj.type === "MultiLineString") {
      (obj as MultiLineString).coordinates.forEach((line) =>
        line.forEach((c) => coords.push([c[0], c[1]])),
      );
    }
  }
  collect(geojson);
  return coords;
}

function getBounds(
  coords: [number, number][],
): maplibregl.LngLatBoundsLike | null {
  if (coords.length === 0) return null;
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

// ─── marker helper ────────────────────────────────────────────────────────────

function makeMarkerEl(label: string): HTMLElement {
  const el = document.createElement("div");
  el.style.cssText = [
    "width:28px;height:28px;border-radius:50%;",
    "background:#b45309;border:3px solid white;",
    "display:flex;align-items:center;justify-content:center;",
    "font-size:11px;font-weight:700;color:white;",
    "box-shadow:0 2px 6px rgba(0,0,0,0.45);",
    "cursor:pointer;user-select:none;",
  ].join("");
  el.textContent = label;
  return el;
}

// ─── serialise ────────────────────────────────────────────────────────────────

function toGeoJson(checkpoints: Checkpoint[]): string {
  const fc: FeatureCollection<
    { type: "Point"; coordinates: [number, number] },
    CheckpointFeatureProperties
  > = {
    type: "FeatureCollection",
    features: checkpoints.map((cp) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: cp.lngLat },
      properties: {
        name: cp.name,
        cutoff: cp.cutoff,
        notes: cp.notes,
        trackPointIndex: cp.trackPointIndex,
      },
    })),
  };
  return JSON.stringify(fc, null, 2);
}

// ─── component ────────────────────────────────────────────────────────────────

export default function CheckpointMapEditor({
  gpxText,
  onChange,
}: CheckpointMapEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const routeCoordsRef = useRef<[number, number][]>([]);
  const checkpointsRef = useRef<Checkpoint[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Notify parent whenever checkpoints change
  const notify = useCallback(
    (cps: Checkpoint[]) => {
      onChange(cps.length > 0 ? toGeoJson(cps) : null);
    },
    [onChange],
  );

  // Keep the ref in sync so the map click handler always sees current list
  useEffect(() => {
    checkpointsRef.current = checkpoints;
  }, [checkpoints]);

  // Notify parent whenever checkpoints state settles — must be an effect, not
  // called inside a setState updater, to avoid "setState during render" errors.
  useEffect(() => {
    notify(checkpoints);
  }, [checkpoints, notify]);

  // ── initialise map ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || !gpxText) return;
    let cancelled = false;

    // Parse GPX → GeoJSON
    let geojson: GeoJSON;
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(gpxText, "application/xml");
      const parseErr = xmlDoc.querySelector("parsererror");
      if (parseErr) throw new Error("GPX could not be parsed");
      geojson = gpx(xmlDoc);
    } catch (e) {
      setParseError(
        e instanceof Error ? e.message : "GPX file could not be read",
      );
      return;
    }

    const routeCoords = extractRouteCoords(geojson);
    routeCoordsRef.current = routeCoords;

    if (routeCoords.length === 0) {
      setParseError("No track coordinates found in GPX file");
      return;
    }

    const bounds = getBounds(routeCoords);
    const sw = (bounds as [[number, number], [number, number]])[0];
    const ne = (bounds as [[number, number], [number, number]])[1];
    const center: [number, number] = [
      (sw[0] + ne[0]) / 2,
      (sw[1] + ne[1]) / 2,
    ];

    const osKey = process.env.NEXT_PUBLIC_OS_MAPS_API_KEY ?? "";
    const maptilerKey = process.env.NEXT_PUBLIC_MAPTILER_KEY ?? "";
    const hasOs = osKey.length > 0;
    const hasDem = maptilerKey.length > 0;

    const sources: maplibregl.StyleSpecification["sources"] = {
      "os-raster": {
        type: "raster",
        tiles: hasOs
          ? [
              `https://api.os.uk/maps/raster/v1/zxy/Outdoor_3857/{z}/{x}/{y}.png?key=${osKey}`,
            ]
          : ["https://tile.opentopomap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        attribution: hasOs
          ? "&copy; <a href='https://www.ordnancesurvey.co.uk'>Ordnance Survey</a>"
          : "&copy; <a href='https://opentopomap.org'>OpenTopoMap</a>",
        minzoom: hasOs ? 7 : 0,
        maxzoom: hasOs ? 20 : 17,
      },
    };

    if (hasDem) {
      const demSource: maplibregl.RasterDEMSourceSpecification = {
        type: "raster-dem",
        url: `https://api.maptiler.com/tiles/terrain-rgb/tiles.json?key=${maptilerKey}`,
        tileSize: 256,
        encoding: "mapbox",
      };
      sources["terrain-dem"] = demSource;
      sources["hillshade-dem"] = { ...demSource };
    }

    const layers: maplibregl.LayerSpecification[] = [
      { id: "os-raster", type: "raster", source: "os-raster" },
    ];
    if (hasDem) {
      layers.push({
        id: "hillshade",
        type: "hillshade",
        source: "hillshade-dem",
        paint: {
          "hillshade-exaggeration": 0.4,
          "hillshade-shadow-color": "#3d2b1f",
        },
      });
    }

    const map = new maplibregl.Map({
      container: containerRef.current!,
      style: {
        version: 8,
        sources,
        layers,
        ...(hasDem ? { terrain: { source: "terrain-dem", exaggeration: 1.2 } } : {}),
      } as maplibregl.StyleSpecification,
      center,
      zoom: 10,
      maxBounds: [[-10.76, 49.52], [2.0, 61.4]],
      attributionControl: false,
    });
    mapRef.current = map;

    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right",
    );
    map.addControl(new maplibregl.NavigationControl({ showZoom: true }), "top-right");

    // OS fallback
    let osFailed = false;
    map.on("error", (e) => {
      const msg =
        e && typeof e === "object" && "error" in e
          ? ((e as { error: Error }).error?.message ?? String(e))
          : String(e);
      if (hasOs && !osFailed && msg.includes("os.uk")) {
        osFailed = true;
        const src = map.getSource("os-raster") as maplibregl.RasterTileSource | undefined;
        src?.setTiles(["https://tile.opentopomap.org/{z}/{x}/{y}.png"]);
      }
    });

    map.on("load", () => {
      if (cancelled) return;

      // Route layers
      map.addSource("gpx-route", { type: "geojson", data: geojson });
      map.addLayer({
        id: "route-shadow",
        type: "line",
        source: "gpx-route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#000000",
          "line-width": 8,
          "line-opacity": 0.15,
          "line-blur": 3,
        },
      });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "gpx-route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "#e63012",
          "line-width": 3.5,
          "line-opacity": 0.95,
        },
      });

      // Start marker
      if (routeCoords.length > 0) {
        const startEl = document.createElement("div");
        startEl.style.cssText = [
          "width:28px;height:28px;border-radius:50%;",
          "background:#16a34a;border:3px solid white;",
          "display:flex;align-items:center;justify-content:center;",
          "font-size:11px;font-weight:700;color:white;",
          "box-shadow:0 2px 6px rgba(0,0,0,0.45);",
        ].join("");
        startEl.textContent = "S";
        new maplibregl.Marker({ element: startEl, anchor: "center" })
          .setLngLat(routeCoords[0])
          .addTo(map);
      }

      if (bounds) {
        map.fitBounds(bounds as maplibregl.LngLatBoundsLike, {
          padding: 56,
          duration: 0,
        });
        map.resize();
      }

      // Click to place checkpoint
      map.on("click", (e) => {
        if (cancelled) return;
        const click: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        const coords = routeCoordsRef.current;
        if (coords.length === 0) return;

        const idx = nearestIndex(click, coords);
        const snapped = coords[idx];

        const currentCps = checkpointsRef.current;
        // Don't allow duplicate checkpoint at same track point
        if (currentCps.some((cp) => cp.trackPointIndex === idx)) return;

        const cpNumber = currentCps.length + 1;
        const markerEl = makeMarkerEl(`${cpNumber}`);
        const marker = new maplibregl.Marker({ element: markerEl, anchor: "center" })
          .setLngLat(snapped)
          .addTo(map);

        const newCp: Checkpoint = {
          id: crypto.randomUUID(),
          trackPointIndex: idx,
          lngLat: snapped,
          name: `CP${cpNumber}`,
          cutoff: "",
          notes: "",
          marker,
        };

        setCheckpoints((prev) => [...prev, newCp]);
      });

      // Pointer cursor over route
      map.on("mouseenter", "route-line", () => {
        map.getCanvas().style.cursor = "crosshair";
      });
      map.on("mouseleave", "route-line", () => {
        map.getCanvas().style.cursor = "";
      });
      // Crosshair anywhere on the map while this editor is active
      map.getCanvas().style.cursor = "crosshair";

      setMapReady(true);
    });

    return () => {
      cancelled = true;
      // Remove all checkpoint markers
      checkpointsRef.current.forEach((cp) => cp.marker.remove());
      try { map.remove(); } catch { /* suppress WebGL cleanup errors */ }
      mapRef.current = null;
    };
    // Re-mount only when gpxText changes (new file selected)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpxText]);

  // ── checkpoint field handlers ───────────────────────────────────────────────

  const updateField = useCallback(
    (id: string, field: keyof Pick<Checkpoint, "name" | "cutoff" | "notes">, value: string) => {
      setCheckpoints((prev) =>
        prev.map((cp) => (cp.id === id ? { ...cp, [field]: value } : cp)),
      );
    },
    [],
  );

  const removeCheckpoint = useCallback((id: string) => {
    setCheckpoints((prev) => {
      const target = prev.find((cp) => cp.id === id);
      target?.marker.remove();
      return prev
        .filter((cp) => cp.id !== id)
        .map((cp, i) => {
          // Re-number remaining markers
          const oldIndex = prev.findIndex((c) => c.id === cp.id);
          const newName = cp.name === `CP${oldIndex + 1}` ? `CP${i + 1}` : cp.name;
          const el = cp.marker.getElement();
          if (el) el.textContent = `${i + 1}`;
          return { ...cp, name: newName };
        });
    });
  }, []);

  // ── render ──────────────────────────────────────────────────────────────────

  if (parseError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Could not display route map: {parseError}
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-4">
      <div>
        <p className="text-sm font-semibold text-stone-800">Checkpoints</p>
        <p className="text-xs text-stone-500 mt-0.5">
          Click anywhere on the route to place a checkpoint. It will snap to
          the nearest track point.
        </p>
      </div>

      {/* Map */}
      <div
        className="relative overflow-hidden rounded-xl border border-stone-200"
        style={{ height: 420 }}
      >
        <div
          ref={containerRef}
          style={{ position: "absolute", inset: 0 }}
        />
        {!mapReady && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-stone-100">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-300 border-t-amber-600" />
          </div>
        )}
      </div>

      {/* Checkpoint list */}
      {checkpoints.length > 0 && (
        <div className="space-y-3">
          {checkpoints.map((cp, i) => (
            <div
              key={cp.id}
              className="rounded-xl border border-stone-200 bg-stone-50 p-4"
            >
              <div className="flex items-start gap-3">
                {/* Number badge */}
                <span
                  aria-hidden
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-700 text-[11px] font-bold text-white"
                >
                  {i + 1}
                </span>

                <div className="flex-1 grid gap-3 sm:grid-cols-3">
                  {/* Name */}
                  <div className="space-y-1">
                    <label
                      htmlFor={`cp-name-${cp.id}`}
                      className="block text-xs font-semibold text-stone-600"
                    >
                      Name
                    </label>
                    <input
                      id={`cp-name-${cp.id}`}
                      type="text"
                      value={cp.name}
                      onChange={(e) => updateField(cp.id, "name", e.target.value)}
                      className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-sm text-stone-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                    />
                  </div>

                  {/* Cutoff */}
                  <div className="space-y-1">
                    <label
                      htmlFor={`cp-cutoff-${cp.id}`}
                      className="block text-xs font-semibold text-stone-600"
                    >
                      Cutoff time{" "}
                      <span className="font-normal text-stone-400">(HH:MM)</span>
                    </label>
                    <input
                      id={`cp-cutoff-${cp.id}`}
                      type="text"
                      value={cp.cutoff}
                      onChange={(e) => updateField(cp.id, "cutoff", e.target.value)}
                      placeholder="e.g. 03:30"
                      pattern="^([0-9]{1,2}:[0-5][0-9])?$"
                      className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                    />
                  </div>

                  {/* Notes */}
                  <div className="space-y-1">
                    <label
                      htmlFor={`cp-notes-${cp.id}`}
                      className="block text-xs font-semibold text-stone-600"
                    >
                      Notes
                    </label>
                    <input
                      id={`cp-notes-${cp.id}`}
                      type="text"
                      value={cp.notes}
                      onChange={(e) => updateField(cp.id, "notes", e.target.value)}
                      placeholder="Retiral instructions, etc."
                      className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                    />
                  </div>
                </div>

                {/* Delete */}
                <button
                  type="button"
                  onClick={() => removeCheckpoint(cp.id)}
                  aria-label={`Remove ${cp.name}`}
                  className="mt-0.5 rounded-lg p-1 text-stone-400 transition hover:bg-red-50 hover:text-red-600"
                >
                  <svg
                    aria-hidden
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {checkpoints.length === 0 && mapReady && (
        <p className="text-xs text-stone-400">
          No checkpoints added yet. Click on the route to place one.
        </p>
      )}
    </div>
  );
}
