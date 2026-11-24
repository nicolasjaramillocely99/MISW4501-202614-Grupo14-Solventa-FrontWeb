import { HttpErrorResponse } from '@angular/common/http';

import { MedioDePago, MedioDePagoDto } from './cobro.modelos';
import { MesPrima, MesPrimaDto, mapearMes } from './pago-poliza.modelos';
import { PolizaListada, PolizaListadaDto, mapearPolizaListada } from './renovacion.modelos';

/** Detalle de una póliza del asegurado (HU-W1.6-02, pantallas A2 y A2b): `GET /v1/policies/{policy_id}`. */

/** El detalle de una póliza (A2 y A2b): la póliza con su prima, su medio de pago y cada mes facturado. */
export interface DetallePoliza extends PolizaListada {
  medioDePago: MedioDePago | null;
  /** Del más reciente al más antiguo. */
  meses: MesPrima[];
}

export interface DetallePolizaDto extends PolizaListadaDto {
  payment_method: MedioDePagoDto | null;
  payments: MesPrimaDto[];
}

export function mapearDetallePoliza(dto: DetallePolizaDto): DetallePoliza {
  const medio = dto.payment_method;
  return {
    ...mapearPolizaListada(dto),
    medioDePago: medio
      ? {
          tipo: medio.method,
          marca: medio.brand,
          ultimosCuatro: medio.last4,
          cuotas: medio.installments,
          codigoBanco: medio.bank_code,
          tipoDePersona: medio.payer_type,
          capturadoEn: medio.captured_at,
        }
      : null,
    meses: dto.payments.map(mapearMes),
  };
}

/** Códigos estables del detalle. */
export type CodigoErrorPoliza =
  'policy_not_found' | 'unauthorized' | 'forbidden' | 'renewal_unavailable';

/** Error del detalle de la póliza, con el código del contrato. */
export class ErrorPoliza extends Error {
  constructor(readonly codigo: CodigoErrorPoliza) {
    super(`Error del detalle de la póliza: ${codigo}`);
    this.name = 'ErrorPoliza';
  }
}

/** Traduce un error HTTP del detalle; un 404 o un 400 (id inválido) es «la póliza no existe». */
export function traducirErrorPoliza(error: unknown): ErrorPoliza {
  if (!(error instanceof HttpErrorResponse)) {
    return new ErrorPoliza('renewal_unavailable');
  }
  switch (error.status) {
    case 400:
    case 404:
      return new ErrorPoliza('policy_not_found');
    case 401:
      return new ErrorPoliza('unauthorized');
    case 403:
      return new ErrorPoliza('forbidden');
    default:
      return new ErrorPoliza('renewal_unavailable');
  }
}
