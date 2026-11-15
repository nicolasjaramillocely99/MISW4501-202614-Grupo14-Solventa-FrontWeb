import { PolizaListada } from '@core/api/originacion/renovacion.modelos';
import { TonoInsignia } from '@shared/ui/insignia-estado/insignia-estado.component';

/** Estado con el que se pinta una póliza del asegurado en A1 y A2. */
export type EstadoPoliza =
  | 'vigente'
  | 'porVencer'
  | 'pagoPendiente'
  | 'enRenovacion'
  | 'renovada'
  | 'noRenovada'
  | 'canceladaNoPago'
  | 'finalizada';

export const ESTADOS_POLIZA: readonly EstadoPoliza[] = [
  'vigente',
  'porVencer',
  'pagoPendiente',
  'enRenovacion',
  'renovada',
  'noRenovada',
  'canceladaNoPago',
  'finalizada',
];

/** Estados de una póliza que sigue dando cobertura: son las «activas» del resumen. La gracia conserva la cobertura. */
export const ESTADOS_ACTIVOS: readonly EstadoPoliza[] = [
  'vigente',
  'porVencer',
  'pagoPendiente',
  'enRenovacion',
];

const TONO_POR_ESTADO: Readonly<Record<EstadoPoliza, TonoInsignia>> = {
  vigente: 'exito',
  porVencer: 'advertencia',
  pagoPendiente: 'advertencia',
  enRenovacion: 'informacion',
  renovada: 'exito',
  noRenovada: 'error',
  canceladaNoPago: 'error',
  finalizada: 'neutro',
};

/**
 * Estado de una póliza. Primero la cancelación por no pago (HU-W1.6-02); luego la renovación del periodo; luego una
 * cuota pendiente, que pesa más que la ventana de renovación porque se cancela antes; y al final la vigencia.
 */
export function estadoDePoliza(poliza: PolizaListada, ahora: number = Date.now()): EstadoPoliza {
  if (poliza.cancelacion || poliza.pago?.estado === 'cancelled') {
    return 'canceladaNoPago';
  }
  switch (poliza.renovacion?.estado) {
    case 'accepted':
      return 'enRenovacion';
    case 'renewed':
      return 'renovada';
    case 'not_renewed':
      return 'noRenovada';
    default:
      break;
  }
  if (poliza.pago?.estado === 'payment_pending') {
    return 'pagoPendiente';
  }
  if (poliza.puedeRenovar) {
    return 'porVencer';
  }
  return new Date(poliza.vigenciaHasta).getTime() > ahora ? 'vigente' : 'finalizada';
}

export function tonoDePoliza(estado: EstadoPoliza): TonoInsignia {
  return TONO_POR_ESTADO[estado];
}

/** Fin efectivo de la vigencia: la fecha de cancelación si la póliza se canceló, la de su cobertura si no. */
export function finDeVigencia(poliza: PolizaListada): string {
  return poliza.cancelacion?.canceladaEn ?? poliza.vigenciaHasta;
}
