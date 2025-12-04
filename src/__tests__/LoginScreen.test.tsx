import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import LoginScreen from '../screens/Auth/LoginScreen';

describe('LoginScreen', () => {
  it('navega para SignUp ao tocar em "Criar nova conta"', () => {
    const navigate = jest.fn();
    const navigation: any = { navigate };

    const { getByText } = render(<LoginScreen navigation={navigation} />);

    const button = getByText('Criar nova conta');
    fireEvent.press(button);

    expect(navigate).toHaveBeenCalledWith('SignUp');
  });
});
