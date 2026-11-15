import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideCircleAlert, LucideFileText, LucideShieldCheck } from '@lucide/angular';
import { Observable, Subject, catchError, map, of, switchMap } from 'rxjs';

import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';
import { ErrorResumenSocio, RangoResumen, ResumenSocio } from '@core/api/originacion/resumen-socio.modelos';
import { SesionService } from '@core/auth/sesion.service';
import { FormatoNumeroPipe } from '@shared/pipes/formato-numero.pipe';

import {
  OPCIONES_RANGO,
  OPCION_INICIAL,
  OpcionRango,
  ProblemaRango,
  diaEnColombia,
  opcionMasAmplia,
  problemaDelRango,
  rangoDeOpcion,
} from './modelos/rango-tablero';

/** Fase del resumen: consultando, con el resumen (con o sin datos) o con una falla del servicio. */
export type FaseTablero = 'cargando' | 'listo' | 'error';

type Resultado = { tipo: 'resumen'; resumen: ResumenSocio } | { tipo: 'error'; error: ErrorResumenSocio };

/**
 * B1 · Tablero de integración · Resumen (HU-W3.2-01): el selector de rango (hoy, últimos 7 días, últimos 30 días o
 * personalizado) y las tarjetas de cotizaciones solicitadas, pólizas emitidas y tasa de conversión del socio
 * autenticado (CA-1, CA-2). Sin cotizaciones en el rango, las tarjetas muestran 0 y 0 % y el estado vacío ofrece ampliar
 * el rango, sin errores (CA-3). El socio nunca se elige aquí: el backend lo toma del token (CA-4). Un 503 muestra
 * «Reintentar»; 401 y 403 los resuelve el interceptor.
 *
 * La gráfica por día, la comparación con el periodo anterior, el desglose por producto (HU-W3.2-02) y el estado de la
 * API (HU-W3.2-03) del prototipo no son de esta historia.
 *
 * Ruta: `/socios/tablero` (solo el socio comercial).
 */
