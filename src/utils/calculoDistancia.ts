// src/utils/calculoDistancia.ts

export interface LocalCoords {
  latitude: number;
  longitude: number;
}

/**
 * Calcula a distância em quilômetros entre dois pontos geográficos.
 * Fórmula de Haversine.
 */
export function calcularDistanciaKm(origem: LocalCoords, destino: LocalCoords): number {
  const R = 6371; // Raio da Terra em km

  const dLat = (destino.latitude - origem.latitude) * (Math.PI / 180);
  const dLon = (destino.longitude - origem.longitude) * (Math.PI / 180);

  const lat1 = origem.latitude * (Math.PI / 180);
  const lat2 = destino.latitude * (Math.PI / 180);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distancia = R * c;

  return Number(distancia.toFixed(2)); // retorna em KM com 2 casas decimais
}
