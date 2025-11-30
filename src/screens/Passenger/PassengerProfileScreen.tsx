import React from 'react';
import ProfileScreen from '../common/ProfileScreen';

const PassengerProfileScreen = (props: any) => {
  const route = { ...(props.route || {}), params: { ...(props.route?.params || {}), role: 'passageiro' } };
  return <ProfileScreen {...props} route={route} />;
};

export default PassengerProfileScreen;
