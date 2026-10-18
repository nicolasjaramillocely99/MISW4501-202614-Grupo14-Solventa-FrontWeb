import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import {
  LucideArrowRight,
  LucideCircleAlert,
  LucideDatabase,
  LucideIdCard,
  LucideInfo,
  LucideLandmark,
} from '@lucide/angular';

import { AuditoriaApiService } from '@core/api/auditoria/auditoria-api.service';
import {
  CodigoFuente,
  ErrorConsentimiento,
  FuenteConsentimiento,
  TerminosConsentimiento,
} from '@core/api/auditoria/consentimiento.modelos';
import { IndicadorPasosComponent, PasoFlujo } from '@shared/ui/indicador-pasos/indicador-pasos.component';

import { ACCIONES_ACEPTACION_OFERTA } from '../aceptacion-oferta/aceptacion-oferta.config';
import { TarjetaCreditoComponent } from '../componentes/tarjeta-credito/tarjeta-credito.component';
import { ContextoLanzamientoService } from '../servicios/contexto-lanzamiento.service';
import { FlujoEmbebidoService } from '../servicios/flujo-embebido.service';

type Fase = 'cargando' | 'formulario' | 'enviando' | 'rechazado' | 'sin-contexto' | 'error';
type MotivoError = 'terminos' | 'registro' | 'datos';

/** Clave i18n (bajo `embebido.consentimiento`) de cada código del contrato. */
const CLAVE_FUENTE: Record<CodigoFuente, string> = {
  open_finance: 'openFinance',
  open_data: 'openData',
  kyc: 'kyc',
};
const CLAVE_VIGENCIA = { '12_months': 'meses12', single_use: 'unicaVez' } as const;
const CLAVE_FINALIDAD: Record<string, string> = {
  risk_profiling_mortgage_life_offer: 'perfilRiesgoVidaHipotecario',
};
const CLAVE_POLITICA: Record<string, string> = {
  'personal-data-policy-v1': 'politicaDatosV1',
};
const CLAVE_CATEGORIA: Record<string, string> = {
  credit_products: 'productosCredito',
  balances: 'saldos',
  payment_behavior: 'comportamientoPago',
  public_records: 'registrosPublicos',
  identity_verification: 'verificacionIdentidad',
};

/**
 * Paso 1 · Consentimiento explícito (E1; HU-W1.2-01). Muestra los términos vigentes que entrega `audit`
 * (fuentes con sus datos y vigencia, finalidad y responsable), pide dos casillas y registra el consentimiento
 * con `POST /v1/audit/consents`. «Autorizar y continuar» solo se habilita con **ambas** casillas marcadas.
 * Sin autorización («Ahora no») no se hace ninguna llamada y no se consulta ninguna fuente (CA-3).
 *
 * Los datos del cliente y del crédito los entrega el aliado en `?contexto=` (`ContextoLanzamientoService`).
 * Los estados viven en la misma página: cargando, formulario, enviando, rechazado, sin contexto y error.
 *
 * Ruta pública: `/embebido/consentimiento`. Al registrar lleva a `/embebido/perfil-riesgo/:clienteId`.
 */
