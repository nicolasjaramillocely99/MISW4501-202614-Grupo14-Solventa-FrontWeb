import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideChevronLeft, LucideChevronRight, LucideCircleAlert, LucideFileText } from '@lucide/angular';
import { Observable, Subject, catchError, combineLatest, map, of, startWith, switchMap } from 'rxjs';

import {
  ESTADOS_FILTRO_ENDOSO,
  ErrorEndoso,
  EstadoEndoso,
  EstadoFiltroEndoso,
  FilaEndoso,
  FiltroEndosos,
  PaginaEndosos,
} from '@core/api/originacion/endosos.modelos';
import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';
import { TIPOS_CAMBIO, TipoCambio } from '@core/api/originacion/solicitud-modificacion.modelos';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';
import { FormatoNumeroPipe } from '@shared/pipes/formato-numero.pipe';
import { InsigniaEstadoComponent, TonoInsignia } from '@shared/ui/insignia-estado/insignia-estado.component';

import { CriteriosEndosos, filtroEndososDesdeParametros, parametrosDesdeFiltroEndosos } from './modelos/filtro-endosos';
import { totalPaginas } from '../renovaciones/modelos/filtro-por-vencer';

/** Fase de la bandeja: consultando, con filas, vacía (sin filtros), sin resultados (con filtros) o con una falla. */
export type FaseBandejaEndosos = 'cargando' | 'lista' | 'vacia' | 'sinResultados' | 'error';

type Resultado = { tipo: 'pagina'; pagina: PaginaEndosos } | { tipo: 'error'; error: ErrorEndoso };

/** El texto siempre acompaña al color de la insignia. */
export const TONO_ENDOSO: Readonly<Record<EstadoEndoso, TonoInsignia>> = {
  radicada: 'informacion',
  enRevision: 'informacion',
  aplicada: 'exito',
  rechazada: 'error',
  noAplicado: 'error',
  desconocido: 'neutro',
};

const SOLO_DIGITOS = /^\d+$/;

/**
 * O2 · Endosos (HU-W1.4-02, frame `34:3012`): la bandeja del analista de operaciones. Tres indicadores (pendientes y las
 * que llevan más de 24 h; aplicadas hoy y su tiempo medio; rechazadas o no aplicadas en 7 días y el motivo más frecuente),
 * los filtros «Tipo de cambio», «Estado» (pendientes por defecto) y «Radicada desde», el conteo, la tabla y la paginación.
 * La URL es la fuente del filtro (`?tipo=&estado=&desde=&pagina=`). *Revisar* toma la solicitud radicada (pasa a «En
 * revisión») y abre el detalle; *Continuar* abre una en revisión o una no aplicada sin devolver; *Ver*, el resto. Sin
 * «Exportar» (decisión D-11). Un 503 muestra «Reintentar»; 401 y 403 los resuelve el interceptor.
 *
 * Ruta: `/originacion/endosos` (solo operaciones).
 */
