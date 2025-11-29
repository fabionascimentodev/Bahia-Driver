// Configurações para serviços de mapas gratuitos

export const MAP_CONFIG = {
    // OpenStreetMap Nominatim (Geocoding)
    NOMINATIM: {
        BASE_URL: 'https://nominatim.openstreetmap.org',
        RATE_LIMIT: 1000, // 1 requisição por segundo
    },
    
    // OSRM (Rotas)
    OSRM: {
        BASE_URL: 'http://router.project-osrm.org',
        PROFILE: 'driving', // driving, walking, cycling
    },
    
    // LocationIQ (Alternativa - 10.000 req/dia free)
    LOCATION_IQ: {
        BASE_URL: 'https://us1.locationiq.com/v1',
        API_KEY: 'pk.your_key_here', // Obtenha em locationiq.com
    },
    
    // Geoapify (Alternativa - 3.000 req/dia free)
    GEOAPIFY: {
        BASE_URL: 'https://api.geoapify.com/v1',
        API_KEY: 'your_geoapify_key_here', // Obtenha em geoapify.com
    },
};

// Preços e configurações da aplicação
export const APP_CONFIG = {
    PRICING: {
        BASE_FARE: 5.00,
        PRICE_PER_KM: 2.50,
        MINIMUM_FARE: 8.00,
    },
    SEARCH: {
        DEFAULT_RESULT_LIMIT: 8,
        SEARCH_RADIUS_KM: 50,
    }
};