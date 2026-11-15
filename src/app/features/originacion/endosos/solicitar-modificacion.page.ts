import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideArrowLeft, LucideCircleAlert, LucideSend, LucideTriangleAlert } from '@lucide/angular';

import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';
import {
  CondicionesVigentes,
  ErrorDeCampoSolicitud,
  ErrorSolicitudModificacion,
  SolicitudNueva,
  TIPOS_CAMBIO,
  TipoCambio,
} from '@core/api/originacion/solicitud-modificacion.modelos';
import { FormatoFechaPipe } from '@shared/pipes/formato-fecha.pipe';

import { AntesDeRadicarComponent } from './componentes/antes-de-radicar/antes-de-radicar.component';
import { CambioBeneficiariosComponent } from './componentes/cambio-beneficiarios/cambio-beneficiarios.component';
import { CambioDatosPersonalesComponent } from './componentes/cambio-datos-personales/cambio-datos-personales.component';
import { CambioSumaAseguradaComponent } from './componentes/cambio-suma-asegurada/cambio-suma-asegurada.component';
import { ResumenCambioComponent } from './componentes/resumen-cambio/resumen-cambio.component';
import { TipoCambioComponent } from './componentes/tipo-cambio/tipo-cambio.component';
import {
  BeneficiarioCaptura,
  ContactoCaptura,
  aBeneficiarios,
  colapsar,
  leerMonto,
  normalizarTelefono,
  validarBeneficiarios,
  validarContacto,
  validarValorAsegurado,
} from './modelos/validaciones-cambio';

/** Fase de A3: consultando, con la captura, radicando, póliza no vigente, póliza que no es del asegurado o falla del servicio. */
export type FaseSolicitar = 'cargando' | 'listo' | 'radicando' | 'noVigente' | 'noEncontrada' | 'error';

/** Lo que salió mal al radicar, fuera de los campos: la abierta del mismo tipo o una falla del servicio. */
type AvisoRadicar = { tipo: 'abierta'; solicitudId: string | null } | { tipo: 'falla' } | null;

const SIN_CONTACTO: ContactoCaptura = { direccion: '', correo: '', telefono: '' };

/**
 * A3 · Solicitar una modificación (HU-W1.4-01, frame `20:529` y sus derivados): el asegurado elige el tipo de cambio
 * (beneficiarios, sumas aseguradas o datos personales), captura lo nuevo y lo radica (CA-1). Las reglas de la captura se
 * revisan en el navegador y «Radicar solicitud» sigue deshabilitado mientras haya errores o se envíe (CA-3); un `422` del
 * servicio se pinta en sus campos. Un tipo con una solicitud abierta queda bloqueado con su enlace (D-6) y una póliza no
 * vigente no deja radicar. Al radicar va a A3b con el estado «recién radicada» (CA-2). 401 y 403 los resuelve el
 * interceptor (CA-4: solo el titular). El regreso va a «Mis pólizas» mientras no exista A2 (D-12).
 *
 * Ruta: `/originacion/polizas/:id/modificar` (solo el asegurado).
 */
