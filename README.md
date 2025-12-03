
# Bahia Driver

Aplicativo mobile para gerenciamento de corridas (motorista e passageiro).

## Sistema de Taxas e Repasse (Bahia Driver)

sistema para controlar repasse ao motorista, cobrança de taxa da plataforma e gerenciamento de dívida quando o pagamento é feito em dinheiro.

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

```powershell
npm run start
## Onde encontrar logs de inicialização


As regras oficiais para o cálculo do valor de uma corrida neste projeto são as seguintes:
- **Valor por km rodado:** R$ 2,20 por km.
```powershell
# Exemplo:

5) Deploy para o Firebase (quando estiver pronto):

# Bahia Driver

Guia de preparação e deploy para produção — instruções completas (Português)

**Resumo rápido**
- App mobile em React Native (Expo / EAS) com backend Firebase (Auth, Firestore, Storage) e Cloud Functions (Node.js).
- Files importantes: `src/` (código), `functions/` (Cloud Functions), `app.json` / `eas.json` (configuração EAS), `package.json`.

**Objetivo deste README**
- Fornecer um passo-a-passo claro e completo para levar o projeto à produção: builds nativos, configuração de segredos e SMTP para envio de e‑mail via Cloud Functions, deploy das functions, recomendações de segurança e práticas operacionais.

--

**Índice**
- Visão Geral
- Pré-requisitos
- Variáveis de ambiente e segredos (recomendado: Secret Manager)
- Cloud Functions (SMTP) — configuração e deploy
- Preparar o app mobile para produção (EAS builds)
- Dependências nativas (react-native-image-picker)
- Testes locais e emulador (Firestore + Functions)
- Deploy contínuo (CI/CD) — recomendações
- Monitoramento / logs / troubleshooting
- Checklist de segurança para produção
- Contato / próximos passos

--

**Visão Geral**
O Bahia Driver é um aplicativo híbrido para passageiros e motoristas. A infra principal usa Firebase (Auth, Firestore, Storage). As Cloud Functions processam eventos (ex.: envio de e‑mail para suporte, processamento financeiro ao finalizar corridas).

**Arquitetura básica**
- Mobile: React Native + Expo (EAS)
- Backend: Firebase Firestore & Firebase Cloud Functions (Node 20)
- E‑mail de suporte: nodemailer + provedor SMTP (configurado via Secret Manager ou functions config)

--

**Pré-requisitos**
- Conta Google Cloud / Firebase com projeto configurado.
- Firebase CLI (`firebase-tools`) instalado e autenticado.
- EAS (Expo Application Services) configurado para builds nativos:
  - `npm install -g eas-cli`
  - `eas login`
- Node.js LTS (recomendo Node 18+ localmente; Functions usam Node 20 runtime).
- (Para iOS) um Mac com Xcode para builds locais ou uso de EAS Build.

Comandos úteis:
```powershell
# instalar Firebase CLI
npm install -g firebase-tools
# instalar EAS
npm install -g eas-cli
```

--

**1) Variáveis de ambiente e segredos**
Recomendo Secret Manager (GCP) para produção. `functions.config()` (Firebase CLI) é simples, mas está deprecado para uso a longo prazo.

Opção recomendada (Secret Manager):
- Crie secrets para: `smtp-host`, `smtp-port`, `smtp-secure`, `smtp-user`, `smtp-pass`, `support-email`.
- Conceda à Service Account das Cloud Functions a role `roles/secretmanager.secretAccessor`.

Exemplos (gcloud):
```bash
# habilitar API (uma vez)
---

# criar secret e adicionar versão localmente

**Atualizações Recentes (resumo)**

rm ./smtp-pass.txt

# dar acesso à service account que executa as functions
# substitua <FUNCTION_SA_EMAIL>
Adicionei várias funcionalidades e correções no repositório. Segue um resumo prático para referência rápida e testes:
  --member="serviceAccount:<FUNCTION_SA_EMAIL>" --role="roles/secretmanager.secretAccessor"
```

