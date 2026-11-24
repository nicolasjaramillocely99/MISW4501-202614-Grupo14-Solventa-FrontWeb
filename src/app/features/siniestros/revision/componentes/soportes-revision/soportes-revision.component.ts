import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideCircle, LucideCircleAlert, LucideCircleCheck, LucideEye } from '@lucide/angular';

import { EvidenciaFirmada, SoporteFirmado } from '@core/api/siniestros/evaluacion.modelos';
import { ItemRevision, MAXIMO_NOTA, VeredictoSoporte } from '@core/api/siniestros/revision.modelos';
import { CanalSiniestro } from '@core/api/siniestros/siniestro.modelos';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';
import {
  InsigniaEstadoComponent,
  TonoInsignia,
} from '@shared/ui/insignia-estado/insignia-estado.component';

import { Traductor, nombreSoporte } from '../../../modelos/catalogo-siniestros';

/** El veredicto de una fila. `null`: un soporte opcional sin adjuntar que el asesor no pidió. */
export interface EntradaVeredicto {
  veredicto: VeredictoSoporte | null;
  nota: string;
}

export interface CambioVeredicto extends EntradaVeredicto {
  codigoRequisito: string;
}

/** Un archivo de la fila: un soporte del portal o una foto de la evidencia del móvil. */
interface ArchivoFila {
  clave: string;
  nombre: string;
  url: string | null;
}

const TONO: Readonly<Record<VeredictoSoporte, TonoInsignia>> = {
  valid: 'exito',
  illegible: 'error',
  missing: 'advertencia',
};

/**
 * «Soportes adjuntos» de S8 (HU-W2.1-03): una fila por soporte del tipo de siniestro con su veredicto y sus archivos.
 *
 * - Un soporte **adjunto** es «Válido» o «Ilegible», y el ilegible lleva una nota corta que lee el asegurado (A9).
 * - Un **requerido sin adjuntar** es «Falta» y no se cambia.
 * - Un **opcional sin adjuntar** se puede «Solicitar al cliente» y queda como «Falta».
 *
 * En una radicación del móvil la evidencia (4 a 6 fotos) es la fila «Fotos del vehículo». Sin `editable`, la tabla solo
 * muestra los veredictos (una radicación ya revisada).
 */
@Component({
  selector: 'app-soportes-revision',
  imports: [
    TranslocoDirective,
    InsigniaEstadoComponent,
    FormatoFechaHoraPipe,
    LucideCircle,
    LucideCircleAlert,
    LucideCircleCheck,
    LucideEye,
  ],
  templateUrl: './soportes-revision.component.html',
  styleUrl: './soportes-revision.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SoportesRevisionComponent {
  readonly items = input.required<readonly ItemRevision[]>();
  readonly soportes = input<readonly SoporteFirmado[]>([]);
  readonly evidencia = input<readonly EvidenciaFirmada[]>([]);
  readonly canal = input<CanalSiniestro>('web');
  readonly veredictos = input.required<Readonly<Record<string, EntradaVeredicto>>>();
  readonly editable = input(false);

  readonly cambio = output<CambioVeredicto>();

  protected readonly maximoNota = MAXIMO_NOTA;
  protected readonly tono = TONO;

  /** Los archivos de cada soporte, por código. */
  protected readonly archivos = computed(() => {
    const porCodigo: Record<string, ArchivoFila[]> = {};
    for (const s of this.soportes()) {
      (porCodigo[s.codigoRequisito] ??= []).push({
        clave: s.soporteId,
        nombre: s.nombreArchivo,
        url: s.urlDescarga,
      });
    }
    if (this.canal() === 'mobile') {
      porCodigo['vehicle_photos'] = this.evidencia().map((e, i) => ({
        clave: `evidencia-${i}`,
        nombre: e.capturadaEn,
        url: e.urlDescarga,
      }));
    }
    return porCodigo;
  });

  protected entrada(codigo: string): EntradaVeredicto {
    return this.veredictos()[codigo] ?? { veredicto: null, nota: '' };
  }

  protected nombre(t: Traductor, item: ItemRevision): string {
    return nombreSoporte(t, item.codigoRequisito, item.etiqueta);
  }

  protected marcar(item: ItemRevision, veredicto: VeredictoSoporte): void {
    const actual = this.entrada(item.codigoRequisito);
    this.cambio.emit({
      codigoRequisito: item.codigoRequisito,
      veredicto,
      nota: veredicto === 'illegible' ? actual.nota : '',
    });
  }

  protected anotar(item: ItemRevision, evento: Event): void {
    const nota = (evento.target as HTMLInputElement).value;
    this.cambio.emit({ codigoRequisito: item.codigoRequisito, veredicto: 'illegible', nota });
  }

  protected solicitar(item: ItemRevision, evento: Event): void {
    const solicitado = (evento.target as HTMLInputElement).checked;
    this.cambio.emit({
      codigoRequisito: item.codigoRequisito,
      veredicto: solicitado ? 'missing' : null,
      nota: '',
    });
  }
}
