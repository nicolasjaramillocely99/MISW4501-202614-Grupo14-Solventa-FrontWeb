import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideCircleAlert, LucideCircleCheck, LucideDownload, LucideInfo } from '@lucide/angular';

import { DetalleSiniestro } from '@core/api/siniestros/siniestro.modelos';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';
import { IndicadorPasosComponent, PasoFlujo } from '@shared/ui/indicador-pasos/indicador-pasos.component';
import { InsigniaEstadoComponent } from '@shared/ui/insignia-estado/insignia-estado.component';

import { Traductor, nombreRamo, nombreTipo } from '../../../modelos/catalogo-siniestros';

/**
 * Confirmación del siniestro radicado (A6b; HU-W2.1-01, CA-4): número de radicado con la insignia «Radicado», póliza,
 * fecha y hora del hecho, soportes adjuntos, las etapas que siguen y «Descargar radicado». «Ver el estado del
 * siniestro» (A8) es de HU-W2.1-02 y no se muestra (F3). Un caso radicado desde la app (sin foto de la póliza) se
 * pinta igual, sin los datos que no tiene.
 */
@Component({
  selector: 'app-confirmacion-radicacion',
  imports: [
    RouterLink,
    TranslocoDirective,
    FormatoFechaHoraPipe,
    IndicadorPasosComponent,
    InsigniaEstadoComponent,
    LucideCircleCheck,
    LucideCircleAlert,
    LucideDownload,
    LucideInfo,
  ],
  templateUrl: './confirmacion-radicacion.component.html',
  styleUrl: './confirmacion-radicacion.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmacionRadicacionComponent {
  private readonly transloco = inject(TranslocoService);

  readonly caso = input.required<DetalleSiniestro>();
  readonly descargando = input(false);
  readonly errorDescarga = input(false);

  readonly descargar = output<void>();

  protected readonly etapas: readonly PasoFlujo[] = [
    { etiqueta: 'siniestros.confirmacion.etapas.radicado', estado: 'actual' },
    { etiqueta: 'siniestros.confirmacion.etapas.revision', estado: 'pendiente' },
    { etiqueta: 'siniestros.confirmacion.etapas.evaluacion', estado: 'pendiente' },
    { etiqueta: 'siniestros.confirmacion.etapas.aprobado', estado: 'pendiente' },
    { etiqueta: 'siniestros.confirmacion.etapas.pagado', estado: 'pendiente' },
  ];

  /** «Autos · AU-2025-118204», o solo el número de la póliza si el caso no guardó su ramo. */
  protected poliza(t: Traductor): string {
    const { poliza } = this.caso();
    const ramo = nombreRamo(t, poliza.ramo, poliza.producto);
    return ramo ? `${ramo} · ${poliza.id}` : poliza.id;
  }

  /** «Colisión con daños al vehículo · Autos AU-2025-118204 · KJT-482 · Radicado el 14/09/2026 a las 19:05». */
  protected resumen(t: Traductor): string {
    const caso = this.caso();
    const ramo = nombreRamo(t, caso.poliza.ramo, caso.poliza.producto);
    const partes = [
      nombreTipo(t, caso.tipoSiniestro),
      ramo ? `${ramo} ${caso.poliza.id}` : caso.poliza.id,
      caso.poliza.objetoAsegurado,
      t('confirmacion.radicadoEl', {
        fecha: this.formatear(caso.radicadoEn, { day: '2-digit', month: '2-digit', year: 'numeric' }),
        hora: this.formatear(caso.radicadoEn, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }),
      }),
    ];
    return partes.filter((parte): parte is string => !!parte).join(' · ');
  }

  /** Fecha u hora en el idioma activo y la zona del usuario (como `formatoFechaHora`). */
  private formatear(iso: string, opciones: Intl.DateTimeFormatOptions): string {
    return new Intl.DateTimeFormat(this.transloco.getActiveLang(), opciones).format(new Date(iso));
  }
}
