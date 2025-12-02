durante essa conversa sempre responda em portugues do brasil.

por favor, nunca altere o estilo visual e layout, sempre siga o padrão ja estabelicido.

vamos corrigir erros. 

sempre peça o arquivo que vai precisar verificar.

# Bahia Driver

Aplicativo mobile para gerenciamento de corridas (motorista e passageiro).

## Sistema de Taxas e Repasse (Bahia Driver — estilo Uber)

Adicionado um sistema para controlar repasse ao motorista, cobrança de taxa da plataforma e gerenciamento de dívida quando o pagamento é feito em dinheiro.

Arquivos principais:

- `src/config/financeConfig.ts` — constantes e parâmetros da plataforma (porcentagem da taxa, limites, nome da coleção de transações).
- `src/services/financeService.ts` — implementação das regras de negócio (processamento de finalização de corrida, registro de transações, saque PIX instantâneo).
- `src/services/rideService.ts` — ponto natural para integrar `financeService.processTripFinalization(...)` quando uma corrida for finalizada.

Modelos / campos no Firestore (campo sugerido/novo)

- `users/{driverId}` (documento de usuário, motorista):
  - `motoristaData.balance` (number) — saldo disponível do motorista (R$).
  - `motoristaData.debt` (number) — dívida do motorista (R$) gerada por corridas pagas em dinheiro.
  - `motoristaData.consecutiveCashDays` (number) — contador de corridas/dias consecutivos em dinheiro para aplicar regras de bloqueio.
  - `motoristaData.blockedForCash` (boolean) — flag para impedir corridas em dinheiro quando regras são violadas.

- `rides/{rideId}` (documento da corrida):
  - `valor_total` (number) — total cobrado pela corrida.
  - `valor_taxa` (number) — valor que a plataforma reteve (taxa).
  - `valor_motorista` (number) — valor bruto destinado ao motorista (antes de abater dívida).
  - `tipo_pagamento` (string) — `'cash'` ou `'digital'`.
  - `pago` (boolean) — indica se a corrida foi paga digitalmente.

- Coleção de `transactions` (nome configurável em `financeConfig.ts`) — registra todas as movimentações e eventos financeiros com os campos:
  - `driverId`, `rideId`, `type` (`credit|fee|debt_increase|debt_decrease|payout|other`), `amount`, `balanceBefore`, `balanceAfter`, `debtBefore`, `debtAfter`, `paymentMethod`, `createdAt`.

Regras implementadas (resumo)

- Pagamento digital (PIX/cartão):
  1. A plataforma recebe o pagamento digital primeiro.
  2. Calcula `taxa = valor_total * porcentagem_da_plataforma` e `valor_motorista = valor_total - taxa`.
  3. Se houver dívida (`debt > 0`): subtrai da `valor_motorista` até quitar a dívida (abatimento automático). Atualiza `motoristaData.debt` e credita o restante em `motoristaData.balance`.
  4. Registra transações: `fee`, `debt_decrease` (se aplicável) e `credit` (se houver crédito ao motorista).

- Pagamento em dinheiro:
  1. O motorista recebe 100% do valor em mãos.
  2. A plataforma calcula `taxa = valor_total * porcentagem_da_plataforma` e registra essa taxa como dívida do motorista: `motoristaData.debt += taxa`.
  3. O `motoristaData.balance` não é alterado.
  4. Registra transação `debt_increase`.

- Desconto automático da dívida:
  - Na próxima corrida digital, a plataforma abate automaticamente a dívida usando o `valor_motorista` daquela corrida. Se `valor_motorista` for maior que a dívida, o excedente é creditado no `balance`. Se não, a dívida permanece parcialmente abatida.

- Regras adicionais:
  - É mantido `motoristaData.consecutiveCashDays` para detectar uso excessivo de corridas em dinheiro.
  - Se `motoristaData.debt` ultrapassar `DEBT_BLOCK_THRESHOLD` ou `consecutiveCashDays` ultrapassar `MAX_CONSECUTIVE_CASH_DAYS`, o motorista é marcado com `motoristaData.blockedForCash = true` e não poderá mais aceitar corridas em dinheiro.
  - Tudo é registrado na coleção de transações para auditoria.
  - Suporte a saque instantâneo via PIX: `financeService.requestInstantPayout(driverId, amount)` registra o saque e reduz o `balance`.

Como usar (exemplos)

- Processar finalização de corrida (ex: ao finalizar a corrida no backend):

