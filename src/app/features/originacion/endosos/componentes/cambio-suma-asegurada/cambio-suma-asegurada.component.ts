import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { ErrorDeCampoSolicitud } from '@core/api/originacion/solicitud-modificacion.modelos';
import { FormatoMonedaPipe } from '@shared/pipes/formato-moneda.pipe';

import { claveMensaje } from '../../modelos/validaciones-cambio';

/**
 * «Nueva suma asegurada» de A3 (HU-W1.4-01, frame derivado de A3 «Sumas aseguradas»): el valor asegurado actual, de solo
 * lectura, y el nuevo valor en COP con sus límites como ayuda. El texto lo valida la página (`validarValorAsegurado`).
 */
@Component({
  selector: 'app-cambio-suma-asegurada',
  imports: [TranslocoDirective, FormatoMonedaPipe],
  templateUrl: './cambio-suma-asegurada.component.html',
  styleUrl: './cambio-suma-asegurada.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CambioSumaAseguradaComponent {
  readonly actual = input.required<number>();
  readonly moneda = input('COP');
  readonly limites = input.required<{ valorMinimo: number; valorMaximo: number }>();
  readonly errores = input<readonly ErrorDeCampoSolicitud[]>([]);
  readonly mostrarTodos = input(false);
  readonly deshabilitado = input(false);
  /** Lo que escribe el asegurado, enlazado con la página. */
  readonly texto = model('');

  private readonly tocado = signal(false);

  /** La clave del mensaje de error del campo, cuando ya se tocó o se intentó radicar. */
  protected readonly claveError = computed(() => {
    const error = this.errores().find((e) => e.campo === 'insured_amount');
    return error && (this.tocado() || this.mostrarTodos()) ? claveMensaje('valorAsegurado', error.codigo) : null;
  });

  protected cambiar(evento: Event): void {
    this.texto.set((evento.target as HTMLInputElement).value);
  }

  protected tocar(): void {
    this.tocado.set(true);
  }
}
