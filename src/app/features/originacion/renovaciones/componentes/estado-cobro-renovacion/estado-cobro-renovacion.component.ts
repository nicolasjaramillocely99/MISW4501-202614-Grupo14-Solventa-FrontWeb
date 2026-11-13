import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideCircleCheck, LucideCircleX, LucideInfo } from '@lucide/angular';

import { MedioDePago } from '@core/api/originacion/cobro.modelos';
import { EmisionContractual } from '@core/api/originacion/emision-contractual.modelos';
import { CobroRenovacion, ResumenRenovacionAsistida } from '@core/api/originacion/renovacion-asistida.modelos';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';
import { InsigniaEstadoComponent, TonoInsignia } from '@shared/ui/insignia-estado/insignia-estado.component';

import { diaColombia, medioLegible } from '../../modelos/presentacion-renovacion';

/** Cómo está cada paso de la emisión de la renovación. */
export type EstadoPaso = 'enCurso' | 'confirmado' | 'fallo' | 'pendiente' | 'emitido' | 'enviada' | 'noRenovada';

const TONO: Readonly<Record<EstadoPaso, TonoInsignia>> = {
  enCurso: 'informacion',
  confirmado: 'exito',
  fallo: 'error',
  pendiente: 'neutro',
  emitido: 'exito',
  enviada: 'exito',
  noRenovada: 'neutro',
};

/**
 * Panel «Emisión de la renovación» de S7b y de «Ver» (HU-W1.5-03, decisión 01·D-3 a+): el cobro de la prima (en
 * curso, confirmado, o fallido con la fecha y hasta cuándo el cliente puede reintentar desde su portal), el
 * certificado renovado con la póliza nueva y la notificación al cliente, o que la póliza no se renovó. Vale para la
 * renovación del asesor y para la del asegurado.
 */
@Component({
  selector: 'app-estado-cobro-renovacion',
  imports: [TranslocoDirective, InsigniaEstadoComponent, FormatoFechaHoraPipe, LucideCircleCheck, LucideCircleX, LucideInfo],
  templateUrl: './estado-cobro-renovacion.component.html',
  styleUrl: './estado-cobro-renovacion.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EstadoCobroRenovacionComponent {
  private readonly transloco = inject(TranslocoService);

  readonly renovacion = input.required<ResumenRenovacionAsistida>();
  readonly cobro = input<CobroRenovacion | null>(null);
  readonly medioDePago = input<MedioDePago | null>(null);
  /** Emisión contractual de la póliza nueva, cuando la hay. */
  readonly emision = input<EmisionContractual | null>(null);
  /** La vigencia renovada, para el certificado y la nota de la póliza nueva. */
  readonly nuevaVigenciaDesde = input<string | null>(null);
  readonly nuevaVigenciaHasta = input<string | null>(null);

  /** Cuándo se confirmó el cobro: al cerrarse la renovación como renovada o, sin ese dato, al activarse la póliza nueva. */
  protected readonly confirmadoEn = computed(
    () => this.renovacion().cerradaEn ?? this.emision()?.activadaEn ?? this.renovacion().aceptadaEn,
  );

  protected readonly noRenovada = computed(() => this.renovacion().estado === 'not_renewed');

  protected readonly cobroPaso = computed<EstadoPaso>(() => {
    if (this.noRenovada()) {
      return 'noRenovada';
    }
    switch (this.cobro()?.estado) {
      case 'confirmed':
        return 'confirmado';
      case 'failed':
        return 'fallo';
      default:
        return this.renovacion().estado === 'renewed' ? 'confirmado' : 'enCurso';
    }
  });

  protected readonly certificadoPaso = computed<EstadoPaso>(() =>
    this.renovacion().estado === 'renewed' && this.emision()?.documento ? 'emitido' : 'pendiente',
  );

  protected readonly notificacionPaso = computed<EstadoPaso>(() =>
    this.emision()?.notificacion.estado === 'sent' ? 'enviada' : 'pendiente',
  );

  protected readonly tarjeta = computed(() => {
    const m = this.medioDePago();
    if (!m) {
      return '';
    }
    return medioLegible(m, (clave) => this.transloco.translate(clave));
  });

  protected tono(paso: EstadoPaso): TonoInsignia {
    return TONO[paso];
  }

  protected dia(iso: string | null): string {
    return diaColombia(iso, this.transloco.getActiveLang());
  }
}
