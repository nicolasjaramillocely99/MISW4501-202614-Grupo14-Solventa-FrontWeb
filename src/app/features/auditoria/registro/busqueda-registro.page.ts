import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideCircleAlert, LucideSearch } from '@lucide/angular';

import { AuditoriaApiService } from '@core/api/auditoria/auditoria-api.service';
import { ErrorDecision } from '@core/api/auditoria/decision.modelos';

import { RegistroConsultadoService } from './servicios/registro-consultado.service';

/** Fase de la búsqueda: sin buscar, buscando, sin resultados (O12b) o con una falla del servicio. */
export type FaseBusqueda = 'inicial' | 'buscando' | 'sinResultados' | 'error';

/** Longitud máxima de un identificador y caracteres que admite el backend. */
const LONGITUD_MAXIMA = 128;
const PATRON_IDENTIFICADOR = /^[A-Za-z0-9_-]+$/;

/**
 * O12 / O12b · Auditoría: búsqueda por identificador (HU-W4.1-01). El analista de operaciones ingresa el
 * identificador de la póliza (la oferta que originó la decisión) y, si existe, pasa al registro de auditoría (O13).
 * Un identificador sin registro muestra «sin resultados» con un mensaje claro, sin datos internos (CA-2); una falla del
 * servicio permite reintentar. La pantalla es de solo lectura.
 *
 * Ruta: `/auditoria/registro` (solo operaciones).
 */
@Component({
  selector: 'app-busqueda-registro-page',
  imports: [ReactiveFormsModule, TranslocoDirective, LucideCircleAlert, LucideSearch],
  templateUrl: './busqueda-registro.page.html',
  styleUrl: './busqueda-registro.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BusquedaRegistroPage {
  private readonly api = inject(AuditoriaApiService);
  private readonly router = inject(Router);
  private readonly consultado = inject(RegistroConsultadoService);
  private readonly destruccion = inject(DestroyRef);

  protected readonly formulario = inject(FormBuilder).nonNullable.group({
    identificador: ['', [Validators.required, Validators.maxLength(LONGITUD_MAXIMA), Validators.pattern(PATRON_IDENTIFICADOR)]],
  });
  protected readonly fase = signal<FaseBusqueda>('inicial');
  /** Identificador por el que se buscó, para repetirlo en el mensaje de «sin resultados». */
  protected readonly buscado = signal('');
  protected readonly intento = signal(false);

  /** Clave del error de validación del campo (`requerido` o `invalido`), solo después del primer intento. */
  protected errorDeCampo(): 'requerido' | 'invalido' | null {
    const control = this.formulario.controls.identificador;
    if (!this.intento() || control.valid) {
      return null;
    }
    return control.hasError('required') ? 'requerido' : 'invalido';
  }

  protected buscar(): void {
    this.intento.set(true);
    this.formulario.controls.identificador.setValue(this.formulario.controls.identificador.value.trim());
    if (this.formulario.invalid || this.fase() === 'buscando') {
      return;
    }
    const id = this.formulario.controls.identificador.value;
    this.buscado.set(id);
    this.fase.set('buscando');
    this.api
      .consultarRegistroDecision(id)
      .pipe(
        takeUntilDestroyed(this.destruccion),
      )
      .subscribe({
        next: (registro) => {
          this.consultado.guardar(registro);
          this.fase.set('inicial');
          void this.router.navigate(['/auditoria/registro', registro.ofertaId]);
        },
        error: (error: unknown) => {
          const codigo = error instanceof ErrorDecision ? error.codigo : 'service_unavailable';
          // 401 y 403 los resuelve el interceptor: la página no muestra aviso propio.
          const fase: FaseBusqueda = codigo === 'decision_not_found' ? 'sinResultados' : codigo === 'service_unavailable' ? 'error' : 'inicial';
          this.fase.set(fase);
        },
      });
  }
}