```ts
import financeService from './src/services/financeService';

// quando a corrida é finalizada (rideId conhecido)
await financeService.processTripFinalization(rideId, { paymentType: 'digital' });
// ou
await financeService.processTripFinalization(rideId, { paymentType: 'cash' });
```

- Requisitar saque instantâneo (PIX):

```ts
import financeService from './src/services/financeService';

await financeService.requestInstantPayout(driverId, 150.00);
```

Configuração / parâmetros

- `src/config/financeConfig.ts` contém valores ajustáveis:
  - `PLATFORM_FEE_PERCENTAGE` — porcentagem da taxa da plataforma (ex.: 0.20 para 20%).
  - `MAX_CONSECUTIVE_CASH_DAYS` — número máximo de corridas/dias em dinheiro antes de bloquear.
  - `DEBT_BLOCK_THRESHOLD` — valor de dívida que bloqueia corridas em dinheiro.
  - `TRANSACTIONS_COLLECTION` — nome da coleção usada para registrar transações.

Observações e migração

- Se você já tem motoristas no Firestore, garanta que os documentos `users/{uid}` tenham o objeto `motoristaData` com os campos numéricos iniciais:

```js
{
  motoristaData: {
    balance: 0,
    debt: 0,
    consecutiveCashDays: 0,
    blockedForCash: false
  }
}
```

- Recomenda-se executar um script de migração para inicializar esses campos para usuários existentes.
- Considere atualizar as regras de segurança do Firestore para proteger campos financeiros e criar índices necessários para consultas.

Notas finais

- A implementação segue a lógica pedida: corridas digitais quitam automaticamente as dívidas e credita saldo; corridas em dinheiro geram dívida que a plataforma recupera nas próximas corridas digitais.
- Toda movimentação é registrada na coleção de `transactions` para auditoria e reconciliação.

Se quiser, eu posso:
- Adicionar um script de migração para inicializar `motoristaData` para usuários existentes;
- Integrar explicitamente `financeService.processTripFinalization` dentro de `src/services/rideService.ts` (no fluxo `finalizarCorrida`) e criar testes unitários para os cenários (digital completa dívida menor/maior, corrida em dinheiro, bloqueio por limite, saque PIX);
- Gerar exemplos de consultas para extrair o extrato financeiro do motorista.

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

## Cloud Functions (envio automático de e-mail de suporte)

Adicionei uma Cloud Function que escuta a coleção `supportReports` e envia um e-mail automático para `bahia-driver@gmail.com` quando um novo relato for criado.

Requisitos
- No diretório `functions/` adicionamos a dependência `nodemailer` (execute `npm install` dentro de `functions/`).
- Você precisa configurar credenciais SMTP seguras em seu ambiente de deploy (por exemplo, usando o Firebase environment config ou o Secret Manager). Variáveis esperadas (exemplos):

  - SMTP_HOST (ex.: smtp.mailprovider.com)
  - SMTP_PORT (ex.: 587)
  - SMTP_SECURE (true|false — se usa TLS)
  - SMTP_USER
  - SMTP_PASS
  - SUPPORT_EMAIL (opcional) — e-mail de destino, padrão bahia-driver@gmail.com

Exemplo (usando Firebase CLI runtime config):

```bash
# Defina via firebase functions:config:set (exemplo genérico — prefira usar Secret Manager em produção)
firebase functions:config:set smtp.host="smtp.example.com" smtp.port="587" smtp.secure="false" smtp.user="you@example.com" smtp.pass="supersecret"

# Depois faça o deploy dentro do diretório functions
cd functions
npm install
firebase deploy --only functions
```

A função criará/atualizará o documento `supportReports/{id}` com `status: 'sent'` ou `status: 'failed'` dependendo do resultado do envio.

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
- Ao criar uma corrida, `src/services/rideService.ts` preenche inicialmente `preçoEstimado` e, em background, atualiza esse valor quando consegue a rota (distance/duration) usando o mesmo calculador.

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

## Testar e deploy das Cloud Functions (Firestore trigger)

Siga estes passos para testar as Cloud Functions localmente com o emulador do Firebase e para fazer o deploy.

1) Instalar Firebase CLI (se ainda não tiver):

```powershell
npm install -g firebase-tools
```

2) Instalar dependências das functions (caso ainda não tenha sido feito):

```powershell
cd 'C:\Users\Fabio\videos\bahia-driver\functions'
npm install
```

3) Iniciar os emuladores (Firestone + Functions) a partir da raiz do projeto:

```powershell
cd 'C:\Users\Fabio\videos\bahia-driver'
firebase emulators:start --only firestore,functions
```

4) Em outro terminal, rode o script de teste que cria uma `trip` e a marca como `completed` (o trigger deve disparar):

