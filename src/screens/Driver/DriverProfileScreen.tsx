import React from 'react';
import { View } from 'react-native';
import ProfileScreen from '../common/ProfileScreen';

const DriverProfileScreen = (props: any) => {
  // Ensure role param is set to 'motorista'
  const route = { ...(props.route || {}), params: { ...(props.route?.params || {}), role: 'motorista' } };
  return <ProfileScreen {...props} route={route} />;
};

export default DriverProfileScreen;
