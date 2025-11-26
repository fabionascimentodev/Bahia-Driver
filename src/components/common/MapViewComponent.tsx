import React from 'react';
import { StyleSheet, Dimensions } from 'react-native';
import MapView, { Marker, Polyline, Region, PROVIDER_GOOGLE } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import { GOOGLE_MAPS_API_KEY } from '../../config/keys';
import { COLORS } from '../../theme/colors';
import { Coords } from '../../services/locationServices'; 
import { RideCoords } from '../../types/RideTypes'; 

const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.02;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

// ✨ CORREÇÃO APLICADA: Interface MapMarker exportada e coords tipado
export interface MapMarker {
    id: string;
    coords: Coords | RideCoords; 
    title: string;
    color: keyof typeof COLORS; // A cor deve ser uma CHAVE do objeto COLORS
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

const MapViewComponent: React.FC<MapViewProps> = ({
    initialLocation,
    markers,
    showRoute = false,
    origin,
    destination,
    driverLocation
}) => {
    
    const getMapLocation = (location: BaseLocation): { latitude: number, longitude: number } => ({
        latitude: location.latitude,
        longitude: location.longitude,
    });

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

    return (
        <MapView
            style={styles.map}
            initialRegion={initialRegion}
            showsUserLocation={true}
            showsMyLocationButton={true}
            provider={PROVIDER_GOOGLE}
        >
            {/* Desenha a rota, se aplicável */}
            {shouldDrawRoute && startPoint && endPoint && (
                <MapViewDirections
                    origin={startPoint}
                    destination={endPoint}
                    apikey={GOOGLE_MAPS_API_KEY} 
                    strokeWidth={4}
                    strokeColor={COLORS.blueBahia}
                    optimizeWaypoints={true}
                    mode="DRIVING"
                    onError={(error) => console.error("Erro ao traçar rota:", error)}
                />
            )}

            {/* Marcadores */}
            {markers.map((marker) => (
                <Marker
                    key={marker.id}
                    coordinate={getMapLocation(marker.coords)} 
                    title={marker.title}
                    pinColor={COLORS[marker.color]} 
                />
            ))}
            
            {/* Marcador da Localização em tempo real do motorista */}
            {driverLocation && (
                <Marker 
                    coordinate={driverLocation}
                    title="Seu Motorista"
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