import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideCircleAlert, LucideInfo } from '@lucide/angular';
import { Subscription } from 'rxjs';

import { SiniestrosApiService } from '@core/api/siniestros/siniestros-api.service';
import { PoliticaTriage, ResumenTriage } from '@core/api/siniestros/triage.modelos';
import { FormatoMonedaPipe } from '@shared/pipes/formato-moneda.pipe';

import { Traductor } from '../modelos/catalogo-siniestros';
import { MAX_IDS_LOTE, IdsBusqueda, parsearIdsBusqueda, umbralesEnPesos } from '../modelos/presentacion-triage';
import { Actualizacion, sondearMientrasPendiente } from '../modelos/sondeo-triage';
import {
  EstadoIndicadores,
  IndicadoresTriageComponent,
} from './componentes/indicadores-triage/indicadores-triage.component';
import { TablaTriageComponent } from './componentes/tabla-triage/tabla-triage.component';

type Fase = 'inicial' | 'buscando' | 'resultados' | 'sinResultados' | 'error';

/** Por qué no se puede buscar (error por campo, antes de llamar al backend). */
type ErrorBusqueda = { tipo: 'vacio' } | { tipo: 'invalidos'; ids: string[] } | { tipo: 'demasiados'; cantidad: number };

/**
 * O5 · Cola de siniestros, provisional (HU-W2.2-01, F1, CA-4 y CA-5): encabezado que explica cómo se calcula la
 * prioridad, indicadores por nivel con su objetivo de atención (`GET /v1/claims/triage-policy`) y una búsqueda de uno o
 * varios `claim_id` (hasta 50) que pinta una fila por caso (`GET /v1/claims/triage?claim_id=…`, **una** llamada por
 * búsqueda). La tabla recibe cualquier lista de ids: cuando exista el listado de HU-W2.2-03 o la cola de HU-W2.2-02,
 * ese listado reemplaza la búsqueda y la tabla no cambia.
 *
 * Ruta `/siniestros/cola`, rol operaciones. Los ids buscados viven en `?casos=` para que recargar o compartir el
 * enlace conserve la consulta. Mientras haya filas `pending` se vuelve a pedir **solo esos ids** cada 5 s (S1).
 */
