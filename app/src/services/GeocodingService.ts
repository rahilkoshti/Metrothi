export interface PlaceNode {
  isPlace: true;
  id: string; // usually stringified lat/lng
  name: string;
  lat: number;
  lng: number;
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
        // Ahmedabad/Gandhinagar bounding box: 72.4,22.9 to 72.7,23.3
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&viewbox=72.4,22.9,72.7,23.3&bounded=1`;
        
        const res = await fetch(url, {
          headers: {
            'Accept-Language': 'en-US,en;q=0.9',
            // Nominatim requires a user-agent
            'User-Agent': 'Metrothi/1.0 (Ahmedabad Metro App)'
          }
        });
        
        if (!res.ok) throw new Error('Geocoding failed');
        
        const data = await res.json();
        const results = data.map((item: any) => ({
          isPlace: true as const,
          id: `place_${item.lat}_${item.lon}`,
          // Nominatim display_name can be long, take the first part
          name: item.name || item.display_name.split(',')[0].trim(),
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon)
        }));

        this.CACHE.set(q, results);
        return results;
      } catch (err) {
        console.error("Geocoding fetch error:", err);
        return [];
      } finally {
        this.PENDING_REQUESTS.delete(q);
      }
    })();

    this.PENDING_REQUESTS.set(q, promise);
    return promise;
  }
}
