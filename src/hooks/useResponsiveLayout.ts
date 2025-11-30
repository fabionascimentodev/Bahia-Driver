import { useMemo } from 'react';
import { useWindowDimensions, Platform } from 'react-native';

export function useResponsiveLayout() {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const footerBottom = useMemo(() => {
    // base padding from bottom (safe area-ish)
    const base = Math.round(Math.max(16, screenHeight * 0.02));
    return base;
  }, [screenHeight]);

  const footerHeight = useMemo(() => {
    // approximate footer/floating button height
    return Math.round(Math.max(56, screenHeight * 0.08));
  }, [screenHeight]);

  const computeCenteredTop = (elementHeight: number) => {
    const rawTop = (screenHeight - elementHeight) / 2;
    const min = 80; // don't go too high
    const max = screenHeight * 0.85; // don't go off-screen
    return Math.min(Math.max(rawTop, min), max);
  };

  return {
    screenWidth,
    screenHeight,
    footerBottom,
    footerHeight,
    computeCenteredTop,
    isAndroid: Platform.OS === 'android',
  };
}

export default useResponsiveLayout;
