// Configurações financeiras do Bahia Driver
// Ajuste os valores conforme sua política de plataforma.

export const PLATFORM_FEE_PERCENTAGE = 0.20; // 20% por padrão
export const MAX_CONSECUTIVE_CASH_DAYS = 3; // após N corridas em dinheiro consecutivas, bloquear
export const DEBT_BLOCK_THRESHOLD = 500.0; // se a dívida ultrapassar esse valor, bloquear corridas em dinheiro

// Timeout e limites para transferências/pix (apenas demostrativo)
export const INSTANT_PAYOUT_ENABLED = true;
export const INSTANT_PAYOUT_FEE = 0.02; // 2% fee para saque instantâneo (opcional)

// Nome das coleções
export const TRANSACTIONS_COLLECTION = 'transactions';

export default {
  PLATFORM_FEE_PERCENTAGE,
  MAX_CONSECUTIVE_CASH_DAYS,
  DEBT_BLOCK_THRESHOLD,
  INSTANT_PAYOUT_ENABLED,
  INSTANT_PAYOUT_FEE,
  TRANSACTIONS_COLLECTION,
};
