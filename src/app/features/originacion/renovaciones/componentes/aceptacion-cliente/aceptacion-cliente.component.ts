import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideCircleAlert } from '@lucide/angular';

import { MedioDePago } from '@core/api/originacion/cobro.modelos';
import {
  LONGITUD_CODIGO_CONFIRMACION,
  MAX_REFERENCIA,
  METODOS_ACEPTACION,
  MetodoAceptacion,
  SolicitudFormalizacion,
} from '@core/api/originacion/formalizacion.modelos';
import {
  CampoRenovacionAsistida,
  CodigoRenovacionEnviado,
  FormalizacionRenovacion,
} from '@core/api/originacion/renovacion-asistida.modelos';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';

import { aFechaHoraLocal } from '../../../cotizacion-asistida/formalizar-compra.page';
import { medioLegible } from '../../modelos/presentacion-renovacion';

/** Campos del formulario que pueden mostrar un error: los del contrato y la casilla de confirmación. */
export type CampoAceptacion = Extract<CampoRenovacionAsistida, 'metodo' | 'fecha' | 'referencia' | 'codigo'> | 'confirmo';

/** Máximo de códigos que se pueden enviar por recotización (HU-W1.1-03). */
export const MAX_ENVIOS_CODIGO = 3;

const PATRON_CODIGO = new RegExp(`^[0-9]{${LONGITUD_CODIGO_CONFIRMACION}}$`);
const PATRON_REFERENCIA = /^[A-Za-z0-9._:/#-]+$/;
/** El cliente no puede haber aceptado en el futuro; el servicio tolera 5 minutos de diferencia de reloj. */
const TOLERANCIA_RELOJ_MS = 5 * 60_000;

/**
 * «Aceptación del cliente» de S7 y «Aceptación registrada» de S7b (HU-W1.5-03, CA-2), con el patrón de la compra de
 * HU-W1.1-03 y sus tres medios: llamada grabada o firma remota con su referencia, o un código que el titular recibe
 * por correo («Enviar código», hasta tres envíos, y el campo de 6 dígitos). La casilla confirma que el cliente aceptó
 * y autorizó el cobro con su medio registrado. Cada cambio emite la solicitud si el formulario es válido, o `null`;
 * la página habilita «Formalizar renovación» con ella. Los errores por campo se muestran al tocarlo, y los del
 * servicio llegan por `erroresServidor` y `errorCodigo`.
 */
@Component({
  selector: 'app-aceptacion-cliente',
  imports: [ReactiveFormsModule, TranslocoDirective, FormatoFechaHoraPipe, LucideCircleAlert],
  templateUrl: './aceptacion-cliente.component.html',
  styleUrl: './aceptacion-cliente.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AceptacionClienteComponent implements OnInit {
  private readonly transloco = inject(TranslocoService);
  private readonly destruccion = inject(DestroyRef);

  readonly medioDePago = input<MedioDePago | null>(null);
  /** Cuándo se hizo la recotización: la aceptación no puede ser anterior a ese minuto. */
  readonly recotizadaEn = input<string | null>(null);
  readonly codigoEnviado = input<CodigoRenovacionEnviado | null>(null);
  /** Códigos enviados para la recotización vigente. */
  readonly envios = input(0);
  /** Errores por campo que respondió el servicio (`validation_failed`). */
  readonly erroresServidor = input<Partial<Record<CampoRenovacionAsistida, string>>>({});
  /** Error del código que respondió el servicio (`invalid_confirmation_code`, `too_many_codes`…). */
  readonly errorCodigo = input<string | null>(null);
  /** Sin recotización vigente o con la renovación bloqueada no se puede diligenciar. */
  readonly deshabilitado = input(false);
  readonly trabajando = input(false);
  /** Aceptación ya registrada (S7b): solo lectura. */
  readonly soloLectura = input<FormalizacionRenovacion | null>(null);

  readonly solicitud = output<SolicitudFormalizacion | null>();
  readonly enviarCodigo = output<void>();

  protected readonly metodos = METODOS_ACEPTACION;
  protected readonly maxReferencia = MAX_REFERENCIA;
  protected readonly maxEnvios = MAX_ENVIOS_CODIGO;

  protected readonly formulario = new FormGroup({
    metodo: new FormControl<MetodoAceptacion>('recorded_call', { nonNullable: true }),
    fecha: new FormControl(aFechaHoraLocal(new Date()), { nonNullable: true }),
    referencia: new FormControl('', { nonNullable: true }),
    codigo: new FormControl('', { nonNullable: true }),
    confirmo: new FormControl(false, { nonNullable: true }),
  });

  private readonly valores = toSignal(this.formulario.valueChanges, { initialValue: this.formulario.getRawValue() });
  /** Campos que el asesor ya tocó: sus errores se muestran. */
  private readonly tocados = signal<ReadonlySet<CampoAceptacion>>(new Set());

  protected readonly conCodigo = computed(() => this.valores().metodo === 'confirmation_code');
  protected readonly erroresLocales = computed(() => {
    this.valores();
    return this.validar(this.formulario.getRawValue());
  });
  /** Errores visibles: los del servicio y, de los campos tocados, los del formulario. */
  protected readonly errores = computed<Partial<Record<CampoAceptacion, string>>>(() => {
    const locales = this.erroresLocales();
    const tocados = this.tocados();
    const visibles: Partial<Record<CampoAceptacion, string>> = {};
    for (const [campo, codigo] of Object.entries(locales) as [CampoAceptacion, string][]) {
      if (tocados.has(campo)) {
        visibles[campo] = codigo;
      }
    }
    for (const [campo, codigo] of Object.entries(this.erroresServidor())) {
      if (campo === 'metodo' || campo === 'fecha' || campo === 'referencia' || campo === 'codigo') {
        visibles[campo] = codigo;
      }
    }
    return visibles;
  });
  protected readonly medio = computed(() => {
    const m = this.medioDePago();
    return m ? medioLegible(m, (clave) => this.transloco.translate(clave)) : '';
  });

  ngOnInit(): void {
    this.formulario.valueChanges.pipe(takeUntilDestroyed(this.destruccion)).subscribe(() => this.emitir());
    this.emitir();
  }

  protected tocar(campo: CampoAceptacion): void {
    this.tocados.update((actual) => new Set([...actual, campo]));
  }

  protected cambiarConfirmo(): void {
    this.tocar('confirmo');
  }

  private emitir(): void {
    const valores = this.formulario.getRawValue();
    const errores = this.validar(valores);
    if (Object.keys(errores).length > 0) {
      this.solicitud.emit(null);
      return;
    }
    this.solicitud.emit({
      metodo: valores.metodo,
      aceptadaEn: new Date(valores.fecha).toISOString(),
      referencia: valores.metodo === 'confirmation_code' ? '' : valores.referencia,
      codigo: valores.metodo === 'confirmation_code' ? valores.codigo : undefined,
    });
  }

  /** Revisa el formulario campo por campo, como lo hará el servicio. */
  private validar(valores: ReturnType<typeof this.formulario.getRawValue>): Partial<Record<CampoAceptacion, string>> {
    const { metodo, fecha, referencia, codigo, confirmo } = valores;
    const errores: Partial<Record<CampoAceptacion, string>> = {};
    const instante = new Date(fecha);
    const desde = this.recotizadaEn() ? new Date(this.recotizadaEn() as string) : null;
    if (desde) {
      desde.setSeconds(0, 0);
    }
    if (!fecha) {
      errores.fecha = 'required';
    } else if (Number.isNaN(instante.getTime())) {
      errores.fecha = 'invalid_format';
    } else if (instante.getTime() > Date.now() + TOLERANCIA_RELOJ_MS || (desde && instante.getTime() < desde.getTime())) {
      errores.fecha = 'out_of_range';
    }
    if (metodo === 'confirmation_code') {
      if (!PATRON_CODIGO.test(codigo)) {
        errores.codigo = codigo ? 'invalid_format' : 'required';
      }
    } else {
      const ref = referencia.trim();
      if (!ref) {
        errores.referencia = 'required';
      } else if (ref.length > MAX_REFERENCIA || !PATRON_REFERENCIA.test(ref)) {
        errores.referencia = 'invalid_format';
      }
    }
    if (!confirmo) {
      errores.confirmo = 'required';
    }
    return errores;
  }
}
