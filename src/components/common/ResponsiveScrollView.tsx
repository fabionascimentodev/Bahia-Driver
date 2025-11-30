import React from 'react';
import { ScrollView, ScrollViewProps, ViewStyle } from 'react-native';
import useResponsiveLayout from '../../hooks/useResponsiveLayout';

type Props = ScrollViewProps & {
  extraBottom?: number;
  contentContainerStyle?: ViewStyle | any;
};

export function ResponsiveScrollView({ children, contentContainerStyle, extraBottom = 0, ...rest }: Props) {
  const { footerBottom } = useResponsiveLayout();

  const paddingBottom = footerBottom + extraBottom;

  return (
    <ScrollView
      contentContainerStyle={[{ paddingBottom }, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      {...rest}
    >
      {children}
    </ScrollView>
  );
}

export default ResponsiveScrollView;
