import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import {
  LucideArrowLeft,
  LucideCheck,
  LucideCircleAlert,
  LucideCircleCheck,
  LucideCircleX,
  LucideInfo,
  LucideTriangleAlert,
} from '@lucide/angular';
import { map } from 'rxjs';

import {
  DecisionEndoso,
  DetalleEndoso,
  ErrorEndoso,
  EstadoEndoso,
  ResultadoAplicacion,
  SolicitudEndoso,
  Validacion,
  estadoParaAnalista,
} from '@core/api/originacion/endosos.modelos';
import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';
import { FormatoMonedaPipe } from '@shared/pipes/formato-moneda.pipe';
import { InsigniaEstadoComponent } from '@shared/ui/insignia-estado/insignia-estado.component';

import { TONO_ENDOSO } from './bandeja-endosos.page';
import { ListaValidacionesComponent } from './componentes/lista-validaciones/lista-validaciones.component';
import { TablaCambiosComponent } from './componentes/tabla-cambios/tabla-cambios.component';
import { FilaCambio, fecha, fechaHora, filasCambio, formatoDe, textoValidacion } from './modelos/formato-endoso';

/** Fase de la carga del detalle. */
export type FaseDetalleEndoso = 'cargando' | 'listo' | 'noEncontrada' | 'error';

/**
 * Qué puede hacer el analista según el estado (plan §5.1 b): revisar (radicada o en revisión: *Rechazar* / *Aplicar
 * endoso*), devolver una no aplicada sin devolver (*Volver a la bandeja* / *Devolver al asegurado*) o solo leer lo decidido.
 */
export type ModoDetalleEndoso = 'revision' | 'noAplicado' | 'devuelto' | 'aplicada' | 'rechazada' | 'soloLectura';

type Accion = 'aplicar' | 'rechazar' | 'devolver';

/** El aviso que deja la última acción del analista. */
export type AlertaEndoso =
  | { tipo: 'aplicado'; endoso: string }
  | { tipo: 'rechazado' }
  | { tipo: 'devueltoOk' }
  /** `503 validation_unverifiable`: no cambió nada; `codigos` son las validaciones sin respuesta. */
  | { tipo: 'noVerificable'; codigos: readonly string[] }
  /** `409`: otro analista decidió antes. */
  | { tipo: 'decidida'; estado: EstadoEndoso }
  /** `409 policy_changed`: otro endoso de la misma póliza se aplicó antes. */
  | { tipo: 'polizaCambio' }
  | { tipo: 'fallo' };

type TonoAviso = 'exito' | 'advertencia' | 'error' | 'informacion';

const P = 'originacion.endosos.detalle';
/** Observaciones de *Rechazar* y *Devolver al asegurado*: las lee el asegurado (mismo rango que el backend). */
const MIN_OBSERVACIONES = 10;
const MAX_OBSERVACIONES = 500;

export function modoDetalle(solicitud: SolicitudEndoso | undefined): ModoDetalleEndoso {
  switch (solicitud?.estado) {
    case 'radicada':
    case 'enRevision':
      return 'revision';
    case 'noAplicado':
      return solicitud.devuelta ? 'devuelto' : 'noAplicado';
    case 'aplicada':
      return 'aplicada';
    case 'rechazada':
      return 'rechazada';
    default:
      return 'soloLectura';
  }
}

/**
 * O3 · Detalle del endoso y O3b · Endoso no aplicado (HU-W1.4-02, frames `34:3402` y `836:9166`), y el detalle de solo
 * lectura de lo ya decidido. Muestra el cambio solicitado con sus valores anterior y nuevo, las validaciones de negocio
 * (la vista previa o las del intento registrado), el panel «Póliza» con «Endosos previos» enlazado al historial y el
 * panel de lo que pasa al aplicar o de por qué no se aplicó (CA-1, CA-2).
 *
 * *Aplicar endoso* valida y crea el endoso o registra el intento no aplicado; *Rechazar* y *Devolver al asegurado* exigen
 * observaciones de 10 a 500 caracteres, visibles para el asegurado (CA-5). Un `409` avisa que otro analista ya decidió y
 * recarga; un `503` avisa que una validación no se pudo verificar sin cambiar nada (falla cerrada). 401 y 403 los
 * resuelve el interceptor.
 *
 * Ruta: `/originacion/endosos/:id` (solo operaciones).
 */
