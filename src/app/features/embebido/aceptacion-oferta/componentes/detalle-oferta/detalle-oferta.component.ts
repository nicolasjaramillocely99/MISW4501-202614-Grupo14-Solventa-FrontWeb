import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideCircleCheck, LucideInfo, LucideTriangleAlert } from '@lucide/angular';

import { Oferta } from '@core/api/originacion/oferta.modelos';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';
import { FormatoMonedaPipe } from '@shared/pipes/formato-moneda.pipe';

/** Coberturas del contrato → clave del texto `embebido.aceptacionOferta.oferta.cobertura.<clave>`. */
const CLAVE_COBERTURA: Readonly<Record<string, string>> = {
  death: 'fallecimiento',
  total_permanent_disability: 'incapacidad',
};

/** Condiciones del contrato → clave del texto `embebido.aceptacionOferta.oferta.condicion.<clave>`. */
const CLAVE_CONDICION: Readonly<Record<string, string>> = {
  validity_24h: 'vigencia24h',
  onerous_beneficiary_lender: 'beneficiarioOneroso',
  monthly_premium: 'primaMensual',
  max_insured_age_70: 'edadMaxima70',
  provisional_requote_when_source_restored: 'recotizacion',
};

/** Fuentes que pueden quedar caídas → clave de `embebido.aceptacionOferta.oferta.fuente.<clave>`. */
const CLAVE_FUENTE: Readonly<Record<string, string>> = {
  open_finance: 'openFinance',
  open_data: 'openData',
  kyc: 'kyc',
};

/**
 * Resumen de la oferta del paso 3 (frames E3, E3b y E3c): prima mensual, valor asegurado, vigencia,
 * beneficiario, perfil aplicado, coberturas y condiciones. Es presentacional y pinta solo lo que llega: las
 * ofertas ajustadas y de demostración traen una vista reducida (prima y vigencia). Las coberturas y las
 * condiciones se traducen por su código y se omite el que la pantalla no conoce, nunca se muestra el código.
 */
@Component({
  selector: 'app-detalle-oferta',
  imports: [TranslocoDirective, FormatoMonedaPipe, FormatoFechaHoraPipe, LucideCircleCheck, LucideInfo, LucideTriangleAlert],
  templateUrl: './detalle-oferta.component.html',
  styleUrl: './detalle-oferta.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetalleOfertaComponent {
  readonly oferta = input.required<Oferta>();
  /** Beneficiario oneroso: el banco del crédito; `null` si la solicitud no está disponible. */
  readonly beneficiario = input<string | null>(null);

  protected readonly provisional = computed(() => this.oferta().modo === 'provisional');

  /** La oferta personalizada normal explica cómo se calculó el precio; las demás no. */
  protected readonly explicaPrecio = computed(() => this.oferta().clase === 'personalized' && !this.provisional());

  /** Vigencia de la póliza: años cuando el plazo es exacto, meses si no. */
  protected readonly vigencia = computed(() => {
    const meses = this.oferta().plazoMeses;
    if (meses === null) {
      return null;
    }
    return meses % 12 === 0 ? { clave: 'vigenciaValor', cantidad: meses / 12 } : { clave: 'vigenciaMeses', cantidad: meses };
  });

  protected readonly coberturas = computed(() =>
    this.oferta()
      .coberturas.filter((c) => c.codigo in CLAVE_COBERTURA)
      .map((c) => ({ clave: CLAVE_COBERTURA[c.codigo], valorAsegurado: c.valorAsegurado })),
  );

  protected readonly condiciones = computed(() =>
    this.oferta()
      .condiciones.filter((c) => c in CLAVE_CONDICION)
      .map((c) => CLAVE_CONDICION[c]),
  );

  /**
   * Cómo se calculó el perfil aplicado: individual (fuentes externas), en caché con su fecha (oferta provisional),
   * vigente (perfil reutilizado de la caché en una oferta normal, que llega sin fecha) o base actuarial.
   */
  protected readonly origenPerfil = computed(() => {
    const oferta = this.oferta();
    switch (oferta.perfil?.fuente) {
      case 'cache':
        return oferta.fechaPerfil ? 'cache' : 'vigente';
      case 'base_actuarial':
        return 'base';
      case undefined:
        return null;
      default:
        return 'individual';
    }
  });

  protected readonly fuenteNoDisponible = computed(() => {
    const fuente = this.oferta().fuenteNoDisponible;
    return fuente ? (CLAVE_FUENTE[fuente] ?? 'otra') : null;
  });
}
