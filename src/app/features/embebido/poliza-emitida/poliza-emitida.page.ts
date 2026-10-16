import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideCircleAlert, LucideCircleCheck, LucideClock, LucideDownload, LucideTriangleAlert } from '@lucide/angular';
import { EMPTY, expand, of, timer, switchMap } from 'rxjs';

import {
  EmisionContractual,
  ErrorEmisionContractual,
  esEmisionFinal,
} from '@core/api/originacion/emision-contractual.modelos';
import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';
import { IndicadorPasosComponent, PasoFlujo } from '@shared/ui/indicador-pasos/indicador-pasos.component';
import { InsigniaEstadoComponent, TonoInsignia } from '@shared/ui/insignia-estado/insignia-estado.component';

/** Cada cuánto se consulta el estado mientras la emisión no termina (contrato HU-W1.3-03). */
export const INTERVALO_CONSULTA_MS = 2_000;

export type FaseEmision = 'cargando' | 'esperando' | 'listo' | 'error';
type MotivoError = 'noEncontrada' | 'permiso' | 'generico';

/**
 * Paso 5 · Póliza emitida (E5; HU-W1.3-03). Sigue la emisión contractual de la póliza con polling hasta que
 * termina: documento disponible para descargar y notificación enviada al asegurado. Los estados viven en la
 * misma página: **esperando** (la cobertura se activó y el documento se está generando, o aún no se activa),
 * **listo** (documento y notificación; si el correo falló, el documento sigue disponible) y **error**.
 *
 * Ruta: `/embebido/poliza-emitida/:polizaId`. Pide la sesión de un asegurado, igual que la aceptación de la
 * oferta: el backend solo deja leer la póliza a su dueño. No hay un frame de Figma dedicado a este estado.
 */
@Component({
  selector: 'app-poliza-emitida-page',
  imports: [
    TranslocoDirective,
    IndicadorPasosComponent,
    InsigniaEstadoComponent,
    FormatoFechaHoraPipe,
    LucideCircleAlert,
    LucideCircleCheck,
    LucideClock,
    LucideDownload,
    LucideTriangleAlert,
  ],
  templateUrl: './poliza-emitida.page.html',
  styleUrl: './poliza-emitida.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PolizaEmitidaPage implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly api = inject(OriginacionApiService);
  private readonly destruccion = inject(DestroyRef);

  protected readonly polizaId: string = this.ruta.snapshot.params['polizaId'];
  protected readonly fase = signal<FaseEmision>('cargando');
  protected readonly emision = signal<EmisionContractual | null>(null);
  protected readonly motivoError = signal<MotivoError>('generico');
  protected readonly descargando = signal(false);
  protected readonly errorDescarga = signal(false);

  protected readonly pasos = computed<readonly PasoFlujo[]>(() => {
    const listo = this.fase() === 'listo';
    return [
      { etiqueta: 'embebido.pasos.consentimiento', estado: 'completado' },
      { etiqueta: 'embebido.pasos.perfilRiesgo', estado: 'completado' },
      { etiqueta: 'embebido.pasos.oferta', estado: 'completado' },
      { etiqueta: 'embebido.pasos.pago', estado: 'completado' },
      { etiqueta: 'embebido.pasos.poliza', estado: listo ? 'completado' : 'actual' },
    ];
  });

  protected readonly insigniaDocumento = computed<{ tono: TonoInsignia; texto: string }>(() =>
    this.emision()?.documento
      ? { tono: 'exito', texto: 'insignia.disponible' }
      : { tono: 'informacion', texto: 'insignia.enCurso' },
  );

  protected readonly insigniaNotificacion = computed<{ tono: TonoInsignia; texto: string }>(() => {
    switch (this.emision()?.notificacion.estado) {
      case 'sent':
        return { tono: 'exito', texto: 'insignia.enviada' };
      case 'failed':
        return { tono: 'advertencia', texto: 'insignia.noEntregada' };
      default:
        return { tono: 'informacion', texto: 'insignia.enCurso' };
    }
  });

  ngOnInit(): void {
    this.consultar();
  }

  /** Consulta el estado y repite cada 2 s hasta que la emisión termina o falla la consulta. */
  protected consultar(): void {
    this.fase.set('cargando');
    this.api
      .consultarEmisionContractual(this.polizaId)
      .pipe(
        expand((emision) =>
          esEmisionFinal(emision.estado)
            ? EMPTY
            : timer(INTERVALO_CONSULTA_MS).pipe(switchMap(() => this.api.consultarEmisionContractual(this.polizaId))),
        ),
        takeUntilDestroyed(this.destruccion),
      )
      .subscribe({
        next: (emision) => {
          this.emision.set(emision);
          this.fase.set(esEmisionFinal(emision.estado) ? 'listo' : 'esperando');
        },
        error: (error: unknown) => {
          const codigo = error instanceof ErrorEmisionContractual ? error.codigo : null;
          this.motivoError.set(
            codigo === 'policy_not_found' ? 'noEncontrada' : codigo === 'forbidden' || codigo === 'unauthorized' ? 'permiso' : 'generico',
          );
          this.fase.set('error');
        },
      });
  }

  /** Descarga el PDF y lo entrega al navegador; el JWT lo adjunta el interceptor, por eso no es un enlace directo. */
  protected descargar(): void {
    if (this.descargando()) {
      return;
    }
    this.descargando.set(true);
    this.errorDescarga.set(false);
    of(this.polizaId)
      .pipe(
        switchMap((id) => this.api.descargarDocumentoContractual(id)),
        takeUntilDestroyed(this.destruccion),
      )
      .subscribe({
        next: (pdf) => {
          const url = URL.createObjectURL(pdf);
          const enlace = document.createElement('a');
          enlace.href = url;
          enlace.download = `poliza-${this.polizaId}.pdf`;
          enlace.click();
          URL.revokeObjectURL(url);
          this.descargando.set(false);
        },
        error: () => {
          this.descargando.set(false);
          this.errorDescarga.set(true);
        },
      });
  }
}
