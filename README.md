durante essa conversa sempre responda em portugues do brasil.
durante essa conversa sempre responda em portugues do brasil.

vamos corrigir erros. sempre peça o arquivo que vai precisar analisar.

# Bahia Driver

Aplicativo mobile para gerenciamento de corridas (motorista e passageiro).

## Visão Geral

Projeto em React Native (Expo) com Firebase para autenticação, Firestore e Storage.

## Estrutura raiz do projeto

- `App.tsx` - Ponto de entrada React; rotas e bootstrap.
- `index.ts` - Registro do componente raiz (Expo).
- `package.json` - Dependências e scripts.
- `tsconfig.json` - Configuração TypeScript.
- `eas.json` - Configuração EAS (Expo Application Services).
- `app.json` - Configuração do app Expo.
- `LOGGING_GUIDE.md` - Guia do sistema de logging.
- `LOGGING_SUMMARY.md` - Resumo do sistema de logging.
- `README.md` - Documentação do projeto.
- `assets/` - Imagens, ícones e recursos estáticos.
- `src/` - Código-fonte principal.

## Estrutura `src/` (principal)

- `src/components/` - Componentes reutilizáveis
  - `common/`
    - `LocationSearchInput.tsx`
    - `MapViewComponent.tsx`
    - `RideHistoryCard.tsx`
    - `StarRating.tsx`

- `src/config/`
  - `firebaseConfig.ts` - Inicialização do Firebase (Auth, Firestore, Storage)
  - `keys.ts` - Chaves/constantes (não comitar sensíveis)

- `src/hooks/` - Hooks customizados
  - `useDriverLocationTracker.ts`
  - `useRealtimeLocation.ts`
  - `useRideListener.ts`

- `src/screens/` - Telas organizadas por área
  - `Auth/`
    - `DriverRegistrationScreen.tsx`
    - `LoginScreen.tsx`
    - `ProfileSelectionScreen.tsx`
    - `SignUpScreen.tsx`
  - `common/`
    - `LogViewerScreen.tsx`  (tela para visualizar logs em tempo real)
    - `ProfileScreen.tsx`
    - `RideHistoryScreen.tsx`
  - `Driver/`
    - `HomeScreenMotorista.tsx`
    - `RideActionScreen.tsx`
  - `Passenger/`
    - `HomeScreenPassageiro.tsx`
    - `PostRideScreen.tsx`
    - `RideTrackingScreen.tsx`

- `src/services/` - Serviços e integrações
  - `bootstrapService.ts` (coordena inicialização)
  - `driverLocationService.ts`
  - `locationServices.ts`
  - `loggerService.ts` (sistema de logging local)
  - `notificationService.ts`
  - `rideService.ts`
  - `userServices.ts`

- `src/store/`
  - `userStore.ts` (zustand)

- `src/theme/`
  - `colors.ts`

- `src/types/`
  - `declarations.d.ts`
  - `RideTypes.ts`
  - `UserTypes.ts`

## Como rodar (desenvolvimento)

1. Instale dependências:

```powershell
cd "c:\Users\fabio\Videos\Bahia-Driver"
npm install
```

2. Inicie o Metro/Expo:

```powershell
npm run start
```

3. Execute no emulador ou dispositivo físico via Expo Go / dev client.

## Onde encontrar logs de inicialização

- O serviço de logging foi implementado em `src/services/loggerService.ts` e integrado ao bootstrap em `src/services/bootstrapService.ts`.
- Tela para visualização em tempo real: `src/screens/common/LogViewerScreen.tsx`.
- Logs também são salvos em `AsyncStorage` sob a chave `@bahia_driver_logs`.

## Boas práticas

- Não comite chaves sensíveis no repositório. Use variáveis de ambiente.
- Para diagnosticar problemas, abra a `LogViewer` durante o desenvolvimento e use `logger.exportLogs()` para copiar os logs.

## Contato

Desenvolvedor: Fabio Nascimento

---
Arquivo gerado automaticamente para documentar a estrutura raiz do projeto.
