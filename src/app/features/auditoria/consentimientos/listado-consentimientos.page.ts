import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideCircleAlert } from '@lucide/angular';
import { Observable, Subject, catchError, combineLatest, map, of, startWith, switchMap } from 'rxjs';

import { AuditoriaApiService } from '@core/api/auditoria/auditoria-api.service';
import { ErrorListado, FiltroConsentimientos, PaginaConsentimientos } from '@core/api/auditoria/listado-consentimientos.modelos';

import { FiltrosConsentimientosComponent } from './componentes/filtros-consentimientos/filtros-consentimientos.component';
import { IndicadoresConsentimientosComponent } from './componentes/indicadores-consentimientos/indicadores-consentimientos.component';
import { TablaConsentimientosComponent } from './componentes/tabla-consentimientos/tabla-consentimientos.component';
import {
  CriteriosListado,
  SIN_CRITERIOS,
  describirFiltro,
  filtroDesdeParametros,
  parametrosDesdeFiltro,
  rangoValido,
} from './modelos/filtro-listado';
import { UltimoListadoService } from './servicios/ultimo-listado.service';

/** Fase del listado: consultando, con filas, sin resultados, con una falla del servicio o con un rango de fechas inválido. */
export type FaseListado = 'cargando' | 'lista' | 'sinResultados' | 'error' | 'rangoInvalido';

type Resultado = { tipo: 'pagina'; pagina: PaginaConsentimientos } | { tipo: 'error'; error: ErrorListado } | { tipo: 'rango' };

/**
 * O14 / O14b · Consentimientos Open Finance (HU-W4.2-01): cuatro indicadores, filtros por estado, días de otorgamiento,
 * entidad y cliente, la tabla paginada de 6 filas y el estado «sin resultados». La URL es la fuente del filtro
 * (`?estado=&desde=&hasta=&entidad=&cliente=&pagina=`): cambiar un filtro vuelve a la página 1, paginar conserva el
 * filtro y recargar o volver del detalle lo mantiene (CA-2). El estado de cada fila es el del servidor en el momento de la
 * consulta (CA-5). Un 503 muestra «Reintentar»; 401 y 403 los resuelve el interceptor.
 *
 * Ruta: `/auditoria/consentimientos` (solo operaciones, CA-6).
 */
@Component({
  selector: 'app-listado-consentimientos-page',
  imports: [
    TranslocoDirective,
    FiltrosConsentimientosComponent,
    IndicadoresConsentimientosComponent,
    TablaConsentimientosComponent,
    LucideCircleAlert,
  ],
  templateUrl: './listado-consentimientos.page.html',
  styleUrl: './listado-consentimientos.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListadoConsentimientosPage implements OnInit {
  private readonly api = inject(AuditoriaApiService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly ultimo = inject(UltimoListadoService);
  private readonly destruccion = inject(DestroyRef);
  private readonly recargas = new Subject<void>();

  protected readonly fase = signal<FaseListado>('cargando');
  protected readonly filtro = signal<FiltroConsentimientos>(filtroDesdeParametros({}));
  /** La última página recibida: los indicadores y las entidades siguen a la vista mientras se consulta otra. */
  protected readonly pagina = signal<PaginaConsentimientos | null>(null);

  protected readonly criterios = computed<CriteriosListado>(() => {
    const { estado, desde, hasta, entidad, cliente } = this.filtro();
    return { estado, desde, hasta, entidad, cliente };
  });
  protected readonly descripcion = computed(() => describirFiltro(this.criterios(), this.pagina()?.entidades ?? []));

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

  protected cambiarCriterios(criterios: CriteriosListado): void {
    this.navegar(parametrosDesdeFiltro({ ...criterios, pagina: 1 }));
  }

  protected irA(pagina: number): void {
    this.navegar(parametrosDesdeFiltro({ ...this.criterios(), pagina }));
  }

  protected limpiar(): void {
    this.navegar(parametrosDesdeFiltro({ ...SIN_CRITERIOS, pagina: 1 }));
  }

  private consultar(params: Params): Observable<Resultado> {
    const filtro = filtroDesdeParametros(params);
    this.filtro.set(filtro);
    this.ultimo.guardar(parametrosDesdeFiltro(filtro));
    if (!rangoValido(filtro)) {
      return of({ tipo: 'rango' });
    }
    this.fase.set('cargando');
    return this.api.listarConsentimientos(filtro).pipe(
      map((pagina): Resultado => ({ tipo: 'pagina', pagina })),
      catchError((error: unknown) =>
        of<Resultado>({ tipo: 'error', error: error instanceof ErrorListado ? error : new ErrorListado('service_unavailable') }),
      ),
    );
  }

  private mostrar(resultado: Resultado): void {
    switch (resultado.tipo) {
      case 'rango':
        this.fase.set('rangoInvalido');
        return;
      case 'error':
        // 401 y 403 los resuelve el interceptor: la página no muestra aviso propio.
        if (resultado.error.codigo !== 'unauthorized' && resultado.error.codigo !== 'forbidden') {
          this.fase.set('error');
        }
        return;
      case 'pagina':
        this.pagina.set(resultado.pagina);
        this.fase.set(resultado.pagina.items.length > 0 ? 'lista' : 'sinResultados');
    }
  }

  private navegar(queryParams: Params): void {
    void this.router.navigate([], { relativeTo: this.ruta, queryParams });
  }
}
