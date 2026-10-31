import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideArrowLeft, LucideBan, LucideCircleAlert, LucideCircleCheck, LucideInfo, LucideRefreshCw } from '@lucide/angular';

import { ErrorRevocacion, SolicitudRevocacion } from '@core/api/auditoria/revocacion.modelos';
import { SesionService } from '@core/auth/sesion.service';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';
import { InsigniaEstadoComponent } from '@shared/ui/insignia-estado/insignia-estado.component';

import { ConfirmarRevocacionComponent } from './componentes/confirmar-revocacion/confirmar-revocacion.component';
import { EntidadesRevocacionComponent } from './componentes/entidades-revocacion/entidades-revocacion.component';
import { HistorialConsentimientoComponent } from './componentes/historial-consentimiento/historial-consentimiento.component';
import {
  confirmadas,
  etiquetaEstado,
  motivoNoRevocable,
  noConfirmadas,
  otorgadoEn,
  pendientes,
  plazoMaximoPendiente,
  solicitadaPor,
} from './modelos/presentacion-revocacion';
import { TraducirCodigoPipe } from './pipes/traducir-codigo.pipe';
import { SeguimientoRevocacionService } from './servicios/seguimiento-revocacion.service';
import { UltimoListadoService } from './servicios/ultimo-listado.service';

/** Fase de la carga: consultando, con el estado, sin ese consentimiento o con una falla del servicio. */
export type FaseDetalle = 'cargando' | 'listo' | 'noEncontrado' | 'error';

/** Por qué se cerró el modal sin revocar: otro la revocó o venció mientras el analista confirmaba (CA-4). */
type AvisoCarrera = 'consent_already_revoked' | 'consent_not_active';

/**
 * O15 / O15b / O15c · Detalle del consentimiento y revocación desde el portal de cumplimiento (HU-W4.2-02). Se arma solo
 * con `GET …/revocation` (F2): titular con documento enmascarado, alcance, entidades, la revocación con el avance del aviso
 * a cada entidad y el historial. Desde HU-W4.2-01 (CA-4) muestra además el canal y la fecha de otorgamiento, la finalidad,
 * la vigencia y la evidencia, y «Volver» regresa al listado con el último filtro. «Revocar consentimiento» solo aparece con `revocable = true` (CA-1) y abre el modal; la
 * confirmación se pinta únicamente con la respuesta del servidor, que ya dejó el registro inmutable (CA-5). Mientras el
 * aviso está en curso se sondea cada 5 s (CA-2); con una revocación parcial una alerta nombra las entidades que no
 * confirmaron y ofrece reintentar solo con ellas (CA-3). Revocado o vencido no ofrece ninguna acción (CA-4).
 *
 * Ruta: `/auditoria/consentimientos/:id` (solo operaciones).
 */
