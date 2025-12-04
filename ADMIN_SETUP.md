# Instruções iniciais após reset do banco (DB zerado)

Perfeito — como você zerou o banco e não há usuários cadastrados, não será necessário nenhum *migration* de arquivos/paths antigos. Abaixo seguem os passos recomendados para configurar o ambiente novo, criar um admin e garantir que a função `adminDeleteUser` esteja disponível.

## 1) Confirmar o novo padrão de nomeação

- O código cliente (`src/services/userServices.ts`) já está configurado para gerar pastas legíveis usando o email (quando disponível) e o `uid`, no formato `category/{uid}/{sanitizedEmail_uid}/...`.
- Como não há usuários antigos, não é necessário migrar arquivos do Storage.

## 2) Deploy da função `adminDeleteUser`

No diretório `functions/` rode:

```powershell
cd functions
npm install
firebase deploy --only functions:adminDeleteUser
```

Teste em staging antes de produção.

## 3) Criar um admin (custom claim)

Coloque o arquivo `functions/serviceAccountKey.json` (contendo a chave de conta de serviço) em `functions/` e execute (no diretório `functions/`):

```powershell
npm run set-admin -- admin@example.com
# ou
node scripts/setAdminClaim.js admin@example.com
```

Observação: o usuário com essa conta precisa existir no Firebase Auth antes de receber a claim.

## 4) Testar a função `adminDeleteUser`

No client (com um usuário que tenha claim `admin: true`) chame a função via `httpsCallable` passando `email` ou `uid` do usuário alvo.

Exemplo rápido:

```js
import { getFunctions, httpsCallable } from 'firebase/functions';
const functions = getFunctions();
const adminDeleteUser = httpsCallable(functions, 'adminDeleteUser');
// apaga pelo email da conta alvo
await adminDeleteUser({ email: 'target@example.com' });
```

## Observações de segurança

- A operação é destrutiva — mantenha backups.
- Restrinja quem recebe o claim `admin`.

## Deletar um usuário sem criar admin no app (opção local)

Se você não quer criar administradores no app, é possível rodar um script local seguro que usa a credencial de serviço e faz a mesma operação da função `adminDeleteUser` (remove Storage, Firestore e Auth).

1. Coloque `functions/serviceAccountKey.json` no diretório `functions/`.
2. Rode (no diretório `functions/`):

```powershell
# apagar por email
npm run delete-user -- --email user@example.com

# ou apagar por uid
npm run delete-user -- --uid someUid
```

O script remove objetos do Storage nas pastas esperadas e apaga documentos nas coleções `users`, `motoristas`, `rides`, `trips`, `transactions`, `supportReports` e por fim exclui o usuário do Auth. Use com extremo cuidado — teste antes em staging.

## Backfill / criar documentos legíveis para usuários já existentes

Se você tiver usuários já existentes e quiser criar documentos legíveis no console (serão duplicatas legíveis dentro de `users/` com id `{sanitizedEmail}_{uid}`), rode o backfill localmente:

```powershell
cd functions
npm run backfill-users-by-email
```

O script usa `functions/serviceAccountKey.json` e criará/atualizará duplicatas legíveis dentro de `users/` (ids do tipo `{sanitizedEmail}_{uid}`) para cada profile em `users/`.

IMPORTANTE: você agora pode encontrar usuários facilmente no Console porque serão criadas duplicatas legíveis dentro de `users/` com ids como `{sanitizedEmail}_{uid}`. Para limpeza completa (Storage + Auth + related Firestore docs) o procedimento recomendado é excluir o documento original `users/{uid}`, que acionará um trigger server-side para remoção automática. Se você preferir, também é possível excluir a duplicata legível `users/{sanitizedEmail}_{uid}` — o código já inclui lógica para detectar e remover duplicatas relacionadas na limpeza.

-- excluir a duplicata legível em `users/` não necessariamente removirá o documento canônico `users/{uid}` — por isso, para uma limpeza completa prefira sempre excluir `users/{uid}` (assim o trigger do Firestore fará a limpeza automática). Caso remova apenas a duplicata legível, o usuário canônico pode permanecer; você pode, então, usar o script `delete-user` ou a função admin se quiser apagar tudo por email/uid.

Para ser explícito: adicionamos um trigger de exclusão do Firestore que é executado em `users/{uid}.onDelete` e removerá os prefixos de Storage, documentos relacionados do Firestore e excluirá o usuário do Auth. Se você excluir apenas a duplicata legível em `users/{sanitizedEmail_uid}`, o documento original `users/{uid}` pode permanecer; prefira excluir o doc `users/{uid}` para uma limpeza completa ou use a função/script administrativa.