```powershell
node scripts/test_trigger_trip.js [driverId] [paymentType] [valorTotal]
# Exemplo:
node scripts/test_trigger_trip.js driver_test_1 digital 42.5
```

5) Deploy para o Firebase (quando estiver pronto):

```powershell
# Faça login e selecione o projeto
firebase login
firebase use --add

# Deploy apenas das functions
cd 'C:\Users\Fabio\videos\bahia-driver'
firebase deploy --only functions --project <SEU_PROJECT_ID>
```

Observações:
- As Cloud Functions que usam o Admin SDK ignoram as regras de segurança do Firestore (são executadas com privilégios administrativos). Ainda assim, as regras protegem o uso direto pelo cliente.
- No emulador, o Admin SDK funciona sem credencial adicional desde que `FIRESTORE_EMULATOR_HOST` esteja definido pelo `firebase emulators:start`.
- Ajuste `functions/index.js` (parâmetros no topo do arquivo) para alterar a porcentagem de taxa, limites de bloqueio, etc.

---

**Atualizações Recentes (resumo)**

Adicionei várias funcionalidades e correções no repositório. Segue um resumo prático para referência rápida e testes:

- Serviço financeiro (`src/services/financeService.ts`): processamento de finalização de corrida, registro de transações, saque PIX, resumo de ganhos (diário/semana/mês). Atual: lógica para descontar dívida automaticamente em corridas digitais e registrar dívida em corridas em dinheiro.
- Cloud Function de trigger (`functions/index.js`): função `onTripCompleted` que dispara em `trips/{tripId}` quando o status muda para `completed` e aplica automaticamente a **taxa de 10%**, registra transações e atualiza `users/{driverId}.motoristaData` (balance/debt/counters). Está pronta para deploy; veja `functions/package.json` para dependências.
- Regras do Firestore (`firestore.rules`): arquivo com regras sugeridas para proteger campos financeiros sensíveis (`motoristaData.balance`, `motoristaData.debt`) e restringir escrita em `transactions` somente por backend/admin (ajuste conforme sua estratégia de auth).
- Script de teste para emulator (`scripts/test_trigger_trip.js`): cria uma `trip` de teste e a marca como `completed` para disparar a Cloud Function no emulador.
- UI - Motorista:
  - `src/screens/Driver/DriverPostRideScreen.tsx`: agora exibe o valor total da corrida e método de pagamento (card/cash) junto com a tela de avaliação — igual à tela do passageiro.
  - `src/screens/Driver/RideActionScreen.tsx`: melhorias de navegação externa — salvamos uma flag antes de abrir Waze/Google Maps e adicionamos listener para detectar quando o app volta ao foreground para retornar o motorista automaticamente à tela da corrida. Também mudei a posição dos botões: o botão "CHEGUEI AO LOCAL DE BUSCA" é posicionado de forma absoluta acima do rodapé, e o botão "Cancelar Corrida" voltou ao fluxo normal (não absoluto).

**Onde verificar / testar**

- Funções: `functions/index.js` — instalar dependências e testar com emulator.
- Teste rápido (emulador):

```powershell
cd 'C:\Users\Fabio\videos\bahia-driver'
firebase emulators:start --only firestore,functions
# Em outro terminal
node scripts/test_trigger_trip.js driver_test_1 digital 42.5
```

- UI do motorista: abra uma corrida no app, finalize e verifique `DriverPostRideScreen` mostrando o valor e a avaliação. Teste também abrir navegação externa (Waze/Google) e retornar ao app para validar a detecção de retorno.

**Notas / recomendações**

- Cloud Functions: revise `functions/index.js` para parametrizar porcentagem e limites via `functions.config()` ou variáveis de ambiente, se desejar.
- Regras do Firestore: ajuste `request.auth.token.backend`/`admin` conforme a estratégia de tokens customizados ou remova/ajuste se preferir confiar apenas no Admin SDK (Cloud Functions usam o Admin SDK e ignoram regras).
- Registro de deep-link (`bahia-driver://`) no app: para que `x-success` ou retorno automático funcione melhor, registre o scheme/intent no `app.json` (AndroidManifest/Info.plist). Posso adicionar essa configuração e os ajustes de manifesto se quiser.

Se desejar, posso:
- parametrizar a taxa da função para vir de `functions/config`;
- adicionar o registro do `bahia-driver://` no `app.json` e arquivos nativos para tornar callbacks mais confiáveis;
- adicionar um modal de confirmação quando o usuário retornar do app de navegação (em vez de navegar automaticamente).

