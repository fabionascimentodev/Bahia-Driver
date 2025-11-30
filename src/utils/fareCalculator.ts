/**
 * Calculadora de tarifa de corrida
 * Regras:
 * - Valor mínimo: R$ 12,00
 * - R$ 2,20 por km
 * - R$ 0,60 por minuto (tempo parado/trânsito)
 * - Se alta demanda: +R$ 3,00
 */

export type FareInput = {
  km: number;
  minutes: number;
  highDemand?: boolean;
};

export type FareResult = {
  totalKm: number; // valor referente aos km
  totalTime: number; // valor referente ao tempo
  subtotal: number; // antes do mínimo e tarifa de alta demanda
  highDemandCharge: number; // 0 ou 3
  total: number; // valor final aplicado mínimo
};

const RATE_PER_KM = 2.2; // R$ 2,20 por km
const RATE_PER_MIN = 0.6; // R$ 0,60 por minuto
const HIGH_DEMAND_CHARGE = 3.0; // R$ 3,00
const MIN_FARE = 12.0; // R$ 12,00

export function calculateFare(input: FareInput): FareResult {
  const km = Math.max(0, Number(input.km || 0));
  const minutes = Math.max(0, Number(input.minutes || 0));
  const highDemand = Boolean(input.highDemand);

  const totalKm = Number((km * RATE_PER_KM).toFixed(2));
  const totalTime = Number((minutes * RATE_PER_MIN).toFixed(2));

  let subtotal = Number((totalKm + totalTime).toFixed(2));
  const highDemandCharge = highDemand ? HIGH_DEMAND_CHARGE : 0;

  if (highDemand) subtotal = Number((subtotal + highDemandCharge).toFixed(2));

  const total = subtotal < MIN_FARE ? MIN_FARE : subtotal;

  return {
    totalKm,
    totalTime,
    subtotal,
    highDemandCharge,
    total: Number(total.toFixed(2)),
  };
}

// Exemplos (para facilitar testes rápidos):
// calculateFare({ km: 2, minutes: 5 }) => km:4.4 time:3.0 subtotal:7.4 -> total:12.00 (mínimo)
// calculateFare({ km: 10, minutes: 15 }) => km:22.0 time:9.0 subtotal:31.0 -> total:31.00
// calculateFare({ km: 5, minutes: 10, highDemand: true }) => km:11.0 time:6.0 subtotal:17.0 +3 => 20.00

export default calculateFare;