No código das functions use `@google-cloud/secret-manager` para buscar o segredo (ou continue usando `functions.config()` como fallback durante a migração — o projeto já lê `functions.config()` e variáveis de ambiente).

Opção rápida (não recomendada para produção): `firebase functions:config:set smtp.host=... smtp.user=...` — útil para testes, mas migrar para Secret Manager antes de março/2026.

--

**2) Cloud Functions — configuração SMTP e deploy**
1. Verifique `functions/package.json`:
   - `nodemailer` e (se usar Secret Manager) `@google-cloud/secret-manager` devem estar nas dependências.
   - `engines.node` deve apontar para `20` (Node 20 runtime).

2. As funções já existentes no projeto (ex.: `onSupportReportCreated`) tentam ler `functions.config().smtp` e variáveis de ambiente. Em produção, use Secret Manager ou configure `SMTP_*` env vars.

3. Passos para deploy:
```powershell
# na raiz do projeto
cd C:\Users\Fabio\videos\bahia-driver\functions
npm install
# voltar à raiz e deploy
cd ..
firebase deploy --only functions --project <SEU_PROJECT_ID>
```

4. Se preferir usar Secret Manager em vez de `functions.config()`:
 - Altere o código em `functions/index.js` para usar `SecretManagerServiceClient` e `accessSecretVersion()` para cada segredo.
 - Garanta que a Service Account das functions tenha `secretAccessor` no secret criado.

Logs:
```powershell
firebase functions:log --only onSupportReportCreated --limit 200
```
Verifique mensagens como `sending support email to ...`, `Support email sent:` ou erros de `nodemailer`.

--

**3) Preparar o app mobile para produção (EAS)**
O app usa dependências nativas (ex.: `react-native-image-picker`). Após adicionar ou alterar dependências nativas é necessário rebuild nativo.

Recomendo usar EAS Build (mais simples para Teams e CI):
1. Configure `eas.json` (já existe no projeto). Garanta `android` e `ios` profiles corretos.
2. Faça login e configure credenciais (Android keystore / Apple credentials):
```bash
eas login

```
3. Build para Android / iOS:
```bash
# Android (recurso: gerar apk/aab)
- Serviço financeiro (`src/services/financeService.ts`): processamento de finalização de corrida, registro de transações, saque PIX, resumo de ganhos (diário/semana/mês). Atual: lógica para descontar dívida automaticamente em corridas digitais e registrar dívida em corridas em dinheiro.

# iOS (via EAS, requer conta Apple e credenciais)
- Cloud Function de trigger (`functions/index.js`): função `onTripCompleted` que dispara em `trips/{tripId}` quando o status muda para `completed` e aplica automaticamente a **taxa de 10%**, registra transações e atualiza `users/{driverId}.motoristaData` (balance/debt/counters). Está pronta para deploy; veja `functions/package.json` para dependências.
```
4. Sideload / publicar na Play Store / App Store conforme necessário.

Observação: se estiver usando Expo Dev Client (prebuild), antes de executar `expo run:android` ou `expo run:ios`, rode `expo prebuild` para gerar os projetos nativos.

--

**4) Dependência nativa `react-native-image-picker`**
- O projeto foi atualizado para usar o picker nativo nas telas de cadastro.
- Essa dependência exige rebuild nativo — use `eas build` ou `expo prebuild` + `expo run:android`.

Instalação local (já adicionada ao `package.json`):
```powershell
npm install react-native-image-picker
```
Depois, se for usando bare workflow ou prebuild:
```powershell
npx pod-install  # iOS (em Mac)
expo prebuild
```

--

**5) Testes locais / Emulador**
- Para testar Cloud Functions localmente use o emulador:
```powershell
firebase emulators:start --only firestore,functions
```
- Em outro terminal, crie um documento `supportReports` manualmente ou rode um script de teste para disparar a função (há `scripts/test_trigger_trip.js` no repo).

--

