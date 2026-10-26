import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideCircleAlert, LucideCircleCheck, LucideRefreshCw } from '@lucide/angular';
import { Subscription, timer } from 'rxjs';

import {
  CANALES_EMISION,
  CanalEmision,
  ConteosEmisiones,
  ESTADOS_EMISION,
  Emision,
  EstadoEmision,
  FiltroEmisiones,
  rangoValido,
  ultimoPaso,
} from '@core/api/originacion/emision-monitor.modelos';
import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';
import { InsigniaEstadoComponent, TonoInsignia } from '@shared/ui/insignia-estado/insignia-estado.component';

import { DetalleExcepcionComponent } from './componentes/detalle-excepcion/detalle-excepcion.component';

export type FaseEmisiones = 'cargando' | 'listo' | 'error';

/** Cada cuánto se vuelve a consultar: el «tiempo real» de la historia es un sondeo, no un empuje. */
export const INTERVALO_SONDEO_MS = 30_000;

const TONO_POR_ESTADO: Readonly<Record<EstadoEmision, TonoInsignia>> = {
  accepted: 'neutro',
  charging: 'informacion',
  active: 'exito',
  notified: 'exito',
  exception: 'error',
};

/** Largo del identificador que se muestra en la tabla. */
const ID_CORTO = 8;

/** Cada cuánto se refresca el «Actualizado hace N s». */
const INTERVALO_RELOJ_MS = 1_000;

/**
 * O1 · Monitoreo de emisiones y excepciones (HU-W1.3-04). El analista de operaciones ve las tarjetas con cuántas
 * emisiones hay en cada estado y la lista de emisiones con el estado y el último paso de cada una (aceptada, en
 * cobro, activa, notificada, en excepción); las filtra por estado, rango de fechas y canal y abre cada una:
 * una excepción (O1b) se reintenta desde la aceptación registrada y una emisión sin excepción solo se consulta,
 * porque no pide ninguna acción. La lista se actualiza sola cada 30 s y con el botón «Actualizar». Sin resultados
 * la vista se muestra vacía, sin error. Los filtros los aplica el backend.
 *
 * Ruta: `/originacion/emisiones` (solo operaciones).
 */
