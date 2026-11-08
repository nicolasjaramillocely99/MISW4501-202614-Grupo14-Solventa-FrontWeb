import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideChevronLeft, LucideChevronRight, LucideCircleAlert, LucideSearch } from '@lucide/angular';
import { Observable, Subject, catchError, combineLatest, map, of, startWith, switchMap } from 'rxjs';

import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';
import {
  ESTADOS_POR_VENCER,
  ErrorPorVencer,
  EstadoPolizaPorVencer,
  EstadoPorVencer,
  FiltroPorVencer,
  PaginaPorVencer,
  PolizaPorVencer,
} from '@core/api/originacion/polizas-por-vencer.modelos';
import { FormatoMonedaPipe } from '@shared/pipes/formato-moneda.pipe';
import { FormatoNumeroPipe } from '@shared/pipes/formato-numero.pipe';
import { InsigniaEstadoComponent, TonoInsignia } from '@shared/ui/insignia-estado/insignia-estado.component';

import {
  CriteriosPorVencer,
  diaCorto,
  filtroDesdeParametros,
  parametrosDesdeFiltro,
  rangoValido,
  totalPaginas,
} from './modelos/filtro-por-vencer';

/** Fase del listado: consultando, con filas, sin resultados, con una falla del servicio o con un rango de fechas inválido. */
export type FasePorVencer = 'cargando' | 'lista' | 'sinResultados' | 'error' | 'rangoInvalido';

type Resultado = { tipo: 'pagina'; pagina: PaginaPorVencer } | { tipo: 'error'; error: ErrorPorVencer } | { tipo: 'rango' };

/** Tono de la insignia por estado, como A1 (`mis-polizas.page.ts`): el texto siempre acompaña al color. */
const TONO: Readonly<Record<EstadoPolizaPorVencer, TonoInsignia>> = {
  expiring: 'advertencia',
  renewal_in_progress: 'informacion',
  desconocido: 'neutro',
};

/** Los días de la tabla son los de Colombia, como el filtro del backend (días civiles UTC-5). */
const ZONA_COLOMBIA = 'America/Bogota';

const SOLO_DIGITOS = /^\d+$/;

/**
 * S6 · Pólizas próximas a vencer (HU-W1.5-01): la tarjeta «Vencen en N días», los filtros «Vencen desde», «Hasta» y
 * «Estado», el conteo, la tabla (póliza, cliente con su documento, producto, vencimiento, prima, estado y acción) y la
 * paginación. La URL es la fuente del filtro (`?desde=&hasta=&estado=&pagina=`); sin rango, el backend aplica la ventana
 * de renovación desde hoy y los campos la muestran. *Renovar* solo aparece cuando el backend dice `can_renew` (dentro de
 * la ventana de HU-W1.5-02); fuera de ella la fila dice desde cuándo se puede renovar; *Ver* abre la renovación en curso.
 * Los dos llevan a la renovación asistida (HU-W1.5-03, `/originacion/renovaciones/:id`). Sin pólizas en el rango, la tabla
 * muestra el estado vacío con «Limpiar filtros» (CA-3). Un 503 muestra «Reintentar»; 401 y 403 los resuelve el interceptor.
 *
 * Ruta: `/originacion/renovaciones` (solo el asesor).
 */
