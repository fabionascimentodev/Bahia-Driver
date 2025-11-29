// src/services/unifiedLocationService.ts
import { 
  MAP_SERVICES_CONFIG, 
  USE_GOOGLE_AS_FALLBACK,
  GOOGLE_MAPS_API_KEY // ← agora existe no keys.ts (mas é opcional)
} from '../config/keys';

import { Coords } from './locationServices';

export interface PlaceResult {
  id: string;
  name: string;
  address: string;
  coords: Coords & { nome?: string };
}

export interface RouteResult {
  coordinates: { latitude: number; longitude: number }[];
  distance: number;
  duration: number;
}

class UnifiedLocationService {
  private currentService: 'osm' | 'google' = 'osm';

  async searchPlaces(query: string, userLocation?: Coords): Promise<PlaceResult[]> {
    // tenta OSM
    try {
      const osmResults = await this.searchWithOSM(query, userLocation);
      if (osmResults.length > 0) {
        this.currentService = 'osm';
        return osmResults;
      }
    } catch (error) {
      console.warn('OSM search failed, trying fallback...', error);
    }

    // fallback Google somente se configurado e chave existir
    if (USE_GOOGLE_AS_FALLBACK && GOOGLE_MAPS_API_KEY) {
      try {
        const googleResults = await this.searchWithGoogle(query, userLocation);
        if (googleResults.length > 0) {
          this.currentService = 'google';
          return googleResults;
        }
      } catch (error) {
        console.error('Google fallback also failed:', error);
      }
    }

    return [];
  }

  private async searchWithOSM(query: string, userLocation?: Coords): Promise<PlaceResult[]> {
    let url = `${MAP_SERVICES_CONFIG.NOMINATIM.BASE_URL}/search?format=json&q=${encodeURIComponent(query)}&limit=8&accept-language=pt-BR`;

    if (userLocation) {
      url += `&viewbox=${userLocation.longitude - 0.1},${userLocation.latitude - 0.1},${userLocation.longitude + 0.1},${userLocation.latitude + 0.1}&bounded=1`;
    }

    // Nominatim espera um User-Agent identificável. Adicionamos headers e tratamos respostas não-JSON.
    const headers: any = {
      'Accept': 'application/json',
      'User-Agent': MAP_SERVICES_CONFIG.NOMINATIM.USER_AGENT || 'BahiaDriverApp/1.0'
    };

    const response = await fetch(url, { headers });

    if (MAP_SERVICES_CONFIG.NOMINATIM.RATE_LIMIT) {
      await new Promise(resolve => setTimeout(resolve, MAP_SERVICES_CONFIG.NOMINATIM.RATE_LIMIT));
    }

    // Se a resposta não for OK, tenta ler o texto para debug e retorna vazio
    if (!response.ok) {
      const text = await response.text();
      console.warn('Nominatim respondeu com status:', response.status, text?.slice?.(0, 200));
      return [];
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      console.warn('Nominatim retornou conteúdo não-JSON:', contentType, text?.slice?.(0, 200));
      return [];
    }

    const data = await response.json();

    if (Array.isArray(data) && data.length > 0) {
      return data.map((item: any, index: number) => ({
        id: item.place_id || `osm-${index}-${Date.now()}`,
        name: (item.display_name || '').split(',')[0],
        address: item.display_name || '',
        coords: {
          latitude: parseFloat(item.lat),
          longitude: parseFloat(item.lon),
          nome: (item.display_name || '').split(',')[0]
        }
      }));
    }

    return [];
  }

