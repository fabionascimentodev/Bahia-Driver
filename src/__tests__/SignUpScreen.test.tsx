import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import SignUpScreen from '../screens/Auth/SignUpScreen';

// Mock userServices used inside SignUpScreen
jest.mock('../services/userServices', () => ({
  createUserWithEmailAndPassword: jest.fn(() => Promise.resolve('uid-mock')),
  uploadUserAvatar: jest.fn(() => Promise.resolve()),
}));

describe('SignUpScreen', () => {
  const navigation: any = { navigate: jest.fn(), reset: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('mostra modal de seleção de perfil após preencher formulário e tocar em Criar Conta', async () => {
    const { getByPlaceholderText, getByText } = render(<SignUpScreen navigation={navigation} />);

    fireEvent.changeText(getByPlaceholderText('Nome completo'), 'João Silva');
    fireEvent.changeText(getByPlaceholderText('Telefone'), '21999999999');
    fireEvent.changeText(getByPlaceholderText('Email'), 'joao@example.com');
    fireEvent.changeText(getByPlaceholderText('Senha'), '123456');
    fireEvent.changeText(getByPlaceholderText('Confirmar senha'), '123456');

    const createButton = getByText('Criar Conta');
    fireEvent.press(createButton);

    // modal should be visible with profile choices
    await waitFor(() => expect(getByText('Como você gostaria de usar o Bahia Driver?')).toBeTruthy());
    expect(getByText('Sou Passageiro')).toBeTruthy();
    expect(getByText('Sou Motorista')).toBeTruthy();
  });

  it('ao escolher Passageiro cria usuário e reseta para HomePassageiro', async () => {
    const { getByPlaceholderText, getByText } = render(<SignUpScreen navigation={navigation} />);

    fireEvent.changeText(getByPlaceholderText('Nome completo'), 'Joana');
    fireEvent.changeText(getByPlaceholderText('Telefone'), '21988888888');
    fireEvent.changeText(getByPlaceholderText('Email'), 'joana@example.com');
    fireEvent.changeText(getByPlaceholderText('Senha'), 'abcdef');
    fireEvent.changeText(getByPlaceholderText('Confirmar senha'), 'abcdef');

    fireEvent.press(getByText('Criar Conta'));

    // wait for modal to appear and press the passenger option
    await waitFor(() => getByText('Sou Passageiro'));
    fireEvent.press(getByText('Sou Passageiro'));

    await waitFor(() => expect(navigation.reset).toHaveBeenCalled());
    expect(navigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'HomePassageiro' }] });
  });

  it('ao escolher Motorista navega para CarRegistration com prefill', async () => {
    const { getByPlaceholderText, getByText } = render(<SignUpScreen navigation={navigation} />);

    fireEvent.changeText(getByPlaceholderText('Nome completo'), 'Carlos');
    fireEvent.changeText(getByPlaceholderText('Telefone'), '21977777777');
    fireEvent.changeText(getByPlaceholderText('Email'), 'carlos@example.com');
    fireEvent.changeText(getByPlaceholderText('Senha'), 'zzzzzz');
    fireEvent.changeText(getByPlaceholderText('Confirmar senha'), 'zzzzzz');

    fireEvent.press(getByText('Criar Conta'));

    await waitFor(() => getByText('Sou Motorista'));
    fireEvent.press(getByText('Sou Motorista'));

    await waitFor(() => expect(navigation.navigate).toHaveBeenCalledWith('CarRegistration', expect.any(Object)));
  });
});
