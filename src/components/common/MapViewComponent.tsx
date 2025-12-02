import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View,StyleSheet, Dimensions } from 'react-native';
import MapView, { Marker, Polyline, Region } from 'react-native-maps';
import { COLORS } from '../../theme/colors';
import { Coords } from '../../services/locationServices'; 
import { RideCoords } from '../../types/RideTypes'; 

const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.02;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

export interface MapMarker {
    id: string;
    coords: Coords | RideCoords; 
    title: string;
    color: keyof typeof COLORS;
    icon?: string; 
}

type BaseLocation = Coords | RideCoords;

interface MapViewProps {
    initialLocation: BaseLocation; 
    markers: MapMarker[];
    showRoute?: boolean;
    origin?: RideCoords | null; 
    destination?: RideCoords | null; 
    driverLocation?: Coords | null;
    centerOnDriver?: boolean; // NOVA PROP: controla se centraliza no motorista
    initialRouteCoordinates?: { latitude: number; longitude: number }[] | null;
}

// ✅ CORREÇÃO: Mover função para fora do componente para evitar recriação
const calculateOSRMRoute = async (origin: Coords, destination: Coords) => {
    try {
        const url = `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson`;
        const response = await fetch(url);

        if (!response.ok) {
            // Some public endpoints return HTML error pages or redirects. Log and bail out safely.
            const txt = await response.text();
            console.warn('OSRM responded with non-OK status', response.status, txt?.slice?.(0, 300));
            return null;
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            const txt = await response.text();
            console.warn('OSRM returned non-JSON response (content-type=' + contentType + '):', txt?.slice?.(0, 300));
            return null;
        }

        const data = await response.json();
        
        if (data.code === 'Ok' && data.routes.length > 0) {
            const route = data.routes[0];
            const coordinates = route.geometry.coordinates.map((coord: [number, number]) => ({
                latitude: coord[1],
                longitude: coord[0]
            }));
            
            return {
                coordinates,
                distance: route.distance,
                duration: route.duration
            };
        }
        return null;
    } catch (error) {
        console.error('Erro ao calcular rota OSRM:', error);
        return null;
    }
};

