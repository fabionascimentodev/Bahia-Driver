import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, Dimensions } from 'react-native';
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
}

// ✅ CORREÇÃO: Mover função para fora do componente para evitar recriação
const calculateOSRMRoute = async (origin: Coords, destination: Coords) => {
    try {
        const response = await fetch(
            `http://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson`
        );
        
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
    driverLocation
}) => {
    const [routeCoordinates, setRouteCoordinates] = useState<{latitude: number, longitude: number}[]>([]);
    const mapRef = useRef<MapView | null>(null);

    const getMapLocation = useCallback((location: BaseLocation): { latitude: number, longitude: number } => ({
        latitude: location.latitude,
        longitude: location.longitude,
    }), []);

    const initialRegion: Region = {
        ...getMapLocation(initialLocation),
        latitudeDelta: LATITUDE_DELTA,
        longitudeDelta: LONGITUDE_DELTA,
    };
    
    const routeOrigin = origin ? getMapLocation(origin) : null;
    const routeDestination = destination ? getMapLocation(destination) : null;
    
    const startPoint = driverLocation || routeOrigin; 
    const endPoint = routeDestination;
    
    const shouldDrawRoute = showRoute && startPoint && endPoint;

    // ✅ CORREÇÃO CRÍTICA: useEffect com dependências corretas
    useEffect(() => {
        const fetchRoute = async () => {
            if (!shouldDrawRoute || !startPoint || !endPoint) {
                setRouteCoordinates([]);
                return;
            }

            try {
                const route = await calculateOSRMRoute(startPoint, endPoint);
                
                if (route) {
                    setRouteCoordinates(route.coordinates);
                } else {
                    // Rota fallback simples (linha reta)
                    setRouteCoordinates([startPoint, endPoint]);
                }
            } catch (error) {
                console.error('Erro ao buscar rota:', error);
                setRouteCoordinates([startPoint, endPoint]);
            }
        };

        fetchRoute();
    }, [shouldDrawRoute, startPoint?.latitude, startPoint?.longitude, endPoint?.latitude, endPoint?.longitude]); // ✅ DEPENDÊNCIAS CORRETAS

    // Animar/centralizar mapa quando a localização do motorista mudar
    useEffect(() => {
        if (!mapRef.current || !driverLocation) return;

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
    }, [driverLocation]);

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

    return (
        <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={initialRegion}
            showsUserLocation={true}
            showsMyLocationButton={true}
        >
            {/* Rota */}
            {routeCoordinates.length > 0 && (
                <Polyline
                    coordinates={routeCoordinates}
                    strokeWidth={4}
                    strokeColor={COLORS.blueBahia}
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
            
            {/* Motorista */}
            {driverLocation && (
                <Marker 
                    coordinate={driverLocation}
                    title="Seu Motorista"
                    description="🚗"
                    pinColor={COLORS.yellowSol} 
                />
            )}
        </MapView>
    );
};

const styles = StyleSheet.create({
    map: {
        width: Dimensions.get('window').width,
        height: Dimensions.get('window').height,
    },
});

export default MapViewComponent;