// Provisional (HU-W2.2-01 F1): el listado de HU-W2.2-03 / la cola de HU-W2.2-02 reemplazan la búsqueda
@Component({
  selector: 'app-cola-siniestros-page',
  imports: [
    TranslocoDirective,
    FormatoMonedaPipe,
    IndicadoresTriageComponent,
    TablaTriageComponent,
    LucideCircleAlert,
    LucideInfo,
  ],
  templateUrl: './cola-siniestros.page.html',
  styleUrl: './cola-siniestros.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColaSiniestrosPage implements OnInit {
  private readonly api = inject(SiniestrosApiService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destruccion = inject(DestroyRef);
  private consulta: Subscription | null = null;

  protected readonly maxIds = MAX_IDS_LOTE;

  protected readonly fase = signal<Fase>('inicial');
  protected readonly texto = signal('');
  protected readonly errorBusqueda = signal<ErrorBusqueda | null>(null);
  protected readonly repetidos = signal(0);
  protected readonly filas = signal<readonly ResumenTriage[]>([]);
  protected readonly actualizacion = signal<Actualizacion>('al-dia');
  protected readonly ids = signal<readonly string[]>([]);

  protected readonly politica = signal<PoliticaTriage | null>(null);
  protected readonly estadoPolitica = signal<EstadoIndicadores>('cargando');

  protected readonly visibles = computed(() => this.filas().filter((fila) => fila.estado !== 'not_found'));
  protected readonly inexistentes = computed(() => this.filas().filter((fila) => fila.estado === 'not_found').length);
  protected readonly parametrosEnlace = computed(() => (this.ids().length > 0 ? { casos: this.ids().join(',') } : null));
  protected readonly umbrales = computed(() => {
    const politica = this.politica();
    return politica ? umbralesEnPesos(politica) : null;
  });

  ngOnInit(): void {
    this.cargarPolitica();
    const casos = this.ruta.snapshot.queryParamMap.get('casos');
    if (casos) {
      const { ids } = parsearIdsBusqueda(casos);
      if (ids.length > 0 && ids.length <= MAX_IDS_LOTE) {
        this.texto.set(ids.join('\n'));
        this.consultar(ids);
      }
    }
  }

  protected cargarPolitica(): void {
    this.estadoPolitica.set('cargando');
    this.api
      .consultarPoliticaTriage()
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (politica) => {
          this.politica.set(politica);
          this.estadoPolitica.set('listo');
        },
        error: () => this.estadoPolitica.set('error'),
      });
  }

  protected escribir(valor: string): void {
    this.texto.set(valor);
    this.errorBusqueda.set(null);
  }

  /** «Buscar»: valida los ids antes de llamar (S6) y escribe `?casos=` en la URL. */
  protected buscar(): void {
    const lectura = parsearIdsBusqueda(this.texto());
    const error = this.errorDe(lectura);
    this.errorBusqueda.set(error);
    if (error) {
      return;
    }
    this.repetidos.set(lectura.repetidos.length);
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { casos: lectura.ids.join(',') },
      replaceUrl: true,
    });
    this.consultar(lectura.ids);
  }

  /** «Limpiar»: vuelve al estado inicial y quita `?casos=`. */
  protected limpiar(): void {
    this.consulta?.unsubscribe();
    this.texto.set('');
    this.errorBusqueda.set(null);
    this.repetidos.set(0);
    this.ids.set([]);
    this.filas.set([]);
    this.actualizacion.set('al-dia');
    this.fase.set('inicial');
    void this.router.navigate([], { relativeTo: this.ruta, queryParams: { casos: null }, replaceUrl: true });
  }

  /** Vuelve a pedir los ids de la búsqueda actual (reintento y «Actualizar»). */
  protected reintentar(): void {
    this.consultar([...this.ids()]);
  }

  /**
   * Una sola llamada al lote con todos los ids; si quedan filas `pending`, el sondeo vuelve a pedir **solo esos ids**
   * y actualiza únicamente esas filas.
   */
  private consultar(ids: string[]): void {
    this.consulta?.unsubscribe();
    this.ids.set(ids);
    this.fase.set('buscando');
    this.actualizacion.set('al-dia');
    let pendientes = ids;
    let primera = true;
    this.consulta = sondearMientrasPendiente(
      () => this.api.consultarTriageLote(pendientes),
      (lote) => lote.some((fila) => fila.estado === 'pending'),
    )
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: ({ valor, actualizacion }) => {
          if (primera) {
            this.filas.set(valor);
            primera = false;
          } else {
            this.filas.update((actuales) =>
              actuales.map((fila) => valor.find((nueva) => nueva.siniestroId === fila.siniestroId) ?? fila),
            );
          }
          pendientes = this.filas()
            .filter((fila) => fila.estado === 'pending')
            .map((fila) => fila.siniestroId);
          this.actualizacion.set(actualizacion);
          this.fase.set(this.visibles().length > 0 ? 'resultados' : 'sinResultados');
        },
        error: () => this.fase.set('error'),
      });
  }

  private errorDe(lectura: IdsBusqueda): ErrorBusqueda | null {
    if (lectura.invalidos.length > 0) {
      return { tipo: 'invalidos', ids: lectura.invalidos };
    }
    if (lectura.excedeMaximo) {
      return { tipo: 'demasiados', cantidad: lectura.ids.length };
    }
    return lectura.ids.length === 0 ? { tipo: 'vacio' } : null;
  }

  protected textoError(t: Traductor, error: ErrorBusqueda): string {
    switch (error.tipo) {
      case 'invalidos':
        return t('triage.cola.busqueda.errores.invalidos', { ids: error.ids.join(', ') });
      case 'demasiados':
        return t('triage.cola.busqueda.errores.demasiados', { cantidad: error.cantidad });
      default:
        return t('triage.cola.busqueda.errores.vacio');
    }
  }
}
