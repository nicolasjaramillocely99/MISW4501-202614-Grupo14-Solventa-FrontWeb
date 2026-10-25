import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import {
  LucideArrowLeft,
  LucideCircle,
  LucideCircleAlert,
  LucideCircleCheck,
  LucideCircleX,
  LucideInfo,
} from '@lucide/angular';

import {
  CampoRadicacion,
  CodigoCampoRadicacion,
  ErrorRadicacion,
  MotivoPolizaNoElegible,
  OpcionesRadicacion,
} from '@core/api/siniestros/radicacion.modelos';
import { DetalleSiniestro, ErrorSiniestro } from '@core/api/siniestros/siniestro.modelos';
import { SiniestrosApiService } from '@core/api/siniestros/siniestros-api.service';
import { FormatoFechaPipe } from '@shared/pipes/formato-fecha.pipe';

import { Traductor, nombreRamo, nombreSoporte, nombreTipo } from '../modelos/catalogo-siniestros';
import { ConfirmacionRadicacionComponent } from './componentes/confirmacion-radicacion/confirmacion-radicacion.component';
import {
  AgregarArchivos,
  QuitarArchivo,
  SoportesRadicacionComponent,
} from './componentes/soportes-radicacion/soportes-radicacion.component';
import {
  CampoFormulario,
  DESCRIPCION_MAX,
  FORMULARIO_VACIO,
  Faltante,
  FormularioRadicacion,
  LUGAR_MAX,
  ProblemaCampo,
  ProblemaSoporte,
  aIsoDesdeLocal,
  aSolicitud,
  dentroDeVigencia,
  faltantes,
  limitesFechaHecho,
  requisitosDelTipo,
  soportesNoAplica,
} from './modelos/formulario-radicacion';
import { CargaSoportesService } from './servicios/carga-soportes.service';

type Fase = 'cargando' | 'sin-polizas' | 'formulario' | 'enviando' | 'confirmacion' | 'error';
type MotivoError = 'opciones' | 'caso' | 'casoNoEncontrado';

/** Por qué no se radicó: el formulario se conserva intacto y el aviso dice qué hacer. */
type ErrorEnvio =
  | { tipo: 'validacion' }
  | { tipo: 'noElegible'; motivo: MotivoPolizaNoElegible | null; desde: string | null; hasta: string | null }
  | { tipo: 'claveReusada' }
  | { tipo: 'indisponible' }
  | { tipo: 'invalido' };

/** Estado de una comprobación de «Antes de radicar». */
type Comprobacion = 'ok' | 'error' | 'pendiente';

/** Campo del contrato → campo del formulario. */
const CAMPO_FORMULARIO: Readonly<Record<Exclude<CampoRadicacion, 'soportes'>, CampoFormulario>> = {
  polizaId: 'polizaId',
  tipoSiniestro: 'tipoSiniestro',
  ocurridoEn: 'ocurridoEn',
  lugar: 'lugar',
  descripcion: 'descripcion',
};

/** Código de campo del `422 validation_failed` → problema que se muestra en el soporte. */
const PROBLEMA_SOPORTE: Readonly<Partial<Record<CodigoCampoRadicacion, ProblemaSoporte>>> = {
  missing: 'falta',
  required: 'falta',
  too_few: 'pocos',
  too_many: 'muchos',
  invalid_format: 'formato',
  not_applicable: 'noAplica',
  not_found: 'noEncontrado',
};

/** Motivo de `policy_not_eligible` → clave bajo `siniestros.radicacion.envio.noElegible`. */
const CLAVE_NO_ELEGIBLE: Readonly<Record<MotivoPolizaNoElegible, string>> = {
  policy_not_found: 'noEncontrada',
  policy_not_active: 'noActiva',
  incident_not_covered: 'noCubierto',
  occurred_outside_validity: 'fueraVigencia',
};

