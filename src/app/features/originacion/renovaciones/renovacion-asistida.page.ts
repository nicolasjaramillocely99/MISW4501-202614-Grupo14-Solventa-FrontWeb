import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideArrowLeft, LucideArrowRight, LucideCircleAlert, LucideInfo, LucideRefreshCw, LucideTriangleAlert } from '@lucide/angular';
import { Subscription, switchMap, timer } from 'rxjs';

import { EmisionContractual } from '@core/api/originacion/emision-contractual.modelos';
import { SolicitudFormalizacion } from '@core/api/originacion/formalizacion.modelos';
import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';
import {
  CampoRenovacionAsistida,
  CodigoErrorRenovacionAsistida,
  CodigoRenovacionEnviado,
  ErrorRenovacionAsistida,
  RecotizacionRenovacion,
  RenovacionAsistida,
  nombreDelAsesor,
} from '@core/api/originacion/renovacion-asistida.modelos';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';
import { FormatoMonedaPipe } from '@shared/pipes/formato-moneda.pipe';
import { InsigniaEstadoComponent } from '@shared/ui/insignia-estado/insignia-estado.component';

import { AceptacionClienteComponent } from './componentes/aceptacion-cliente/aceptacion-cliente.component';
import { ComparativoCondicionesComponent } from './componentes/comparativo-condiciones/comparativo-condiciones.component';
import { AfirmacionConsentimiento, ConsentimientoAsesorComponent } from './componentes/consentimiento-asesor/consentimiento-asesor.component';
import { EstadoCobroRenovacionComponent } from './componentes/estado-cobro-renovacion/estado-cobro-renovacion.component';
import { MotivoPendiente, TrazabilidadRecotizacionComponent } from './componentes/trazabilidad-recotizacion/trazabilidad-recotizacion.component';
import { diaColombia, documentoLegible } from './modelos/presentacion-renovacion';

/**
 * Fases de S7 y S7b, todas en la misma página (§4.2 del plan): la carga y sus fallas; la póliza que no se puede
 * renovar; la renovación que hizo el asegurado (solo lectura); S7 antes de recotizar, sin consentimiento, con la
 * casilla del asesor por marcar, con el consentimiento sin verificar, recotizada, sin medio de pago, con la
 * recotización vencida o reemplazada; S7b formalizada y «Ver» de una renovación en curso.
 */
export type FaseRenovacionAsistida =
  | 'cargando'
  | 'noEncontrada'
  | 'error'
  | 'noDisponible'
  | 'soloLecturaAsegurado'
  | 'sinRecotizar'
  | 'sinConsentimiento'
  | 'consentimientoPorAfirmar'
  | 'consentimientoNoVerificable'
  | 'recotizada'
  | 'sinMedioDePago'
  | 'recotizacionVencida'
  | 'reemplazada'
  | 'formalizada'
  | 'enCurso';

/** Fases de S7 en las que el asesor recotiza y registra la aceptación. */
const FASES_S7: readonly FaseRenovacionAsistida[] = [
  'sinRecotizar',
  'sinConsentimiento',
  'consentimientoPorAfirmar',
  'consentimientoNoVerificable',
  'recotizada',
  'sinMedioDePago',
  'recotizacionVencida',
  'reemplazada',
];

/** Fases de S7 que muestran la recotización. */
const FASES_CON_RECOTIZACION: readonly FaseRenovacionAsistida[] = ['recotizada', 'sinMedioDePago', 'recotizacionVencida', 'reemplazada'];

/** Fases de S7b: la renovación del periodo ya existe. */
const FASES_S7B: readonly FaseRenovacionAsistida[] = ['formalizada', 'enCurso', 'soloLecturaAsegurado'];

/** Cada cuánto se consulta la renovación mientras se cobra, y la emisión de la póliza nueva mientras se genera. */
export const INTERVALO_SEGUIMIENTO_MS = 2000;

/** Errores que resuelve el interceptor (sesión o rol): la pantalla no muestra aviso propio. */
const SIN_AVISO: readonly CodigoErrorRenovacionAsistida[] = ['unauthorized', 'forbidden'];

