import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideCircleAlert, LucideCircleCheck, LucideRefreshCw } from '@lucide/angular';
import { Observable, Subscription } from 'rxjs';

import { CasoEnCola, CasoEnColaPrioridad, FiltroCola, PaginaCola, ResumenCola } from '@core/api/siniestros/evaluacion.modelos';
import { ListaOperaciones, SiniestrosApiService } from '@core/api/siniestros/siniestros-api.service';
import { PoliticaTriage } from '@core/api/siniestros/triage.modelos';
import { FormatoMonedaPipe } from '@shared/pipes/formato-moneda.pipe';
import { InsigniaEstadoComponent } from '@shared/ui/insignia-estado/insignia-estado.component';

import { Traductor, nombreRamo, nombreTipo } from '../modelos/catalogo-siniestros';
import { tiempoEnCola, tonoEstado, tonoPrioridad } from '../modelos/estado-siniestro';
import {
  EstadoIndicadores,
  IndicadoresTriageComponent,
} from '../triage/componentes/indicadores-triage/indicadores-triage.component';

export type FaseCasos = 'cargando' | 'lista' | 'error';

const PESTANAS: readonly ListaOperaciones[] = ['evaluations', 'payment-exceptions'];

/** Cada cuánto se refresca «actualizado hace …». */
export const INTERVALO_RELOJ_MS = 5000;

/** Opciones de los filtros de O5. */
export const NIVELES_FILTRO = ['1', '2', '3', 'none'] as const;
export const RAMOS_FILTRO = ['auto', 'home'] as const;
export const ESTADOS_FILTRO = ['in_evaluation'] as const;

/**
 * O5 · Cola de siniestros (HU-W2.2-02) y excepciones de pago (HU-W2.2-03): el listado del que el analista de operaciones
 * abre un caso para decidirlo.
 *
 * - **Cola por prioridad (pestaña «En evaluación»):** Triage 1, luego 2, luego 3 y al final lo que el triage aún no
 *   calcula; en cada nivel, el que más espera desde su radicación (CA-2). Cada consulta trae el orden vigente, así que
 *   un cambio de nivel mueve el caso al «Actualizar» (CA-3). Los indicadores cuentan toda la cola por nivel, con el
 *   objetivo de la política (`GET /v1/claims/triage-policy`) y el tiempo medio de resolución de los últimos 30 días;
 *   con la cola vacía muestran ceros, sin datos ficticios (CA-4). Filtros de prioridad, estado y producto.
 * - **Excepciones de pago:** los aprobados cuyo pago falló, para atenderlos (O6b), del más antiguo al más nuevo.
 *
 * La cola por id de HU-W2.2-01 (`/siniestros/cola`) sigue disponible desde el encabezado. Ruta: `/siniestros/evaluacion`
 * (solo operaciones, CA-5).
 */
