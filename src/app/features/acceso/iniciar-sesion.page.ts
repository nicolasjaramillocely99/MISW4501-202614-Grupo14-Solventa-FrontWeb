import { ChangeDetectionStrategy, Component, ElementRef, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import {
  LucideActivity,
  LucideCircleAlert,
  LucideDatabase,
  LucideLogIn,
  LucideShieldCheck,
} from '@lucide/angular';

import { ErrorIdentidad, MotivoErrorIdentidad } from '@core/auth/proveedor-identidad';
import { SesionService } from '@core/auth/sesion.service';

type Campo = 'correo' | 'contrasena';

/** Mensaje de cada motivo de error; las credenciales inválidas usan un mensaje genérico (no revela cuál falló). */
const MENSAJE_ERROR: Readonly<Record<MotivoErrorIdentidad, string>> = {
  'credenciales-invalidas': 'acceso.iniciarSesion.errorCredenciales',
  'accion-requerida': 'acceso.iniciarSesion.errorAccionRequerida',
  'sin-rol': 'acceso.iniciarSesion.errorSinRol',
  'sesion-invalida': 'acceso.iniciarSesion.errorServicio',
  'servicio-no-disponible': 'acceso.iniciarSesion.errorServicio',
};

/** Ruta a la que se entra si no hay una URL de retorno válida (D-12: todos los roles aterrizan en `/inicio`). */
const RUTA_PREDETERMINADA = '/inicio';

/**
 * P0 · Inicio de sesión del portal (frame 17-174). Estados: inicial, validación por campo, cargando,
 * error de credenciales y error del servicio.
 */
@Component({
  selector: 'app-iniciar-sesion-page',
  imports: [
    ReactiveFormsModule,
    TranslocoDirective,
    LucideActivity,
    LucideCircleAlert,
    LucideDatabase,
    LucideLogIn,
    LucideShieldCheck,
  ],
  templateUrl: './iniciar-sesion.page.html',
  styleUrl: './iniciar-sesion.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IniciarSesionPage {
  private readonly sesion = inject(SesionService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly formulario = inject(NonNullableFormBuilder).group({
    correo: ['', [Validators.required, Validators.email]],
    contrasena: ['', Validators.required],
  });
  protected readonly enviando = signal(false);
  protected readonly error = signal<MotivoErrorIdentidad | null>(null);

  /** Clave i18n del error de un campo, si debe mostrarse. */
  protected errorDe(campo: Campo): string | null {
    const control = this.formulario.controls[campo];
    if (!control.touched || control.valid) {
      return null;
    }
    if (campo === 'correo') {
      return control.hasError('required')
        ? 'acceso.iniciarSesion.correoRequerido'
        : 'acceso.iniciarSesion.correoInvalido';
    }
    return 'acceso.iniciarSesion.contrasenaRequerida';
  }

  protected mensajeError(motivo: MotivoErrorIdentidad): string {
    return MENSAJE_ERROR[motivo];
  }

  protected async enviar(): Promise<void> {
    if (this.enviando()) {
      return;
    }
    this.error.set(null);
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.enfocarPrimerCampoInvalido();
      return;
    }

    this.enviando.set(true);
    const { correo, contrasena } = this.formulario.getRawValue();
    try {
      await this.sesion.iniciarSesion(correo.trim(), contrasena);
      await this.router.navigateByUrl(this.destino());
    } catch (error) {
      this.error.set(error instanceof ErrorIdentidad ? error.motivo : 'servicio-no-disponible');
      this.formulario.controls.contrasena.reset();
    } finally {
      this.enviando.set(false);
    }
  }

  /** `returnUrl` solo si es una ruta interna del portal (nunca otro origen ni las pantallas de acceso). */
  private destino(): string {
    const url = this.ruta.snapshot.queryParamMap.get('returnUrl');
    const interna = !!url && url.startsWith('/') && !/^\/[/\\]/.test(url) && !url.startsWith('/acceso');
    return interna ? url : RUTA_PREDETERMINADA;
  }

  private enfocarPrimerCampoInvalido(): void {
    const campo = this.formulario.controls.correo.invalid ? 'correo' : 'contrasena';
    this.elemento.nativeElement.querySelector<HTMLInputElement>(`#${campo}`)?.focus();
  }
}
