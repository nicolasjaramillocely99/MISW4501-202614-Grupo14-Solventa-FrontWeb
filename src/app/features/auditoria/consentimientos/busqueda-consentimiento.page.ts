import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideCircleAlert, LucideCircleCheck, LucideSearch } from '@lucide/angular';

import { AuditoriaApiService } from '@core/api/auditoria/auditoria-api.service';
import { ErrorRevocacion } from '@core/api/auditoria/revocacion.modelos';

import { EstadoConsultadoService } from './servicios/estado-consultado.service';

/** Fase de la búsqueda: sin buscar, buscando, sin resultados o con una falla del servicio. */
export type FaseBusquedaConsentimiento = 'inicial' | 'buscando' | 'sinResultados' | 'error';

/** Longitud máxima de un identificador y caracteres que admite el backend (`consentIDParam`). */
const LONGITUD_MAXIMA = 64;
const PATRON_IDENTIFICADOR = /^[A-Za-z0-9_-]+$/;

/**
 * O14 provisional · Consentimientos Open Finance: búsqueda mínima por identificador (HU-W4.2-02 F1). El analista de
 * operaciones ingresa el identificador del consentimiento y, si existe, pasa al detalle (O15). Uno que no existe muestra
 * «sin resultados» en la misma página; una falla del servicio permite reintentar. Reutiliza la composición de O12 y O12b.
 *
 * Provisional (HU-W4.2-02 F1): HU-W4.2-01 la reemplaza por el listado O14 con filtros e indicadores.
 *
 * Ruta: `/auditoria/consentimientos` (solo operaciones).
 */
@Component({
  selector: 'app-busqueda-consentimiento-page',
  imports: [ReactiveFormsModule, TranslocoDirective, LucideCircleAlert, LucideCircleCheck, LucideSearch],
  templateUrl: './busqueda-consentimiento.page.html',
  styleUrl: './busqueda-consentimiento.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BusquedaConsentimientoPage {
  private readonly api = inject(AuditoriaApiService);
  private readonly router = inject(Router);
  private readonly consultado = inject(EstadoConsultadoService);
  private readonly destruccion = inject(DestroyRef);

  protected readonly formulario = inject(FormBuilder).nonNullable.group({
    identificador: ['', [Validators.required, Validators.maxLength(LONGITUD_MAXIMA), Validators.pattern(PATRON_IDENTIFICADOR)]],
  });
  protected readonly fase = signal<FaseBusquedaConsentimiento>('inicial');
  /** Identificador por el que se buscó, para repetirlo en el mensaje de «sin resultados». */
  protected readonly buscado = signal('');
  protected readonly intento = signal(false);
  /** Claves de lo que muestra el detalle (`auditoria.consentimientos.busqueda.incluye.*`). */
  protected readonly incluye = ['estado', 'entidades', 'revocacion', 'historial'] as const;

  /** «Limpiar búsqueda»: vacía el campo y vuelve al estado inicial. */
  protected limpiar(): void {
    this.formulario.reset();
    this.intento.set(false);
    this.buscado.set('');
    this.fase.set('inicial');
  }

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
      .consultarEstadoRevocacion(id)
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (estado) => {
          this.consultado.guardar(estado);
          this.fase.set('inicial');
          void this.router.navigate(['/auditoria/consentimientos', estado.consentimientoId]);
        },
        error: (error: unknown) => {
          const codigo = error instanceof ErrorRevocacion ? error.codigo : 'service_unavailable';
          // 401 y 403 los resuelve el interceptor: la página no muestra aviso propio.
          const fase: FaseBusquedaConsentimiento =
            codigo === 'consent_not_found' ? 'sinResultados' : codigo === 'unauthorized' || codigo === 'forbidden' ? 'inicial' : 'error';
          this.fase.set(fase);
        },
      });
  }
}
