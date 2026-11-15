import { ChangeDetectionStrategy, Component, input, model, signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { DatosContacto, ErrorDeCampoSolicitud, ubicarCampo } from '@core/api/originacion/solicitud-modificacion.modelos';

import { ContactoCaptura, claveMensaje } from '../../modelos/validaciones-cambio';

type ControlContacto = keyof ContactoCaptura;

/**
 * «Nuevos datos de contacto» de A3 (HU-W1.4-01, tipo «Datos personales»): dirección, teléfono y el correo
 * de contacto de la póliza, que no es el usuario de inicio de sesión (decisión D-5 a). Solo viaja lo que el asegurado
 * escribe; los campos muestran como ayuda el valor actual o «no registrado».
 */
@Component({
  selector: 'app-cambio-datos-personales',
  imports: [TranslocoDirective],
  templateUrl: './cambio-datos-personales.component.html',
  styleUrl: './cambio-datos-personales.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CambioDatosPersonalesComponent {
  readonly actual = input.required<DatosContacto>();
  readonly errores = input<readonly ErrorDeCampoSolicitud[]>([]);
  readonly mostrarTodos = input(false);
  readonly deshabilitado = input(false);
  /** Lo que escribe el asegurado, enlazado con la página. */
  readonly captura = model<ContactoCaptura>({ direccion: '', correo: '', telefono: '' });

  private readonly tocados = signal<ReadonlySet<ControlContacto>>(new Set());

  /** La clave del mensaje del campo (o del grupo, con `null`), cuando ya se tocó o se intentó radicar. */
  protected claveError(control: ControlContacto | null): string | null {
    if (!this.mostrarTodos() && (control === null ? this.tocados().size === 0 : !this.tocados().has(control))) {
      return null;
    }
    const error = this.errores().find((e) => {
      const ubicacion = ubicarCampo(e.campo);
      return ubicacion?.grupo === 'contacto' && ubicacion.control === control;
    });
    return error ? claveMensaje(control ?? 'contacto', error.codigo) : null;
  }

  protected cambiar(control: ControlContacto, evento: Event): void {
    const valor = (evento.target as HTMLInputElement).value;
    this.captura.update((c) => ({ ...c, [control]: valor }));
  }

  protected tocar(control: ControlContacto): void {
    this.tocados.update((t) => new Set(t).add(control));
  }
}
