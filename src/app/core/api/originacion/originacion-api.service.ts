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
import { Cobro, CobroDto, mapearCobro, traducirErrorCobro } from './cobro.modelos';
import {
  ClienteCotizacion,
  ClienteDto,
  CotizacionAsistida,
  CotizacionAsistidaDto,
  RespaldoErrorCotizacion,
  SolicitudCotizacionAsistida,
  aSolicitudDto,
  mapearCliente,
  mapearCotizacionAsistida,
  traducirErrorCotizacion,
} from './cotizacion-asistida.modelos';
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

const RESPALDO_COTIZAR: RespaldoErrorCotizacion = {
  noEncontrado: 'quote_not_found',
  indisponible: 'quote_unavailable',
};

const RESPALDO_CLIENTE: RespaldoErrorCotizacion = {
  noEncontrado: 'customer_not_found',
  indisponible: 'customer_unavailable',
};

/**
 * Cliente del servicio de originación vía API Gateway. Única salida HTTP hacia ese microservicio:
 * ningún dominio usa `HttpClient` directamente. Hoy expone el perfilamiento de riesgo (HU-W1.2-02), la
 * aceptación de la oferta (HU-W1.3-01), la cotización asistida por asesor (HU-W1.1-01) y el estado del cobro
 * de la prima (HA-D02); la emisión se suma aquí con su historia.
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
   * Genera la cotización asistida (`POST /v1/assisted-quotes`, solo asesor): 201 con la cotización, vigente
   * 24 horas. Con las fuentes caídas también es 201, con `modo: provisional`. Falla con
   * `ErrorCotizacionAsistida`: `validation_failed` trae todos los campos inválidos a la vez y
   * `consent_required` indica que falta el consentimiento.
   */
  crearCotizacionAsistida(solicitud: SolicitudCotizacionAsistida): Observable<CotizacionAsistida> {
    return this.http
      .post<CotizacionAsistidaDto>(`${this.base}/v1/assisted-quotes`, aSolicitudDto(solicitud))
      .pipe(
        map(mapearCotizacionAsistida),
        catchError((error: unknown) => throwError(() => traducirErrorCotizacion(error, RESPALDO_COTIZAR))),
      );
  }

  /**
   * Consulta una cotización asistida (`GET /v1/assisted-quotes/{quote_id}`). Una cotización vencida sigue
   * siendo legible: llega con `estado: expired` y `puedeFormalizar: false`.
   */
  consultarCotizacionAsistida(cotizacionId: string): Observable<CotizacionAsistida> {
    return this.http
      .get<CotizacionAsistidaDto>(`${this.base}/v1/assisted-quotes/${encodeURIComponent(cotizacionId)}`)
      .pipe(
        map(mapearCotizacionAsistida),
        catchError((error: unknown) => throwError(() => traducirErrorCotizacion(error, RESPALDO_COTIZAR))),
      );
  }

  /**
   * Recupera un cliente por su documento (`GET /v1/customers?document_id=`) para no digitar sus datos de
   * nuevo. `customer_not_found` significa que el documento aún no está registrado.
   */
  buscarClientePorDocumento(documento: string): Observable<ClienteCotizacion> {
    return this.http
      .get<ClienteDto>(`${this.base}/v1/customers`, { params: { document_id: documento } })
      .pipe(
        map(mapearCliente),
        catchError((error: unknown) => throwError(() => traducirErrorCotizacion(error, RESPALDO_CLIENTE))),
      );
  }

  /**
   * Consulta el cobro de la prima de una aceptación (`GET /v1/acceptances/{acceptance_id}/charge`, HA-D02): el
   * estado que pinta el paso de pago (pendiente con sus reintentos, confirmado con la póliza o en excepción).
   * `charge_not_found` significa que la aceptación aún no tiene cobro (suscripción en curso o en revisión).
   * Falla con `ErrorCobro`.
   */
  consultarCobro(aceptacionId: string): Observable<Cobro> {
    return this.http.get<CobroDto>(`${this.base}/v1/acceptances/${encodeURIComponent(aceptacionId)}/charge`).pipe(
      map(mapearCobro),
      catchError((error: unknown) => throwError(() => traducirErrorCobro(error))),
    );
  }
}
