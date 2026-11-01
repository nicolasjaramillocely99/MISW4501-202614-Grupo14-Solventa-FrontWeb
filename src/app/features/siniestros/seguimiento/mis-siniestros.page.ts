import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideCircleAlert, LucidePlus } from '@lucide/angular';
import { Subscription } from 'rxjs';

import { PolizaRadicable } from '@core/api/siniestros/radicacion.modelos';
import { ResumenSiniestro } from '@core/api/siniestros/siniestro.modelos';
import { SiniestrosApiService } from '@core/api/siniestros/siniestros-api.service';

import { Traductor, nombreRamo } from '../modelos/catalogo-siniestros';
import { TablaSiniestrosComponent } from './componentes/tabla-siniestros/tabla-siniestros.component';

type Fase = 'cargando' | 'lista' | 'vacio' | 'sin-resultados' | 'error';

interface Filtro {
  polizaId: string;
  /** `YYYY-MM-DD` del control `<input type="date">`. */
  desde: string;
}

const SIN_FILTRO: Filtro = { polizaId: '', desde: '' };
const TAMANO_PAGINA = 20;

/**
 * A7 · Mis siniestros, versión mínima de HU-W2.1-01 (F1, CA-6): los casos del asegurado de los dos canales
 * (`GET /v1/claims`), del más reciente al más antiguo, con filtros de póliza y «Desde» y «Cargar más» por
 * `next_page_token`. Al cambiar un filtro se empieza sin token y el filtro se conserva al paginar. Los indicadores,
 * el filtro de etapa, «Ver detalle» y «Corregir» los completa HU-W2.1-02.
 *
 * Ruta `/siniestros/mis-siniestros`, rol asegurado. Las pólizas del filtro salen de `filing-options` (las activas);
 * si esa consulta falla, el filtro de póliza se oculta y la tabla sigue.
 */
@Component({
  selector: 'app-mis-siniestros-page',
  imports: [RouterLink, TranslocoDirective, TablaSiniestrosComponent, LucidePlus, LucideCircleAlert],
  templateUrl: './mis-siniestros.page.html',
  styleUrl: './mis-siniestros.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MisSiniestrosPage implements OnInit {
  private readonly api = inject(SiniestrosApiService);
  private readonly destruccion = inject(DestroyRef);
  private consulta: Subscription | null = null;

  protected readonly fase = signal<Fase>('cargando');
  protected readonly filtro = signal<Filtro>(SIN_FILTRO);
  protected readonly casos = signal<readonly ResumenSiniestro[]>([]);
  protected readonly siguienteToken = signal<string | null>(null);
  protected readonly cargandoMas = signal(false);
  protected readonly errorMas = signal(false);
  protected readonly polizas = signal<readonly PolizaRadicable[]>([]);

  protected readonly hayFiltro = computed(() => !!this.filtro().polizaId || !!this.filtro().desde);

  ngOnInit(): void {
    this.api
      .consultarOpcionesRadicacion()
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({ next: (opciones) => this.polizas.set(opciones.polizas), error: () => this.polizas.set([]) });
    this.cargar();
  }

  /** Primera página con el filtro actual (sin token). */
  protected cargar(): void {
    this.consulta?.unsubscribe();
    this.fase.set('cargando');
    this.errorMas.set(false);
    const { polizaId, desde } = this.filtro();
    this.consulta = this.api
      .listarSiniestros({ polizaId, desde, tamanoPagina: TAMANO_PAGINA })
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (pagina) => {
          this.casos.set(pagina.items);
          this.siguienteToken.set(pagina.siguienteToken);
          this.fase.set(pagina.items.length > 0 ? 'lista' : this.hayFiltro() ? 'sin-resultados' : 'vacio');
        },
        error: () => this.fase.set('error'),
      });
  }

  /** Página siguiente con el mismo filtro y el token que dio la anterior. */
  protected cargarMas(): void {
    const token = this.siguienteToken();
    if (!token || this.cargandoMas()) {
      return;
    }
    this.cargandoMas.set(true);
    this.errorMas.set(false);
    const { polizaId, desde } = this.filtro();
    this.api
      .listarSiniestros({ polizaId, desde, tamanoPagina: TAMANO_PAGINA, tokenPagina: token })
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (pagina) => {
          this.casos.update((actuales) => [...actuales, ...pagina.items]);
          this.siguienteToken.set(pagina.siguienteToken);
          this.cargandoMas.set(false);
        },
        error: () => {
          this.cargandoMas.set(false);
          this.errorMas.set(true);
        },
      });
  }

  protected filtrar(campo: keyof Filtro, valor: string): void {
    if (this.filtro()[campo] === valor) {
      return;
    }
    this.filtro.update((actual) => ({ ...actual, [campo]: valor }));
    this.cargar();
  }

  protected limpiarFiltros(): void {
    this.filtro.set(SIN_FILTRO);
    this.cargar();
  }

  protected etiquetaPoliza(t: Traductor, poliza: PolizaRadicable): string {
    return [nombreRamo(t, poliza.ramo, poliza.producto), poliza.id, poliza.objetoAsegurado].filter(Boolean).join(' · ');
  }
}
