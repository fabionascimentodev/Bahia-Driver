# Administração e deploy de funções (Cloud Functions)

Este arquivo descreve como **deployar** a função `adminDeleteUser` e como criar um usuário administrador (custom claim `admin`) para utilizar a função.

## Preparação

- Instale o Firebase CLI e faça login:

```powershell
npm i -g firebase-tools
firebase login
```

- Entre na pasta `functions/` e instale dependências (se ainda não fez):

```powershell
cd functions
npm install
```

## Deploy da função `adminDeleteUser`

No diretório raiz (ou em `functions/`), rode:

```powershell
cd functions
firebase deploy --only functions:adminDeleteUser
# ou para deploy de todas as funções
firebase deploy --only functions
```

*Observação*: teste em um ambiente de staging antes de deployar em produção.

## Criar um admin (custom claim)

Depois de ter uma conta no Auth que você queira que seja admin, você pode usar o script local `scripts/setAdminClaim.js`.

Pré-requisitos:
- Coloque a `serviceAccountKey.json` no diretório `functions/` (arquivo sensível — mantenha fora de repositórios públicos).

Uso (no diretório `functions/`):

```powershell
npm run set-admin -- <email-do-usuario>
# ou
node scripts/setAdminClaim.js email@exemplo.com
```

Observação: o usuário precisará reconectar (logout/login) para receber o token atualizado com o claim.

## Teste a função `adminDeleteUser`

Use um cliente com um usuário que tenha claim `admin: true`. Pelo client, um exemplo em JS:

```js
import { getFunctions, httpsCallable } from 'firebase/functions';
const functions = getFunctions();
const adminDeleteUser = httpsCallable(functions, 'adminDeleteUser');
await adminDeleteUser({ email: 'target@example.com' });
```

Ou chame a função de um servidor trusted usando o Admin SDK (recomendado para automação).
