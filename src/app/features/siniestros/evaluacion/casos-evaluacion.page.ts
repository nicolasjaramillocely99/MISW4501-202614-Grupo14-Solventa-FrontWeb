import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideCircleAlert, LucideCircleCheck, LucideRefreshCw } from '@lucide/angular';
import { Subscription } from 'rxjs';

import { CasoEnCola } from '@core/api/siniestros/evaluacion.modelos';
import { ListaOperaciones, SiniestrosApiService } from '@core/api/siniestros/siniestros-api.service';
import { FormatoMonedaPipe } from '@shared/pipes/formato-moneda.pipe';
import { InsigniaEstadoComponent } from '@shared/ui/insignia-estado/insignia-estado.component';

import { Traductor, nombreRamo, nombreTipo } from '../modelos/catalogo-siniestros';
import { tiempoEnCola, tonoEstado, tonoPrioridad } from '../modelos/estado-siniestro';

export type FaseCasos = 'cargando' | 'lista' | 'error';

const PESTANAS: readonly ListaOperaciones[] = ['evaluations', 'payment-exceptions'];

/**
 * Casos en evaluación (HU-W2.2-03, CA-1): el listado del que el analista de operaciones abre un caso para decidirlo.
 * Cada caso trae su prioridad (Triage 1, 2 o 3, de HU-W2.2-01), el monto estimado y el tiempo en cola; «Evaluar» abre
 * O6 y «Ver prioridad» la pantalla de prioridad de HU-W2.2-01 (`/siniestros/cola/:id`). La pestaña «Excepciones de
 * pago» lista los aprobados cuyo pago falló, para atenderlos (O6b). El backend los entrega del más antiguo al más
 * nuevo. La cola por id de HU-W2.2-01 (`/siniestros/cola`) sigue disponible desde el encabezado; **HU-W2.2-02** une
 * las dos en la cola ordenada por prioridad del prototipo (O5).
 *
 * Ruta: `/siniestros/evaluacion` (solo operaciones).
 */
@Component({
  selector: 'app-casos-evaluacion-page',
  imports: [
    RouterLink,
    TranslocoDirective,
    InsigniaEstadoComponent,
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
  protected readonly lista = signal<ListaOperaciones>('evaluations');
  protected readonly fase = signal<FaseCasos>('cargando');
  protected readonly casos = signal<readonly CasoEnCola[]>([]);
  protected readonly siguienteToken = signal<string | null>(null);
  protected readonly cargandoMas = signal(false);
  protected readonly ahora = signal(new Date());

  protected readonly tonoEstado = tonoEstado;
  protected readonly tonoPrioridad = tonoPrioridad;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.consulta?.unsubscribe());
  }

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.consulta?.unsubscribe();
    this.fase.set('cargando');
    this.consulta = this.api.listarCola(this.lista()).subscribe({
      next: (pagina) => {
        this.ahora.set(new Date());
        this.casos.set(pagina.items);
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
    this.consulta = this.api.listarCola(this.lista(), token).subscribe({
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
}
