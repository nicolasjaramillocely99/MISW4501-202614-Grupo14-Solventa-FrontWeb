import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideCircleAlert, LucideCircleCheck, LucideInfo, LucideSearch } from '@lucide/angular';

import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';
import {
  CampoCotizacion,
  CodigoCampo,
  ErrorCotizacionAsistida,
  SolicitudCotizacionAsistida,
} from '@core/api/originacion/cotizacion-asistida.modelos';

/** Estado de la búsqueda del cliente por documento. */
export type EstadoBusqueda = 'inactiva' | 'buscando' | 'encontrado' | 'noEncontrado' | 'error';

/** Límites del seguro de vida hipotecario; los valida también el backend, que manda. */
const EDAD_MINIMA = 18;
const EDAD_MAXIMA = 70;
const MONTO_MINIMO = 10_000_000;
const MONTO_MAXIMO = 2_000_000_000;
const PLAZO_MINIMO = 12;
const PLAZO_MAXIMO = 360;
const PATRON_DOCUMENTO = /^[A-Za-z0-9]{5,20}$/;

/** Campos en el orden en que aparecen en la pantalla; el `id` de cada control es su nombre. */
const ORDEN_CAMPOS: readonly CampoCotizacion[] = [
  'documento',
  'nombreCompleto',
  'correo',
  'fechaNacimiento',
  'montoAsegurado',
  'plazoMeses',
  'consentimiento',
];

/** Años cumplidos de `nacimiento` (`YYYY-MM-DD`) al día `hoy`, o `null` si no es una fecha válida. */
export function edadEn(nacimiento: string, hoy: Date): number | null {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(nacimiento);
  if (!partes) {
    return null;
  }
  const [anio, mes, dia] = [Number(partes[1]), Number(partes[2]), Number(partes[3])];
  const fecha = new Date(anio, mes - 1, dia);
  if (fecha.getFullYear() !== anio || fecha.getMonth() !== mes - 1 || fecha.getDate() !== dia) {
    return null;
  }
  let edad = hoy.getFullYear() - anio;
  if (hoy.getMonth() < mes - 1 || (hoy.getMonth() === mes - 1 && hoy.getDate() < dia)) {
    edad--;
  }
  return fecha > hoy ? -1 : edad;
}

function validarNacimiento(control: AbstractControl<string>): ValidationErrors | null {
  if (!control.value) {
    return null;
  }
  const edad = edadEn(control.value, new Date());
  if (edad === null) {
    return { patron: true };
  }
  return edad < EDAD_MINIMA || edad > EDAD_MAXIMA ? { min: true } : null;
}

function validarEntero(control: AbstractControl<number | null>): ValidationErrors | null {
  const valor = control.value;
  return valor === null || Number.isInteger(valor) ? null : { patron: true };
}

/**
 * S1 · Cotización asistida · Datos del cliente (HU-W1.1-01). El asesor registra los datos del cliente —o
 * los recupera por documento— y solicita la cotización, que el backend calcula con el mismo perfilamiento
 * y motor de rating del canal embebido. Cada campo muestra su error específico, el del navegador y el que
 * devuelve el backend (`validation_failed`), y nada se cotiza mientras haya un campo inválido.
 *
 * Ruta: `/originacion/cotizaciones/nueva`. Con `?documento=` precarga y busca al cliente (así «Generar una
 * nueva cotización» de una vencida no obliga a digitar de nuevo).
 */
