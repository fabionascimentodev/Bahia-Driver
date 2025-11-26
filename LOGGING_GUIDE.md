# 📊 Sistema de Logging - Bahia Driver

## Visão Geral

Sistema completo de logging para rastreamento de inicialização e execução do aplicativo Bahia Driver. Permite acompanhar erros, avisos e eventos em tempo real.

## Arquivos Criados

### 1. `src/services/loggerService.ts`
Serviço principal de logging com as seguintes funcionalidades:

- **Níveis de Log**: INFO, WARN, ERROR, DEBUG, SUCCESS
- **Persistência**: Salva logs em AsyncStorage
- **Limite de Logs**: Mantém últimos 100 logs
- **Exportação**: Exporte logs em formato de texto

#### Métodos Principais:

```typescript
// Inicializar logger
await logger.initialize();

// Registrar logs
logger.info('MODULE', 'mensagem', dados);
logger.success('MODULE', 'mensagem');
logger.warn('MODULE', 'mensagem');
logger.error('MODULE', 'mensagem', erro);
logger.debug('MODULE', 'mensagem', dados);

// Consultar logs
logger.getLogs() // Todos os logs
logger.getLogsByLevel('ERROR') // Por nível
logger.getLogsByModule('AUTH') // Por módulo

// Exportar
logger.exportLogs() // Retorna string formatada
logger.printSummary() // Imprime resumo no console

// Gerenciar
logger.clearLogs()
await logger.saveLogs()
await logger.loadLogs()
```

### 2. `src/services/bootstrapService.ts`
Serviço que coordena a inicialização completa do app:

1. ✅ Logger inicializado
2. ✅ Firebase validado
3. ✅ AsyncStorage verificado
4. ✅ Permissões checadas
5. ✅ Notificações configuradas

#### Uso:

```typescript
import { bootstrap } from './src/services/bootstrapService';

const success = await bootstrap.initialize();
if (!success) {
  console.log('Bootstrap com avisos');
}
```

### 3. `App.tsx` (Atualizado)
Integração completa com logging:

- Logs na inicialização do app
- Logs no listener de autenticação
- Logs ao carregar dados do usuário
- Logs ao registrar notificações push
- Tela de erro com mensagens úteis

### 4. `src/screens/common/LogViewerScreen.tsx`
Componente visual para visualizar logs em tempo real:

- Lista interativa de logs
- Filtros por nível (ERROR, WARN, SUCCESS, etc)
- Estatísticas em tempo real
- Auto-refresh
- Exportação de logs
- Limpeza de logs

## Como Usar

### Adicionar Logs em Qualquer Componente

```typescript
import { logger } from '../services/loggerService';

export const MyComponent = () => {
  useEffect(() => {
    logger.info('MY_COMPONENT', 'Componente montado');
    
    return () => {
      logger.debug('MY_COMPONENT', 'Componente desmontado');
    };
  }, []);

  const handleError = (error: any) => {
    logger.error('MY_COMPONENT', 'Erro ao processar', error);
  };

  const handleSuccess = () => {
    logger.success('MY_COMPONENT', 'Operação concluída com sucesso');
  };

  return (
    <View>
      {/* JSX */}
    </View>
  );
};
```

### Visualizar Logs em Tempo Real

1. Adicione LogViewerScreen ao seu navegador (exemplo):

```typescript
import LogViewerScreen from './src/screens/common/LogViewerScreen';

// No seu AppStack.Navigator:
<AppStack.Screen 
  name="LogViewer" 
  component={LogViewerScreen} 
  options={{ title: 'Monitor de Logs' }}
/>
```

2. Navegue para a tela durante o desenvolvimento
3. Veja logs em tempo real com filtros

### Fluxo de Inicialização Rastreado

```
🚀 APP INICIANDO
  ├─ 📋 Logger inicializado
  ├─ 🔥 Firebase validado
  ├─ 💾 AsyncStorage verificado
  ├─ 🔐 Permissões checadas
  ├─ 🔔 Notificações configuradas
  └─ ✅ Bootstrap concluído
  
👤 AUTH INICIADO
  ├─ 📝 Listener configurado
  ├─ 🔍 Usuário detectado
  ├─ 💾 Dados carregados
  ├─ 🔔 Notificações registradas
  └─ ✅ Autenticação pronta
```

## Níveis de Log

| Nível | Icon | Cor | Uso |
|-------|------|-----|-----|
| ERROR | ❌ | Vermelho | Erros críticos |
| WARN | ⚠️ | Laranja | Avisos e situações inesperadas |
| INFO | ℹ️ | Azul | Informações gerais |
| SUCCESS | ✅ | Verde | Operações bem-sucedidas |
| DEBUG | 🔍 | Roxo | Informações de debug |

## Boas Práticas

### ✅ Faça
```typescript
// Logs descritivos com contexto
logger.info('RIDE_SERVICE', 'Iniciando busca de corridas', { userId: user.id });
logger.error('LOCATION_SERVICE', 'Falha ao obter localização', error);
```

### ❌ Evite
```typescript
// Logs vagos sem contexto
logger.info('RIDE_SERVICE', 'erro');
logger.info('', 'alguma coisa');
```

## Exportar Logs

Para diagnosticar problemas:

```typescript
// No console:
const logsText = logger.exportLogs();
console.log(logsText);

// Salvar em arquivo (pedir ao usuário):
// Use o botão "Exportar" na LogViewerScreen
```

## Rastreamento Automático

O sistema rastreia automaticamente:

- ✅ Inicialização do app
- ✅ Autenticação de usuários
- ✅ Carregamento de dados
- ✅ Erros não tratados
- ✅ Permissões e notificações

## Troubleshooting

### Logs não aparecem?
1. Certifique-se de que `logger.initialize()` foi chamado
2. Verifique se AsyncStorage está disponível
3. Veja o console do React Native

### AsyncStorage cheio?
- Logs antigos são removidos automaticamente (limite de 100)
- Use `logger.clearLogs()` se necessário

### Exportação não funciona?
- Copie os logs do console
- Use ferramentas de debug do Expo

## Performance

- ⚡ Overhead mínimo (~1-2ms por log)
- 💾 Máximo 100 logs em memória
- 🔄 Salvamento assíncrono no storage

## Próximos Passos

Adicione logging a esses serviços:
- [ ] `notificationService.ts`
- [ ] `rideService.ts`
- [ ] `locationServices.ts`
- [ ] `userServices.ts`
- [ ] Custom hooks

---

**Criado em**: November 26, 2025
**Versão**: 1.0.0
