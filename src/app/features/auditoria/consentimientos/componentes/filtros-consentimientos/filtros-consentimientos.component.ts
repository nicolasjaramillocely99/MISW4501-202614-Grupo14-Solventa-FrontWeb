import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, output, signal, untracked } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { ESTADOS_FILTRO, EstadoFiltroConsentimiento } from '@core/api/auditoria/listado-consentimientos.modelos';
import { EntidadConsentimiento } from '@core/api/auditoria/revocacion.modelos';

import { CriteriosListado, LONGITUD_MAXIMA_CLIENTE, rangoValido } from '../../modelos/filtro-listado';

/** Espera sin teclear antes de buscar el cliente. */
export const ESPERA_BUSQUEDA_MS = 400;

/**
 * Filtros del listado O14 (HU-W4.2-01): Estado, «Otorgado desde», «Hasta», Entidad y «Buscar cliente», con etiquetas
 * permanentes. Cada cambio emite los criterios completos; la página los lleva a la URL y vuelve a la página 1. Un rango con
 * «Hasta» anterior a «Otorgado desde» se avisa en el campo y no se emite (no se consulta). La búsqueda se emite con Enter o
 * 400 ms después de la última tecla.
 */
@Component({
  selector: 'app-filtros-consentimientos',
  imports: [TranslocoDirective],
  templateUrl: './filtros-consentimientos.component.html',
  styleUrl: './filtros-consentimientos.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FiltrosConsentimientosComponent {
  /** Los criterios vigentes (los de la URL). */
  readonly criterios = input.required<CriteriosListado>();
  readonly entidades = input<readonly EntidadConsentimiento[]>([]);
  readonly cambio = output<CriteriosListado>();

  protected readonly estados = ESTADOS_FILTRO;
  protected readonly longitudMaxima = LONGITUD_MAXIMA_CLIENTE;
  protected readonly desde = signal('');
  protected readonly hasta = signal('');
  protected readonly cliente = signal('');
  protected readonly rangoInvalido = signal(false);

  private espera: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Los controles siguen a la URL: limpiar filtros, volver del detalle o recargar los repinta.
    effect(() => {
      const criterios = this.criterios();
      untracked(() => {
        this.desde.set(criterios.desde ?? '');
        this.hasta.set(criterios.hasta ?? '');
        this.cliente.set(criterios.cliente ?? '');
        this.rangoInvalido.set(!rangoValido(criterios));
      });
    });
    inject(DestroyRef).onDestroy(() => this.cancelarEspera());
  }

  protected cambiarEstado(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    const estado = (ESTADOS_FILTRO as readonly string[]).includes(valor) ? (valor as EstadoFiltroConsentimiento) : null;
    this.emitir({ estado });
  }

  protected cambiarEntidad(evento: Event): void {
    this.emitir({ entidad: (evento.target as HTMLSelectElement).value || null });
  }

  protected cambiarFecha(campo: 'desde' | 'hasta', evento: Event): void {
    const valor = (evento.target as HTMLInputElement).value;
    (campo === 'desde' ? this.desde : this.hasta).set(valor);
    const rango = { desde: this.desde() || null, hasta: this.hasta() || null };
    if (!rangoValido(rango)) {
      // Se avisa en «Hasta» y no se consulta hasta que el rango sea válido.
      this.rangoInvalido.set(true);
      return;
    }
    this.rangoInvalido.set(false);
    this.emitir(rango);
  }

  protected escribirCliente(evento: Event): void {
    this.cliente.set((evento.target as HTMLInputElement).value);
    this.cancelarEspera();
    this.espera = setTimeout(() => this.buscarCliente(), ESPERA_BUSQUEDA_MS);
  }

  protected buscarCliente(): void {
    this.cancelarEspera();
    const cliente = this.cliente().trim() || null;
    if (cliente !== (this.criterios().cliente ?? null)) {
      this.emitir({ cliente });
    }
  }

  private emitir(cambios: Partial<CriteriosListado>): void {
    const rango = { desde: this.desde() || null, hasta: this.hasta() || null };
    this.cambio.emit({
      ...this.criterios(),
      // Una fecha a medio corregir no viaja: solo un rango válido.
      ...(rangoValido(rango) ? rango : { desde: this.criterios().desde, hasta: this.criterios().hasta }),
      cliente: this.cliente().trim() || null,
      ...cambios,
    });
  }

  private cancelarEspera(): void {
    if (this.espera !== null) {
      clearTimeout(this.espera);
      this.espera = null;
    }
  }
}
