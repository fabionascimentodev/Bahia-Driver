# Configurar envio de e-mails para Cloud Functions (suporte)

Este projeto grava `supportReports` no Firestore e conta com uma Cloud Function (`functions/onSupportReportCreated`) que envia um e-mail para a caixa de suporte. Se você enviar um relato e o e-mail não chegar, normalmente isso significa que a função não consegue enviar por SMTP (ou não tem nodemailer / credenciais configuradas).

Abaixo está um passo-a-passo para ativar o envio automatizado em produção (PT-BR).

---

## 1) Requisitos
- Ter o Firebase CLI instalado e autenticado na conta do projeto.
- Ter uma conta/credencial SMTP funcional (ou usar um provedor de e-mail transacional: SendGrid, Mailgun, etc.).
- O diretório `functions/` já tem `nodemailer` listado em `package.json`.

## 2) Recomendações de provedor
- Para produção no Brasil, recomendo um provedor transacional (SendGrid, Mailgun, Amazon SES) — pois provedores como Gmail/Smtp de contas pessoais podem bloquear envio.
- Este exemplo assume uso de SMTP padrão (host/port/user/pass). Se usar SendGrid por API, troque a implementação na função para usar o SDK/API do SendGrid.

## 3) Como configurar (via Firebase CLI)
1. Abra seu terminal e selecione o projeto Firebase correto.

2. Defina as variáveis de configuração para SMTP e e-mail de suporte (exemplo):

```powershell
# Substitua os valores abaixo pelo seu provedor
firebase functions:config:set smtp.host="smtp.example.com" smtp.port="587" smtp.secure="false" smtp.user="seu-usuario" smtp.pass="sua-senha" support.email="suporte@seudominio.com"
```

3. Reimplante as funções para que as configurações entrem em vigor:

```powershell
cd functions
npm ci   # instala dependências se necessário
cd ..
firebase deploy --only functions:onSupportReportCreated
```

4. Verifique logs da função para checar envios e erros:

```powershell
firebase functions:log --only onSupportReportCreated --limit 50
# ou via GCP Console (Functions > Logs)
```

## 4) Alternativa - configurar variáveis de ambiente via GCP Console
- Em vez de `functions:config:set`, pode abrir o Google Cloud Console → Cloud Functions → escolher a função → Editar → Variáveis de ambiente e configurar `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SUPPORT_EMAIL`.

## 5) Teste end-to-end
- Abra o app, envie um relato na tela de Perfil.
- Se SMTP OK: função deverá atualizar o documento `supportReports/{id}` com `status: 'sent'` e `mailInfo` (messageId).
- Se SMTP não configurado/erro: função escreve `status: 'pending_no_smtp'` ou `status: 'failed'` e `error` no documento.

## 6) Fallback no app
- O app já grava `supportReports` e, se a função não enviou e-mail (status `pending_no_smtp`), o app perguntará ao usuário se quer abrir o cliente de e-mail do dispositivo para enviar manualmente. (Comportamento já implementado em `ProfileScreen`.)

---

Se preferir, eu posso:
- adaptar a função para usar a API do SendGrid (mais fácil de configurar) e fornecer exemplos de variáveis e deploy; ou
- adicionar um script de CI que, ao fazer deploy em produção, automaticamente define as config do functions e monitoramento.

Quer que eu gere a alteração para usar SendGrid em vez de SMTP em `functions/index.js` (pode ser mais confiável em produção)?