@Component({
  selector: 'app-detalle-endoso-page',
  imports: [
    RouterLink,
    TranslocoDirective,
    InsigniaEstadoComponent,
    TablaCambiosComponent,
    ListaValidacionesComponent,
    FormatoFechaHoraPipe,
    FormatoMonedaPipe,
    LucideArrowLeft,
    LucideCheck,
    LucideCircleAlert,
    LucideCircleCheck,
    LucideCircleX,
    LucideInfo,
    LucideTriangleAlert,
  ],
  templateUrl: './detalle-endoso.page.html',
  styleUrl: './detalle-endoso.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetalleEndosoPage implements OnInit {
  private readonly api = inject(OriginacionApiService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly transloco = inject(TranslocoService);
  private readonly destruccion = inject(DestroyRef);
  private readonly campoObservaciones = viewChild<ElementRef<HTMLTextAreaElement>>('campoObservaciones');
  private solicitudId = '';

  protected readonly tono = TONO_ENDOSO;
  protected readonly maximo = MAX_OBSERVACIONES;
  protected readonly fase = signal<FaseDetalleEndoso>('cargando');
  protected readonly detalle = signal<DetalleEndoso | null>(null);
  protected readonly alerta = signal<AlertaEndoso | null>(null);
  protected readonly enviando = signal<Accion | null>(null);
  protected readonly observaciones = signal('');
  protected readonly errorObservaciones = signal(false);

  protected readonly modo = computed(() => modoDetalle(this.detalle()?.solicitud));

  /** Las validaciones a la vista; tras un `503`, las que no respondieron se marcan «No verificable». */
  protected readonly validaciones = computed<readonly Validacion[]>(() => {
    const detalle = this.detalle();
    const alerta = this.alerta();
    if (!detalle) {
      return [];
    }
    if (alerta?.tipo !== 'noVerificable') {
      return detalle.validaciones;
    }
    return detalle.validaciones.map((v) => (alerta.codigos.includes(v.codigo) ? { ...v, resultado: 'unverifiable' as const } : v));
  });

  /** La validación que no cumplió, para la alerta roja de O3b. */
  protected readonly fallida = computed(() => {
    const detalle = this.detalle();
    return detalle?.decision?.fallidas[0] ?? detalle?.validaciones.find((v) => v.resultado === 'failed')?.codigo ?? null;
  });

  ngOnInit(): void {
    this.ruta.paramMap
      .pipe(
        map((parametros) => parametros.get('id') ?? ''),
        takeUntilDestroyed(this.destruccion),
      )
      .subscribe((id) => {
        this.solicitudId = id;
        this.alerta.set(null);
        this.observaciones.set('');
        this.errorObservaciones.set(false);
        this.cargar();
      });
  }

  protected cargar(): void {
    this.fase.set('cargando');
    this.api.consultarSolicitudEndoso(this.solicitudId).subscribe({
      next: (detalle) => {
        this.detalle.set(detalle);
        this.fase.set('listo');
      },
      error: (error: unknown) => {
        const codigo = error instanceof ErrorEndoso ? error.codigo : 'endorsement_unavailable';
        if (codigo === 'unauthorized' || codigo === 'forbidden') {
          return;
        }
        this.fase.set(codigo === 'change_request_not_found' ? 'noEncontrada' : 'error');
      },
    });
  }

  protected escribir(evento: Event): void {
    this.observaciones.set((evento.target as HTMLTextAreaElement).value);
    if (this.errorObservaciones() && this.observacionesValidas() !== null) {
      this.errorObservaciones.set(false);
    }
  }

  /** *Aplicar endoso*: aplicada con su número o no aplicada con el intento registrado (CA-2, CA-3). */
  protected aplicar(): void {
    if (this.enviando()) {
      return;
    }
    this.alerta.set(null);
    this.enviando.set('aplicar');
    this.api.aplicarEndoso(this.solicitudId).subscribe({
      next: (resultado) => {
        this.enviando.set(null);
        this.integrarAplicacion(resultado);
        if (resultado.resultado === 'applied' && resultado.endoso) {
          this.alerta.set({ tipo: 'aplicado', endoso: resultado.endoso.endosoId });
        }
        this.refrescar();
      },
      error: (error: unknown) => this.fallarAccion(error),
    });
  }

  protected rechazar(): void {
    this.cerrar('rechazar');
  }

  protected devolver(): void {
    this.cerrar('devolver');
  }

  protected filas(detalle: DetalleEndoso): FilaCambio[] {
    return filasCambio(
      formatoDe(this.transloco),
      detalle.solicitud.tipo,
      detalle.cambios,
      detalle.poliza.oneroso,
      detalle.prima,
      detalle.poliza.moneda,
    );
  }

  /** «Vida hipotecario»; una línea sin texto se muestra tal cual. */
  protected producto(linea: string): string {
    const clave = `originacion.endosos.linea.${linea}`;
    const texto = this.transloco.translate(clave);
    return texto === clave ? linea : texto;
  }

  protected canal(canal: string): 'web' | 'mobile' {
    return canal === 'mobile' ? 'mobile' : 'web';
  }

  /** «1 · último: datos personales (16/09/2026)» o «Ninguno». */
  protected endososPrevios(detalle: DetalleEndoso): string {
    const { cantidad, ultimo } = detalle.poliza.endososPrevios;
    if (cantidad === 0 || !ultimo) {
      return this.transloco.translate(`${P}.poliza.ninguno`);
    }
    const f = formatoDe(this.transloco);
    return this.transloco.translate(`${P}.poliza.ultimo`, {
      n: cantidad,
      tipo: this.transloco.translate(`originacion.endosos.tipos.${ultimo.tipo}`).toLocaleLowerCase(f.idioma),
      fecha: fecha(f, ultimo.aplicadoEn),
    });
  }

  /** El título de una validación por su código (alertas de O3b). */
  protected tituloValidacion(codigo: string): string {
    return textoValidacion(formatoDe(this.transloco), { codigo, resultado: 'failed', parametros: {} }).titulo;
  }

  /** El aviso de la última acción. */
  protected aviso(alerta: AlertaEndoso): { tono: TonoAviso; titulo: string; texto: string } {
    const t = (clave: string, parametros?: Record<string, unknown>) => this.transloco.translate(`${P}.alertas.${clave}`, parametros);
    switch (alerta.tipo) {
      case 'aplicado':
        return { tono: 'exito', titulo: t('aplicado.titulo'), texto: t('aplicado.texto', { endoso: alerta.endoso }) };
      case 'rechazado':
        return { tono: 'exito', titulo: t('rechazado.titulo'), texto: t('rechazado.texto') };
      case 'devueltoOk':
        return { tono: 'exito', titulo: t('devueltoOk.titulo'), texto: t('devueltoOk.texto') };
      case 'noVerificable':
        return {
          tono: 'advertencia',
          titulo: t('noVerificable.titulo'),
          texto: t('noVerificable.texto', { fuentes: this.fuentes(alerta.codigos) }),
        };
      case 'decidida':
        return {
          tono: 'informacion',
          titulo: t('decidida.titulo'),
          texto: t('decidida.texto', { estado: this.transloco.translate(`originacion.endosos.estados.${alerta.estado}`) }),
        };
      case 'polizaCambio':
        return { tono: 'advertencia', titulo: t('polizaCambio.titulo'), texto: t('polizaCambio.texto') };
      default:
        return { tono: 'error', titulo: t('fallo.titulo'), texto: t('fallo.texto') };
    }
  }

  /** El panel lateral: qué pasa al aplicar, por qué no se aplicó o lo que se decidió. */
  protected panel(detalle: DetalleEndoso): { titulo: string; texto: string } | null {
    const t = (clave: string, parametros?: Record<string, unknown>) => this.transloco.translate(`${P}.panel.${clave}`, parametros);
    const decision = detalle.decision;
    const f = formatoDe(this.transloco);
    switch (this.modo()) {
      case 'revision':
        return { titulo: t('alAplicar.titulo'), texto: t(`alAplicar.${detalle.solicitud.tipo}`) };
      case 'noAplicado':
        return { titulo: t('noAplicado.titulo'), texto: t('noAplicado.texto') };
      case 'devuelto':
        return { titulo: t('devuelto.titulo'), texto: t('devuelto.texto') };
      case 'aplicada':
        return decision
          ? {
              titulo: t('aplicado.titulo'),
              texto: t('aplicado.texto', {
                endoso: decision.endosoId ?? '',
                autor: decision.por?.nombre ?? '',
                fecha: fechaHora(f, decision.en),
              }),
            }
          : null;
      case 'rechazada':
        return decision
          ? {
              titulo: t('rechazado.titulo'),
              texto: t('rechazado.texto', { autor: decision.por?.nombre ?? '', fecha: fechaHora(f, decision.en) }),
            }
          : null;
      default:
        return null;
    }
  }

  /** «Devuelto al asegurado»: quién y cuándo. */
  protected devolucion(detalle: DetalleEndoso): { autor: string; fecha: string } {
    const decision = detalle.decision;
    return { autor: decision?.por?.nombre ?? '', fecha: decision ? fechaHora(formatoDe(this.transloco), decision.en) : '' };
  }

  /** «La verificación de documentos», «La consulta de siniestros y el cálculo de la prima»… */
  private fuentes(codigos: readonly string[]): string {
    const nombres = [
      ...new Set(
        (codigos.length > 0 ? codigos : ['otra']).map((codigo) => {
          const clave = `${P}.fuentes.${codigo}`;
          const texto = this.transloco.translate(clave);
          return texto === clave ? this.transloco.translate(`${P}.fuentes.otra`) : texto;
        }),
      ),
    ];
    if (nombres.length === 1) {
      return nombres[0];
    }
    const idioma = this.transloco.getActiveLang();
    const resto = nombres.slice(1).map((n) => n.charAt(0).toLocaleLowerCase(idioma) + n.slice(1));
    return this.transloco.translate(`${P}.fuentes.y`, { a: [nombres[0], ...resto.slice(0, -1)].join(', '), b: resto[resto.length - 1] });
  }

  private cerrar(accion: 'rechazar' | 'devolver'): void {
    if (this.enviando()) {
      return;
    }
    const texto = this.observacionesValidas();
    if (texto === null) {
      this.errorObservaciones.set(true);
      this.campoObservaciones()?.nativeElement.focus();
      return;
    }
    this.errorObservaciones.set(false);
    this.alerta.set(null);
    this.enviando.set(accion);
    const peticion =
      accion === 'rechazar'
        ? this.api.rechazarSolicitudEndoso(this.solicitudId, texto)
        : this.api.devolverSolicitudEndoso(this.solicitudId, texto);
    peticion.subscribe({
      next: (solicitud) => {
        this.enviando.set(null);
        this.detalle.update((d) => (d ? { ...d, solicitud } : d));
        this.observaciones.set('');
        this.alerta.set({ tipo: accion === 'rechazar' ? 'rechazado' : 'devueltoOk' });
        this.refrescar();
      },
      error: (error: unknown) => this.fallarAccion(error),
    });
  }

  /** El texto sin espacios de los extremos, o `null` fuera de 10 a 500 caracteres. */
  private observacionesValidas(): string | null {
    const texto = this.observaciones().trim();
    const largo = [...texto].length;
    return largo >= MIN_OBSERVACIONES && largo <= MAX_OBSERVACIONES ? texto : null;
  }

  private fallarAccion(error: unknown): void {
    this.enviando.set(null);
    const e = error instanceof ErrorEndoso ? error : new ErrorEndoso('endorsement_unavailable');
    switch (e.codigo) {
      case 'unauthorized':
      case 'forbidden':
        return;
      case 'validation_unverifiable':
        this.alerta.set({ tipo: 'noVerificable', codigos: e.noVerificables });
        return;
      case 'request_already_decided':
      case 'not_returnable':
        this.alerta.set({ tipo: 'decidida', estado: estadoParaAnalista(e.estadoActual ?? '') });
        this.refrescar();
        return;
      case 'policy_changed':
        this.alerta.set({ tipo: 'polizaCambio' });
        this.refrescar();
        return;
      case 'observations_required':
        this.errorObservaciones.set(true);
        return;
      default:
        this.alerta.set({ tipo: 'fallo' });
    }
  }

  /** Lo que devolvió *Aplicar* se ve de una vez; `refrescar` trae luego el panel de la póliza. */
  private integrarAplicacion(resultado: ResultadoAplicacion): void {
    const decision: DecisionEndoso | null = resultado.endoso
      ? {
          resultado: 'applied',
          por: resultado.endoso.por,
          en: resultado.endoso.aplicadoEn,
          observaciones: null,
          endosoId: resultado.endoso.endosoId,
          fallidas: [],
        }
      : resultado.intento
        ? {
            resultado: 'not_applied',
            por: resultado.intento.por,
            en: resultado.intento.en,
            observaciones: null,
            endosoId: null,
            fallidas: resultado.intento.fallidas,
          }
        : null;
    this.detalle.update((d) =>
      d
        ? { ...d, solicitud: resultado.solicitud, validaciones: resultado.validaciones, origenValidaciones: 'attempt', decision }
        : d,
    );
  }

  /** Vuelve a leer el detalle sin la fase de carga; si falla, se queda lo que ya se ve. */
  private refrescar(): void {
    this.api.consultarSolicitudEndoso(this.solicitudId).subscribe({
      next: (detalle) => this.detalle.set(detalle),
      error: () => undefined,
    });
  }
}
