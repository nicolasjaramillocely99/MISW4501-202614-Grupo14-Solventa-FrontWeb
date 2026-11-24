import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideCircleAlert, LucidePlus, LucideRefreshCw } from '@lucide/angular';
import { Subscription } from 'rxjs';

import { aLocal } from '../radicacion/modelos/formulario-radicacion';
import {
  EstadoSiniestro,
  PolizaSiniestro,
  ResumenCasos,
  ResumenSiniestro,
} from '@core/api/siniestros/siniestro.modelos';
import { SiniestrosApiService } from '@core/api/siniestros/siniestros-api.service';

import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';
import { FormatoMonedaPipe } from '@shared/pipes/formato-moneda.pipe';

import { Traductor, nombreRamo } from '../modelos/catalogo-siniestros';
import { TablaSiniestrosComponent } from './componentes/tabla-siniestros/tabla-siniestros.component';
import { refrescoVisible } from './modelos/refresco';

type Fase = 'cargando' | 'lista' | 'vacio' | 'sin-resultados' | 'error';

interface Filtro {
  polizaId: string;
  /** `YYYY-MM-DD` del control `<input type="date">`. */
  desde: string;
  /** La etapa (HU-W2.1-02); vacío para todas. */
  estado: EstadoSiniestro | '';
}

const SIN_FILTRO: Filtro = { polizaId: '', desde: '', estado: '' };
const TAMANO_PAGINA = 20;
/** El máximo de una página del backend: el refresco relee lo que ya se ve, hasta este tope. */
const TAMANO_MAXIMO = 50;

/** Las etapas del filtro, en el orden en que avanza un caso. */
export const ETAPAS: readonly EstadoSiniestro[] = [
  'active',
  'returned',
  'in_evaluation',
  'approved',
  'payment_exception',
  'paid',
  'rejected',
];

/**
 * A7 · Mis siniestros (HU-W2.1-01 y HU-W2.1-02): los casos del asegurado de los dos canales (`GET /v1/claims`), del más
 * reciente al más antiguo, con su etapa y la fecha del último cambio (CA-1), filtros de etapa, póliza y «Desde» y
 * «Cargar más» por `next_page_token`. Los indicadores («En curso», «Pagados este año», «Acción pendiente de tu parte»)
 * salen del `summary` del backend: cuentan todos los casos, sin importar los filtros. Un caso devuelto ofrece
 * «Corregir» (A9); los demás, «Ver detalle» (A8). La lista vuelve a leerse cada 60 s con la pestaña visible (CA-2).
 *
 * Ruta `/siniestros/mis-siniestros`, rol asegurado. Las pólizas del filtro salen de `filing-options` (las activas);
 * si esa consulta falla, el filtro de póliza se oculta y la tabla sigue.
 */