const MapViewComponent: React.FC<MapViewProps> = ({
    initialLocation,
    markers,
    showRoute = false,
    origin,
    destination,
    driverLocation,
    centerOnDriver = true, // DEFAULT: true para sempre centralizar no motorista
    initialRouteCoordinates = null,
}) => {
    const theme = COLORS;
    // initialRouteCoordinates is provided by props (precomputed route coords)
    // DEBUG: log props to help diagnose why driver map may not draw route
    useEffect(() => {
        try {
            console.debug('[MapViewComponent] props', {
                showRoute,
                origin,
                destination,
                driverLocation,
                centerOnDriver,
            });
        } catch (e) {
            // ignore
        }
    }, [showRoute, origin?.latitude, origin?.longitude, destination?.latitude, destination?.longitude, driverLocation?.latitude, driverLocation?.longitude, centerOnDriver]);

    const [routeCoordinates, setRouteCoordinates] = useState<{latitude: number, longitude: number}[]>([]);
    const mapRef = useRef<MapView | null>(null);

    // Se o pai passou coordenadas pré-calculadas, use-as imediatamente para evitar atraso
    useEffect(() => {
        try {
            if (initialRouteCoordinates && initialRouteCoordinates.length > 0) {
                setRouteCoordinates(initialRouteCoordinates);
                return;
            }
        } catch (e) {
            // ignore
        }
    }, [initialRouteCoordinates]);

    const getMapLocation = useCallback((location: BaseLocation): { latitude: number, longitude: number } => ({
        latitude: location.latitude,
        longitude: location.longitude,
    }), []);

    // ALTERADO: Usar driverLocation como initialRegion quando disponível e centerOnDriver = true
    const getInitialRegion = useCallback((): Region => {
        // Se temos driverLocation e queremos centralizar nele, use como região inicial
        if (driverLocation && centerOnDriver) {
            return {
                latitude: driverLocation.latitude,
                longitude: driverLocation.longitude,
                latitudeDelta: LATITUDE_DELTA,
                longitudeDelta: LONGITUDE_DELTA,
            };
        }
        
        // Caso contrário, use a localização inicial fornecida
        return {
            ...getMapLocation(initialLocation),
            latitudeDelta: LATITUDE_DELTA,
            longitudeDelta: LONGITUDE_DELTA,
        };
    }, [driverLocation, initialLocation, centerOnDriver, getMapLocation]);

    const [initialRegion] = useState<Region>(getInitialRegion());
    
    const routeOrigin = origin ? getMapLocation(origin) : null;
    const routeDestination = destination ? getMapLocation(destination) : null;
    
    const startPoint = driverLocation || routeOrigin; 
    const endPoint = routeDestination;
    
    const shouldDrawRoute = showRoute && startPoint && endPoint;

    // ✅ CORREÇÃO CRÍTICA: useEffect com dependências corretas
    useEffect(() => {
        let isMounted = true;
        let attempts = 0;

        const fetchRoute = async () => {
            if (!isMounted) return;
            if (!shouldDrawRoute || !startPoint || !endPoint) {
                console.debug('[MapViewComponent] fetchRoute skipped: shouldDrawRoute=', shouldDrawRoute, 'startPoint=', startPoint, 'endPoint=', endPoint);
                setRouteCoordinates([]);
                return;
            }

            try {
                console.debug('[MapViewComponent] fetching route from', startPoint, 'to', endPoint, 'attempt', attempts + 1);
                const route = await calculateOSRMRoute(startPoint, endPoint);

                if (route && route.coordinates && route.coordinates.length > 0) {
                    console.debug('[MapViewComponent] OSRM route received, coords:', route.coordinates.length);
                    setRouteCoordinates(route.coordinates);
                } else {
                    console.debug('[MapViewComponent] OSRM returned null/empty, using straight-line fallback');
                    setRouteCoordinates([startPoint, endPoint]);
                }
            } catch (error) {
                console.error('Erro ao buscar rota:', error);
                // fallback line
                setRouteCoordinates([startPoint, endPoint]);
            }

            // Se ainda não temos rota (empty or trivial) tentamos novamente algumas vezes
            if (isMounted && shouldDrawRoute && (!routeCoordinates || routeCoordinates.length === 0) && attempts < 3) {
                attempts += 1;
                setTimeout(() => {
                    fetchRoute();
                }, 1000);
            }
        };

        fetchRoute();

        return () => {
            isMounted = false;
        };
    // note: routeCoordinates intentionally not included to avoid loop
    }, [shouldDrawRoute, startPoint?.latitude, startPoint?.longitude, endPoint?.latitude, endPoint?.longitude]); // ✅ DEPENDÊNCIAS CORRETAS

    // Animar/centralizar mapa quando a localização do motorista mudar
    useEffect(() => {
        if (!mapRef.current || !driverLocation || !centerOnDriver) return;

        try {
            const region = {
                latitude: driverLocation.latitude,
                longitude: driverLocation.longitude,
                latitudeDelta: LATITUDE_DELTA,
                longitudeDelta: LONGITUDE_DELTA,
            };

            // Centraliza suavemente na localização do motorista
            mapRef.current.animateToRegion(region, 500);
        } catch (error) {
            // ignore
        }
    }, [driverLocation, centerOnDriver]);

    // NOVO: Função para calcular uma região que inclua todos os pontos importantes
    const getRegionThatFitsAll = useCallback(() => {
        const points = [];
        
        if (driverLocation) {
            points.push(driverLocation);
        }
        
        if (origin) {
            points.push(getMapLocation(origin));
        }
        
        if (destination) {
            points.push(getMapLocation(destination));
        }
        
        // Adiciona marcadores importantes
        markers.forEach(marker => {
            points.push(getMapLocation(marker.coords));
        });

        if (points.length === 0) {
            return null;
        }

        // Encontra os limites
        let minLat = points[0].latitude;
        let maxLat = points[0].latitude;
        let minLng = points[0].longitude;
        let maxLng = points[0].longitude;
        
        points.forEach(point => {
            minLat = Math.min(minLat, point.latitude);
            maxLat = Math.max(maxLat, point.latitude);
            minLng = Math.min(minLng, point.longitude);
            maxLng = Math.max(maxLng, point.longitude);
        });

        const centerLat = (minLat + maxLat) / 2;
        const centerLng = (minLng + maxLng) / 2;
        
        // Adiciona um padding para garantir que todos os pontos sejam visíveis
        const latDelta = (maxLat - minLat) * 1.5;
        const lngDelta = (maxLng - minLng) * 1.5;

        return {
            latitude: centerLat,
            longitude: centerLng,
            latitudeDelta: Math.max(latDelta, LATITUDE_DELTA),
            longitudeDelta: Math.max(lngDelta, LONGITUDE_DELTA),
        };
    }, [driverLocation, origin, destination, markers, getMapLocation]);

    // ALTERNATIVA: Centralizar em todos os pontos quando não temos driverLocation específico
    useEffect(() => {
        if (!mapRef.current || centerOnDriver) return;

        const region = getRegionThatFitsAll();
        if (region) {
            mapRef.current.animateToRegion(region, 1000);
        }
    }, [centerOnDriver, getRegionThatFitsAll]);

    // ✅ CORREÇÃO: Função estável para ícones
    const getMarkerIcon = useCallback((marker: MapMarker) => {
        if (marker.icon === 'car-sport') {
            return '🚗';
        }
        
        switch (marker.color) {
            case 'blueBahia':
                return '📍';
            case 'yellowSol':
                return '🏁';
            case 'danger':
                return '🚨';
            case 'success':
                return '✅';
            default:
                return '📌';
        }
    }, []);

    // Determinar qual região usar no mapa
    const mapRegion = driverLocation && centerOnDriver 
        ? {
            latitude: driverLocation.latitude,
            longitude: driverLocation.longitude,
            latitudeDelta: LATITUDE_DELTA,
            longitudeDelta: LONGITUDE_DELTA,
          }
        : initialRegion;

    return (
        <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={initialRegion}
            region={mapRegion} // ADICIONADO: region atual para forçar o centro
            showsUserLocation={true}
            showsMyLocationButton={true}
            followsUserLocation={centerOnDriver} // Segue o usuário se centerOnDriver for true
        >
            {/* Rota */}
            {routeCoordinates.length > 0 && (
                <Polyline
                    coordinates={routeCoordinates}
                    strokeWidth={4}
                    strokeColor={theme.blueBahia}
                    lineCap="round"
                    lineJoin="round"
                />
            )}

            {/* Marcadores */}
            {markers.map((marker) => (
                <Marker
                    key={marker.id}
                    coordinate={getMapLocation(marker.coords)} 
                    title={marker.title}
                    description={getMarkerIcon(marker)}
                    pinColor={COLORS[marker.color]} 
                />
            ))}
            
            {/* Motorista - marcador personalizado */}
            {driverLocation && (
                <Marker 
                    coordinate={driverLocation}
                    title="Sua Localização"
                    description="📍"
                    tracksViewChanges={false}
                >
                    {/* Marcador circular personalizado para sua posição */}
                    <View style={[styles.driverMarker, { backgroundColor: theme.yellowSol, borderColor: theme.whiteAreia }]}>
                        <View style={[styles.driverMarkerInner, { backgroundColor: theme.whiteAreia }]} />
                    </View>
                </Marker>
            )}
        </MapView>
    );
};

const styles = StyleSheet.create({
    map: {
        width: Dimensions.get('window').width,
        height: Dimensions.get('window').height,
    },
    driverMarker: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: COLORS.yellowSol,
        borderWidth: 3,
        borderColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 5,
    },
    driverMarkerInner: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'white',
    },
});

export default MapViewComponent;