import { ChangeDetectionStrategy, Component, computed, effect, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideCircleAlert, LucideCircleCheck, LucideCircleX } from '@lucide/angular';
import { map, startWith } from 'rxjs';

import { Cobertura, Desglose, calcularDesglose } from '@core/api/siniestros/evaluacion.modelos';
import { FormatoMonedaPipe } from '@shared/pipes/formato-moneda.pipe';

export type OpcionDecision = 'aprobar' | 'rechazar';

/** Errores del servidor que se muestran en su campo (`422` del contrato). */
export interface ErroresServidorDecision {
  bruto?: 'amount_exceeds_insured_value' | 'amount_out_of_range' | 'nothing_to_pay';
  motivo?: 'reason_required' | 'reason_too_long';
}

/** Máximo del motivo de rechazo, igual que el backend. */
export const MAX_MOTIVO = 1000;

/**
 * Bloque «Decisión» de O6 (HU-W2.2-03, CA-2 y CA-3). **Aprobar:** el analista escribe el costo **bruto** aprobado
 * (precargado con el monto estimado del asegurado), que no puede superar el valor asegurado, y ve el desglose: menos
 * el deducible a cargo del asegurado, el **monto aprobado** neto que paga la aseguradora. **Rechazar:** el motivo es
 * obligatorio y se notifica al cliente. Sin cobertura conocida (núcleo caído o incidente no cubierto) el bloque se
 * deshabilita.
 */
@Component({
  selector: 'app-decision-siniestro',
  imports: [ReactiveFormsModule, TranslocoDirective, FormatoMonedaPipe, LucideCircleAlert, LucideCircleCheck, LucideCircleX],
  templateUrl: './decision-siniestro.component.html',
  styleUrl: './decision-siniestro.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DecisionSiniestroComponent {
  /** La cobertura del incidente; `null` deshabilita la aprobación. */
  readonly cobertura = input<Cobertura | null>(null);
  /** Monto estimado por el asegurado, en pesos, para precargar el costo bruto. */
  readonly montoSugerido = input<number | null>(null);
  readonly deshabilitado = input(false);
  readonly enviando = input(false);
  readonly erroresServidor = input<ErroresServidorDecision>({});

  readonly aprobar = output<number>();
  readonly rechazar = output<string>();
  readonly campoEditado = output<'bruto' | 'motivo'>();

  protected readonly opciones: readonly OpcionDecision[] = ['aprobar', 'rechazar'];
  protected readonly maxMotivo = MAX_MOTIVO;
  protected enviado = false;

  protected readonly formulario = new FormGroup({
    opcion: new FormControl<OpcionDecision>('aprobar', { nonNullable: true }),
    bruto: new FormControl<number | null>(null, [Validators.required, Validators.min(1)]),
    motivo: new FormControl('', { nonNullable: true }),
  });

  private readonly valores = toSignal(
    this.formulario.valueChanges.pipe(
      startWith(this.formulario.getRawValue()),
      map(() => this.formulario.getRawValue()),
    ),
    { initialValue: this.formulario.getRawValue() },
  );

  protected readonly opcion = computed(() => this.valores().opcion);

  /** Desglose en vivo con la misma regla del backend; `null` sin un bruto válido o sin cobertura. */
  protected readonly desglose = computed<Desglose | null>(() => {
    const cobertura = this.cobertura();
    const bruto = this.valores().bruto;
    if (!cobertura || bruto === null || !(bruto > 0)) {
      return null;
    }
    return calcularDesglose(bruto, cobertura.deduciblePuntosBasicos);
  });

  protected readonly porcentajeDeducible = computed(() => (this.cobertura()?.deduciblePuntosBasicos ?? 0) / 100);

  constructor() {
    // Precarga el bruto con el monto estimado mientras el analista no lo haya escrito.
    effect(() => {
      const sugerido = this.montoSugerido();
      const control = this.formulario.controls.bruto;
      if (sugerido !== null && control.value === null && !control.dirty) {
        control.setValue(sugerido);
      }
    });
    effect(() => {
      if (this.deshabilitado()) {
        this.formulario.disable({ emitEvent: false });
      } else {
        this.formulario.enable({ emitEvent: false });
      }
    });
  }

  /** Clave del error que se muestra en el campo, o `null`. El del servidor gana mientras no se edite el campo. */
  protected errorDe(campo: 'bruto' | 'motivo'): string | null {
    const servidor = this.erroresServidor()[campo];
    if (servidor) {
      return servidor;
    }
    if (!this.enviado) {
      return null;
    }
    if (campo === 'bruto' && this.opcion() === 'aprobar') {
      const valor = this.formulario.controls.bruto.value;
      const tope = this.cobertura()?.valorAsegurado ?? Infinity;
      if (valor === null || !(valor > 0)) {
        return 'requerido';
      }
      if (valor > tope) {
        return 'amount_exceeds_insured_value';
      }
    }
    if (campo === 'motivo' && this.opcion() === 'rechazar') {
      const motivo = this.formulario.controls.motivo.value.trim();
      if (motivo === '') {
        return 'reason_required';
      }
      if ([...motivo].length > MAX_MOTIVO) {
        return 'reason_too_long';
      }
    }
    return null;
  }

  protected editado(campo: 'bruto' | 'motivo'): void {
    this.campoEditado.emit(campo);
  }

  protected enviar(): void {
    this.enviado = true;
    if (this.deshabilitado() || this.enviando()) {
      return;
    }
    if (this.opcion() === 'aprobar') {
      const bruto = this.formulario.controls.bruto.value;
      if (this.errorDe('bruto') === null && bruto !== null) {
        this.aprobar.emit(bruto);
      }
      return;
    }
    if (this.errorDe('motivo') === null) {
      this.rechazar.emit(this.formulario.controls.motivo.value.trim());
    }
  }
}
