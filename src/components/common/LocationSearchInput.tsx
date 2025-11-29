/*import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
// Você provavelmente precisará instalar e importar a biblioteca GooglePlacesAutocomplete
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { GOOGLE_MAPS_API_KEY } from '../../config/keys';
import { COLORS } from '../../theme/colors';
import { RideCoords } from '../../types/RideTypes'; // Assumindo que você usa este tipo

// Interface que define as propriedades que o componente recebe
interface LocationSearchInputProps {
    placeholder: string;
    // Função chamada ao selecionar um local, retorna o objeto de coordenadas
    onSelectLocation: (coords: RideCoords) => void; 
}

// O componente deve retornar JSX (ReactNode), não 'void'
const LocationSearchInput: React.FC<LocationSearchInputProps> = ({ placeholder, onSelectLocation }) => {
    
    // Função para extrair coordenadas e nome do resultado da busca
    const handlePlaceSelect = (data: any, details: any) => {
        if (details && details.geometry && details.geometry.location) {
            const { lat, lng } = details.geometry.location;
            
            const newCoords: RideCoords = {
                latitude: lat,
                longitude: lng,
                nome: data.description || 'Local Selecionado'
            };
            
            onSelectLocation(newCoords);
        }
    };

    return (
        <View style={styles.container}>
            <GooglePlacesAutocomplete
                placeholder={placeholder}
                onPress={handlePlaceSelect}
                query={{
                    key: GOOGLE_MAPS_API_KEY,
                    language: 'pt-BR',
                    components: 'country:br', // Opcional: restringir ao Brasil
                }}
                fetchDetails={true}
                styles={{
                    container: {
                        flex: 0, // Importante para não expandir demais
                        zIndex: 10,
                    },
                    textInputContainer: {
                        width: '100%',
                        backgroundColor: COLORS.whiteAreia,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: COLORS.grayClaro,
                        height: 50,
                    },
                    textInput: {
                        fontSize: 16,
                        height: 48,
                        color: COLORS.blackProfissional,
                        backgroundColor: COLORS.whiteAreia,
                    },
                    listView: {
                        // Posiciona a lista de resultados abaixo do input
                        position: 'absolute', 
                        top: 50,
                        backgroundColor: COLORS.whiteAreia,
                        borderBottomLeftRadius: 8,
                        borderBottomRightRadius: 8,
                        elevation: 5,
                        zIndex: 20, // Garante que a lista fique acima de outros elementos
                    }
                }}
                debounce={300} // Atraso na pesquisa para otimizar
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        // Altura mínima para garantir que o input e os resultados caibam
        minHeight: 50, 
        // Importante para garantir que o input de busca se encaixe corretamente no painel
        width: '100%',
        marginBottom: 10,
    },
});

export default LocationSearchInput;*/