import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideCircleAlert, LucideRefreshCw } from '@lucide/angular';

import { Decision, DestinoPago } from '@core/api/siniestros/evaluacion.modelos';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';
import { FormatoMonedaPipe } from '@shared/pipes/formato-moneda.pipe';

/** Mismos patrones que el contrato (`PayoutDestination`). */
const PATRON_BANCO = /^[0-9]{3,6}$/;
const PATRON_CUENTA = /^[0-9][0-9-]{4,22}[0-9]$/;

type PasoPago = 'hecho' | 'actual' | 'fallido' | 'pendiente';

/**
 * Bloque «Pago de la indemnización» de O6 y O6b (HU-W2.2-03, CA-2 y CA-4): quién aprobó y cuándo, el monto aprobado
 * neto con su desglose, la referencia idempotente del pago, los intentos y su estado. En una excepción de pago muestra
 * el destino y deja corregirlo: con la cuenta vacía se reintenta a la misma (útil si la pasarela no respondía). El
 * reintento usa siempre la misma clave, así que nunca paga dos veces.
 */
@Component({
  selector: 'app-pago-indemnizacion',
  imports: [ReactiveFormsModule, TranslocoDirective, FormatoMonedaPipe, FormatoFechaHoraPipe, LucideCircleAlert, LucideRefreshCw],
  templateUrl: './pago-indemnizacion.component.html',
  styleUrl: './pago-indemnizacion.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PagoIndemnizacionComponent {
  readonly decision = input.required<Decision>();
  readonly enviando = input(false);

  readonly reintentar = output<DestinoPago | undefined>();

  protected readonly enviado = signal(false);

  protected readonly formulario = new FormGroup({
    codigoBanco: new FormControl('', { nonNullable: true, validators: [Validators.pattern(PATRON_BANCO)] }),
    nombreBanco: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(80)] }),
    tipoCuenta: new FormControl<'savings' | 'checking'>('savings', { nonNullable: true }),
    numeroCuenta: new FormControl('', { nonNullable: true }),
  });

  protected readonly pago = computed(() => this.decision().pago);
  protected readonly fallido = computed(() => this.pago()?.estado === 'failed');

  /** Pasos del pago, como en O6b: aprobación, solicitud a la pasarela, reintentos automáticos y pagado. */
  protected readonly pasos = computed<{ clave: string; estado: PasoPago }[]>(() => {
    const p = this.pago();
    if (!p) {
      return [];
    }
    const solicitado: PasoPago = p.estado === 'pending' ? 'actual' : p.falla === 'rejected' ? 'fallido' : 'hecho';
    const reintentos: PasoPago =
      p.falla === 'retries_exhausted' ? 'fallido' : p.intentosAutomaticos > 0 && p.estado !== 'paid' ? 'actual' : 'hecho';
    return [
      { clave: 'aprobado', estado: 'hecho' },
      { clave: 'solicitado', estado: solicitado },
      { clave: 'reintentos', estado: p.falla === 'rejected' ? 'pendiente' : reintentos },
      { clave: 'pagado', estado: p.estado === 'paid' ? 'hecho' : 'pendiente' },
    ];
  });

  constructor() {
    // El banco y el tipo de cuenta parten del destino actual; el número completo nunca llega al portal.
    effect(() => {
      const destino = this.pago()?.destino;
      if (destino) {
        untracked(() =>
          this.formulario.patchValue({
            codigoBanco: destino.codigoBanco,
            nombreBanco: destino.nombreBanco,
            tipoCuenta: destino.tipoCuenta === 'checking' ? 'checking' : 'savings',
            numeroCuenta: '',
          }),
        );
      }
    });
  }

  /** Error del destino, solo si se escribió una cuenta nueva (sin cuenta se reintenta al mismo destino). */
  protected errorDe(campo: 'codigoBanco' | 'numeroCuenta'): string | null {
    if (!this.enviado()) {
      return null;
    }
    const numero = this.formulario.controls.numeroCuenta.value.trim();
    if (numero === '') {
      return null;
    }
    if (campo === 'numeroCuenta' && !PATRON_CUENTA.test(numero)) {
      return 'cuenta';
    }
    if (campo === 'codigoBanco' && !PATRON_BANCO.test(this.formulario.controls.codigoBanco.value.trim())) {
      return 'banco';
    }
    return null;
  }

  protected enviar(): void {
    this.enviado.set(true);
    if (this.enviando() || this.errorDe('codigoBanco') || this.errorDe('numeroCuenta')) {
      return;
    }
    const v = this.formulario.getRawValue();
    const numero = v.numeroCuenta.trim();
    this.reintentar.emit(
      numero === ''
        ? undefined
        : {
            codigoBanco: v.codigoBanco.trim(),
            nombreBanco: v.nombreBanco.trim(),
            tipoCuenta: v.tipoCuenta,
            numeroCuenta: numero,
          },
    );
  }
}
