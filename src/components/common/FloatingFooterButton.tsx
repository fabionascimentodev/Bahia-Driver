import React, { useRef, useEffect } from 'react';
import { Animated, TouchableOpacity, Text, ViewStyle, StyleSheet, Easing } from 'react-native';
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
  const scale = useRef(new Animated.Value(1)).current;
  const index = useRef(0);
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    let id: NodeJS.Timeout | null = null;
    if (online) {
      // start a smooth looping animation (scale + opacity)
      loopRef.current = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(opacity, {
              toValue: 0.85,
              duration: 600,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(scale, {
              toValue: 1.03,
              duration: 600,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(opacity, {
              toValue: 1,
              duration: 600,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(scale, {
              toValue: 1,
              duration: 600,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      loopRef.current.start();

      // keep switching displayed text at a gentler interval
      id = setInterval(() => {
        index.current = (index.current + 1) % texts.length;
      }, 3200);
    } else {
      // ensure we reset values when offline
      opacity.setValue(1);
      scale.setValue(1);
    }
    return () => {
      if (id) clearInterval(id);
      if (loopRef.current) {
        loopRef.current.stop();
        loopRef.current = null;
      }
    };
  }, [online]);

  const displayText = online ? texts[index.current] : 'Offline';

  const theme = COLORS;

  return (
    <Animated.View style={[styles.wrapper, { bottom: footerBottom }, style]} pointerEvents="box-none">
      <TouchableOpacity onPress={onPress} style={[styles.button, { minWidth: Math.min(360, screenWidth * 0.9), backgroundColor: theme.blueBahia }]}>
        <Animated.Text style={[styles.text, { opacity, color: theme.whiteAreia, transform: [{ scale }] }]}>{displayText}</Animated.Text>
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