/** Errores del código de confirmación: se muestran junto al campo de 6 dígitos. */
const ERRORES_CODIGO: readonly CodigoErrorRenovacionAsistida[] = [
  'consent_code_required',
  'invalid_confirmation_code',
  'confirmation_code_expired',
  'too_many_attempts',
  'too_many_codes',
  'code_delivery_unavailable',
];

/** Errores tras los que la vista ya no corresponde: se muestra el aviso y se vuelve a leer la renovación. */
const ERRORES_QUE_RECARGAN: readonly CodigoErrorRenovacionAsistida[] = [
  'renewal_not_available',
  'renewal_closed',
  'already_formalized',
  'payment_method_missing',
  'requote_not_found',
];

/**
 * S7 · Renovación asistida con recotización y S7b · Renovación formalizada (HU-W1.5-03), con sus estados en la
 * misma página.
 *
 * El asesor abre una póliza de su listado de renovaciones (HU-W1.5-01): ve las condiciones vigentes, **recotiza** con
 * el motor de rating (las fuentes se consultan primero y, si no responden, se usa el último perfil en caché o el
 * actuarial base, con su aviso; CA-1, CA-5), **registra cómo y cuándo aceptó el cliente** (llamada grabada, firma
 * remota o código de confirmación; CA-2) y **formaliza**: el cobro y la emisión son los de la renovación en línea
 * (HU-W1.5-02), y la pantalla los sigue cada 2 s hasta que la póliza queda renovada o el pago falla (CA-3). S7b
 * muestra quién renovó y cuándo (CA-4). Antes de recotizar, el consentimiento: `audit` lo verifica (póliza del canal
 * embebido) o, en una póliza vendida por un asesor, el asesor marca la casilla (D-13 c). Todo sale del `GET`, así que
 * la página funciona al recargarse.
 *
 * Ruta: `/originacion/renovaciones/:id` (`policy_id`). Exige el rol de asesor.
 */