**6) CI/CD — recomendações rápidas**
- Use GitHub Actions / GitLab CI para:
  - Executar lint / tests (se adicionar testes).
  - Fazer EAS build em tags ou merges na `main`.
  - Fazer deploy das Cloud Functions (usar uma conta de serviço com `firebase-tools` e credenciais armazenadas como secrets do CI).

Exemplo de etapas para um job de deploy functions:
- Checkout
- Setup Node
- npm ci
- cd functions && npm ci
- firebase deploy --only functions --project $FIREBASE_PROJECT_ID (usar SERVICE_ACCOUNT / FIREBASE_TOKEN)

--

**7) Monitoramento / Logs / Alertas**
- Use Firebase Console → Functions → Logs para ver execuções.
- Configure alertas de erro no Google Cloud Monitoring para a project.
- Para e‑mail de suporte: verifique logs da função `onSupportReportCreated` e o campo `supportReports/{id}.status`.

--

**8) Troubleshooting comum**
- Deploy Functions falhando por runtime Node descontinuado:
  - Atualize `functions/package.json` engines.node para `20` e redeploy.
- Função não envia e‑mail (status `pending_no_smtp`):
  - Verifique se os segredos SMTP foram definidos (Secret Manager) ou `functions:config` durante testes.
  - Verifique `nodemailer` e credenciais corretas (user/pass, porta, TLS).
- Picker nativo não abre no Expo Go: precisa de build nativo (Dev Client / EAS). Use `eas build` ou `expo run:android` após `expo prebuild`.

--

**9) Checklist de segurança antes de produção**
- [ ] Secrets (SMTP, API keys) armazenados no Secret Manager / CI secrets — NÃO no repositório.
- [ ] Regras de segurança do Firestore revisadas e testadas (evitar escrita direta em campos financeiros sem verificação).
- [ ] Rate limiting / monetização: proteger endpoints sensíveis.
- [ ] Monitoramento e alertas configurados para Cloud Functions e Firestore.
- [ ] Backups periódicos do Firestore (export) para recuperação.

--

**10) Comandos úteis (resumo)**
```powershell
# Firebase
firebase login
firebase use --add
firebase deploy --only functions
firebase functions:log --only onSupportReportCreated --limit 200

# Emulador
firebase emulators:start --only firestore,functions

# EAS / Expo
npm install -g eas-cli
- Regras do Firestore (`firestore.rules`): arquivo com regras sugeridas para proteger campos financeiros sensíveis (`motoristaData.balance`, `motoristaData.debt`) e restringir escrita em `transactions` somente por backend/admin (ajuste conforme sua estratégia de auth).
# build
- Script de teste para emulator (`scripts/test_trigger_trip.js`): cria uma `trip` de teste e a marca como `completed` para disparar a Cloud Function no emulador.

# Secret Manager (exemplos gcloud)
- UI - Motorista:
  - `src/screens/Driver/DriverPostRideScreen.tsx`: agora exibe o valor total da corrida e método de pagamento (card/cash) junto com a tela de avaliação — igual à tela do passageiro.
  - `src/screens/Driver/RideActionScreen.tsx`: melhorias de navegação externa — salvamos uma flag antes de abrir Waze/Google Maps e adicionamos listener para detectar quando o app volta ao foreground para retornar o motorista automaticamente à tela da corrida. Também mudei a posição dos botões: o botão "CHEGUEI AO LOCAL DE BUSCA" é posicionado de forma absoluta acima do rodapé, e o botão "Cancelar Corrida" voltou ao fluxo normal (não absoluto).
```

--

**11) Contato / próximos passos**
Se quiser, eu posso:
- Ajudar a configurar Secret Manager e adaptar `functions/index.js` para acessá‑lo.
- Criar um workflow de CI/CD para `functions` + `EAS build` automatizado.
- Preparar um script de migração para inicializar `motoristaData` nos usuários existentes.

Boa prática: execute um deploy de teste para um ambiente `staging` antes do `production`.

---

*Arquivo atualizado automaticamente pelo agente de suporte de desenvolvimento.*

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


