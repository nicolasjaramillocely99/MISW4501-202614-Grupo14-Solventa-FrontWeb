import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideCreditCard, LucideLandmark, LucideLock, LucideRefreshCw } from '@lucide/angular';

import { FormatoMonedaPipe } from '@shared/pipes/formato-moneda.pipe';

import { MedioDePagoNuevo, TipoDePersona } from '@core/api/originacion/cobro.modelos';
import { ErrorPasarela, MotivoErrorPasarela } from '@core/api/pasarela/pasarela.modelos';
import { PasarelaPagosService } from '@core/api/pasarela/pasarela.service';

/** Cuotas que ofrece la pantalla; el backend acepta hasta 36. */
export const CUOTAS: readonly number[] = [1, 3, 6, 12, 24, 36];

/** Bancos de PSE. En la demostración son fijos; los publica la pasarela cuando exista. */
export const BANCOS: readonly { codigo: string; nombre: string }[] = [
  { codigo: '1007', nombre: 'Bancolombia' },
  { codigo: '1001', nombre: 'Banco de Bogotá' },
  { codigo: '1051', nombre: 'Davivienda' },
  { codigo: '1013', nombre: 'BBVA Colombia' },
];

/**
 * Suma de comprobación de Luhn. La pasarela la vuelve a hacer y manda, pero
 * comprobarla aquí convierte un dedazo en un mensaje inmediato en vez de en un
 * viaje a la red y un error genérico.
 */
function luhn(numero: string): boolean {
  let suma = 0;
  let doble = false;
  for (let i = numero.length - 1; i >= 0; i--) {
    let d = numero.charCodeAt(i) - 48;
    if (doble) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    suma += d;
    doble = !doble;
  }
  return suma % 10 === 0;
}

function validarTarjeta(control: AbstractControl<string>): ValidationErrors | null {
  const digitos = control.value.replace(/\D/g, '');
  return digitos.length >= 13 && digitos.length <= 19 && luhn(digitos) ? null : { tarjeta: true };
}

/** MM/AA, mes real y no vencida. */
function validarVencimiento(control: AbstractControl<string>): ValidationErrors | null {
  const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(control.value.trim());
  if (!m) return { vencimiento: true };
  const mes = Number(m[1]);
  const anio = 2000 + Number(m[2]);
  if (mes < 1 || mes > 12) return { vencimiento: true };
  const ahora = new Date();
  const finDeMes = new Date(anio, mes, 0, 23, 59, 59);
  return finDeMes >= ahora ? null : { vencida: true };
}

/**
 * E4 · «Paga tu primera prima»: el cliente elige tarjeta o PSE y confirma.
 *
 * **El número de tarjeta no sale de este componente.** Se tokeniza contra la
 * pasarela y lo que se emite es el token con la marca y los últimos cuatro
 * dígitos, que es lo único que llega a Solventa. Por eso el componente habla
 * con la pasarela directamente en lugar de entregarle la tarjeta a la página:
 * así el dato sensible tiene una frontera y se ve en el código dónde está.
 */
@Component({
  selector: 'app-formulario-medio-pago',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslocoDirective, LucideCreditCard, LucideLandmark, LucideLock,
    LucideRefreshCw],
  // El pipe se inyecta para armar la etiqueta del boton, que el frame pide
  // con el monto dentro («Pagar $ 68.500 COP»).
  providers: [FormatoMonedaPipe],
  templateUrl: './formulario-medio-pago.component.html',
  styleUrl: './formulario-medio-pago.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormularioMedioPagoComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly pasarela = inject(PasarelaPagosService);

  /** Deshabilita el formulario mientras la página entrega el medio de pago. */
  readonly enviando = input(false);
  /** Es un reintento tras un rechazo (E4c): cambia el texto del botón. */
  readonly reintento = input(false);
  /** Prima que el botón muestra, como en el frame: «Pagar $ 68.500 COP». */
  readonly monto = input.required<number>();
  readonly moneda = input.required<string>();
  /** Destino de «Volver a la oferta». */
  readonly volverA = input.required<string>();

  /** El medio de pago ya tokenizado. El número de tarjeta nunca viaja aquí. */
  readonly medioElegido = output<MedioDePagoNuevo>();

  private readonly formatoMoneda = inject(FormatoMonedaPipe);

  protected readonly cuotas = CUOTAS;
  protected readonly montoFormateado = computed(() => this.formatoMoneda.transform(this.monto(), this.moneda()));
  protected readonly bancos = BANCOS;

  protected readonly tokenizando = signal(false);
  protected readonly errorPasarela = signal<MotivoErrorPasarela | null>(null);
  protected readonly ocupado = computed(() => this.tokenizando() || this.enviando());

  protected readonly formulario = this.fb.group({
    metodo: this.fb.control<'card' | 'pse'>('card'),
    numero: this.fb.control('', [Validators.required, validarTarjeta]),
    vencimiento: this.fb.control('', [Validators.required, validarVencimiento]),
    codigo: this.fb.control('', [Validators.required, Validators.pattern(/^\d{3,4}$/)]),
    titular: this.fb.control('', [Validators.required, Validators.minLength(3)]),
    cuotas: this.fb.control(1),
    // Deshabilitado a proposito; el porque esta en la plantilla. Se declara
    // asi y no con el atributo disabled del HTML, que en formularios
    // reactivos Angular advierte como error.
    guardar: this.fb.control({ value: false, disabled: true }),
    banco: this.fb.control(BANCOS[0].codigo),
    tipoDePersona: this.fb.control<TipoDePersona>('natural'),
  });

  protected get esTarjeta(): boolean {
    return this.formulario.controls.metodo.value === 'card';
  }

  protected elegirMetodo(metodo: 'card' | 'pse'): void {
    this.formulario.controls.metodo.setValue(metodo);
    this.errorPasarela.set(null);
    // Los campos de la tarjeta solo se exigen cuando la tarjeta está elegida.
    const deTarjeta = [
      this.formulario.controls.numero,
      this.formulario.controls.vencimiento,
      this.formulario.controls.codigo,
      this.formulario.controls.titular,
    ];
    for (const control of deTarjeta) {
      if (metodo === 'card') control.enable();
      else control.disable();
    }
  }

  protected enviar(): void {
    if (this.ocupado()) return;
    this.errorPasarela.set(null);

    if (!this.esTarjeta) {
      this.medioElegido.emit({
        tipo: 'pse',
        codigoBanco: this.formulario.controls.banco.value,
        tipoDePersona: this.formulario.controls.tipoDePersona.value,
      });
      return;
    }

    this.formulario.markAllAsTouched();
    if (this.formulario.invalid) return;

    const { numero, titular, cuotas } = this.formulario.getRawValue();
    this.tokenizando.set(true);
    this.pasarela.tokenizar({ numero, titular }).subscribe({
      next: (tarjeta) => {
        this.tokenizando.set(false);
        // A partir de aquí el número ya no existe: solo el token.
        this.medioElegido.emit({
          tipo: 'card',
          token: tarjeta.token,
          marca: tarjeta.marca,
          ultimosCuatro: tarjeta.ultimosCuatro,
          cuotas,
        });
      },
      error: (error: unknown) => {
        this.tokenizando.set(false);
        this.errorPasarela.set(error instanceof ErrorPasarela ? error.motivo : 'pasarela_no_disponible');
      },
    });
  }

  protected invalido(campo: 'numero' | 'vencimiento' | 'codigo' | 'titular'): boolean {
    const control = this.formulario.controls[campo];
    return control.invalid && control.touched;
  }
}