@Component({
  selector: 'app-renovacion-asistida-page',
  imports: [
    TranslocoDirective,
    AceptacionClienteComponent,
    ComparativoCondicionesComponent,
    ConsentimientoAsesorComponent,
    EstadoCobroRenovacionComponent,
    TrazabilidadRecotizacionComponent,
    InsigniaEstadoComponent,
    FormatoFechaHoraPipe,
    FormatoMonedaPipe,
    LucideArrowLeft,
    LucideArrowRight,
    LucideCircleAlert,
    LucideInfo,
    LucideRefreshCw,
    LucideTriangleAlert,
  ],
  templateUrl: './renovacion-asistida.page.html',
  styleUrl: './renovacion-asistida.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RenovacionAsistidaPage implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly api = inject(OriginacionApiService);
  private readonly transloco = inject(TranslocoService);
  private readonly destruccion = inject(DestroyRef);
  private seguimiento: Subscription | null = null;
  private seguimientoEmision: Subscription | null = null;

  private readonly panelEmision = viewChild<ElementRef<HTMLElement>>('panelEmision');

  protected readonly polizaId = this.ruta.snapshot.params['id'] as string;

  private readonly carga = signal<'cargando' | 'listo' | 'noEncontrada' | 'error'>('cargando');
  protected readonly datos = signal<RenovacionAsistida | null>(null);
  /** Respuesta de `audit` al recotizar: sin consentimiento activo (422) o sin poder verificarlo (503). */
  private readonly errorConsentimiento = signal<'consent_required' | 'consent_unverifiable' | null>(null);
  /** La formalización respondió que la recotización venció o que ya no es la última. */
  private readonly avisoRecotizacion = signal<'vencida' | 'reemplazada' | null>(null);
  /** El asesor formalizó en esta visita: S7b se titula «Renovación formalizada» aunque el cobro siga en curso. */
  private readonly formalizadaAqui = signal(false);

  protected readonly recotizando = signal(false);
  protected readonly formalizando = signal(false);
  protected readonly enviandoCodigo = signal(false);
  protected readonly descargando = signal(false);

  /** Casilla del asesor (D-13 c): viaja como `consent_affirmed: true`. */
  protected readonly consentimientoAfirmado = signal(false);
  /** El servicio respondió 422 porque faltaba la casilla. */
  private readonly faltaConsentimiento = signal(false);

  protected readonly solicitud = signal<SolicitudFormalizacion | null>(null);
  protected readonly codigoEnviado = signal<CodigoRenovacionEnviado | null>(null);
  protected readonly envios = signal(0);
  protected readonly erroresServidor = signal<Partial<Record<CampoRenovacionAsistida, string>>>({});
  protected readonly errorCodigo = signal<string | null>(null);
  /** Clave bajo `originacion.renovacionAsistida.errores` del último error general, o `null`. */
  protected readonly error = signal<string | null>(null);
  protected readonly emision = signal<EmisionContractual | null>(null);

  protected readonly fase = computed<FaseRenovacionAsistida>(() => {
    const carga = this.carga();
    const d = this.datos();
    if (carga !== 'listo' || !d) {
      return carga === 'listo' ? 'error' : carga;
    }
    const r = d.renovacion;
    if (r) {
      if (r.estado === 'not_renewed') {
        return 'noDisponible';
      }
      if (r.canal === 'insured') {
        return 'soloLecturaAsegurado';
      }
      return r.estado === 'renewed' || this.formalizadaAqui() ? 'formalizada' : 'enCurso';
    }
    if (!d.ventana.abierta || d.motivoBloqueo === 'renewal_not_available' || d.motivoBloqueo === 'renewal_closed') {
      return 'noDisponible';
    }
    const consentimiento = this.errorConsentimiento();
    if (consentimiento === 'consent_required') {
      return 'sinConsentimiento';
    }
    if (consentimiento === 'consent_unverifiable') {
      return 'consentimientoNoVerificable';
    }
    if (d.motivoBloqueo === 'payment_method_missing') {
      return 'sinMedioDePago';
    }
    const aviso = this.avisoRecotizacion() ?? this.avisoPorEstado(d.recotizacion);
    if (aviso === 'vencida') {
      return 'recotizacionVencida';
    }
    if (aviso === 'reemplazada') {
      return 'reemplazada';
    }
    if (d.recotizacion) {
      return 'recotizada';
    }
    return d.modoConsentimiento === 'advisor_affirmation' ? 'consentimientoPorAfirmar' : 'sinRecotizar';
  });

  protected readonly enS7 = computed(() => FASES_S7.includes(this.fase()));
  protected readonly enS7b = computed(() => FASES_S7B.includes(this.fase()));

  /**
   * Póliza de origen asistido: el asesor afirma el consentimiento con la casilla (D-13 c). También aparece si el
   * servicio la pidió con un 422 aunque la vista leída no lo dijera.
   */
  protected readonly conCasilla = computed(
    () => this.enS7() && (this.datos()?.modoConsentimiento === 'advisor_affirmation' || this.faltaConsentimiento()),
  );

  /**
   * Recotización que muestran el comparativo y la trazabilidad: en S7, la vigente o, si venció o fue reemplazada, la
   * última que hubo (sin consentimiento no se muestra ninguna); en S7b, la que se formalizó.
   */
  protected readonly recotizacionMostrada = computed(() => {
    const recotizacion = this.datos()?.recotizacion ?? null;
    if (!this.enS7()) {
      return recotizacion;
    }
    return FASES_CON_RECOTIZACION.includes(this.fase()) ? recotizacion : null;
  });
  /** Solo la recotización vigente sostiene la prima nueva y la aceptación. */
  protected readonly recotizacionVigente = computed(() =>
    this.fase() === 'recotizada' || this.fase() === 'sinMedioDePago' ? this.recotizacionMostrada() : null,
  );
  protected readonly degradada = computed(() => this.enS7() && !!this.recotizacionVigente()?.aviso);

  protected readonly puedeRecotizar = computed(() => {
    const d = this.datos();
    return (
      !!d &&
      this.enS7() &&
      d.puedeRecotizar &&
      !this.recotizando() &&
      !this.formalizando() &&
      (!this.conCasilla() || this.consentimientoAfirmado())
    );
  });

  /** «Formalizar renovación»: recotización vigente, el servicio lo permite y la aceptación está completa (CA-2). */
  protected readonly formalizable = computed(() => this.fase() === 'recotizada' && !!this.datos()?.puedeFormalizar);
  protected readonly puedeFormalizar = computed(
    () => this.formalizable() && this.solicitud() !== null && !this.formalizando() && !this.recotizando(),
  );

  protected readonly motivoPendiente = computed<MotivoPendiente | null>(() => {
    switch (this.fase()) {
      case 'sinConsentimiento':
        return 'sinAutorizacion';
      case 'consentimientoNoVerificable':
        return 'sinVerificar';
      case 'consentimientoPorAfirmar':
        return 'autorizacion';
      default:
        return null;
    }
  });

  protected readonly errorCasilla = computed(() => this.faltaConsentimiento() && !this.consentimientoAfirmado());

  /** «Consentimiento afirmado por … el …» en S7b, si la recotización se hizo con la casilla del asesor. */
  protected readonly afirmacion = computed<AfirmacionConsentimiento | null>(() => {
    const d = this.datos();
    const rq = d?.recotizacion;
    if (!d || !rq || !this.enS7b() || rq.baseConsentimiento !== 'advisor_affirmed' || !rq.consentimientoAfirmadoEn) {
      return null;
    }
    return { asesor: d.formalizacion ? nombreDelAsesor(d.formalizacion) : '', fecha: rq.consentimientoAfirmadoEn };
  });

  /** Clave del título según la fase. */
  protected readonly claveTitulo = computed(() => {
    const fase = this.fase();
    if (fase === 'formalizada' || this.datos()?.renovacion?.estado === 'renewed') {
      return 'titulo.formalizada';
    }
    return fase === 'enCurso' || fase === 'soloLecturaAsegurado' ? 'titulo.enCurso' : 'titulo.asistida';
  });

  /** Insignia del estado de la renovación del periodo, además de «Vence el …». */
  protected readonly insigniaRenovacion = computed<'enCurso' | 'renovada' | null>(() => {
    const r = this.datos()?.renovacion;
    if (r?.estado === 'renewed') {
      return 'renovada';
    }
    return r?.estado === 'accepted' && this.fase() !== 'formalizada' ? 'enCurso' : null;
  });

  /** Aviso de la fase «no disponible»: aún no abre la ventana, ya cerró o la póliza no se renovó. */
  protected readonly noDisponible = computed<'noDisponible' | 'ventanaCerrada' | 'noRenovada'>(() => {
    const d = this.datos();
    if (d?.renovacion?.estado === 'not_renewed') {
      return 'noRenovada';
    }
    return d && new Date(d.ventana.abreEn).getTime() > Date.now() ? 'noDisponible' : 'ventanaCerrada';
  });

  /** Datos del subtítulo: titular, documento y producto. */
  protected readonly titular = computed(() => {
    const d = this.datos();
    if (!d) {
      return null;
    }
    const idioma = this.transloco.getActiveLang();
    return {
      titular: d.poliza.titular.nombreCompleto,
      documento: documentoLegible(d.poliza.titular.documento, d.poliza.titular.tipoDocumento, idioma),
      producto: this.transloco.translate(`originacion.renovacionAsistida.linea.${d.poliza.linea}`),
    };
  });

  protected readonly cobroFallido = computed(() => this.enS7b() && this.datos()?.cobro?.estado === 'failed');

  ngOnInit(): void {
    this.destruccion.onDestroy(() => {
      this.seguimiento?.unsubscribe();
      this.seguimientoEmision?.unsubscribe();
    });
    this.cargar();
  }

  protected cargar(): void {
    this.carga.set('cargando');
    this.error.set(null);
    this.api
      .consultarRenovacionAsistida(this.polizaId)
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (datos) => this.mostrar(datos),
        error: (error: unknown) =>
          this.carga.set(error instanceof ErrorRenovacionAsistida && error.codigo === 'policy_not_found' ? 'noEncontrada' : 'error'),
      });
  }

  /** «Recotizar» (o «Reintentar» si `audit` no respondió): consentimiento primero, luego fuentes y motor. */
  protected recotizar(): void {
    if (!this.puedeRecotizar()) {
      return;
    }
    this.recotizando.set(true);
    this.error.set(null);
    this.api
      .recotizarRenovacion(this.polizaId, this.conCasilla() && this.consentimientoAfirmado())
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (recotizacion) => {
          this.recotizando.set(false);
          this.errorConsentimiento.set(null);
          this.faltaConsentimiento.set(false);
          this.reiniciarAceptacion();
          this.datos.update((d) => (d ? { ...d, recotizacion } : d));
          // El servicio decide si ya se puede formalizar (medio de pago, ventana): se vuelve a leer la vista.
          this.refrescar();
        },
        error: (error: unknown) => this.fallarRecotizacion(error),
      });
  }

  /** «Enviar código» / «Reenviar código»: el titular lo recibe por correo; vale para la recotización vigente. */
  protected enviarCodigo(): void {
    const recotizacion = this.recotizacionVigente();
    if (!recotizacion || this.enviandoCodigo()) {
      return;
    }
    this.enviandoCodigo.set(true);
    this.errorCodigo.set(null);
    this.api
      .enviarCodigoRenovacion(this.polizaId, recotizacion.recotizacionId)
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (enviado) => {
          this.enviandoCodigo.set(false);
          this.codigoEnviado.set(enviado);
          this.envios.update((n) => n + 1);
        },
        error: (error: unknown) => {
          this.enviandoCodigo.set(false);
          this.fallarAccion(error);
        },
      });
  }

  /** «Formalizar renovación»: registra la aceptación del cliente y arranca el cobro de la renovación. */
  protected formalizar(): void {
    const recotizacion = this.recotizacionVigente();
    const solicitud = this.solicitud();
    if (!this.puedeFormalizar() || !recotizacion || !solicitud) {
      return;
    }
    this.formalizando.set(true);
    this.error.set(null);
    this.errorCodigo.set(null);
    this.erroresServidor.set({});
    this.api
      .formalizarRenovacion(this.polizaId, { ...solicitud, recotizacionId: recotizacion.recotizacionId })
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: ({ renovacion }) => {
          this.formalizando.set(false);
          this.formalizadaAqui.set(true);
          this.mostrar(renovacion);
        },
        error: (error: unknown) => {
          this.formalizando.set(false);
          this.fallarAccion(error);
        },
      });
  }

  /** «Ver emisión en curso»: lleva el foco al panel del cobro y la emisión. */
  protected verEmision(): void {
    const panel = this.panelEmision()?.nativeElement;
    panel?.scrollIntoView?.({ block: 'start' });
    panel?.focus();
  }

  /** «Ver certificado»: descarga el PDF de la póliza nueva; el JWT lo adjunta el interceptor. */
  protected verCertificado(): void {
    const polizaNueva = this.datos()?.renovacion?.polizaNuevaId;
    if (!polizaNueva || this.descargando()) {
      return;
    }
    this.descargando.set(true);
    this.error.set(null);
    this.api
      .descargarDocumentoContractual(polizaNueva)
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (pdf) => {
          const url = URL.createObjectURL(pdf);
          const enlace = document.createElement('a');
          enlace.href = url;
          enlace.download = `poliza-${polizaNueva}.pdf`;
          enlace.click();
          URL.revokeObjectURL(url);
          this.descargando.set(false);
        },
        error: () => {
          this.descargando.set(false);
          this.error.set('certificado');
        },
      });
  }

  /** «← Renovaciones» y «Volver a renovaciones»: regresa al listado con su filtro o, si se entró directo, lo abre. */
  protected volver(): void {
    const estado = this.location.getState() as { navigationId?: number } | null;
    if ((estado?.navigationId ?? 1) > 1) {
      this.location.back();
      return;
    }
    void this.router.navigateByUrl('/originacion/renovaciones');
  }

  protected fechaCorta(iso: string | null | undefined): string {
    return diaColombia(iso, this.transloco.getActiveLang());
  }

  protected asesor(): string {
    const f = this.datos()?.formalizacion;
    return f ? nombreDelAsesor(f) : '';
  }

  private mostrar(datos: RenovacionAsistida): void {
    this.datos.set(datos);
    this.carga.set('listo');
    if (datos.recotizacion?.estado === 'valid') {
      this.avisoRecotizacion.set(null);
    }
    this.seguir();
    this.seguirEmision();
  }

  private avisoPorEstado(recotizacion: RecotizacionRenovacion | null): 'vencida' | 'reemplazada' | null {
    switch (recotizacion?.estado) {
      case 'expired':
        return 'vencida';
      case 'superseded':
        return 'reemplazada';
      default:
        return null;
    }
  }

  private reiniciarAceptacion(): void {
    this.avisoRecotizacion.set(null);
    this.codigoEnviado.set(null);
    this.envios.set(0);
    this.errorCodigo.set(null);
    this.erroresServidor.set({});
  }

  private fallarRecotizacion(error: unknown): void {
    this.recotizando.set(false);
    const codigo = error instanceof ErrorRenovacionAsistida ? error.codigo : 'renewal_unavailable';
    if (codigo === 'consent_required' || codigo === 'consent_unverifiable') {
      this.errorConsentimiento.set(codigo);
      return;
    }
    if (codigo === 'validation_failed' && error instanceof ErrorRenovacionAsistida && error.campos.some((c) => c.campo === 'consentimiento')) {
      // El servicio pide la casilla del asesor: se muestra con su error y la recotización espera a que la marque.
      this.consentimientoAfirmado.set(false);
      this.faltaConsentimiento.set(true);
      return;
    }
    this.fallarAccion(error);
  }

  /** Errores de enviar el código y de formalizar (y los generales de recotizar). */
  private fallarAccion(error: unknown): void {
    const codigo = error instanceof ErrorRenovacionAsistida ? error.codigo : 'renewal_unavailable';
    if (SIN_AVISO.includes(codigo)) {
      return;
    }
    if (ERRORES_CODIGO.includes(codigo)) {
      this.errorCodigo.set(codigo);
      return;
    }
    if (codigo === 'validation_failed' && error instanceof ErrorRenovacionAsistida && error.campos.length > 0) {
      const campos: Partial<Record<CampoRenovacionAsistida, string>> = {};
      for (const { campo, codigo: motivo } of error.campos) {
        campos[campo] = motivo;
      }
      this.erroresServidor.set(campos);
      return;
    }
    if (codigo === 'requote_expired' || codigo === 'requote_superseded') {
      this.avisoRecotizacion.set(codigo === 'requote_expired' ? 'vencida' : 'reemplazada');
      return;
    }
    this.error.set(codigo);
    if (ERRORES_QUE_RECARGAN.includes(codigo)) {
      this.refrescar();
    }
  }

  /** Vuelve a leer la renovación sin pasar por la pantalla de carga. */
  private refrescar(): void {
    this.api
      .consultarRenovacionAsistida(this.polizaId)
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({ next: (datos) => this.mostrar(datos), error: () => undefined });
  }

  /** Mientras la renovación del periodo se cobra, la consulta cada `INTERVALO_SEGUIMIENTO_MS` hasta su resultado. */
  private seguir(): void {
    this.seguimiento?.unsubscribe();
    this.seguimiento = null;
    const d = this.datos();
    if (d?.renovacion?.estado !== 'accepted' || d.cobro?.estado === 'failed') {
      return;
    }
    this.seguimiento = timer(INTERVALO_SEGUIMIENTO_MS)
      .pipe(switchMap(() => this.api.consultarRenovacionAsistida(this.polizaId)))
      .subscribe({
        next: (datos) => this.mostrar(datos),
        // El cobro sigue su curso en el backend: se vuelve a preguntar.
        error: () => this.seguir(),
      });
  }

  /** Con la póliza nueva activa, sigue su emisión (certificado y correo) hasta que termina. */
  private seguirEmision(): void {
    const polizaNueva = this.datos()?.renovacion?.polizaNuevaId;
    const actual = this.emision();
    if (!polizaNueva || this.seguimientoEmision || actual?.estado === 'completed' || actual?.estado === 'failed') {
      return;
    }
    this.seguimientoEmision = timer(0, INTERVALO_SEGUIMIENTO_MS)
      .pipe(switchMap(() => this.api.consultarEmisionContractual(polizaNueva)))
      .subscribe({
        next: (emision) => {
          this.emision.set(emision);
          if (emision.estado === 'completed' || emision.estado === 'failed') {
            this.seguimientoEmision?.unsubscribe();
          }
        },
        // La emisión aún no existe o no respondió: el panel sigue en «Pendiente» y se deja de preguntar.
        error: () => undefined,
      });
  }
}
