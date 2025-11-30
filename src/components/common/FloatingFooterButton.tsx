import React, { useRef, useEffect } from 'react';
import { Animated, TouchableOpacity, Text, ViewStyle, StyleSheet } from 'react-native';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';
import { COLORS } from '../../theme/colors';

type Props = {
  online: boolean;
  onPress: () => void;
  texts?: [string, string];
  style?: ViewStyle | any;
};

export function FloatingFooterButton({ online, onPress, texts = ['Você está online', 'Buscando viagens...'], style }: Props) {
  const { footerBottom, screenWidth } = useResponsiveLayout();
  const opacity = useRef(new Animated.Value(1)).current;
  const index = useRef(0);

  useEffect(() => {
    let id: NodeJS.Timeout | null = null;
    if (online) {
      id = setInterval(() => {
        index.current = (index.current + 1) % texts.length;
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        ]).start();
      }, 2800);
    }
    return () => { if (id) clearInterval(id); };
  }, [online]);

  const displayText = online ? texts[index.current] : 'Offline';

  return (
    <Animated.View style={[styles.wrapper, { bottom: footerBottom }, style]} pointerEvents="box-none">
      <TouchableOpacity onPress={onPress} style={[styles.button, { minWidth: Math.min(360, screenWidth * 0.9), backgroundColor: COLORS.blueBahia }]}>
        <Animated.Text style={[styles.text, { opacity }]}>{displayText}</Animated.Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 12,
    right: 12,
    alignItems: 'center',
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  text: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});

export default FloatingFooterButton;