@Component({
  selector: 'app-tablero-page',
  imports: [TranslocoDirective, FormatoNumeroPipe, LucideCircleAlert, LucideFileText, LucideShieldCheck],
  templateUrl: './tablero.page.html',
  styleUrl: './tablero.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableroPage implements OnInit {
  private readonly api = inject(OriginacionApiService);
  private readonly sesion = inject(SesionService);
  private readonly transloco = inject(TranslocoService);
  private readonly destruccion = inject(DestroyRef);
  private readonly consultas = new Subject<RangoResumen>();

  protected readonly opciones = OPCIONES_RANGO;
  /** Nombre del socio en la sesión (claim `name` del token), para el subtítulo y el aviso de aislamiento. */
  protected readonly socio = computed(() => this.sesion.usuario()?.nombre ?? '');
  protected readonly opcion = signal<OpcionRango>(OPCION_INICIAL);
  protected readonly rango = signal<RangoResumen>({ desde: '', hasta: '' });
  protected readonly fase = signal<FaseTablero>('cargando');
  protected readonly resumen = signal<ResumenSocio | null>(null);

  /** El formulario del rango personalizado: visible al elegir «Personalizado». */
  protected readonly personalizadoAbierto = signal(false);
  protected readonly desde = signal('');
  protected readonly hasta = signal('');
  /** Problema del rango personalizado que se muestra; solo después de intentar aplicarlo o al corregir un campo. */
  protected readonly problema = signal<ProblemaRango | null>(null);

  protected readonly sinDatos = computed(() => this.fase() === 'listo' && (this.resumen()?.cotizaciones ?? 0) === 0);
  protected readonly masAmplia = computed(() => opcionMasAmplia(this.opcion()));

  ngOnInit(): void {
    this.consultas
      .pipe(
        switchMap((rango) => this.consultar(rango)),
        takeUntilDestroyed(this.destruccion),
      )
      .subscribe((resultado) => this.mostrar(resultado));
    this.elegir(OPCION_INICIAL);
  }

  /** Un botón del selector. «Personalizado» abre el formulario con el rango actual; las demás consultan (CA-2). */
  protected elegir(opcion: OpcionRango): void {
    if (opcion === 'personalizado') {
      this.personalizadoAbierto.set(true);
      this.desde.set(this.rango().desde);
      this.hasta.set(this.rango().hasta);
      this.problema.set(null);
      return;
    }
    this.personalizadoAbierto.set(false);
    this.problema.set(null);
    this.opcion.set(opcion);
    this.cargar(rangoDeOpcion(opcion, diaEnColombia(new Date())));
  }

  protected cambiarFecha(campo: 'desde' | 'hasta', evento: Event): void {
    (campo === 'desde' ? this.desde : this.hasta).set((evento.target as HTMLInputElement).value);
    if (this.problema()) {
      this.problema.set(problemaDelRango(this.desde(), this.hasta()));
    }
  }

  /** «Aplicar» del rango personalizado: no consulta un rango inválido (CA-2). */
  protected aplicar(evento: Event): void {
    evento.preventDefault();
    const problema = problemaDelRango(this.desde(), this.hasta());
    this.problema.set(problema);
    if (problema) {
      return;
    }
    this.opcion.set('personalizado');
    this.personalizadoAbierto.set(false);
    this.cargar({ desde: this.desde(), hasta: this.hasta() });
  }

  protected cancelarPersonalizado(): void {
    this.personalizadoAbierto.set(false);
    this.problema.set(null);
  }

  /** «Reintentar» del error del servicio. */
  protected reintentar(): void {
    this.cargar(this.rango());
  }

  /** Subtítulo del rango: «últimos 30 días (18/08 a 16/09/2026)», «hoy 16/09/2026». */
  protected descripcionRango(): string {
    const { desde, hasta } = this.rango();
    if (!desde) {
      return '';
    }
    const opcion = this.opcion();
    if (opcion === 'hoy') {
      return this.transloco.translate('socios.tablero.rango.descripcion.hoy', { dia: this.dia(hasta, true) });
    }
    return this.transloco.translate(`socios.tablero.rango.descripcion.${opcion}`, {
      desde: this.dia(desde, desde.slice(0, 4) !== hasta.slice(0, 4)),
      hasta: this.dia(hasta, true),
    });
  }

  /** «16/09/2026» (o «16/09» sin el año) de un día civil, en el orden del idioma, sin correrlo por la zona horaria. */
  private dia(dia: string, conAno: boolean): string {
    const partes = new Intl.DateTimeFormat(this.transloco.getActiveLang(), {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'UTC',
    }).formatToParts(new Date(`${dia}T00:00:00Z`));
    if (conAno) {
      return partes.map((p) => p.value).join('');
    }
    // Sin el año se quita su parte y el separador que la une, conservando el orden del idioma («16/09», «09/16»).
    // Pedirle a Intl el día y el mes solos cambia el formato del mes en algunos idiomas («16/9»).
    const ano = partes.findIndex((p) => p.type === 'year');
    const separador = ano > 0 ? ano - 1 : ano + 1;
    return partes
      .filter((_, i) => i !== ano && i !== separador)
      .map((p) => p.value)
      .join('');
  }

  private cargar(rango: RangoResumen): void {
    this.rango.set(rango);
    this.fase.set('cargando');
    this.consultas.next(rango);
  }

  private consultar(rango: RangoResumen): Observable<Resultado> {
    return this.api.consultarResumenSocio(rango).pipe(
      map((resumen): Resultado => ({ tipo: 'resumen', resumen })),
      catchError((error: unknown) =>
        of<Resultado>({
          tipo: 'error',
          error: error instanceof ErrorResumenSocio ? error : new ErrorResumenSocio('metrics_unavailable'),
        }),
      ),
    );
  }

  private mostrar(resultado: Resultado): void {
    if (resultado.tipo === 'resumen') {
      this.resumen.set(resultado.resumen);
      this.fase.set('listo');
      return;
    }
    this.fase.set('error');
  }
}
