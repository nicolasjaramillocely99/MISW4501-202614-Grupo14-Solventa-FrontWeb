import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, inject, input, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideCircleAlert, LucideCircleCheck, LucideCircleX, LucideSlidersHorizontal } from '@lucide/angular';

import { TipoDecision } from '@core/api/originacion/aceptacion.modelos';
import { RegistroDecision } from '@core/api/originacion/revision.modelos';

/** Límites de la decisión; los valida también el backend, que manda (contrato HU-W1.1-02, §2.3). */
export const MAX_OBSERVACIONES = 1000;
export const MAX_AJUSTE_PCT = 100;

/** Campos del formulario en el orden de la pantalla; el `id` de cada control es su nombre. */
export type CampoDecision = 'tipo' | 'ajustePrimaPct' | 'observaciones';
const ORDEN_CAMPOS: readonly CampoDecision[] = ['tipo', 'ajustePrimaPct', 'observaciones'];

/** Errores que devolvió el backend para un campo (`observations_required`, `premium_adjustment_invalid`). */
export type ErroresServidorDecision = Partial<Record<'ajustePrimaPct' | 'observaciones', true>>;

const OPCIONES: readonly TipoDecision[] = ['accept', 'adjust', 'reject'];

/** Recargo mayor que 0 y hasta 100, con máximo dos decimales (decisión D-4 a). */
function validarAjuste(control: AbstractControl<number | null>): ValidationErrors | null {
  const valor = control.value;
  if (valor === null) {
    return null;
  }
  const centesimas = valor * 100;
  const dosDecimales = Math.abs(centesimas - Math.round(centesimas)) < 1e-6;
  return valor > 0 && valor <= MAX_AJUSTE_PCT && dosDecimales ? null : { rango: true };
}

/** Observaciones con algo más que espacios. */
function validarTexto(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim() === '' ? { required: true } : null;
}

/**
 * Bloque «Decisión» del detalle (S5, CA-2): el asesor elige aceptar, ajustar o rechazar el riesgo. «Ajuste de prima
 * (%)» solo se habilita al ajustar y las observaciones son obligatorias al ajustar o rechazar. Cada campo muestra su
 * error (del navegador o del backend) asociado con `aria-describedby`, y al enviar con errores el foco va al primero.
 * Emite el registro listo para el cliente HTTP; no llama al backend.
 */
@Component({
  selector: 'app-formulario-decision',
  imports: [
    ReactiveFormsModule,
    TranslocoDirective,
    LucideCircleAlert,
    LucideCircleCheck,
    LucideCircleX,
    LucideSlidersHorizontal,
  ],
  templateUrl: './formulario-decision.component.html',
  styleUrl: './formulario-decision.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormularioDecisionComponent implements OnInit {
  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destruccion = inject(DestroyRef);

  /** `POST` en curso: el botón queda deshabilitado. */
  readonly enviando = input(false);
  readonly erroresServidor = input<ErroresServidorDecision>({});
  readonly registrar = output<RegistroDecision>();
  /** El asesor editó un campo con error del backend: la página lo limpia. */
  readonly campoEditado = output<'ajustePrimaPct' | 'observaciones'>();

  protected readonly opciones = OPCIONES;
  protected readonly maxObservaciones = MAX_OBSERVACIONES;

  protected readonly formulario = inject(NonNullableFormBuilder).group({
    tipo: ['' as TipoDecision | '', Validators.required],
    ajustePrimaPct: [{ value: null as number | null, disabled: true }, [Validators.required, validarAjuste]],
    observaciones: ['', Validators.maxLength(MAX_OBSERVACIONES)],
  });

  ngOnInit(): void {
    const { tipo, ajustePrimaPct, observaciones } = this.formulario.controls;
    tipo.valueChanges.pipe(takeUntilDestroyed(this.destruccion)).subscribe((valor) => {
      if (valor === 'adjust') {
        ajustePrimaPct.enable();
      } else {
        ajustePrimaPct.reset(null);
        ajustePrimaPct.disable();
      }
      observaciones.setValidators(
        valor === 'adjust' || valor === 'reject'
          ? [validarTexto, Validators.maxLength(MAX_OBSERVACIONES)]
          : Validators.maxLength(MAX_OBSERVACIONES),
      );
      observaciones.updateValueAndValidity();
    });
    ajustePrimaPct.valueChanges.pipe(takeUntilDestroyed(this.destruccion)).subscribe(() => this.campoEditado.emit('ajustePrimaPct'));
    observaciones.valueChanges.pipe(takeUntilDestroyed(this.destruccion)).subscribe(() => this.campoEditado.emit('observaciones'));
  }

  /** Clave i18n del error de un campo (relativa a `originacion.bandejaDecision.formulario.errores`), o `null`. */
  protected errorDe(campo: CampoDecision): string | null {
    if (campo !== 'tipo' && this.erroresServidor()[campo]) {
      return campo === 'observaciones' ? 'observaciones.required' : 'ajustePrimaPct.rango';
    }
    const control = this.formulario.controls[campo];
    if (!control.touched || control.valid || control.disabled) {
      return null;
    }
    if (control.hasError('required')) {
      return `${campo}.required`;
    }
    return campo === 'observaciones' ? 'observaciones.maxlength' : `${campo}.rango`;
  }

  protected enviar(): void {
    if (this.enviando()) {
      return;
    }
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.enfocarPrimerCampoInvalido();
      return;
    }
    const v = this.formulario.getRawValue();
    const tipo = v.tipo as TipoDecision;
    const registro: RegistroDecision = { tipo, observaciones: v.observaciones.trim() };
    if (tipo === 'adjust' && v.ajustePrimaPct !== null) {
      registro.ajustePrimaPct = v.ajustePrimaPct;
    }
    this.registrar.emit(registro);
  }

  private enfocarPrimerCampoInvalido(): void {
    const primero = ORDEN_CAMPOS.find((campo) => this.errorDe(campo) !== null);
    if (!primero) {
      return;
    }
    const selector = primero === 'tipo' ? 'input[name="tipo"]' : `#${primero}`;
    this.elemento.nativeElement.querySelector<HTMLElement>(selector)?.focus();
  }
}