@Component({
  selector: 'app-bandeja-endosos-page',
  imports: [
    RouterLink,
    TranslocoDirective,
    InsigniaEstadoComponent,
    FormatoFechaHoraPipe,
    FormatoNumeroPipe,
    LucideChevronLeft,
    LucideChevronRight,
    LucideCircleAlert,
    LucideFileText,
  ],
  templateUrl: './bandeja-endosos.page.html',
  styleUrl: './bandeja-endosos.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BandejaEndososPage implements OnInit {
  private readonly api = inject(OriginacionApiService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly destruccion = inject(DestroyRef);
  private readonly recargas = new Subject<void>();

  protected readonly tipos = TIPOS_CAMBIO;
  protected readonly estados = ESTADOS_FILTRO_ENDOSO;
  protected readonly fase = signal<FaseBandejaEndosos>('cargando');
  protected readonly filtro = signal<FiltroEndosos>(filtroEndososDesdeParametros({}));
  /** La última página recibida: los indicadores siguen a la vista mientras se consulta otra. */
  protected readonly pagina = signal<PaginaEndosos | null>(null);
  /** La solicitud que no se pudo tomar con «Revisar». */
  protected readonly errorRevisar = signal<string | null>(null);
  protected readonly tomando = signal<string | null>(null);

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

  protected reintentar(): void {
    this.recargas.next();
  }

  protected cambiarTipo(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    const tipo = (TIPOS_CAMBIO as readonly string[]).includes(valor) ? (valor as TipoCambio) : null;
    this.navegar({ ...this.criterios(), tipo });
  }

  protected cambiarEstado(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    const estado = (ESTADOS_FILTRO_ENDOSO as readonly string[]).includes(valor) ? (valor as EstadoFiltroEndoso) : 'pending';
    this.navegar({ ...this.criterios(), estado });
  }

  protected cambiarDesde(evento: Event): void {
    const valor = (evento.target as HTMLInputElement).value;
    this.navegar({ ...this.criterios(), desde: valor || null });
  }

  protected irA(pagina: number): void {
    this.navegar(this.criterios(), pagina);
  }

  protected limpiar(): void {
    this.navegar({ tipo: null, estado: 'pending', desde: null });
  }

  /** «Revisar»: toma la solicitud radicada y abre su detalle. */
  protected revisar(fila: FilaEndoso): void {
    this.errorRevisar.set(null);
    this.tomando.set(fila.solicitudId);
    this.api.iniciarRevisionEndoso(fila.solicitudId).subscribe({
      next: () => {
        this.tomando.set(null);
        void this.router.navigate(['/originacion/endosos', fila.solicitudId]);
      },
      error: (error: unknown) => {
        this.tomando.set(null);
        const codigo = error instanceof ErrorEndoso ? error.codigo : 'endorsement_unavailable';
        if (codigo !== 'unauthorized' && codigo !== 'forbidden') {
          this.errorRevisar.set(fila.solicitudId);
        }
      },
    });
  }

  /** La acción de la fila, como el frame: *Revisar* una radicada, *Continuar* lo que espera al analista, *Ver* lo decidido. */
  protected accion(fila: FilaEndoso): 'revisar' | 'continuar' | 'ver' {
    if (fila.estado === 'radicada') {
      return 'revisar';
    }
    return fila.estado === 'enRevision' || (fila.estado === 'noAplicado' && !fila.devuelta) ? 'continuar' : 'ver';
  }

  protected tono(fila: FilaEndoso): TonoInsignia {
    return TONO_ENDOSO[fila.estado];
  }

  /** «1.020.345.678»: el documento del titular con separadores de miles (la póliza no guarda su tipo). */
  protected documento(fila: FilaEndoso): string {
    const doc = fila.titular.documento;
    return SOLO_DIGITOS.test(doc)
      ? new Intl.NumberFormat(this.transloco.getActiveLang(), { useGrouping: true }).format(Number(doc))
      : doc;
  }

  /** «3 h 20 min» o «45 min». */
  protected tiempoMedio(segundos: number): string {
    const minutos = Math.round(segundos / 60);
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    const P = 'originacion.endosos.bandeja.indicadores';
    return h > 0 ? this.transloco.translate(`${P}.horasMinutos`, { h, m }) : this.transloco.translate(`${P}.minutos`, { m });
  }

  /** El motivo más frecuente: la validación que más falló o el rechazo del analista. */
  protected motivo(codigo: string): string {
    const clave = `originacion.endosos.bandeja.motivos.${codigo}`;
    const texto = this.transloco.translate(clave);
    return texto === clave ? this.transloco.translate('originacion.endosos.bandeja.motivos.otro') : texto;
  }

  private criterios(): CriteriosEndosos {
    const { tipo, estado, desde } = this.filtro();
    return { tipo, estado, desde };
  }

  private consultar(params: Params): Observable<Resultado> {
    const filtro = filtroEndososDesdeParametros(params);
    this.filtro.set(filtro);
    this.fase.set('cargando');
    return this.api.listarSolicitudesEndoso(filtro).pipe(
      map((pagina): Resultado => ({ tipo: 'pagina', pagina })),
      catchError((error: unknown) =>
        of<Resultado>({ tipo: 'error', error: error instanceof ErrorEndoso ? error : new ErrorEndoso('endorsement_unavailable') }),
      ),
    );
  }

  private mostrar(resultado: Resultado): void {
    if (resultado.tipo === 'error') {
      // 401 y 403 los resuelve el interceptor: la página no muestra aviso propio.
      if (resultado.error.codigo !== 'unauthorized' && resultado.error.codigo !== 'forbidden') {
        this.fase.set('error');
      }
      return;
    }
    const { pagina } = resultado;
    this.pagina.set(pagina);
    if (pagina.items.length > 0) {
      this.fase.set('lista');
      return;
    }
    const { tipo, estado, desde } = this.filtro();
    this.fase.set(!tipo && estado === 'pending' && !desde ? 'vacia' : 'sinResultados');
  }

  private navegar(criterios: CriteriosEndosos, pagina = 1): void {
    void this.router.navigate([], { relativeTo: this.ruta, queryParams: parametrosDesdeFiltroEndosos({ ...criterios, pagina }) });
  }
}