@Component({
  selector: 'app-emisiones-page',
  imports: [
    TranslocoDirective,
    FormatoFechaHoraPipe,
    InsigniaEstadoComponent,
    DetalleExcepcionComponent,
    LucideCircleAlert,
    LucideCircleCheck,
    LucideRefreshCw,
  ],
  templateUrl: './emisiones.page.html',
  styleUrl: './emisiones.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmisionesPage implements OnInit {
  private readonly api = inject(OriginacionApiService);
  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destruir = inject(DestroyRef);
  private consulta: Subscription | null = null;

  protected readonly estados = ESTADOS_EMISION;
  protected readonly canales = CANALES_EMISION;

  protected readonly estado = signal<EstadoEmision | null>(null);
  protected readonly canal = signal<CanalEmision | null>(null);
  protected readonly desde = signal<string | null>(null);
  protected readonly hasta = signal<string | null>(null);
  protected readonly fase = signal<FaseEmisiones>('cargando');
  protected readonly emisiones = signal<readonly Emision[]>([]);
  protected readonly conteos = signal<ConteosEmisiones | null>(null);
  /** Reloj de la pantalla, para «Actualizado hace N s». */
  protected readonly ahora = signal(Date.now());
  /** La última actualización falló pero la lista anterior sigue en pantalla. */
  protected readonly actualizacionFallida = signal(false);
  protected readonly actualizadaEn = signal<number | null>(null);
  protected readonly seleccionada = signal<Emision | null>(null);
  /** Aceptación que se acaba de reintentar, para anunciarlo. */
  protected readonly reintentada = signal<string | null>(null);

  protected readonly rangoInvalido = computed(() => !rangoValido(this.filtro()));
  /** «hace 8 s» o «hace 2 min» desde la última actualización correcta. */
  protected readonly hace = computed(() => {
    const ultima = this.actualizadaEn();
    if (ultima === null) {
      return null;
    }
    const segundos = Math.max(0, Math.floor((this.ahora() - ultima) / 1000));
    return segundos < 60 ? { clave: 'segundos', n: segundos } : { clave: 'minutos', n: Math.floor(segundos / 60) };
  });
  private readonly filtro = computed<FiltroEmisiones>(() => ({
    estado: this.estado(),
    canal: this.canal(),
    desde: this.desde(),
    hasta: this.hasta(),
  }));

  constructor() {
    this.destruir.onDestroy(() => this.consulta?.unsubscribe());
  }

  ngOnInit(): void {
    this.cargar();
    timer(INTERVALO_SONDEO_MS, INTERVALO_SONDEO_MS)
      .pipe(takeUntilDestroyed(this.destruir))
      .subscribe(() => this.cargar(true));
    timer(INTERVALO_RELOJ_MS, INTERVALO_RELOJ_MS)
      .pipe(takeUntilDestroyed(this.destruir))
      .subscribe(() => this.ahora.set(Date.now()));
  }

  protected tono(estado: EstadoEmision): TonoInsignia {
    return TONO_POR_ESTADO[estado];
  }

  protected readonly paso = ultimoPaso;

  /** Los identificadores son UUID: la tabla muestra el inicio y el diálogo, el completo. */
  protected corto(id: string): string {
    return id.length > ID_CORTO ? id.slice(0, ID_CORTO) : id;
  }

  /** La hora basta para lo de hoy; lo anterior lleva también la fecha. */
  protected esHoy(fecha: string): boolean {
    return new Date(fecha).toDateString() === new Date(this.ahora()).toDateString();
  }

  /** `silencioso` es el sondeo: mantiene la lista en pantalla y solo avisa si la actualización falla. */
  protected cargar(silencioso = false): void {
    if (this.rangoInvalido()) {
      return;
    }
    const filtro = this.filtro();
    this.consulta?.unsubscribe();
    if (!silencioso) {
      this.fase.set('cargando');
    }
    this.consulta = this.api.listarEmisiones(filtro).subscribe({
      next: (lista) => {
        this.emisiones.set(lista.emisiones);
        this.conteos.set(lista.conteos);
        this.actualizadaEn.set(Date.now());
        this.ahora.set(Date.now());
        this.actualizacionFallida.set(false);
        this.fase.set('listo');
      },
      // 401 y 403 los resuelve el interceptor; el resto se muestra, con reintento.
      error: () => {
        if (silencioso && this.fase() === 'listo') {
          this.actualizacionFallida.set(true);
        } else {
          this.fase.set('error');
        }
      },
    });
  }

  protected cambiarEstado(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    this.estado.set(ESTADOS_EMISION.find((e) => e === valor) ?? null);
    this.cargar();
  }

  protected cambiarCanal(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    this.canal.set(CANALES_EMISION.find((c) => c === valor) ?? null);
    this.cargar();
  }

  protected cambiarDesde(evento: Event): void {
    this.desde.set((evento.target as HTMLInputElement).value || null);
    this.cargar();
  }

  protected cambiarHasta(evento: Event): void {
    this.hasta.set((evento.target as HTMLInputElement).value || null);
    this.cargar();
  }

  protected limpiarFiltros(): void {
    this.estado.set(null);
    this.canal.set(null);
    this.desde.set(null);
    this.hasta.set(null);
    this.cargar();
  }

  protected abrir(emision: Emision): void {
    this.reintentada.set(null);
    this.seleccionada.set(emision);
  }

  /** Cierra el detalle y devuelve el foco al botón que lo abrió. */
  protected cerrar(): void {
    const id = this.seleccionada()?.aceptacionId;
    this.seleccionada.set(null);
    if (id) {
      queueMicrotask(() =>
        Array.from(this.elemento.nativeElement.querySelectorAll<HTMLElement>('[data-aceptacion]'))
          .find((boton) => boton.dataset['aceptacion'] === id)
          ?.focus(),
      );
    }
  }

  /** Se reintentó (o ya no había nada fallido): se anuncia y se refresca la lista. */
  protected alReintentar(aceptacionId: string): void {
    this.reintentada.set(aceptacionId);
    this.cerrar();
    this.cargar(true);
  }
}