@Component({
  selector: 'app-casos-evaluacion-page',
  imports: [
    RouterLink,
    TranslocoDirective,
    InsigniaEstadoComponent,
    IndicadoresTriageComponent,
    FormatoMonedaPipe,
    LucideCircleAlert,
    LucideCircleCheck,
    LucideRefreshCw,
  ],
  templateUrl: './casos-evaluacion.page.html',
  styleUrl: './casos-evaluacion.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CasosEvaluacionPage implements OnInit {
  private readonly api = inject(SiniestrosApiService);
  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);
  private consulta: Subscription | null = null;

  protected readonly pestanas = PESTANAS;
  protected readonly niveles = NIVELES_FILTRO;
  protected readonly ramos = RAMOS_FILTRO;
  protected readonly estados = ESTADOS_FILTRO;
  protected readonly lista = signal<ListaOperaciones>('evaluations');
  protected readonly fase = signal<FaseCasos>('cargando');
  protected readonly casos = signal<readonly (CasoEnCola | CasoEnColaPrioridad)[]>([]);
  protected readonly siguienteToken = signal<string | null>(null);
  protected readonly cargandoMas = signal(false);
  protected readonly ahora = signal(new Date());
  protected readonly filtro = signal<FiltroCola>({});
  protected readonly resumen = signal<ResumenCola | null>(null);
  protected readonly politica = signal<PoliticaTriage | null>(null);
  protected readonly estadoPolitica = signal<EstadoIndicadores>('cargando');
  /** Hora de la última lectura de la cola y el reloj que dice hace cuánto fue. */
  protected readonly actualizadoEn = signal<Date | null>(null);
  protected readonly reloj = signal(new Date());

  protected readonly tonoEstado = tonoEstado;
  protected readonly tonoPrioridad = tonoPrioridad;

  protected readonly esCola = computed(() => this.lista() === 'evaluations');
  /** Casos de la cola por nivel; mientras no carga, ceros (nunca datos ficticios). */
  protected readonly conteos = computed<Readonly<Record<number, number>>>(() => this.resumen()?.porNivel ?? { 1: 0, 2: 0, 3: 0 });
  protected readonly segundosDesdeActualizacion = computed(() => {
    const en = this.actualizadoEn();
    return en ? Math.max(0, Math.floor((this.reloj().getTime() - en.getTime()) / 1000)) : 0;
  });

  constructor() {
    const intervalo = setInterval(() => this.reloj.set(new Date()), INTERVALO_RELOJ_MS);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(intervalo);
      this.consulta?.unsubscribe();
    });
  }

  ngOnInit(): void {
    this.cargarPolitica();
    this.cargar();
  }

  protected cargar(): void {
    this.consulta?.unsubscribe();
    this.fase.set('cargando');
    this.consulta = this.leer().subscribe({
      next: (pagina) => {
        const ahora = new Date();
        this.ahora.set(ahora);
        this.actualizadoEn.set(ahora);
        this.reloj.set(ahora);
        this.casos.set(pagina.items);
        this.siguienteToken.set(pagina.siguienteToken);
        this.resumen.set('resumen' in pagina ? (pagina.resumen as ResumenCola) : null);
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
    this.consulta = this.leer(token).subscribe({
      next: (pagina) => {
        this.casos.update((casos) => [...casos, ...pagina.items]);
        this.siguienteToken.set(pagina.siguienteToken);
        this.cargandoMas.set(false);
      },
      error: () => {
        this.cargandoMas.set(false);
        this.fase.set('error');
      },
    });
  }

  protected cargarPolitica(): void {
    this.estadoPolitica.set('cargando');
    this.api.consultarPoliticaTriage().subscribe({
      next: (politica) => {
        this.politica.set(politica);
        this.estadoPolitica.set('listo');
      },
      error: () => this.estadoPolitica.set('error'),
    });
  }

  protected filtrar(campo: keyof FiltroCola, evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    this.filtro.update((f) => {
      const nuevo: FiltroCola = { ...f };
      if (valor) {
        (nuevo as Record<string, string>)[campo] = valor;
      } else {
        delete nuevo[campo];
      }
      return nuevo;
    });
    this.cargar();
  }

  protected seleccionarPestana(lista: ListaOperaciones): void {
    if (lista === this.lista()) {
      return;
    }
    this.lista.set(lista);
    this.cargar();
  }

  /** Flechas izquierda/derecha, Inicio y Fin mueven entre pestañas (patrón de pestañas de WAI-ARIA). */
  protected alTeclearPestana(evento: KeyboardEvent): void {
    const actual = PESTANAS.indexOf(this.lista());
    const destino: Partial<Record<string, number>> = {
      ArrowRight: (actual + 1) % PESTANAS.length,
      ArrowLeft: (actual - 1 + PESTANAS.length) % PESTANAS.length,
      Home: 0,
      End: PESTANAS.length - 1,
    };
    const indice = destino[evento.key];
    if (indice === undefined) {
      return;
    }
    evento.preventDefault();
    this.seleccionarPestana(PESTANAS[indice]);
    this.elemento.nativeElement.querySelector<HTMLElement>(`#pestana-${PESTANAS[indice]}`)?.focus();
  }

  protected producto(t: Traductor, caso: CasoEnCola): string {
    const ramo = nombreRamo(t, caso.poliza.ramo, caso.poliza.producto);
    const tipo = nombreTipo(t, caso.tipoSiniestro, undefined, 'corto');
    return ramo ? `${ramo} · ${tipo}` : tipo;
  }

  protected espera(t: Traductor, caso: CasoEnCola): string {
    const { dias, horas } = tiempoEnCola(caso.radicadoEn, this.ahora());
    return dias > 0 ? t('casosEvaluacion.esperaDias', { dias, horas }) : t('casosEvaluacion.esperaHoras', { horas });
  }

  protected asegurado(caso: CasoEnCola | CasoEnColaPrioridad): CasoEnColaPrioridad['asegurado'] {
    return 'asegurado' in caso ? caso.asegurado : null;
  }

  private leer(token?: string): Observable<PaginaCola> {
    return this.esCola() ? this.api.listarColaPrioridad(this.filtro(), token) : this.api.listarCola(this.lista(), token);
  }
}
