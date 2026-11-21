import { TitleCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideCircleCheck, LucideTriangleAlert } from '@lucide/angular';

import { EstadoReembolso } from '@core/api/originacion/cancelacion.modelos';
import { CancelacionAPedido } from '@core/api/originacion/pago-poliza.modelos';
import { FormatoMonedaPipe } from '@shared/pipes/formato-moneda.pipe';
import {
  InsigniaEstadoComponent,
  TonoInsignia,
} from '@shared/ui/insignia-estado/insignia-estado.component';

import { fechaCorta } from '../../../endosos/modelos/fecha-corta';

const TONO_REEMBOLSO: Readonly<Record<EstadoReembolso, TonoInsignia>> = {
  in_process: 'informacion',
  completed: 'exito',
  failed: 'error',
  not_applicable: 'neutro',
};

/**
 * A5b · Póliza cancelada y reembolso registrado (HU-W1.6-01, CA-2): el aviso «Cancelación registrada», el detalle del
 * reembolso —monto, método, referencia, fecha de la cancelación, motivo y estado del reembolso— y el estado de la póliza
 * (la cobertura terminó, los documentos siguen disponibles, no se reactiva). El aviso y la insignia siguen al reembolso:
 * en proceso, reembolsado, no se pudo procesar o sin reembolso. Sin «Descargar constancia» ni correo (D-7 a). Lo muestra el
 * detalle de la póliza (A2) cuando la cancelación fue a solicitud del asegurado (D-8 a).
 */
@Component({
  selector: 'app-detalle-cancelacion',
  imports: [TitleCasePipe, TranslocoDirective, FormatoMonedaPipe, InsigniaEstadoComponent, LucideCircleCheck, LucideTriangleAlert],
  templateUrl: './detalle-cancelacion.component.html',
  styleUrl: './detalle-cancelacion.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetalleCancelacionComponent {
  private readonly transloco = inject(TranslocoService);

  readonly cancelacion = input.required<CancelacionAPedido>();

  protected readonly reembolso = computed(() => this.cancelacion().detalleReembolso);
  protected readonly tono = computed(() => TONO_REEMBOLSO[this.cancelacion().reembolso]);
  /** El aviso de arriba: advertencia si el reembolso no se pudo procesar, éxito en los demás casos. */
  protected readonly fallido = computed(() => this.cancelacion().reembolso === 'failed');

  /** «03/12/2026 · 23:59» en el idioma activo. */
  protected fechaHora(iso: string): string {
    const idioma = this.transloco.getActiveLang();
    const hora = new Intl.DateTimeFormat(idioma, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(
      new Date(iso),
    );
    return `${fechaCorta(iso, idioma)} · ${hora}`;
  }
}