@Component({
  selector: 'app-polizas-por-vencer-page',
  imports: [
    RouterLink,
    TranslocoDirective,
    InsigniaEstadoComponent,
    FormatoMonedaPipe,
    FormatoNumeroPipe,
    LucideChevronLeft,
    LucideChevronRight,
    LucideCircleAlert,
    LucideSearch,
  ],
  templateUrl: './polizas-por-vencer.page.html',
  styleUrl: './polizas-por-vencer.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PolizasPorVencerPage implements OnInit {
  private readonly api = inject(OriginacionApiService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly destruccion = inject(DestroyRef);
  private readonly recargas = new Subject<void>();

  protected readonly estados = ESTADOS_POR_VENCER;
  protected readonly fase = signal<FasePorVencer>('cargando');
  protected readonly filtro = signal<FiltroPorVencer>(filtroDesdeParametros({}));
  /** La última página recibida: la tarjeta sigue a la vista mientras se consulta otra. */
  protected readonly pagina = signal<PaginaPorVencer | null>(null);
  /** Lo que muestran los campos de fecha: el filtro de la URL o, sin él, el rango que aplicó el backend. */
  protected readonly desde = signal('');
  protected readonly hasta = signal('');

  protected readonly paginas = computed(() => {
    const datos = this.pagina();
    return datos ? totalPaginas(datos.total, datos.tamano) : 1;
  });
  protected readonly hayAnterior = computed(() => (this.pagina()?.pagina ?? 1) > 1);
  protected readonly haySiguiente = computed(() => (this.pagina()?.pagina ?? 1) < this.paginas());

  ngOnInit(): void {
    combineLatest([this.ruta.queryParams, this.recargas.pipe(startWith(undefined))])
      .pipe(
        map(([params]) => params),
        switchMap((params) => this.consultar(params)),
        takeUntilDestroyed(this.destruccion),
      )
      .subscribe((resultado) => this.mostrar(resultado));
  }

  /** «Reintentar» del error del servicio. */
  protected reintentar(): void {
    this.recargas.next();
  }

  protected cambiarFecha(campo: 'desde' | 'hasta', evento: Event): void {
    (campo === 'desde' ? this.desde : this.hasta).set((evento.target as HTMLInputElement).value);
    const rango = { desde: this.desde() || null, hasta: this.hasta() || null };
    if (!rangoValido(rango)) {
      // Se avisa en «Hasta» y no se consulta hasta que el rango sea válido.
      this.fase.set('rangoInvalido');
      return;
    }
    this.navegar({ ...rango, estado: this.filtro().estado });
  }

  protected cambiarEstado(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    const estado = (ESTADOS_POR_VENCER as readonly string[]).includes(valor) ? (valor as EstadoPorVencer) : null;
    const { desde, hasta } = this.filtro();
    this.navegar({ desde, hasta, estado });
  }

  protected irA(pagina: number): void {
    const { desde, hasta, estado } = this.filtro();
    this.navegar({ desde, hasta, estado }, pagina);
  }

  /** Vuelve al rango por defecto (la ventana de renovación desde hoy) y a todos los estados. */
  protected limpiar(): void {
    this.navegar({ desde: null, hasta: null, estado: null });
  }

  protected tono(poliza: PolizaPorVencer): TonoInsignia {
    return TONO[poliza.estado];
  }

  /** Por vencer y fuera de la ventana: la fila dice desde cuándo se puede renovar (decisión D-5 a). */
  protected renovableMasAdelante(poliza: PolizaPorVencer): boolean {
    return poliza.estado === 'expiring' && !poliza.puedeRenovar;
  }

  /** «02/10/2026»: el día civil de Colombia, en el orden del idioma. */
  protected dia(iso: string): string {
    const valor = new Date(iso);
    if (Number.isNaN(valor.getTime())) {
      return '';
    }
    return new Intl.DateTimeFormat(this.transloco.getActiveLang(), {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: ZONA_COLOMBIA,
    }).format(valor);
  }

  /** «1.020.345.678»: un documento numérico con separadores de miles del idioma; otro, tal cual. */
  protected documento(poliza: PolizaPorVencer): string {
    const { documento, tipoDocumento } = poliza.titular;
    if (!documento) {
      return '';
    }
    const numero = SOLO_DIGITOS.test(documento)
      ? new Intl.NumberFormat(this.transloco.getActiveLang(), { useGrouping: true }).format(Number(documento))
      : documento;
    return tipoDocumento ? `${tipoDocumento} ${numero}` : numero;
  }

  /** La columna «Producto»: el nombre del producto si lo hay; si no, el tipo de seguro traducido (decisión D-8 b). */
  protected producto(poliza: PolizaPorVencer): string {
    if (poliza.producto) {
      return poliza.producto;
    }
    const clave = `originacion.polizasPorVencer.linea.${poliza.linea}`;
    const texto = this.transloco.translate(clave);
    return texto === clave ? poliza.linea : texto;
  }

  /** El rango y el estado aplicados, para el estado vacío («entre el 01/12/2026 y el 15/12/2026 con el estado Todos»). */
  protected readonly vacio = computed(() => {
    const datos = this.pagina();
    const estado = this.filtro().estado;
    return {
      desde: datos ? diaCorto(datos.desde) : '',
      hasta: datos ? diaCorto(datos.hasta) : '',
      estado: estado ? `estados.${estado}` : 'filtros.todos',
    };
  });

  private consultar(params: Params): Observable<Resultado> {
    const filtro = filtroDesdeParametros(params);
    this.filtro.set(filtro);
    this.desde.set(filtro.desde ?? '');
    this.hasta.set(filtro.hasta ?? '');
    if (!rangoValido(filtro)) {
      return of({ tipo: 'rango' });
    }
    this.fase.set('cargando');
    return this.api.listarPolizasPorVencer(filtro).pipe(
      map((pagina): Resultado => ({ tipo: 'pagina', pagina })),
      catchError((error: unknown) =>
        of<Resultado>({ tipo: 'error', error: error instanceof ErrorPorVencer ? error : new ErrorPorVencer('renewal_unavailable') }),
      ),
    );
  }

  private mostrar(resultado: Resultado): void {
    switch (resultado.tipo) {
      case 'rango':
        this.fase.set('rangoInvalido');
        return;
      case 'error':
        if (resultado.error.codigo === 'out_of_range') {
          this.fase.set('rangoInvalido');
        } else if (resultado.error.codigo !== 'unauthorized' && resultado.error.codigo !== 'forbidden') {
          // 401 y 403 los resuelve el interceptor: la página no muestra aviso propio.
          this.fase.set('error');
        }
        return;
      case 'pagina': {
        const { pagina } = resultado;
        this.pagina.set(pagina);
        // Sin filtro en la URL, los campos muestran el rango que aplicó el backend.
        this.desde.set(this.filtro().desde ?? pagina.desde);
        this.hasta.set(this.filtro().hasta ?? pagina.hasta);
        this.fase.set(pagina.items.length > 0 ? 'lista' : 'sinResultados');
      }
    }
  }

  private navegar(criterios: CriteriosPorVencer, pagina = 1): void {
    void this.router.navigate([], { relativeTo: this.ruta, queryParams: parametrosDesdeFiltro({ ...criterios, pagina }) });
  }
}
