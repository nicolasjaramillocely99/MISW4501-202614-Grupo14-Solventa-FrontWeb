import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideCircleAlert, LucideCircleCheck, LucideRefreshCw } from '@lucide/angular';
import { Subscription } from 'rxjs';

import { CasoEnCola } from '@core/api/siniestros/evaluacion.modelos';
import { SiniestrosApiService } from '@core/api/siniestros/siniestros-api.service';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';
import { FormatoMonedaPipe } from '@shared/pipes/formato-moneda.pipe';

import { Traductor, nombreRamo, nombreTipo } from '../modelos/catalogo-siniestros';
import { tiempoEnCola } from '../modelos/estado-siniestro';

export type FaseRadicaciones = 'cargando' | 'lista' | 'error';

/**
 * Radicaciones por revisar (HU-W2.1-03): la bandeja de la que el asesor abre una radicación para revisarla (S8). Son
 * los casos `active` de todos los asegurados, de la más antigua a la más nueva, como los entrega el backend. Aún no
 * tienen prioridad: el triage la calcula cuando el asesor aprueba. El prototipo no tiene esta bandeja; sigue la tabla de
 * «Casos en evaluación» de operaciones.
 *
 * Ruta: `/siniestros/revision` (solo el asesor).
 */
@Component({
  selector: 'app-radicaciones-revision-page',
  imports: [
    RouterLink,
    TranslocoDirective,
    FormatoFechaHoraPipe,
    FormatoMonedaPipe,
    LucideCircleAlert,
    LucideCircleCheck,
    LucideRefreshCw,
  ],
  templateUrl: './radicaciones-revision.page.html',
  styleUrl: './radicaciones-revision.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RadicacionesRevisionPage implements OnInit {
  private readonly api = inject(SiniestrosApiService);
  private consulta: Subscription | null = null;

  protected readonly fase = signal<FaseRadicaciones>('cargando');
  protected readonly radicaciones = signal<readonly CasoEnCola[]>([]);
  protected readonly siguienteToken = signal<string | null>(null);
  protected readonly cargandoMas = signal(false);
  protected readonly ahora = signal(new Date());

  constructor() {
    inject(DestroyRef).onDestroy(() => this.consulta?.unsubscribe());
  }

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.consulta?.unsubscribe();
    this.fase.set('cargando');
    this.consulta = this.api.listarRevisiones().subscribe({
      next: (pagina) => {
        this.ahora.set(new Date());
        this.radicaciones.set(pagina.items);
        this.siguienteToken.set(pagina.siguienteToken);
        this.fase.set('lista');
      },
      // 401 y 403 los resuelve el interceptor; el resto se muestra como error con reintento.
      error: () => this.fase.set('error'),
    });
  }

  protected cargarMas(): void {
    const token = this.siguienteToken();
    if (!token || this.cargandoMas()) {
      return;
    }
    this.cargandoMas.set(true);
    this.consulta = this.api.listarRevisiones(token).subscribe({
      next: (pagina) => {
        this.radicaciones.update((radicaciones) => [...radicaciones, ...pagina.items]);
        this.siguienteToken.set(pagina.siguienteToken);
        this.cargandoMas.set(false);
      },
      error: () => {
        this.cargandoMas.set(false);
        this.fase.set('error');
      },
    });
  }

  protected producto(t: Traductor, caso: CasoEnCola): string {
    const ramo = nombreRamo(t, caso.poliza.ramo, caso.poliza.producto);
    const tipo = nombreTipo(t, caso.tipoSiniestro, undefined, 'corto');
    return ramo ? `${ramo} · ${tipo}` : tipo;
  }

  protected espera(t: Traductor, caso: CasoEnCola): string {
    const { dias, horas } = tiempoEnCola(caso.radicadoEn, this.ahora());
    return dias > 0
      ? t('casosEvaluacion.esperaDias', { dias, horas })
      : t('casosEvaluacion.esperaHoras', { horas });
  }
}
