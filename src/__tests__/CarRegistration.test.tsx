import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import CarRegistrationScreen from '../screens/Driver/CarRegistrationScreen';

// Mock userServices functions used by CarRegistration
const mockCreateUser = jest.fn(() => Promise.resolve('uid-123'));
const mockUploadUserAvatar = jest.fn(() => Promise.resolve());
const mockUploadVehiclePhoto = jest.fn(() => Promise.resolve('https://foto'));
const mockUploadVehicleDocument = jest.fn(() => Promise.resolve('https://doc'));
const mockUploadCnhPhoto = jest.fn(() => Promise.resolve('https://cnh'));
const mockUploadAntecedenteFile = jest.fn(() => Promise.resolve('https://ant'));
const mockSaveDriverVehicleData = jest.fn(() => Promise.resolve());
const mockSaveMotoristaRecord = jest.fn(() => Promise.resolve());
const mockUpdateUserProfileType = jest.fn(() => Promise.resolve());

jest.mock('../services/userServices', () => ({
  createUserWithEmailAndPassword: (...args: any[]) => mockCreateUser(...args),
  uploadUserAvatar: (...args: any[]) => mockUploadUserAvatar(...args),
  uploadVehiclePhoto: (...args: any[]) => mockUploadVehiclePhoto(...args),
  uploadVehicleDocument: (...args: any[]) => mockUploadVehicleDocument(...args),
  uploadCnhPhoto: (...args: any[]) => mockUploadCnhPhoto(...args),
  uploadAntecedenteFile: (...args: any[]) => mockUploadAntecedenteFile(...args),
  saveDriverVehicleData: (...args: any[]) => mockSaveDriverVehicleData(...args),
  saveMotoristaRecord: (...args: any[]) => mockSaveMotoristaRecord(...args),
  updateUserProfileType: (...args: any[]) => mockUpdateUserProfileType(...args),
}));

// Mock navigation helpers
const mockResetRoot = jest.fn(() => Promise.resolve(true));
const mockNavigateRoot = jest.fn(() => Promise.resolve(true));
jest.mock('../services/navigationService', () => ({
  resetRootWhenAvailable: (...args: any[]) => mockResetRoot(...args),
  navigateRootWhenAvailable: (...args: any[]) => mockNavigateRoot(...args),
  navigateToRoute: jest.fn(() => true),
}));

// Mock useUserStore
const mockSetUser = jest.fn();
jest.mock('../store/userStore', () => ({
  useUserStore: jest.fn((selector: any) => selector({ user: undefined, setUser: mockSetUser }))
}));

describe('CarRegistrationScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('quando usar prefill cria usuário e salva veículo, então navega para HomeMotorista', async () => {
    const navigation: any = { navigate: jest.fn(), canGoBack: jest.fn(() => true), goBack: jest.fn() };
    const route: any = { params: { prefillPersonal: { nome: 'Teste', telefone: '2191234', email: 't@t.com', password: '123456', avatarUri: undefined }, existingUser: false } };

    const { getByPlaceholderText, getByText } = render(<CarRegistrationScreen navigation={navigation} route={route} />);

    // Preencher dados do veículo básicos
    fireEvent.changeText(getByPlaceholderText('Modelo'), 'Fiat Uno');
    fireEvent.changeText(getByPlaceholderText('Placa'), 'ABC1234');
    fireEvent.changeText(getByPlaceholderText('Cor'), 'Vermelho');

    // Submit
    fireEvent.press(getByText('Finalizar Cadastro'));

    await waitFor(() => expect(mockCreateUser).toHaveBeenCalledWith('t@t.com', '123456', 'Teste', '2191234', 'motorista'));
    await waitFor(() => expect(mockSaveDriverVehicleData).toHaveBeenCalled());
    await waitFor(() => expect(mockResetRoot).toHaveBeenCalledWith('HomeMotorista', expect.any(Object)));
  }, 10000);
});