@Component({
  selector: 'app-detalle-consentimiento-page',
  imports: [
    RouterLink,
    TranslocoDirective,
    InsigniaEstadoComponent,
    ConfirmarRevocacionComponent,
    EntidadesRevocacionComponent,
    HistorialConsentimientoComponent,
    FormatoFechaHoraPipe,
    TraducirCodigoPipe,
    LucideArrowLeft,
    LucideBan,
    LucideCircleAlert,
    LucideCircleCheck,
    LucideInfo,
    LucideRefreshCw,
  ],
  providers: [SeguimientoRevocacionService],
  templateUrl: './detalle-consentimiento.page.html',
  styleUrl: './detalle-consentimiento.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetalleConsentimientoPage implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly sesion = inject(SesionService);
  private readonly seguimiento = inject(SeguimientoRevocacionService);
  private readonly destruccion = inject(DestroyRef);
  private readonly modal = viewChild.required(ConfirmarRevocacionComponent);
  private readonly titulo = viewChild<ElementRef<HTMLElement>>('titulo');
  private readonly transloco = inject(TranslocoService);

  /** Los parámetros del último listado, para que «Volver» conserve el filtro y la página (HU-W4.2-01). */
  protected readonly volverA = inject(UltimoListadoService).parametros;

  protected readonly id = signal('');
  protected readonly fase = signal<FaseDetalle>('cargando');
  protected readonly estado = this.seguimiento.estado;
  protected readonly actualizacion = this.seguimiento.actualizacion;
  /** La revocación se está enviando desde el modal. */
  protected readonly enviando = signal(false);
  protected readonly errorRevocacion = signal<ErrorRevocacion | null>(null);
  protected readonly reintentando = signal(false);
  protected readonly falloReintento = signal(false);
  protected readonly avisoCarrera = signal<AvisoCarrera | null>(null);

  protected readonly etiqueta = computed(() => {
    const estado = this.estado();
    return estado ? etiquetaEstado(estado) : null;
  });
  protected readonly sinConfirmar = computed(() => {
    const estado = this.estado();
    return estado ? noConfirmadas(estado) : [];
  });
  protected readonly yaConfirmaron = computed(() => {
    const estado = this.estado();
    return estado ? confirmadas(estado) : [];
  });
  protected readonly esperando = computed(() => {
    const estado = this.estado();
    return estado ? pendientes(estado) : [];
  });
  protected readonly plazo = computed(() => {
    const estado = this.estado();
    return estado ? plazoMaximoPendiente(estado) : null;
  });
  protected readonly noRevocable = computed(() => {
    const estado = this.estado();
    return estado ? motivoNoRevocable(estado) : null;
  });
  protected readonly otorgado = computed(() => {
    const estado = this.estado();
    return estado ? (estado.otorgadoEn ?? otorgadoEn(estado)) : null;
  });
  /** La entidad por la que se otorgó (hoy, el aliado). */
  protected readonly entidadOtorgamiento = computed(() => this.estado()?.entidades[0]?.nombre ?? null);
  protected readonly solicitante = computed(() => {
    const revocacion = this.estado()?.revocacion;
    return revocacion ? solicitadaPor(revocacion, this.sesion.usuario()?.id ?? null) : null;
  });
  /** El nombre de la sesión solo se muestra si el `sub` de la revocación es el de quien mira (F4). */
  protected readonly nombreSesion = computed(() => this.sesion.usuario()?.nombre ?? '');

  /** «20/10/2026»: la fecha sin la hora, con día y mes de dos cifras en el orden del idioma. */
  protected fecha(iso: string | null): string {
    if (!iso) {
      return '';
    }
    const valor = new Date(iso);
    if (Number.isNaN(valor.getTime())) {
      return '';
    }
    return new Intl.DateTimeFormat(this.transloco.getActiveLang(), { day: '2-digit', month: '2-digit', year: 'numeric' })
      .formatToParts(valor)
      .map((parte) => (parte.type === 'day' || parte.type === 'month' ? parte.value.padStart(2, '0') : parte.value))
      .join('');
  }

  ngOnInit(): void {
    this.id.set(this.ruta.snapshot.paramMap.get('id') ?? '');
    this.seguimiento.iniciar(this.id());
    this.cargar();
  }

  protected cargar(): void {
    this.fase.set('cargando');
    this.seguimiento
      .recargar()
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: () => this.fase.set('listo'),
        error: (error: unknown) => {
          const codigo = error instanceof ErrorRevocacion ? error.codigo : 'service_unavailable';
          if (codigo === 'consent_not_found') {
            this.fase.set('noEncontrado');
          } else if (codigo !== 'unauthorized' && codigo !== 'forbidden') {
            // 401 y 403 los resuelve el interceptor.
            this.fase.set('error');
          }
        },
      });
  }

  /** «Actualizar» del aviso de sondeo detenido: lee el estado una vez y reanuda el seguimiento si hace falta. */
  protected actualizar(): void {
    this.seguimiento
      .recargar()
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({ error: () => undefined });
  }

  protected abrirConfirmacion(): void {
    this.errorRevocacion.set(null);
    this.avisoCarrera.set(null);
    this.seguimiento.abrirConfirmacion();
    this.modal().abrir();
  }

  protected revocar(solicitud: SolicitudRevocacion): void {
    if (this.enviando()) {
      return;
    }
    this.enviando.set(true);
    this.errorRevocacion.set(null);
    this.seguimiento
      .revocar(solicitud)
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.modal().cerrar();
          // El botón que abrió el modal ya no existe: el foco pasa al título para que se lea el nuevo estado.
          this.titulo()?.nativeElement.focus();
        },
        error: (error: unknown) => {
          this.enviando.set(false);
          const falla = error instanceof ErrorRevocacion ? error : new ErrorRevocacion('service_unavailable');
          if (falla.codigo === 'consent_already_revoked' || falla.codigo === 'consent_not_active') {
            // Lo revocó otro (p. ej. el titular desde la app) o venció mientras el modal estaba abierto (CA-4).
            this.modal().cerrar();
            this.avisoCarrera.set(falla.codigo);
            this.actualizar();
            return;
          }
          this.errorRevocacion.set(falla);
        },
      });
  }

  protected reintentar(): void {
    if (this.reintentando()) {
      return;
    }
    this.reintentando.set(true);
    this.falloReintento.set(false);
    this.avisoCarrera.set(null);
    this.seguimiento
      .reintentar()
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: () => this.reintentando.set(false),
        error: (error: unknown) => {
          this.reintentando.set(false);
          const codigo = error instanceof ErrorRevocacion ? error.codigo : 'service_unavailable';
          if (codigo === 'nothing_to_retry' || codigo === 'consent_not_revoked') {
            // El estado ya cambió (otra sesión reintentó o terminó): se recarga sin aviso de error.
            this.actualizar();
          } else if (codigo !== 'unauthorized' && codigo !== 'forbidden') {
            this.falloReintento.set(true);
          }
        },
      });
  }
}
