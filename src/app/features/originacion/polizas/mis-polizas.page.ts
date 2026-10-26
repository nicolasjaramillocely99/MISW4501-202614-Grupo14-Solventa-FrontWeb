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

export type FasePolizas = 'cargando' | 'listo' | 'error';

/** Estado con el que se pinta una póliza en el listado. */
export type EstadoPoliza = 'vigente' | 'porVencer' | 'enRenovacion' | 'renovada' | 'noRenovada' | 'finalizada';

const ESTADOS: readonly EstadoPoliza[] = ['vigente', 'porVencer', 'enRenovacion', 'renovada', 'noRenovada', 'finalizada'];

/** Estados de una póliza que sigue dando cobertura: son las «activas» del resumen. */
const ACTIVAS: readonly EstadoPoliza[] = ['vigente', 'porVencer', 'enRenovacion'];

const TONO_POR_ESTADO: Readonly<Record<EstadoPoliza, TonoInsignia>> = {
  vigente: 'exito',
  porVencer: 'advertencia',
  enRenovacion: 'informacion',
  renovada: 'exito',
  noRenovada: 'error',
  finalizada: 'neutro',
};

const MS_POR_DIA = 86_400_000;

/**
 * A1 · Mis pólizas (HU-W1.5-02): el resumen, el aviso de la póliza por vencer y el listado de las pólizas del
 * asegurado con su vigencia y, dentro de la ventana de renovación, la entrada a «Renovar póliza» (A4). Solo
 * ofrece renovar cuando el backend dice `can_renew`: fuera de la ventana la opción no existe (criterio 3).
 *
 * Es la versión del listado que permite el contrato de hoy: sin producto, sin siniestros en curso y sin el
 * detalle de la póliza (A2, HU-W1.6-02). Ruta: `/originacion/polizas`. Exige la sesión del asegurado.
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

  protected readonly estados = ESTADOS;
  protected readonly fase = signal<FasePolizas>('cargando');
  protected readonly polizas = signal<PolizaListada[]>([]);
  protected readonly filtro = new FormControl<EstadoPoliza | ''>('', { nonNullable: true });
  private readonly estadoElegido = signal<EstadoPoliza | ''>('');

  protected readonly titular = computed(() => this.polizas()[0]?.titular ?? '');
  protected readonly activas = computed(() => this.polizas().filter((p) => ACTIVAS.includes(this.estado(p))));
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

  /** Estado de una póliza: el de su renovación si la hay; si no, si está por vencer, vigente o finalizada. */
  protected estado(poliza: PolizaListada): EstadoPoliza {
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
    if (poliza.puedeRenovar) {
      return 'porVencer';
    }
    return new Date(poliza.vigenciaHasta).getTime() > Date.now() ? 'vigente' : 'finalizada';
  }

  protected tono(poliza: PolizaListada): TonoInsignia {
    return TONO_POR_ESTADO[this.estado(poliza)];
  }
}
