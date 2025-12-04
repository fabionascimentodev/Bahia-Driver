🔊 Sons e alertas — instruções de configuração

Resumo:
- Implementado um serviço de áudio (src/services/audioService.ts) usando expo-av
- Integração em HomeScreenMotorista: toca som ao ficar online, offline e quando chega uma nova solicitação (respeita configurações do usuário)
- Controle no perfil: o motorista pode ativar/desativar sons e ajustar volume; configurações são persistidas

Como instalar as dependências:
1. No terminal, rode:

```powershell
expo install expo-av
```

Como adicionar os arquivos de som (recomendado):
- Coloque arquivos de som locais em `assets/sounds/` com os nomes:
  - `online.wav` (som ao ficar online)
  - `offline.wav` (som ao ficar offline)
  - `new_request.wav` (som para nova solicitação de corrida)

Você pode usar formatos `.wav` ou `.mp3`. Se preferir tocar via URL, o serviço também aceita `audioService.play({ url: 'https://...' })`.

Limitações e notas importantes:
- Tocar som enquanto o app está em background ou quando a tela está bloqueada depende do sistema operacional e do tipo de build.
  - No iOS, para reprodução em background de áudio é necessário habilitar o Background Mode (Audio) no Xcode e usar um build custom (Bare or EAS). O expo-go pode não suportar tudo.
  - No Android, reprodução em background funciona melhor em builds reais; em alguns dispositivos pode ser necessário um serviço nativo para confiabilidade total.

Requisitos atendidos:
- Sons locais e via URL: ✅
- Biblioteca compatível: expo-av (expo) ✅
- Evitar sobreposição: o serviço pára o som anterior antes de tocar outro ✅
- Persistência de preferências (on/off e volume): ✅

Testes rápidos (desenvolvimento):
1. Instale expo-av (veja comandos acima).
2. Coloque os arquivos em `assets/sounds`.
3. Rode o app e no perfil do motorista use "Testar som".

Se quiser, eu posso:
- Extrair os caminhos/nomes de arquivo para config global (para tornar os sons fáceis de trocar) ✅
- Implementar um controle de volume mais sofisticado (slider) e/ou configurar sons diferentes por evento ✅
- Adicionar suporte via push notifications para garantir sons mesmo quando app estiver totalmente morto (requer server-side push + platform config) ✅
