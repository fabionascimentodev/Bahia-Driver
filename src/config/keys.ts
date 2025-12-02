// Configure chaves e configurações usadas pelos serviços de mapa
export const LOCATIONIQ_API_KEY = 'pk.8d41176f3f5c6b3a7a0b8c9d4e5f6a7b'; // ← Chave de teste

// Configuração dos serviços de mapa (valores padrão que podem ser sobrescritos)
export const MAP_SERVICES_CONFIG = {
	NOMINATIM: {
		BASE_URL: 'https://nominatim.openstreetmap.org',
		RATE_LIMIT: 0,
		// Identifique sua aplicação. Recomenda-se incluir email para contato.
		USER_AGENT: 'BahiaDriverApp/1.0 (contato@seudominio.com)'
	},
	OSRM: {
		BASE_URL: 'https://router.project-osrm.org',
		PROFILE: 'driving'
	}
};

// Por padrão não usar Google como fallback (mude para true se tiver chave)
export const USE_GOOGLE_AS_FALLBACK = false;

// Se tiver chave do Google Maps, configure aqui
export const GOOGLE_MAPS_API_KEY = '';

// Ou obtenha uma gratuita em: https://locationiq.com/free-account