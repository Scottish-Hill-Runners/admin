const EARTH_RADIUS_M = 6_371_000;
const DEG_TO_RAD = Math.PI / 180;

type LatLon = { lat: number; lon: number };

/**
 * Perpendicular distance from point P to the line segment A→B, in metres.
 * Uses a planar cosine-corrected approximation that is accurate to better
 * than 0.1 % for distances under ~500 km.
 */
function perpendicularDistanceM(
  p: LatLon,
  a: LatLon,
  b: LatLon,
  cosLat: number,
): number {
  const scale = EARTH_RADIUS_M * DEG_TO_RAD;
  const px = (p.lon - a.lon) * cosLat * scale;
  const py = (p.lat - a.lat) * scale;
  const bx = (b.lon - a.lon) * cosLat * scale;
  const by = (b.lat - a.lat) * scale;

  const lenSq = bx * bx + by * by;
  if (lenSq === 0) {
    return Math.sqrt(px * px + py * py);
  }

  const t = Math.max(0, Math.min(1, (px * bx + py * by) / lenSq));
  const dx = px - t * bx;
  const dy = py - t * by;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Iterative Douglas-Peucker polyline simplification using an explicit stack
 * to avoid call-stack overflows on very long tracks.
 *
 * Returns a boolean[] where `true` means the corresponding point is kept.
 */
function douglasPeucker(
  points: LatLon[],
  epsilonM: number,
  cosLat: number,
): boolean[] {
  const n = points.length;
  const keep = new Array<boolean>(n).fill(false);

  if (n === 0) return keep;
  if (n === 1) {
    keep[0] = true;
    return keep;
  }

  // Stack of [start, end] index pairs to process
  const stack: Array<[number, number]> = [[0, n - 1]];
  keep[0] = true;
  keep[n - 1] = true;

  while (stack.length > 0) {
    const [start, end] = stack.pop()!;
    if (end - start < 2) continue;

    let maxDist = 0;
    let maxIdx = start;

    for (let i = start + 1; i < end; i++) {
      const d = perpendicularDistanceM(
        points[i],
        points[start],
        points[end],
        cosLat,
      );
      if (d > maxDist) {
        maxDist = d;
        maxIdx = i;
      }
    }

    if (maxDist >= epsilonM) {
      keep[maxIdx] = true;
      stack.push([start, maxIdx]);
      stack.push([maxIdx, end]);
    }
  }

  return keep;
}

/** Removes the `<metadata>…</metadata>` block. */
function removeMetadata(gpx: string): string {
  return gpx.replace(/<metadata\b[\s\S]*?<\/metadata>\s*/gi, "");
}

/** Removes all `<time>…</time>` leaf elements. */
function removeTimes(gpx: string): string {
  return gpx.replace(/<time>[^<]*<\/time>\s*/gi, "");
}

/** Removes the `creator="…"` attribute from the root `<gpx>` element. */
function removeCreator(gpx: string): string {
  // Handle creator at the end of an attribute list (followed by other attrs or >)
  return gpx.replace(
    /(<gpx\b(?:[^>](?!creator))*)\s+creator="[^"]*"/i,
    "$1",
  );
}

/** Applies Douglas-Peucker to every `<trkseg>` block in the GPX string. */
function smoothTracks(
  gpx: string,
  epsilonM: number,
): { result: string; pointsBefore: number; pointsAfter: number } {
  let pointsBefore = 0;
  let pointsAfter = 0;

  const result = gpx.replace(
    /<trkseg\b[^>]*>([\s\S]*?)<\/trkseg>/gi,
    (_, segContent: string) => {
      // Collect all <trkpt> blocks from this segment
      const trkptBlocks: string[] = [];
      const trkptRe = /<trkpt\b[^>]*>[\s\S]*?<\/trkpt>/gi;
      let m: RegExpExecArray | null;
      while ((m = trkptRe.exec(segContent)) !== null) {
        trkptBlocks.push(m[0]);
      }

      pointsBefore += trkptBlocks.length;

      if (trkptBlocks.length < 3 || epsilonM <= 0) {
        pointsAfter += trkptBlocks.length;
        return `<trkseg>${segContent}</trkseg>`;
      }

      // Parse coordinates
      const coords: LatLon[] = trkptBlocks.map((block) => {
        const latM = block.match(/\blat="([^"]+)"/);
        const lonM = block.match(/\blon="([^"]+)"/);
        return {
          lat: latM ? parseFloat(latM[1]) : 0,
          lon: lonM ? parseFloat(lonM[1]) : 0,
        };
      });

      // Cosine correction from average latitude
      const avgLat = coords.reduce((s, c) => s + c.lat, 0) / coords.length;
      const cosLat = Math.cos(avgLat * DEG_TO_RAD);

      const keep = douglasPeucker(coords, epsilonM, cosLat);
      const surviving = trkptBlocks.filter((_, i) => keep[i]);
      pointsAfter += surviving.length;

      return `<trkseg>\n    ${surviving.join("\n    ")}\n  </trkseg>`;
    },
  );

  return { result, pointsBefore, pointsAfter };
}

export type GpxCleanResult = {
  result: string;
  /** Number of track points in the original file. */
  pointsBefore: number;
  /** Number of track points retained after smoothing. */
  pointsAfter: number;
};

/**
 * Cleans a GPX string ready for publication:
 *
 * 1. Removes the `<metadata>` block (author names, timestamps, descriptions).
 * 2. Strips all `<time>` elements from track points.
 * 3. Removes the `creator` attribute from the root element.
 * 4. Simplifies track geometry using the Douglas-Peucker algorithm.
 *
 * @param gpx       Raw GPX content as a UTF-8 string.
 * @param epsilonM  Smoothing tolerance in metres. Pass 0 to skip smoothing.
 */
export function cleanGpx(gpx: string, epsilonM: number): GpxCleanResult {
  let processed = removeMetadata(gpx);
  processed = removeTimes(processed);
  processed = removeCreator(processed);
  return smoothTracks(processed, epsilonM);
}