@Component({
  selector: 'app-consentimiento-page',
  imports: [
    RouterLink,
    TranslocoDirective,
    IndicadorPasosComponent,
    TarjetaCreditoComponent,
    LucideLandmark,
    LucideDatabase,
    LucideIdCard,
    LucideArrowRight,
    LucideInfo,
    LucideCircleAlert,
  ],
  templateUrl: './consentimiento.page.html',
  styleUrl: './consentimiento.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsentimientoPage implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(AuditoriaApiService);
  private readonly flujo = inject(FlujoEmbebidoService);
  private readonly contexto = inject(ContextoLanzamientoService);
  private readonly destruccion = inject(DestroyRef);

  protected readonly acciones = inject(ACCIONES_ACEPTACION_OFERTA);
  protected readonly solicitud = this.flujo.solicitud;
  protected readonly fase = signal<Fase>('cargando');
  protected readonly motivoError = signal<MotivoError>('terminos');
  protected readonly terminos = signal<TerminosConsentimiento | null>(null);
  /** Los términos cambiaron mientras el cliente los leía: se muestran de nuevo y se pide autorizar otra vez. */
  protected readonly terminosActualizados = signal(false);
  protected readonly autorizaFuentes = signal(false);
  protected readonly aceptaPolitica = signal(false);

  /** Clave i18n del encabezado: «enviando» conserva el del formulario y «sin-contexto» va en camelCase. */
  protected readonly claveFase = computed(() => {
    const fase = this.fase();
    return fase === 'enviando' ? 'formulario' : fase === 'sin-contexto' ? 'sinContexto' : fase;
  });

  protected readonly puedeAutorizar = computed(
    () => this.fase() === 'formulario' && this.autorizaFuentes() && this.aceptaPolitica(),
  );

  protected readonly pasos: readonly PasoFlujo[] = [
    { etiqueta: 'embebido.pasos.consentimiento', estado: 'actual' },
    { etiqueta: 'embebido.pasos.perfilRiesgo', estado: 'pendiente' },
    { etiqueta: 'embebido.pasos.oferta', estado: 'pendiente' },
    { etiqueta: 'embebido.pasos.pago', estado: 'pendiente' },
    { etiqueta: 'embebido.pasos.poliza', estado: 'pendiente' },
  ];

  ngOnInit(): void {
    if (this.contexto.cargarDesde(this.ruta).estado !== 'valido') {
      this.fase.set('sin-contexto');
      return;
    }
    this.cargarTerminos();
  }

  protected cargarTerminos(): void {
    this.fase.set('cargando');
    this.api
      .consultarTerminosVigentes()
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (terminos) => {
          this.terminos.set(terminos);
          this.fase.set('formulario');
        },
        error: () => {
          this.motivoError.set('terminos');
          this.fase.set('error');
        },
      });
  }

  protected alternarFuentes(marcada: boolean): void {
    this.autorizaFuentes.set(marcada);
  }

  protected alternarPolitica(marcada: boolean): void {
    this.aceptaPolitica.set(marcada);
  }

  /** «Ahora no»: no se llama a ningún servicio. */
  protected rechazar(): void {
    this.fase.set('rechazado');
  }

  protected volverAAutorizar(): void {
    this.fase.set('formulario');
  }

  /** «Reintentar»: vuelve a pedir los términos o repite el registro (idempotente, reenviarlo es seguro). */
  protected reintentar(): void {
    if (this.motivoError() === 'terminos') {
      this.cargarTerminos();
    } else {
      this.autorizar();
    }
  }

  protected autorizar(): void {
    const terminos = this.terminos();
    const cliente = this.contexto.cliente();
    const aliadoId = this.contexto.aliadoId();
    const solicitud = this.solicitud();
    if (!terminos || !cliente || !aliadoId || !solicitud) {
      this.fase.set('sin-contexto');
      return;
    }
    if (!this.autorizaFuentes() || !this.aceptaPolitica()) {
      return;
    }
    this.fase.set('enviando');
    this.api
      .registrarConsentimiento({
        clienteId: cliente.id,
        documento: cliente.documento,
        nombreCompleto: cliente.nombreCompleto,
        versionTerminos: terminos.version,
        fuentesAceptadas: terminos.fuentes.map((fuente) => fuente.codigo),
        aceptaPoliticaDatos: true,
        aliadoId,
        solicitudId: solicitud.numero,
      })
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (consentimiento) => {
          this.contexto.registrarConsentimiento({ id: consentimiento.id, fecha: consentimiento.otorgadoEn });
          void this.router.navigate(['/embebido/perfil-riesgo', cliente.id], { queryParams: { consentimiento: 'true' } });
        },
        error: (error: unknown) => this.manejarError(error),
      });
  }

  private manejarError(error: unknown): void {
    const codigo = error instanceof ErrorConsentimiento ? error.codigo : 'service_unavailable';
    if (codigo === 'terms_outdated') {
      // Lo que se mostró ya no es lo vigente: se limpian las casillas y se muestran los términos nuevos.
      this.autorizaFuentes.set(false);
      this.aceptaPolitica.set(false);
      this.terminosActualizados.set(true);
      this.cargarTerminos();
      return;
    }
    this.motivoError.set(codigo === 'validation_failed' || codigo === 'invalid_request' ? 'datos' : 'registro');
    this.fase.set('error');
  }

  protected claveFuente(fuente: FuenteConsentimiento): string {
    return CLAVE_FUENTE[fuente.codigo] ?? '';
  }

  protected claveVigencia(fuente: FuenteConsentimiento): string {
    return CLAVE_VIGENCIA[fuente.vigencia] ?? '';
  }

  protected claveFinalidad(codigo: string): string | null {
    return CLAVE_FINALIDAD[codigo] ?? null;
  }

  protected clavePolitica(codigo: string): string | null {
    return CLAVE_POLITICA[codigo] ?? null;
  }

  /**
   * Los datos que lee una fuente, escritos con sus categorías del contrato («Productos de crédito, saldos y
   * comportamiento de pago»). `traducir` es el `t` del prefijo `embebido` de la plantilla.
   */
  protected unirCategorias(fuente: FuenteConsentimiento, traducir: (clave: string) => string): string {
    const nombres = this.clavesCategorias(fuente).map((clave) => traducir(`consentimiento.categoria.${clave}`));
    const unidos =
      nombres.length > 1
        ? `${nombres.slice(0, -1).join(', ')} ${traducir('consentimiento.conjuncion')} ${nombres[nombres.length - 1]}`
        : (nombres[0] ?? '');
    return unidos.charAt(0).toLocaleUpperCase() + unidos.slice(1);
  }

  /** Claves de las categorías de datos de una fuente (las que el backend no conozca el cliente las omite). */
  protected clavesCategorias(fuente: FuenteConsentimiento): string[] {
    return fuente.categoriasDatos.map((categoria) => CLAVE_CATEGORIA[categoria]).filter((clave) => !!clave);
  }
}
