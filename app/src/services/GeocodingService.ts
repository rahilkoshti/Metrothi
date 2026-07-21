export interface PlaceNode {
  isPlace: true;
  id: string; // usually stringified lat/lng
  name: string;
  lat: number;
  lng: number;
}

// Photon (komoot) GeoJSON response — only the fields we read.
interface PhotonFeature {
  geometry?: { coordinates?: [number, number] }; // [lng, lat]
  properties?: {
    name?: string;
    suburb?: string;
    district?: string;
    city?: string;
    county?: string;
  };
}

// Place search uses Photon (photon.komoot.io) — OSM-based, keyless,
// CORS-enabled, and its usage policy permits client-side autocomplete
// (Nominatim's doesn't), so it works with zero setup.
function toPlaceNode(name: string, lat: number, lng: number): PlaceNode {
  return { isPlace: true, id: `place_${lat}_${lng}`, name, lat, lng };
}

async function searchViaPhoton(q: string): Promise<PlaceNode[]> {
  // Ahmedabad/Gandhinagar bounding box: 72.4,22.9 to 72.7,23.3
  const url =
    `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}` +
    `&bbox=72.4,22.9,72.7,23.3&limit=5&lang=en`;

  const res = await fetch(url);
  if (!res.ok) throw new Error('Geocoding failed');
  const data = await res.json();
  return ((data.features ?? []) as PhotonFeature[])
    .filter((f) => f.geometry?.coordinates && f.properties?.name)
    .map((f) => {
      const [lng, lat] = f.geometry!.coordinates!;
      const p = f.properties!;
      // Append a locality so same-named places are tellable apart.
      const context = p.suburb || p.district || p.city || p.county;
      const name =
        context && context !== p.name ? `${p.name}, ${context}` : p.name!;
      return toPlaceNode(name, lat, lng);
    });
}

export class GeocodingService {
  private static CACHE = new Map<string, PlaceNode[]>();
  private static PENDING_REQUESTS = new Map<string, Promise<PlaceNode[]>>();

  static async searchPlaces(query: string): Promise<PlaceNode[]> {
    const q = query.trim().toLowerCase();
    if (q.length < 3) return [];

    if (this.CACHE.has(q)) {
      return this.CACHE.get(q)!;
    }

    if (this.PENDING_REQUESTS.has(q)) {
      return this.PENDING_REQUESTS.get(q)!;
    }

    const promise = (async () => {
      try {
        const results = await searchViaPhoton(q);
        this.CACHE.set(q, results);
        return results;
      } catch (err) {
        console.error('Geocoding fetch error:', err);
        throw err;
      } finally {
        this.PENDING_REQUESTS.delete(q);
      }
    })();

    this.PENDING_REQUESTS.set(q, promise);
    return promise;
  }
}