@Component({
  selector: 'app-solicitar-modificacion-page',
  imports: [
    RouterLink,
    TranslocoDirective,
    FormatoFechaPipe,
    TipoCambioComponent,
    CambioBeneficiariosComponent,
    CambioSumaAseguradaComponent,
    CambioDatosPersonalesComponent,
    ResumenCambioComponent,
    AntesDeRadicarComponent,
    LucideArrowLeft,
    LucideCircleAlert,
    LucideSend,
    LucideTriangleAlert,
  ],
  templateUrl: './solicitar-modificacion.page.html',
  styleUrl: './solicitar-modificacion.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SolicitarModificacionPage implements OnInit {
  private readonly api = inject(OriginacionApiService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly destruccion = inject(DestroyRef);

  protected readonly polizaId = String(this.ruta.snapshot.params['id'] ?? '');
  protected readonly fase = signal<FaseSolicitar>('cargando');
  protected readonly condiciones = signal<CondicionesVigentes | null>(null);
  protected readonly tipo = signal<TipoCambio | null>(null);
  protected readonly beneficiarios = signal<BeneficiarioCaptura[]>([]);
  protected readonly textoSuma = signal('');
  protected readonly contacto = signal<ContactoCaptura>(SIN_CONTACTO);
  /** Los campos del último `422`; se descartan cuando el asegurado cambia algo. */
  protected readonly erroresServicio = signal<readonly ErrorDeCampoSolicitud[]>([]);
  protected readonly mostrarTodos = signal(false);
  protected readonly aviso = signal<AvisoRadicar>(null);

  /** Los errores de la captura del tipo elegido, con las mismas reglas del servicio. */
  protected readonly erroresCaptura = computed<readonly ErrorDeCampoSolicitud[]>(() => {
    const c = this.condiciones();
    switch (c ? this.tipo() : null) {
      case 'beneficiaries':
        return validarBeneficiarios(this.beneficiarios(), c!.beneficiarios, c!.limites.maxBeneficiarios);
      case 'insured_amount':
        return validarValorAsegurado(this.textoSuma(), c!.valorAsegurado, c!.limites);
      case 'personal_data':
        return validarContacto(this.contacto(), c!.contacto);
      default:
        return [];
    }
  });

  /** Los propios y, para los demás campos, los del servicio. */
  protected readonly errores = computed(() => {
    const propios = this.erroresCaptura();
    const campos = new Set(propios.map((e) => e.campo));
    return [...propios, ...this.erroresServicio().filter((e) => !campos.has(e.campo))];
  });

  /** Los tipos con una solicitud abierta: todos bloqueados es no poder radicar nada. */
  protected readonly todosAbiertos = computed(() => {
    const abiertas = this.condiciones()?.abiertas ?? [];
    return TIPOS_CAMBIO.every((t) => abiertas.some((a) => a.tipo === t));
  });

  protected readonly puedeRadicar = computed(
    () => this.fase() === 'listo' && this.tipo() !== null && this.errores().length === 0 && !this.tipoAbierto(),
  );

  constructor() {
    // Cualquier cambio de la captura descarta los errores del último 422 y el aviso.
    effect(() => {
      this.tipo();
      this.beneficiarios();
      this.textoSuma();
      this.contacto();
      untracked(() => {
        this.erroresServicio.set([]);
        this.aviso.set(null);
      });
    });
  }

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.fase.set('cargando');
    this.api
      .consultarCondicionesVigentes(this.polizaId)
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (condiciones) => {
          this.condiciones.set(condiciones);
          this.tipo.set(TIPOS_CAMBIO.find((t) => !condiciones.abiertas.some((a) => a.tipo === t)) ?? null);
          this.fase.set(condiciones.poliza.vigente ? 'listo' : 'noVigente');
        },
        error: (error: unknown) => {
          const codigo = error instanceof ErrorSolicitudModificacion ? error.codigo : 'change_request_unavailable';
          this.fase.set(codigo === 'policy_not_found' ? 'noEncontrada' : 'error');
        },
      });
  }

  /** «Vida hipotecario» desde la línea de la póliza. */
  protected producto(linea: string): string {
    const clave = `originacion.solicitudes.linea.${linea}`;
    const texto = this.transloco.translate(clave);
    return texto === clave ? linea : texto;
  }

  protected radicar(): void {
    const condiciones = this.condiciones();
    const tipo = this.tipo();
    if (!condiciones || !tipo || this.fase() !== 'listo') {
      return;
    }
    this.mostrarTodos.set(true);
    if (this.erroresCaptura().length > 0) {
      return;
    }
    this.aviso.set(null);
    this.erroresServicio.set([]);
    this.fase.set('radicando');
    this.api
      .radicarSolicitudModificacion(this.polizaId, this.solicitud(tipo))
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (solicitud) =>
          void this.router.navigate(['/originacion/solicitudes', solicitud.solicitudId], { state: { recienRadicada: true } }),
        error: (error: unknown) => this.alFallar(error, tipo),
      });
  }

  private tipoAbierto(): boolean {
    const tipo = this.tipo();
    return (this.condiciones()?.abiertas ?? []).some((a) => a.tipo === tipo);
  }

  private solicitud(tipo: TipoCambio): SolicitudNueva {
    switch (tipo) {
      case 'beneficiaries':
        return { tipo, beneficiarios: aBeneficiarios(this.beneficiarios()) };
      case 'insured_amount':
        return { tipo, valorAsegurado: leerMonto(this.textoSuma()) ?? 0 };
      default: {
        const c = this.contacto();
        return {
          tipo,
          contacto: {
            direccion: colapsar(c.direccion),
            correo: c.correo.trim(),
            telefono: c.telefono.trim() ? normalizarTelefono(c.telefono) : '',
          },
        };
      }
    }
  }

  private alFallar(error: unknown, tipo: TipoCambio): void {
    const e = error instanceof ErrorSolicitudModificacion ? error : new ErrorSolicitudModificacion('change_request_unavailable');
    this.fase.set('listo');
    switch (e.codigo) {
      case 'validation_failed':
        this.erroresServicio.set(e.campos);
        return;
      case 'change_request_open':
        // El tipo queda bloqueado con el enlace a la abierta, como al cargar.
        this.condiciones.update((c) =>
          c && e.solicitudAbierta
            ? {
                ...c,
                abiertas: [...c.abiertas, { solicitudId: e.solicitudAbierta, tipo, estadoGuardado: 'filed', radicadaEn: new Date().toISOString() }],
              }
            : c,
        );
        this.aviso.set({ tipo: 'abierta', solicitudId: e.solicitudAbierta });
        return;
      case 'policy_not_in_force':
        this.fase.set('noVigente');
        return;
      case 'policy_not_found':
        this.fase.set('noEncontrada');
        return;
      case 'unauthorized':
      case 'forbidden':
        // Los resuelve el interceptor (sesión expirada o «no autorizado»).
        return;
      default:
        this.aviso.set({ tipo: 'falla' });
    }
  }
}