  private async searchWithGoogle(query: string, userLocation?: Coords): Promise<PlaceResult[]> {
    if (!GOOGLE_MAPS_API_KEY) {
      console.warn("Google Maps API KEY não configurada.");
      return [];
    }

    let url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_API_KEY}&language=pt-BR&region=br`;

    if (userLocation) {
      url += `&location=${userLocation.latitude},${userLocation.longitude}&radius=50000`;
    }

    const response = await fetch(url);
    const data = await response.json();

    if (data?.status === 'OK' && Array.isArray(data.predictions)) {
      const places = await Promise.all(
        data.predictions.slice(0, 5).map(async (prediction: any) => {
          try {
            const detailsResponse = await fetch(
              `https://maps.googleapis.com/maps/api/place/details/json?place_id=${prediction.place_id}&key=${GOOGLE_MAPS_API_KEY}&language=pt-BR`
            );

            const detailsData = await detailsResponse.json();
            if (detailsData?.status === 'OK') {
              const place = detailsData.result;
              return {
                id: prediction.place_id,
                name: prediction.structured_formatting?.main_text || prediction.description,
                address: prediction.structured_formatting?.secondary_text || place?.formatted_address,
                coords: {
                  latitude: place.geometry.location.lat,
                  longitude: place.geometry.location.lng,
                  nome: prediction.structured_formatting?.main_text
                }
              };
            }
          } catch (err) {
            console.error("Erro buscando detalhes Google:", err);
          }
          return null;
        })
      );

      return places.filter(p => p !== null) as PlaceResult[];
    }

    return [];
  }

  async calculateRoute(origin: Coords, destination: Coords): Promise<RouteResult | null> {
    try {
      const osmRoute = await this.calculateRouteWithOSRM(origin, destination);
      if (osmRoute) {
        this.currentService = 'osm';
        return osmRoute;
      }
    } catch (err) {
      console.warn("OSRM failed, fallback...", err);
    }

    if (USE_GOOGLE_AS_FALLBACK && GOOGLE_MAPS_API_KEY) {
      const googleRoute = await this.calculateRouteWithGoogle(origin, destination);
      if (googleRoute) {
        this.currentService = 'google';
        return googleRoute;
      }
    }

    return null;
  }

  private async calculateRouteWithOSRM(origin: Coords, destination: Coords): Promise<RouteResult | null> {
    try {
      const response = await fetch(
        `${MAP_SERVICES_CONFIG.OSRM.BASE_URL}/route/v1/${MAP_SERVICES_CONFIG.OSRM.PROFILE}/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson`
      );

      const data = await response.json();

      if (data?.code === 'Ok' && data.routes?.length > 0) {
        const route = data.routes[0];

        const coordinates = route.geometry.coordinates.map(
          (c: [number, number]) => ({ latitude: c[1], longitude: c[0] })
        );

        return {
          coordinates,
          distance: route.distance,
          duration: route.duration
        };
      }

      return null;
    } catch (err) {
      console.error("OSRM route error:", err);
      return null;
    }
  }

  private async calculateRouteWithGoogle(origin: Coords, destination: Coords): Promise<RouteResult | null> {
    if (!GOOGLE_MAPS_API_KEY) {
      console.warn("Google Maps API KEY não configurada.");
      return null;
    }

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&key=${GOOGLE_MAPS_API_KEY}`
      );

      const data = await response.json();

      if (data?.status === 'OK') {
        const route = data.routes[0];
        const leg = route.legs[0];
        const coordinates = this.decodePolyline(route.overview_polyline.points);

        return {
          coordinates,
          distance: leg.distance.value,
          duration: leg.duration.value
        };
      }

      return null;
    } catch (err) {
      console.error("Google Directions error:", err);
      return null;
    }
  }

  private decodePolyline(encoded: string): { latitude: number; longitude: number }[] {
    const coords: { latitude: number; longitude: number }[] = [];
    let index = 0, lat = 0, lng = 0;

    while (index < encoded.length) {
      let b, shift = 0, result = 0;

      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;

      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      coords.push({ latitude: lat * 1e-5, longitude: lng * 1e-5 });
    }

    return coords;
  }

  getCurrentService() {
    return this.currentService;
  }
}

export const unifiedLocationService = new UnifiedLocationService();
