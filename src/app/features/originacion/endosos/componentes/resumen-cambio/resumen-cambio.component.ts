import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

import { Beneficiario, CondicionesVigentes, DatosContacto, TipoCambio } from '@core/api/originacion/solicitud-modificacion.modelos';

import { BeneficiarioCaptura, ContactoCaptura, colapsar, leerMonto, normalizarTelefono } from '../../modelos/validaciones-cambio';

const PREFIJO = 'originacion.solicitudes.resumen';

/**
 * «Resumen del cambio» de A3 (HU-W1.4-01, frames `20:529` y sus derivados): el valor actual, el valor nuevo que el
 * asegurado está pidiendo (se actualiza mientras escribe) y el efecto del cambio.
 */
@Component({
  selector: 'app-resumen-cambio',
  imports: [TranslocoDirective],
  templateUrl: './resumen-cambio.component.html',
  styleUrl: './resumen-cambio.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResumenCambioComponent {
  private readonly transloco = inject(TranslocoService);

  readonly tipo = input.required<TipoCambio>();
  readonly condiciones = input.required<CondicionesVigentes>();
  readonly beneficiarios = input<readonly BeneficiarioCaptura[]>([]);
  readonly textoSuma = input('');
  readonly contacto = input<ContactoCaptura>({ direccion: '', correo: '', telefono: '' });

  protected readonly actual = computed(() => {
    const c = this.condiciones();
    switch (this.tipo()) {
      case 'beneficiaries':
        return this.listaBeneficiarios(c.beneficiarios);
      case 'insured_amount':
        return this.moneda(c.valorAsegurado, c.moneda);
      default:
        return this.contactoTexto(c.contacto);
    }
  });

  protected readonly nuevo = computed(() => {
    const c = this.condiciones();
    switch (this.tipo()) {
      case 'beneficiaries': {
        const lista = this.beneficiarios().filter((b) => colapsar(b.nombreCompleto) !== '');
        return lista.length === 0 ? this.texto('pendiente') : this.listaBeneficiarios(lista);
      }
      case 'insured_amount': {
        const valor = leerMonto(this.textoSuma());
        return valor === null ? this.texto('pendiente') : this.moneda(valor, c.moneda);
      }
      default: {
        const captura = this.contacto();
        const telefono = captura.telefono.trim() ? normalizarTelefono(captura.telefono) : '';
        return this.contactoTexto({
          direccion: colapsar(captura.direccion) || c.contacto.direccion,
          correo: captura.correo.trim() || c.contacto.correo,
          telefono: telefono || c.contacto.telefono,
        });
      }
    }
  });

  private texto(clave: string, parametros?: Record<string, unknown>): string {
    return this.transloco.translate(`${PREFIJO}.${clave}`, parametros);
  }

  private listaBeneficiarios(lista: readonly (Beneficiario | BeneficiarioCaptura)[]): string {
    if (lista.length === 0) {
      return this.texto('sinBeneficiarios');
    }
    const formato = new Intl.NumberFormat(this.transloco.getActiveLang(), { maximumFractionDigits: 2 });
    return lista
      .map((b) =>
        this.texto('beneficiario', {
          nombre: colapsar(b.nombreCompleto),
          participacion: b.participacion === null || Number.isNaN(b.participacion) ? '—' : formato.format(b.participacion),
        }),
      )
      .join(' · ');
  }

  private moneda(valor: number, moneda: string): string {
    const formato = new Intl.NumberFormat(this.transloco.getActiveLang(), {
      style: 'currency',
      currency: moneda,
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: 0,
    });
    return `${formato.format(valor)} ${moneda}`;
  }

  private contactoTexto(contacto: DatosContacto): string {
    return [
      this.texto('direccion', { valor: contacto.direccion ?? this.texto('noRegistrada') }),
      this.texto('telefono', { valor: contacto.telefono ?? this.texto('noRegistrado') }),
      this.texto('correo', { valor: contacto.correo ?? this.texto('noRegistrado') }),
    ].join(' · ');
  }
}