/**
 * A6 / A6b · Radicar un siniestro con soportes (HU-W2.1-01). Ruta `/siniestros/radicar`, rol asegurado.
 *
 * - El formulario se arma con `GET /v1/claims/filing-options`: solo las pólizas activas propias, los tipos que cubre
 *   cada una y los soportes de cada tipo (CA-1). Con la lista vacía se muestra el estado «sin pólizas».
 * - «Radicar siniestro» se habilita solo cuando no falta nada, y el aviso lateral dice exactamente qué falta (CA-2);
 *   «Antes de radicar» comprueba la póliza y la vigencia (CA-3). El `422` del backend se muestra campo a campo.
 * - Cada soporte se sube en cuanto se elige (`CargaSoportesService`); un rechazo no toca el resto (CA-5).
 * - La `Idempotency-Key` se genera una vez por formulario y se reutiliza en cada reintento (S1).
 * - Al radicar, la página pasa a la confirmación A6b y escribe `?caso=<claim_id>`; al recargar, la confirmación se
 *   vuelve a leer con `GET /v1/claims/{id}` (F3). Sin «Guardar borrador» (F2).
 */
@Component({
  selector: 'app-radicacion-siniestro-page',
  imports: [
    RouterLink,
    TranslocoDirective,
    FormatoFechaPipe,
    SoportesRadicacionComponent,
    ConfirmacionRadicacionComponent,
    LucideArrowLeft,
    LucideCircle,
    LucideCircleAlert,
    LucideCircleCheck,
    LucideCircleX,
    LucideInfo,
  ],
  providers: [CargaSoportesService],
  templateUrl: './radicacion-siniestro.page.html',
  styleUrl: './radicacion-siniestro.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RadicacionSiniestroPage implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(SiniestrosApiService);
  private readonly transloco = inject(TranslocoService);
  private readonly destruccion = inject(DestroyRef);
  protected readonly carga = inject(CargaSoportesService);

  /** Se genera una vez por formulario y se reutiliza en cada reintento (S1). */
  private claveIdempotencia = crypto.randomUUID();

  protected readonly fase = signal<Fase>('cargando');
  protected readonly motivoError = signal<MotivoError>('opciones');
  protected readonly opciones = signal<OpcionesRadicacion | null>(null);
  protected readonly formulario = signal<FormularioRadicacion>(FORMULARIO_VACIO);
  protected readonly tocados = signal<ReadonlySet<CampoFormulario>>(new Set());
  /** Se actualiza con cada cambio: la fecha del hecho se valida contra «ahora». */
  protected readonly ahora = signal(new Date());
  protected readonly erroresCampoServidor = signal<Partial<Record<CampoFormulario, ProblemaCampo>>>({});
  protected readonly erroresSoporteServidor = signal<Readonly<Record<string, ProblemaSoporte>>>({});
  protected readonly errorEnvio = signal<ErrorEnvio | null>(null);
  protected readonly caso = signal<DetalleSiniestro | null>(null);
  protected readonly descargando = signal(false);
  protected readonly errorDescarga = signal(false);

  protected readonly lugarMax = LUGAR_MAX;
  protected readonly descripcionMax = DESCRIPCION_MAX;

  protected readonly polizas = computed(() => this.opciones()?.polizas ?? []);
  protected readonly poliza = computed(
    () => this.polizas().find((poliza) => poliza.id === this.formulario().polizaId) ?? null,
  );
  protected readonly requisitos = computed(() => requisitosDelTipo(this.poliza(), this.formulario().tipoSiniestro));
  protected readonly noAplica = computed(() => soportesNoAplica(this.poliza(), this.formulario().tipoSiniestro));
  protected readonly limites = computed(() => limitesFechaHecho(this.ahora(), this.poliza()));
  protected readonly faltantes = computed(() =>
    faltantes(this.formulario(), this.poliza(), this.carga.adjuntos(), this.ahora()),
  );
  protected readonly soportesFaltantes = computed(() =>
    this.faltantes().filter((faltante) => faltante.tipo === 'soporte'),
  );
  /** El aviso de lo que falta aparece cuando el asegurado ya eligió el tipo o tocó algún campo. */
  protected readonly mostrarFaltantes = computed(
    () => this.faltantes().length > 0 && (this.formulario().tipoSiniestro !== '' || this.tocados().size > 0),
  );
  protected readonly puedeRadicar = computed(
    () => this.fase() === 'formulario' && this.faltantes().length === 0 && !this.carga.subiendo(),
  );

  protected readonly comprobacionPoliza = computed<Comprobacion>(() =>
    this.poliza() && this.requisitos().length > 0 ? 'ok' : 'pendiente',
  );
  protected readonly comprobacionVigencia = computed<Comprobacion>(() => {
    const poliza = this.poliza();
    const hecho = aIsoDesdeLocal(this.formulario().ocurridoEn);
    if (!poliza || !hecho) {
      return 'pendiente';
    }
    return dentroDeVigencia(hecho, poliza) ? 'ok' : 'error';
  });

  ngOnInit(): void {
    const casoId = this.ruta.snapshot.queryParamMap.get('caso');
    if (casoId) {
      this.cargarCaso(casoId);
    } else {
      this.cargarOpciones();
    }
  }

  protected cargarOpciones(): void {
    this.fase.set('cargando');
    this.api
      .consultarOpcionesRadicacion()
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (opciones) => {
          this.opciones.set(opciones);
          // Si la póliza elegida ya no está (venció o dejó de ser radicable), se vuelve a elegir.
          if (!opciones.polizas.some((poliza) => poliza.id === this.formulario().polizaId)) {
            this.formulario.update((actual) => ({ ...actual, polizaId: '', tipoSiniestro: '' }));
          }
          this.errorEnvio.set(null);
          this.fase.set(opciones.polizas.length > 0 ? 'formulario' : 'sin-polizas');
        },
        error: () => {
          this.motivoError.set('opciones');
          this.fase.set('error');
        },
      });
  }

  private cargarCaso(id: string): void {
    this.fase.set('cargando');
    this.api
      .consultarSiniestro(id)
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (caso) => {
          this.caso.set(caso);
          this.fase.set('confirmacion');
        },
        error: (error: unknown) => {
          this.motivoError.set(
            error instanceof ErrorSiniestro && error.codigo === 'claim_not_found' ? 'casoNoEncontrado' : 'caso',
          );
          this.fase.set('error');
        },
      });
  }

  protected reintentarCarga(): void {
    const casoId = this.ruta.snapshot.queryParamMap.get('caso');
    if (this.motivoError() === 'caso' && casoId) {
      this.cargarCaso(casoId);
    } else {
      this.cargarOpciones();
    }
  }

  /** Formulario nuevo: sin `?caso=`, con otra clave y sin archivos. */
  protected nuevaRadicacion(): void {
    this.caso.set(null);
    this.reiniciarFormulario();
    void this.router.navigate([], { relativeTo: this.ruta, queryParams: { caso: null }, replaceUrl: true });
    this.cargarOpciones();
  }

  protected actualizar(campo: CampoFormulario, valor: string): void {
    this.formulario.update((actual) => ({
      ...actual,
      [campo]: valor,
      // Otra póliza tiene otros tipos: el tipo se vuelve a elegir.
      ...(campo === 'polizaId' ? { tipoSiniestro: '' } : {}),
    }));
    this.ahora.set(new Date());
    this.erroresCampoServidor.update((errores) => ({ ...errores, [campo]: undefined }));
    if (this.errorEnvio()?.tipo !== 'indisponible') {
      this.errorEnvio.set(null);
    }
  }

  protected tocar(campo: CampoFormulario): void {
    this.tocados.update((actual) => new Set(actual).add(campo));
  }

  /** Error que se muestra bajo el campo: el del backend o, si ya se tocó, el de la validación local. */
  protected errorCampo(campo: CampoFormulario): ProblemaCampo | null {
    const servidor = this.erroresCampoServidor()[campo];
    if (servidor) {
      return servidor;
    }
    if (!this.tocados().has(campo)) {
      return null;
    }
    const faltante = this.faltantes().find((f) => f.tipo === 'campo' && f.campo === campo);
    return faltante?.tipo === 'campo' ? faltante.problema : null;
  }

  protected agregarArchivos({ requisito, archivos }: AgregarArchivos): void {
    this.carga.agregar(requisito, archivos);
    this.limpiarErrorSoporte(requisito.codigo);
  }

  protected quitarArchivo({ codigo, clave }: QuitarArchivo): void {
    this.carga.quitar(codigo, clave);
    this.limpiarErrorSoporte(codigo);
  }

  /** «Radicar siniestro». También es el reintento: usa la misma `Idempotency-Key`. */
  protected radicar(): void {
    this.ahora.set(new Date());
    if (!this.puedeRadicar()) {
      this.tocados.set(new Set<CampoFormulario>(['polizaId', 'tipoSiniestro', 'ocurridoEn', 'lugar', 'descripcion']));
      return;
    }
    this.fase.set('enviando');
    this.errorEnvio.set(null);
    this.api
      .radicar(aSolicitud(this.formulario(), this.poliza(), this.carga.soporteIds()), this.claveIdempotencia)
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (caso) => this.mostrarConfirmacion(caso),
        error: (error: unknown) => this.manejarErrorEnvio(error),
      });
  }

  /** Ante `idempotency_key_reused`: el asegurado decide radicar otro caso, con una clave nueva. */
  protected radicarComoNuevo(): void {
    this.claveIdempotencia = crypto.randomUUID();
    this.radicar();
  }

  /** Descarga el PDF del radicado; el JWT lo adjunta el interceptor, por eso no es un enlace directo. */
  protected descargar(): void {
    const caso = this.caso();
    if (!caso || this.descargando()) {
      return;
    }
    this.descargando.set(true);
    this.errorDescarga.set(false);
    this.api
      .descargarRadicado(caso.id)
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (pdf) => {
          const url = URL.createObjectURL(pdf);
          const enlace = document.createElement('a');
          enlace.href = url;
          enlace.download = `radicado-${caso.numeroRadicado}.pdf`;
          enlace.click();
          URL.revokeObjectURL(url);
          this.descargando.set(false);
        },
        error: () => {
          this.descargando.set(false);
          this.errorDescarga.set(true);
        },
      });
  }

  private mostrarConfirmacion(caso: DetalleSiniestro): void {
    this.caso.set(caso);
    this.reiniciarFormulario();
    this.fase.set('confirmacion');
    void this.router.navigate([], { relativeTo: this.ruta, queryParams: { caso: caso.id }, replaceUrl: true });
  }

  private reiniciarFormulario(): void {
    this.formulario.set(FORMULARIO_VACIO);
    this.tocados.set(new Set());
    this.erroresCampoServidor.set({});
    this.erroresSoporteServidor.set({});
    this.errorEnvio.set(null);
    this.carga.reiniciar();
    this.claveIdempotencia = crypto.randomUUID();
  }

  private manejarErrorEnvio(error: unknown): void {
    this.fase.set('formulario');
    const radicacion = error instanceof ErrorRadicacion ? error : new ErrorRadicacion('filing_unavailable');
    switch (radicacion.codigo) {
      case 'validation_failed':
        this.aplicarErroresValidacion(radicacion);
        this.errorEnvio.set({ tipo: 'validacion' });
        return;
      case 'policy_not_eligible':
        this.errorEnvio.set({
          tipo: 'noElegible',
          motivo: radicacion.motivo,
          desde: radicacion.vigenteDesde,
          hasta: radicacion.vigenteHasta,
        });
        return;
      case 'idempotency_key_reused':
        this.errorEnvio.set({ tipo: 'claveReusada' });
        return;
      case 'invalid_request':
        this.errorEnvio.set({ tipo: 'invalido' });
        return;
      default:
        // No se sabe si se creó el caso: el reintento va con la misma clave (S1).
        this.errorEnvio.set({ tipo: 'indisponible' });
    }
  }

  private aplicarErroresValidacion(error: ErrorRadicacion): void {
    const campos: Partial<Record<CampoFormulario, ProblemaCampo>> = {};
    const soportes: Record<string, ProblemaSoporte> = {};
    for (const { campo, codigo, requisito } of error.campos) {
      if (campo === 'soportes') {
        const problema = PROBLEMA_SOPORTE[codigo];
        if (requisito && problema) {
          soportes[requisito] = problema;
        }
        continue;
      }
      campos[CAMPO_FORMULARIO[campo]] = this.problemaDelServidor(CAMPO_FORMULARIO[campo], codigo);
    }
    this.erroresCampoServidor.set(campos);
    this.erroresSoporteServidor.set(soportes);
  }

  private problemaDelServidor(campo: CampoFormulario, codigo: CodigoCampoRadicacion): ProblemaCampo {
    if (codigo === 'required' || codigo === 'missing') {
      return 'requerido';
    }
    if (codigo === 'out_of_range') {
      return campo === 'lugar'
        ? 'lugarLongitud'
        : campo === 'descripcion'
          ? 'descripcionLongitud'
          : campo === 'ocurridoEn'
            ? 'fechaFueraRango'
            : 'formatoInvalido';
    }
    return 'formatoInvalido';
  }

  private limpiarErrorSoporte(codigo: string): void {
    this.erroresSoporteServidor.update((errores) => {
      const resto = { ...errores };
      delete resto[codigo];
      return resto;
    });
  }

  // --- Textos que dependen del catálogo (F4) ---

  protected etiquetaPoliza(t: Traductor, id: string): string {
    const poliza = this.polizas().find((candidata) => candidata.id === id);
    if (!poliza) {
      return id;
    }
    return [nombreRamo(t, poliza.ramo, poliza.producto), poliza.id, poliza.objetoAsegurado].filter(Boolean).join(' · ');
  }

  protected etiquetaTipo(t: Traductor, codigo: string, respaldo: string): string {
    return nombreTipo(t, codigo, respaldo);
  }

  /** Título del aviso: «Falta 1 soporte obligatorio», «Faltan 2 soportes obligatorios» o «Faltan datos del siniestro». */
  protected tituloFaltantes(t: Traductor): string {
    const soportes = this.soportesFaltantes().length;
    if (soportes === 0) {
      return t('radicacion.faltantes.tituloDatos');
    }
    return t(soportes === 1 ? 'radicacion.faltantes.tituloSoporte' : 'radicacion.faltantes.tituloSoportes', {
      cantidad: soportes,
    });
  }

  /** «No es posible radicar hasta completar: Informe de tránsito o croquis, Lugar del hecho.» */
  protected textoFaltantes(t: Traductor): string {
    const nombres = this.faltantes().map((faltante: Faltante) => {
      switch (faltante.tipo) {
        case 'campo':
          return t(`radicacion.campos.${faltante.campo}.etiqueta`);
        case 'soporte':
          return nombreSoporte(t, faltante.requisito.codigo, faltante.requisito.etiqueta);
        default:
          return t('radicacion.faltantes.total');
      }
    });
    return t('radicacion.faltantes.texto', { lista: nombres.join(', ') });
  }

  protected claveNoElegible(motivo: MotivoPolizaNoElegible | null): string {
    return motivo ? CLAVE_NO_ELEGIBLE[motivo] : 'generico';
  }

  /** «1.000» / «1,000» en el idioma activo. */
  protected numero(valor: number): string {
    return new Intl.NumberFormat(this.transloco.getActiveLang()).format(valor);
  }
}
