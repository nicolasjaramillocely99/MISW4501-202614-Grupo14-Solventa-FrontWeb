import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideX } from '@lucide/angular';
import { startWith } from 'rxjs';

import { CampoSocio, ErrorSocios, SolicitudRegistroSocio, TIPOS_SOCIO } from '@core/api/socios/socios.modelos';

import { FORMULARIO_INICIAL, FormularioRegistro, aSolicitudRegistro, validarRegistro } from '../../modelos/presentacion-socios';

/** Campos del formulario en el orden de la pantalla. */
const CAMPOS: readonly CampoSocio[] = [
  'nombre',
  'codigo',
  'tipo',
  'productos',
  'correoContactoTecnico',
  'limiteDiario',
  'limiteRafaga',
  'rafagaMaxima',
];

/**
 * «Registrar socio» (HU-W3.1-01, decisión del equipo: alta + aprobación desde el portal): un `<dialog>` modal con los
 * datos del socio y su cuota (diaria y ráfaga). Valida en el navegador con las reglas del contrato y, si el servidor
 * responde `validation_failed` o `partner_code_taken`, marca los campos que nombra. El socio queda pendiente de
 * aprobación: este paso no genera credenciales. El envío lo hace la página.
 */
@Component({
  selector: 'app-registrar-socio',
  imports: [ReactiveFormsModule, TranslocoDirective, LucideX],
  templateUrl: './registrar-socio.component.html',
  styleUrl: './registrar-socio.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistrarSocioComponent {
  readonly enviando = input(false);
  readonly error = input<ErrorSocios | null>(null);

  readonly registrar = output<SolicitudRegistroSocio>();

  private readonly dialogo = viewChild<ElementRef<HTMLDialogElement>>('dialogo');
  private origen: HTMLElement | null = null;

  protected readonly tipos = TIPOS_SOCIO;
  protected readonly abierto = signal(false);
  protected readonly intentado = signal(false);
  protected readonly formulario = inject(FormBuilder).group({
    nombre: FORMULARIO_INICIAL.nombre,
    codigo: FORMULARIO_INICIAL.codigo,
    tipo: FORMULARIO_INICIAL.tipo as FormularioRegistro['tipo'],
    productos: FORMULARIO_INICIAL.productos,
    correoContactoTecnico: FORMULARIO_INICIAL.correoContactoTecnico,
    limiteDiario: FORMULARIO_INICIAL.limiteDiario,
    limiteRafaga: FORMULARIO_INICIAL.limiteRafaga,
    rafagaMaxima: FORMULARIO_INICIAL.rafagaMaxima,
  });
  private readonly valor = toSignal(this.formulario.valueChanges.pipe(startWith(this.formulario.getRawValue())), {
    requireSync: true,
  });
  private readonly erroresLocales = computed(() => validarRegistro(this.valor() as FormularioRegistro));

  /** Error de cada campo: el local tras el primer intento de envío y, si no hay, el del servidor. */
  protected readonly errores = computed(() => {
    const errores = new Map<CampoSocio, string>();
    if (this.intentado()) {
      for (const [campo, codigo] of this.erroresLocales()) {
        errores.set(campo, codigo);
      }
    }
    const servidor = this.error();
    if (servidor?.codigo === 'validation_failed') {
      for (const { campo, codigo } of servidor.campos) {
        if (!errores.has(campo)) {
          errores.set(campo, codigo);
        }
      }
    }
    if (servidor?.codigo === 'partner_code_taken') {
      errores.set('codigo', 'taken');
    }
    return errores;
  });

  /** Error del servidor que no es de un campo. */
  protected readonly errorGeneral = computed(() => {
    const codigo = this.error()?.codigo;
    return codigo && codigo !== 'validation_failed' && codigo !== 'partner_code_taken' ? 'generico' : null;
  });

  abrir(): void {
    this.origen = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.formulario.reset(FORMULARIO_INICIAL);
    this.intentado.set(false);
    this.abierto.set(true);
    this.dialogo()?.nativeElement.showModal();
  }

  cerrar(): void {
    this.dialogo()?.nativeElement.close();
  }

  protected pedirCierre(): void {
    if (!this.enviando()) {
      this.cerrar();
    }
  }

  protected alCancelarNativo(evento: Event): void {
    evento.preventDefault();
    this.pedirCierre();
  }

  protected alCerrar(): void {
    this.abierto.set(false);
    this.origen?.focus();
  }

  protected idError(campo: CampoSocio): string | null {
    return this.errores().has(campo) ? `registrar-${campo}-error` : null;
  }

  protected enviar(): void {
    this.intentado.set(true);
    if (this.enviando()) {
      return;
    }
    const errores = this.erroresLocales();
    if (errores.size > 0) {
      const primero = CAMPOS.find((campo) => errores.has(campo));
      this.dialogo()?.nativeElement.querySelector<HTMLElement>(`#registrar-${primero}`)?.focus();
      return;
    }
    this.registrar.emit(aSolicitudRegistro(this.formulario.getRawValue() as FormularioRegistro));
  }
}
