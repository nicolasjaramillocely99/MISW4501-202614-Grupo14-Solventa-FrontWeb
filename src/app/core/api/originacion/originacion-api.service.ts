import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '@env/environment';
import { Observable, catchError, map, throwError } from 'rxjs';

import {
  Aceptacion,
  AceptacionDto,
  CanalAceptacion,
  RespaldoErrorAceptacion,
  mapearAceptacion,
  traducirErrorAceptacion,
} from './aceptacion.modelos';
import {
  EmisionContractual,
  EmisionContractualDto,
  mapearEmisionContractual,
  traducirErrorEmision,
} from './emision-contractual.modelos';
import {
  PerfilRiesgo,
  PerfilRiesgoDto,
  SolicitudPerfilRiesgo,
  mapearPerfilRiesgo,
} from './perfil-riesgo.modelos';

const RESPALDO_ACEPTAR: RespaldoErrorAceptacion = {
  noEncontrado: 'offer_not_found',
  indisponible: 'acceptance_not_registered',
};

const RESPALDO_CONSULTAR: RespaldoErrorAceptacion = {
  noEncontrado: 'acceptance_not_found',
  indisponible: 'acceptance_unavailable',
};

/**
 * Cliente del servicio de originación vía API Gateway. Única salida HTTP hacia ese microservicio:
 * ningún dominio usa `HttpClient` directamente. Hoy expone el perfilamiento de riesgo (HU-W1.2-02) y la
 * aceptación de la oferta (HU-W1.3-01); cotización, emisión y cobro se suman aquí con sus historias.
 */
@Injectable({ providedIn: 'root' })
export class OriginacionApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiGatewayUrl.replace(/\/+$/, '');

  /**
   * Resuelve el perfil de riesgo con el que se cotiza la oferta (`POST /v1/risk-profiles/resolve`).
   * Un perfil degradado o provisional es una respuesta 200; sin consentimiento activo responde 422
   * (`consent_required`) y no se consulta ninguna fuente.
   */
  resolverPerfilRiesgo(solicitud: SolicitudPerfilRiesgo): Observable<PerfilRiesgo> {
    return this.http
      .post<PerfilRiesgoDto>(`${this.base}/v1/risk-profiles/resolve`, {
        customer_id: solicitud.clienteId,
        consent_active: solicitud.consentimientoActivo,
      })
      .pipe(map(mapearPerfilRiesgo));
  }

  /**
   * Acepta la oferta (`POST /v1/offers/{offer_id}/acceptance`): 202 con la aceptación nueva o 200 con la
   * que ya existía. Es idempotente por oferta, así que reenviarlo es seguro. Falla con `ErrorAceptacion`.
   */
  aceptarOferta(ofertaId: string): Observable<Aceptacion> {
    const cuerpo: { channel: CanalAceptacion } = { channel: 'web' };
    return this.http
      .post<AceptacionDto>(`${this.base}/v1/offers/${encodeURIComponent(ofertaId)}/acceptance`, cuerpo)
      .pipe(
        map(mapearAceptacion),
        catchError((error: unknown) => throwError(() => traducirErrorAceptacion(error, RESPALDO_ACEPTAR))),
      );
  }

  /** Consulta una aceptación por su identificador (`GET /v1/acceptances/{acceptance_id}`), para el polling. */
  consultarAceptacion(aceptacionId: string): Observable<Aceptacion> {
    return this.consultar(`${this.base}/v1/acceptances/${encodeURIComponent(aceptacionId)}`);
  }

  /**
   * Consulta la aceptación de una oferta (`GET /v1/offers/{offer_id}/acceptance`), para retomar el trámite.
   * `acceptance_not_found` significa que la oferta aún no se aceptó.
   */
  consultarAceptacionDeOferta(ofertaId: string): Observable<Aceptacion> {
    return this.consultar(`${this.base}/v1/offers/${encodeURIComponent(ofertaId)}/acceptance`);
  }

  private consultar(url: string): Observable<Aceptacion> {
    return this.http.get<AceptacionDto>(url).pipe(
      map(mapearAceptacion),
      catchError((error: unknown) => throwError(() => traducirErrorAceptacion(error, RESPALDO_CONSULTAR))),
    );
  }

  /**
   * Estado de la emisión contractual de una póliza (`GET /v1/policies/{policy_id}/issuance-status`,
   * HU-W1.3-03): documento disponible y notificación. Falla con `ErrorEmisionContractual`;
   * `policy_not_found` significa que la cobertura aún no se activó.
   */
  consultarEmisionContractual(polizaId: string): Observable<EmisionContractual> {
    return this.http
      .get<EmisionContractualDto>(`${this.base}/v1/policies/${encodeURIComponent(polizaId)}/issuance-status`)
      .pipe(
        map(mapearEmisionContractual),
        catchError((error: unknown) => throwError(() => traducirErrorEmision(error))),
      );
  }

  /** Descarga el documento contractual en PDF (`GET /v1/policies/{policy_id}/contract-document`). */
  descargarDocumentoContractual(polizaId: string): Observable<Blob> {
    return this.http
      .get(`${this.base}/v1/policies/${encodeURIComponent(polizaId)}/contract-document`, { responseType: 'blob' })
      .pipe(catchError((error: unknown) => throwError(() => traducirErrorEmision(error))));
  }
}
