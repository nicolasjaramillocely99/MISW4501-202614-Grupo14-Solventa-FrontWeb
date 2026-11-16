import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideCircleAlert, LucidePlus, LucideTriangleAlert } from '@lucide/angular';

import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';
import { PolizaListada } from '@core/api/originacion/renovacion.modelos';
import { FormatoFechaPipe } from '@shared/pipes/formato-fecha.pipe';
import { FormatoMonedaPipe } from '@shared/pipes/formato-moneda.pipe';
import { InsigniaEstadoComponent, TonoInsignia } from '@shared/ui/insignia-estado/insignia-estado.component';

import {
  ESTADOS_ACTIVOS,
  ESTADOS_POLIZA,
  EstadoPoliza,
  estadoDePoliza,
  finDeVigencia,
  tonoDePoliza,
} from './modelos/estado-poliza';

export type { EstadoPoliza } from './modelos/estado-poliza';

export type FasePolizas = 'cargando' | 'listo' | 'error';

const MS_POR_DIA = 86_400_000;

/**
 * A1 · Mis pólizas (HU-W1.5-02): el resumen, el aviso de la póliza por vencer y el listado de las pólizas del
 * asegurado con su vigencia y, dentro de la ventana de renovación, la entrada a «Renovar póliza» (A4). Solo
 * ofrece renovar cuando el backend dice `can_renew`: fuera de la ventana la opción no existe (criterio 3).
 *
 * HU-W1.6-02: el estado del pago (una cuota en gracia es «Pago pendiente» y avisa cuándo se cancela; una póliza
 * cancelada es «No pago», sin reembolso) y el enlace al detalle (A2 y A2b). Sin producto ni siniestros en curso, que
 * el contrato no trae. Ruta: `/originacion/polizas`. Exige la sesión del asegurado.
 */
@Component({
  selector: 'app-mis-polizas-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslocoDirective,
    InsigniaEstadoComponent,
    FormatoFechaPipe,
    FormatoMonedaPipe,
    LucideCircleAlert,
    LucidePlus,
    LucideTriangleAlert,
  ],
  templateUrl: './mis-polizas.page.html',
  styleUrl: './mis-polizas.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MisPolizasPage implements OnInit {
  private readonly api = inject(OriginacionApiService);
  private readonly destruccion = inject(DestroyRef);

  protected readonly estados = ESTADOS_POLIZA;
  protected readonly finDeVigencia = finDeVigencia;
  protected readonly fase = signal<FasePolizas>('cargando');
  protected readonly polizas = signal<PolizaListada[]>([]);
  protected readonly filtro = new FormControl<EstadoPoliza | ''>('', { nonNullable: true });
  private readonly estadoElegido = signal<EstadoPoliza | ''>('');

  protected readonly titular = computed(() => this.polizas()[0]?.titular ?? '');
  protected readonly activas = computed(() => this.polizas().filter((p) => ESTADOS_ACTIVOS.includes(this.estado(p))));
  /** Pólizas con una cuota vencida sin pago (en gracia), la que se cancela primero arriba. */
  protected readonly pagosPendientes = computed(() =>
    this.polizas()
      .filter((p) => this.estado(p) === 'pagoPendiente' && p.pago?.pendiente)
      .sort((a, b) => (a.pago?.pendiente?.cancelaEn ?? '').localeCompare(b.pago?.pendiente?.cancelaEn ?? '')),
  );
  /** Pólizas en su ventana de renovación (por vencer), la más próxima primero. */
  protected readonly porVencer = computed(() =>
    this.polizas()
      .filter((p) => this.estado(p) === 'porVencer')
      .sort((a, b) => a.vigenciaHasta.localeCompare(b.vigenciaHasta)),
  );
  protected readonly visibles = computed(() => {
    const estado = this.estadoElegido();
    return estado ? this.polizas().filter((p) => this.estado(p) === estado) : this.polizas();
  });
  /** Días que faltan para que venza la póliza más próxima, sin bajar de 0. */
  protected readonly diasParaVencer = computed(() => {
    const proxima = this.porVencer()[0];
    return proxima ? Math.max(0, Math.ceil((new Date(proxima.vigenciaHasta).getTime() - Date.now()) / MS_POR_DIA)) : 0;
  });

  ngOnInit(): void {
    this.filtro.valueChanges.pipe(takeUntilDestroyed(this.destruccion)).subscribe((estado) => this.estadoElegido.set(estado));
    this.cargar();
  }

  protected cargar(): void {
    this.fase.set('cargando');
    this.api
      .listarPolizas()
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (polizas) => {
          this.polizas.set(polizas);
          this.fase.set('listo');
        },
        error: () => this.fase.set('error'),
      });
  }

  /** Estado de una póliza: cancelada, el de su renovación, pago pendiente, por vencer, vigente o finalizada. */
  protected estado(poliza: PolizaListada): EstadoPoliza {
    return estadoDePoliza(poliza);
  }

  protected tono(poliza: PolizaListada): TonoInsignia {
    return tonoDePoliza(this.estado(poliza));
  }
}
