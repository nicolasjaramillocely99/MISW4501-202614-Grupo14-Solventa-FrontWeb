import { EstadoSiniestro } from '@core/api/siniestros/siniestro.modelos';
import { TonoInsignia } from '@shared/ui/insignia-estado/insignia-estado.component';

/**
 * Tono de la insignia de cada estado del caso. El texto sale de `siniestros.estados.*`: el estado nunca se comunica
 * solo con color.
 */
const TONO_ESTADO: Readonly<Record<EstadoSiniestro, TonoInsignia>> = {
  active: 'informacion',
  in_evaluation: 'informacion',
  approved: 'advertencia',
  paid: 'exito',
  rejected: 'neutro',
  payment_exception: 'error',
};

export function tonoEstado(estado: EstadoSiniestro): TonoInsignia {
  return TONO_ESTADO[estado] ?? 'neutro';
}

/** Tono del nivel de prioridad (O5): Triage 1 rojo, 2 ámbar, 3 gris; sin calcular, gris. */
export function tonoPrioridad(nivel: 1 | 2 | 3 | null): TonoInsignia {
  switch (nivel) {
    case 1:
      return 'error';
    case 2:
      return 'advertencia';
    default:
      return 'neutro';
  }
}

/** Tiempo que lleva un caso en cola desde su radicación, en días y horas completos («2 d 4 h», O5). */
export function tiempoEnCola(radicadoEn: string, ahora: Date): { dias: number; horas: number } {
  const horas = Math.max(0, Math.floor((ahora.getTime() - new Date(radicadoEn).getTime()) / 3_600_000));
  return { dias: Math.floor(horas / 24), horas: horas % 24 };
}