@Component({
  selector: 'app-datos-cliente-page',
  imports: [ReactiveFormsModule, RouterLink, TranslocoDirective, LucideCircleAlert, LucideCircleCheck, LucideInfo, LucideSearch],
  templateUrl: './datos-cliente.page.html',
  styleUrl: './datos-cliente.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DatosClientePage implements OnInit {
  private readonly api = inject(OriginacionApiService);
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destruccion = inject(DestroyRef);

  protected readonly formulario = inject(NonNullableFormBuilder).group({
    documento: ['', [Validators.required, Validators.pattern(PATRON_DOCUMENTO)]],
    nombreCompleto: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]],
    correo: ['', [Validators.required, Validators.email]],
    fechaNacimiento: ['', [Validators.required, validarNacimiento]],
    montoAsegurado: [null as number | null, [Validators.required, Validators.min(MONTO_MINIMO), Validators.max(MONTO_MAXIMO)]],
    plazoMeses: [
      null as number | null,
      [Validators.required, Validators.min(PLAZO_MINIMO), Validators.max(PLAZO_MAXIMO), validarEntero],
    ],
    consentimiento: [false, Validators.requiredTrue],
  });

  protected readonly enviando = signal(false);
  protected readonly busqueda = signal<EstadoBusqueda>('inactiva');
  /** Error general de la solicitud (consentimiento o servicio), distinto del de un campo. */
  protected readonly errorGeneral = signal<'servicio' | 'permiso' | null>(null);
  /** Errores de campo que devolvió el backend; se limpian cuando el asesor edita el campo. */
  protected readonly erroresServidor = signal<Partial<Record<CampoCotizacion, CodigoCampo>>>({});

  protected readonly limites = {
    montoMinimo: MONTO_MINIMO,
    montoMaximo: MONTO_MAXIMO,
    plazoMinimo: PLAZO_MINIMO,
    plazoMaximo: PLAZO_MAXIMO,
    edadMinima: EDAD_MINIMA,
    edadMaxima: EDAD_MAXIMA,
  };

  ngOnInit(): void {
    for (const campo of Object.keys(this.formulario.controls) as CampoCotizacion[]) {
      (this.formulario.controls[campo] as AbstractControl).valueChanges
        .pipe(takeUntilDestroyed(this.destruccion))
        .subscribe(() => this.limpiarErrorServidor(campo));
    }
    const documento = this.ruta.snapshot.queryParamMap.get('documento');
    if (documento) {
      this.formulario.controls.documento.setValue(documento);
      this.buscarCliente();
    }
  }

  /** Clave i18n del error de un campo (relativa a `originacion.cotizacionAsistida`), o `null` si no debe mostrarse. */
  protected errorDe(campo: CampoCotizacion): string | null {
    const codigo = this.codigoDeError(campo);
    return codigo ? `errores.${campo}.${codigo}` : null;
  }

  private codigoDeError(campo: CampoCotizacion): CodigoCampo | null {
    const delServidor = this.erroresServidor()[campo];
    if (delServidor) {
      return delServidor;
    }
    const control = this.formulario.controls[campo];
    if (!control.touched || control.valid) {
      return null;
    }
    if (control.hasError('required')) {
      return 'required';
    }
    return control.hasError('min') || control.hasError('max') ? 'out_of_range' : 'invalid_format';
  }

  /** Recupera al cliente por su documento y precarga sus datos (criterio 2). */
  protected buscarCliente(): void {
    const documento = this.formulario.controls.documento;
    documento.markAsTouched();
    if (documento.invalid || this.busqueda() === 'buscando') {
      return;
    }
    this.busqueda.set('buscando');
    this.api
      .buscarClientePorDocumento(documento.value.trim())
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (cliente) => {
          this.formulario.patchValue({
            nombreCompleto: cliente.nombreCompleto,
            correo: cliente.correo,
            fechaNacimiento: cliente.fechaNacimiento,
          });
          this.busqueda.set('encontrado');
        },
        error: (error: unknown) => {
          const codigo = error instanceof ErrorCotizacionAsistida ? error.codigo : null;
          if (codigo === 'customer_not_found') {
            this.busqueda.set('noEncontrado');
          } else if (codigo === 'validation_failed') {
            this.aplicarErroresServidor(error as ErrorCotizacionAsistida);
            this.busqueda.set('inactiva');
          } else {
            this.busqueda.set('error');
          }
        },
      });
  }

  protected enviar(): void {
    if (this.enviando()) {
      return;
    }
    this.errorGeneral.set(null);
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      this.enfocarPrimerCampoInvalido();
      return;
    }

    const v = this.formulario.getRawValue();
    const solicitud: SolicitudCotizacionAsistida = {
      documento: v.documento.trim(),
      nombreCompleto: v.nombreCompleto.trim(),
      correo: v.correo.trim(),
      fechaNacimiento: v.fechaNacimiento,
      montoAsegurado: v.montoAsegurado ?? 0,
      plazoMeses: v.plazoMeses ?? 0,
      consentimientoActivo: v.consentimiento,
    };
    this.enviando.set(true);
    this.api
      .crearCotizacionAsistida(solicitud)
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (cotizacion) => {
          this.enviando.set(false);
          void this.router.navigate(['/originacion/cotizaciones', cotizacion.cotizacionId]);
        },
        error: (error: unknown) => {
          this.enviando.set(false);
          this.tratarError(error);
        },
      });
  }

  private tratarError(error: unknown): void {
    const codigo = error instanceof ErrorCotizacionAsistida ? error.codigo : null;
    switch (codigo) {
      case 'validation_failed':
        this.aplicarErroresServidor(error as ErrorCotizacionAsistida);
        this.enfocarPrimerCampoInvalido();
        break;
      case 'consent_required':
        this.erroresServidor.set({ consentimiento: 'required' });
        this.formulario.controls.consentimiento.markAsTouched();
        break;
      case 'forbidden':
      case 'unauthorized':
        this.errorGeneral.set('permiso');
        break;
      default:
        this.errorGeneral.set('servicio');
    }
  }

  private aplicarErroresServidor(error: ErrorCotizacionAsistida): void {
    const errores: Partial<Record<CampoCotizacion, CodigoCampo>> = {};
    for (const { campo, codigo } of error.campos) {
      errores[campo] = codigo;
    }
    this.erroresServidor.set(errores);
  }

  private limpiarErrorServidor(campo: CampoCotizacion): void {
    if (this.erroresServidor()[campo]) {
      this.erroresServidor.update((errores) => {
        const resto = { ...errores };
        delete resto[campo];
        return resto;
      });
    }
  }

  /** Lleva el foco al primer campo (en el orden de la pantalla) que muestra un error. */
  private enfocarPrimerCampoInvalido(): void {
    const primero = ORDEN_CAMPOS.find((campo) => this.codigoDeError(campo) !== null);
    if (primero) {
      this.elemento.nativeElement.querySelector<HTMLElement>(`#${primero}`)?.focus();
    }
  }
}