@Component({
  selector: 'app-mis-siniestros-page',
  imports: [
    RouterLink,
    TranslocoDirective,
    FormatoFechaHoraPipe,
    FormatoMonedaPipe,
    TablaSiniestrosComponent,
    LucidePlus,
    LucideCircleAlert,
    LucideRefreshCw,
  ],
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
  /** Las pólizas vigentes de `filing-options`: el respaldo del filtro si el backend no trae las de los siniestros. */
  private readonly polizasVigentes = signal<readonly PolizaSiniestro[]>([]);
  /** «Desde» no admite días futuros: el máximo es hoy, en la hora del navegador. */
  protected readonly hoy = aLocal(new Date()).slice(0, 10);
  /** Se escribió en «Desde» un día futuro: se avisa y no se consulta. */
  protected readonly desdeFutura = signal(false);
  private readonly controlDesde = viewChild<ElementRef<HTMLInputElement>>('controlDesde');
  protected readonly resumen = signal<ResumenCasos | null>(null);
  /** Cuándo se leyó la lista por última vez (CA-2). */
  protected readonly leidoEn = signal<string | null>(null);
  protected readonly etapas = ETAPAS;

  /**
   * Las pólizas del filtro: las de los siniestros del asegurado (`summary.policies`), también las vencidas y las de los
   * casos del móvil. Sin resumen, las vigentes de `filing-options`. La póliza elegida siempre está, aunque ya no venga.
   */
  protected readonly polizas = computed<readonly PolizaSiniestro[]>(() => {
    const deLosCasos = this.resumen()?.polizas;
    const base = deLosCasos && deLosCasos.length > 0 ? deLosCasos : this.polizasVigentes();
    const elegida = this.filtro().polizaId;
    if (elegida && !base.some((p) => p.id === elegida)) {
      return [...base, { id: elegida, ramo: null, producto: null, objetoAsegurado: null }];
    }
    return base;
  });

  protected readonly hayFiltro = computed(
    () => !!this.filtro().polizaId || !!this.filtro().desde || !!this.filtro().estado,
  );

  ngOnInit(): void {
    this.api
      .consultarOpcionesRadicacion()
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (opciones) =>
          this.polizasVigentes.set(
            opciones.polizas.map((p) => ({ id: p.id, ramo: p.ramo, producto: p.producto, objetoAsegurado: p.objetoAsegurado })),
          ),
        error: () => this.polizasVigentes.set([]),
      });
    this.cargar();
    refrescoVisible()
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe(() => this.actualizar());
  }

  /** Primera página con el filtro actual (sin token). */
  protected cargar(): void {
    this.fase.set('cargando');
    this.errorMas.set(false);
    this.leer(TAMANO_PAGINA);
  }

  /**
   * «Actualizar» y la lectura de cada minuto: relee lo que ya se ve, sin «Cargando». Si falla, la lista que se ve
   * se queda.
   */
  protected actualizar(): void {
    if (this.fase() === 'cargando' || this.cargandoMas()) {
      return;
    }
    this.leer(Math.min(TAMANO_MAXIMO, Math.max(TAMANO_PAGINA, this.casos().length)), true);
  }

  private leer(tamanoPagina: number, silencioso = false): void {
    this.consulta?.unsubscribe();
    const { polizaId, desde, estado } = this.filtro();
    this.consulta = this.api
      .listarSiniestros({ polizaId, desde, estado: estado || undefined, tamanoPagina })
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (pagina) => {
          this.casos.set(pagina.items);
          this.siguienteToken.set(pagina.siguienteToken);
          this.resumen.set(pagina.resumen ?? null);
          this.leidoEn.set(new Date().toISOString());
          this.fase.set(pagina.items.length > 0 ? 'lista' : this.hayFiltro() ? 'sin-resultados' : 'vacio');
        },
        error: () => {
          if (!silencioso) {
            this.fase.set('error');
          }
        },
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
    const { polizaId, desde, estado } = this.filtro();
    this.api
      .listarSiniestros({ polizaId, desde, estado: estado || undefined, tamanoPagina: TAMANO_PAGINA, tokenPagina: token })
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
    if (campo === 'desde') {
      this.desdeFutura.set(valor > this.hoy);
      if (this.desdeFutura()) {
        return;
      }
    }
    if (this.filtro()[campo] === valor) {
      return;
    }
    this.filtro.update((actual) => ({ ...actual, [campo]: valor }));
    this.cargar();
  }

  /** «1 en evaluación · 1 devuelto»: los estados en curso con casos, en el orden de las etapas. */
  protected detalleEnCurso(t: Traductor, resumen: ResumenCasos): string {
    return ETAPAS.filter((e) => e !== 'paid' && e !== 'rejected' && (resumen.porEstado[e] ?? 0) > 0)
      .map((e) => t('misSiniestros.indicadores.enCursoDe', { n: resumen.porEstado[e], etapa: t('estados.' + e) }))
      .join(' · ');
  }

  protected limpiarFiltros(): void {
    this.desdeFutura.set(false);
    // Una fecha futura no llegó al filtro: el campo la sigue mostrando aunque el filtro ya esté vacío.
    const desde = this.controlDesde()?.nativeElement;
    if (desde) {
      desde.value = '';
    }
    this.filtro.set(SIN_FILTRO);
    this.cargar();
  }

  protected etiquetaPoliza(t: Traductor, poliza: PolizaSiniestro): string {
    return [nombreRamo(t, poliza.ramo, poliza.producto), poliza.id, poliza.objetoAsegurado].filter(Boolean).join(' · ');
  }
}
