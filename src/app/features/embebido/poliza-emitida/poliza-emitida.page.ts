import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import {
  LucideCircleAlert,
  LucideCircleCheck,
  LucideClock,
  LucideDownload,
  LucideFileText,
  LucideLandmark,
  LucideSmartphone,
  LucideTriangleAlert,
} from '@lucide/angular';
import { EMPTY, expand, of, timer, switchMap } from 'rxjs';

import {
  EmisionContractual,
  ErrorEmisionContractual,
  esEmisionFinal,
} from '@core/api/originacion/emision-contractual.modelos';
import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';
import { ContextoAliadoService } from '@core/aliado/contexto-aliado.service';
import { RUTA_INICIO_POR_ROL } from '@core/navegacion/menu-por-rol';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';
import {
  IndicadorPasosComponent,
  PasoFlujo,
} from '@shared/ui/indicador-pasos/indicador-pasos.component';

import { TarjetaCreditoComponent } from '../componentes/tarjeta-credito/tarjeta-credito.component';
import { FlujoEmbebidoService } from '../servicios/flujo-embebido.service';

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
 * oferta: el backend solo deja leer la póliza a su dueño.
 *
 * Sigue el frame E5 del prototipo (tarjeta «Tu crédito», póliza activa, documento, confirmación y tarjeta de la
 * app). Quedan fuera lo que el contrato `issuance-status` aún no entrega: la cuadrícula con asegurado, prima,
 * valor asegurado, vigencia, pago y beneficiario, el SMS, el QR y el botón «Volver a mi crédito».
 */
@Component({
  selector: 'app-poliza-emitida-page',
  imports: [
    TranslocoDirective,
    IndicadorPasosComponent,
    RouterLink,
    TarjetaCreditoComponent,
    FormatoFechaHoraPipe,
    LucideCircleAlert,
    LucideCircleCheck,
    LucideClock,
    LucideDownload,
    LucideFileText,
    LucideLandmark,
    LucideSmartphone,
    LucideTriangleAlert,
  ],
  templateUrl: './poliza-emitida.page.html',
  styleUrl: './poliza-emitida.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PolizaEmitidaPage implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly api = inject(OriginacionApiService);
  private readonly flujo = inject(FlujoEmbebidoService);
  private readonly aliado = inject(ContextoAliadoService);
  private readonly transloco = inject(TranslocoService);
  private readonly destruccion = inject(DestroyRef);

  protected readonly solicitud = this.flujo.solicitud;
  protected readonly rutaPortal = RUTA_INICIO_POR_ROL.asegurado;
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

  ngOnInit(): void {
    this.aliado.establecer(this.solicitud()?.aliado ?? null);
    this.consultar();
  }

  /** Tamaño del documento para mostrar: KB bajo 1 MB y MB desde ahí, con el formato del idioma activo. */
  protected tamano(bytes: number): string {
    const formato = new Intl.NumberFormat(this.transloco.getActiveLang(), {
      maximumFractionDigits: 1,
    });
    return bytes < 1_048_576
      ? `${formato.format(bytes / 1024)} KB`
      : `${formato.format(bytes / 1_048_576)} MB`;
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
            : timer(INTERVALO_CONSULTA_MS).pipe(
                switchMap(() => this.api.consultarEmisionContractual(this.polizaId)),
              ),
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
            codigo === 'policy_not_found'
              ? 'noEncontrada'
              : codigo === 'forbidden' || codigo === 'unauthorized'
                ? 'permiso'
                : 'generico',
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
