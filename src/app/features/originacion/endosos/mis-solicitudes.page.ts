import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideChevronLeft, LucideChevronRight, LucideCircleAlert, LucideFileText, LucidePlus, LucideSearch } from '@lucide/angular';
import { Observable, Subject, catchError, combineLatest, map, of, startWith, switchMap } from 'rxjs';

import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';
import {
  ESTADOS_FILTRO_SOLICITUD,
  ErrorSolicitudModificacion,
  EstadoFiltroSolicitud,
  FiltroSolicitudes,
  PaginaSolicitudes,
} from '@core/api/originacion/solicitud-modificacion.modelos';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';

import { EstadoSolicitudComponent } from './componentes/estado-solicitud/estado-solicitud.component';
import { fechaCorta } from './modelos/fecha-corta';
import {
  CriteriosSolicitudes,
  ESTADO_VISIBLE,
  conCriterios,
  esDia,
  filtroDesdeParametros,
  parametrosDesdeFiltro,
} from './modelos/filtro-solicitudes';

/** Fase de A11: consultando, con filas, sin ninguna solicitud, sin resultados para el filtro o con una falla. */
export type FaseMisSolicitudes = 'cargando' | 'lista' | 'vacia' | 'sinResultados' | 'error';

type Resultado = { tipo: 'pagina'; pagina: PaginaSolicitudes } | { tipo: 'error'; error: ErrorSolicitudModificacion };

/**
 * A11 · Mis solicitudes (HU-W1.4-01, frame `291:6869`, con sus estados vacío y con error): los tres indicadores (en
 * revisión, aplicadas este año y rechazadas, sin los filtros), los filtros Estado, Póliza y Desde en la URL, el conteo, la
 * tabla (solicitud, póliza y tipo, radicada, estado, último cambio con el motivo y «Ver detalle») y la paginación. El
 * estado es el que ve el asegurado (ajuste A-1). «Nueva solicitud» lleva a «Mis pólizas», donde se elige la póliza (D-12).
 * Las pólizas del núcleo (Autos, Hogar) no tienen solicitudes (D-2). 401 y 403 los resuelve el interceptor.
 *
 * Ruta: `/originacion/solicitudes` (solo el asegurado).
 */
@Component({
  selector: 'app-mis-solicitudes-page',
  imports: [
    RouterLink,
    TranslocoDirective,
    FormatoFechaHoraPipe,
    EstadoSolicitudComponent,
    LucideChevronLeft,
    LucideChevronRight,
    LucideCircleAlert,
    LucideFileText,
    LucidePlus,
    LucideSearch,
  ],
  templateUrl: './mis-solicitudes.page.html',
  styleUrl: './mis-solicitudes.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MisSolicitudesPage implements OnInit {
  private readonly api = inject(OriginacionApiService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destruccion = inject(DestroyRef);
  private readonly transloco = inject(TranslocoService);
  private readonly recargas = new Subject<void>();

  protected readonly estados = ESTADOS_FILTRO_SOLICITUD;
  protected readonly estadoVisible = ESTADO_VISIBLE;
  protected readonly fase = signal<FaseMisSolicitudes>('cargando');
  protected readonly filtro = signal<FiltroSolicitudes>(filtroDesdeParametros({}));
  /** La última página recibida: los indicadores siguen a la vista mientras se consulta otra. */
  protected readonly pagina = signal<PaginaSolicitudes | null>(null);
  /** Con la lista caída, los tres indicadores siguen a la vista con «— · No disponible». */
  protected readonly indicadoresSinDatos = ['abiertas', 'aplicadas', 'rechazadas'] as const;

  ngOnInit(): void {
    combineLatest([this.ruta.queryParams, this.recargas.pipe(startWith(undefined))])
      .pipe(
        map(([params]) => params),
        switchMap((params) => this.consultar(params)),
        takeUntilDestroyed(this.destruccion),
      )
      .subscribe((resultado) => this.mostrar(resultado));
  }

  /** «16/09/2026»: la fecha corta del frame. */
  protected fechaCorta(iso: string): string {
    return fechaCorta(iso, this.transloco.getActiveLang());
  }

  protected reintentar(): void {
    this.recargas.next();
  }

  protected cambiarEstado(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    const estado = (ESTADOS_FILTRO_SOLICITUD as readonly string[]).includes(valor) ? (valor as EstadoFiltroSolicitud) : null;
    this.navegar({ ...this.criterios(), estado });
  }

  protected cambiarPoliza(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    this.navegar({ ...this.criterios(), polizaId: valor || null });
  }

  protected cambiarDesde(evento: Event): void {
    const valor = (evento.target as HTMLInputElement).value;
    this.navegar({ ...this.criterios(), desde: esDia(valor) ? valor : null });
  }

  protected irA(pagina: number): void {
    this.navegar(this.criterios(), pagina);
  }

  protected limpiar(): void {
    this.navegar({ estado: null, polizaId: null, desde: null });
  }

  private criterios(): CriteriosSolicitudes {
    const { estado, polizaId, desde } = this.filtro();
    return { estado, polizaId, desde };
  }

  private consultar(params: Params): Observable<Resultado> {
    const filtro = filtroDesdeParametros(params);
    this.filtro.set(filtro);
    this.fase.set('cargando');
    return this.api.listarMisSolicitudes(filtro).pipe(
      map((pagina): Resultado => ({ tipo: 'pagina', pagina })),
      catchError((error: unknown) =>
        of<Resultado>({
          tipo: 'error',
          error: error instanceof ErrorSolicitudModificacion ? error : new ErrorSolicitudModificacion('change_request_unavailable'),
        }),
      ),
    );
  }

  private mostrar(resultado: Resultado): void {
    if (resultado.tipo === 'error') {
      if (resultado.error.codigo !== 'unauthorized' && resultado.error.codigo !== 'forbidden') {
        this.fase.set('error');
      }
      return;
    }
    const { pagina } = resultado;
    this.pagina.set(pagina);
    if (pagina.items.length > 0) {
      this.fase.set('lista');
    } else {
      this.fase.set(conCriterios(this.filtro()) || pagina.pagina > 1 ? 'sinResultados' : 'vacia');
    }
  }

  private navegar(criterios: CriteriosSolicitudes, pagina = 1): void {
    void this.router.navigate([], { relativeTo: this.ruta, queryParams: parametrosDesdeFiltro({ ...criterios, pagina }) });
  }
}
