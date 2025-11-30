durante essa conversa sempre responda em portugues do brasil.
durante essa conversa sempre responda em portugues do brasil.
por favor, nunca altere o estilo visual e layout, sempre siga o padra ja estabelicido

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


## Fluxo de Autenticação e Cadastro

## Cálculo da Tarifa (como o valor da corrida é calculado)

As regras oficiais para o cálculo do valor de uma corrida neste projeto são as seguintes:

- **Valor mínimo:** R$ 12,00 — o valor final nunca pode ser menor que R$ 12,00.
- **Valor por km rodado:** R$ 2,20 por km.
- **Tarifa por minuto:** R$ 0,60 por minuto (tempo parado ou trânsito lento).
- **Horário de alta demanda:** se aplicável, acrescenta-se R$ 3,00 ao subtotal.

Fórmula usada:

```
total_km = km × 2,20
total_tempo = minutos × 0,60
subtotal = total_km + total_tempo
se alta_demanda → subtotal += 3,00
se subtotal < 12,00 → total = 12,00
caso contrário → total = subtotal
```

Observações de implementação:

- A lógica canônica está implementada em `src/utils/fareCalculator.ts` (função `calculateFare`).
- A função retorna um objeto de detalhamento com as chaves: `totalKm`, `totalTime`, `subtotal`, `highDemandCharge` e `total`.
- Para compatibilidade com lugares do código que chamavam um estimador antigo, existe `calculateEstimatedPrice` em `src/services/locationServices.ts` que agora delega ao `fareCalculator` (com fallback para a fórmula antiga caso necessário).
- Ao criar uma corrida, `src/services/rideService.ts` preenche inicialmente `precoEstimado` e, em background, atualiza esse valor quando consegue a rota (distance/duration) usando o mesmo calculador.

Exemplos (para facilitar verificação rápida):

- `calculateFare({ km: 2, minutes: 5 })` → totalKm: 4.40, totalTime: 3.00, subtotal: 7.40 → total: **12.00** (aplicado o valor mínimo)
- `calculateFare({ km: 10, minutes: 15 })` → totalKm: 22.00, totalTime: 9.00, subtotal: 31.00 → total: **31.00**
- `calculateFare({ km: 5, minutes: 10, highDemand: true })` → totalKm: 11.00, totalTime: 6.00, subtotal: 17.00 + 3.00 → total: **20.00**

Exemplo de instrução (para IA ou scripts):

`"Calcule o valor da corrida usando as regras: Mínimo R$ 12,00, R$ 2,20 por km, R$ 0,60 por minuto, +R$ 3,00 se alta demanda."`


```
1. Login Screen
    ↓ (usuário novo clica em "Criar conta")
2. Sign Up Screen (cadastro genérico - sem perfil ainda)
    ↓ (clica em "Criar Conta")
3. Profile Selection Screen (escolhe perfil)
    ↓
    ┌────────────────────────┬────────────────────────┐
    ↓                        ↓
Passageiro              Motorista
    ↓                        ↓
HomeScreenPassageiro  DriverRegistration
                      (cadastro do carro)
                             ↓
                      HomeScreenMotorista
```

### Como funciona:

- **Sign Up**: Cria usuário NO Firebase Auth e Firestore **SEM perfil definido**
- **Profile Selection**: Salva o perfil (`passageiro` ou `motorista`) no Firestore
- **App.tsx**: Monitora mudanças no usuário via `onAuthStateChanged`
  - Se tem perfil `passageiro` → Redireciona para `MainNavigator` (Passageiro Flow)
  - Se tem perfil `motorista` E sem carro → Redireciona para `DriverRegistrationScreen`
  - Se tem perfil `motorista` E com carro → Redireciona para `MainNavigator` (Motorista Flow)
- **DriverRegistration**: Salva dados do veículo e marca `isRegistered = true`
- **App.tsx**: Detecta que motorista está completo → Redireciona para `HomeScreenMotorista`