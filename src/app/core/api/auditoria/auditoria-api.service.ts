import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { CONFIGURACION_EJECUCION } from '@core/configuracion/configuracion';
import { Observable, catchError, map, throwError } from 'rxjs';

import {
  RegistroDecision,
  RegistroDecisionDto,
  mapearRegistroDecision,
  traducirErrorDecision,
} from './decision.modelos';
import {
  Consentimiento,
  ConsentimientoDto,
  SolicitudConsentimiento,
  TerminosConsentimiento,
  TerminosConsentimientoDto,
  aSolicitudConsentimientoDto,
  mapearConsentimiento,
  mapearTerminosConsentimiento,
  traducirErrorConsentimiento,
} from './consentimiento.modelos';
import {
  FiltroConsentimientos,
  PaginaConsentimientos,
  PaginaConsentimientosDto,
  aParametrosListado,
  mapearPaginaConsentimientos,
  traducirErrorListado,
} from './listado-consentimientos.modelos';
import {
  EstadoRevocacion,
  EstadoRevocacionDto,
  ResultadoReintento,
  ResultadoReintentoDto,
  SolicitudRevocacion,
  aSolicitudRevocacionDto,
  mapearEstadoRevocacion,
  mapearResultadoReintento,
  traducirErrorRevocacion,
} from './revocacion.modelos';

/**
 * Cliente del servicio de auditoría y consentimientos vía API Gateway. Única salida HTTP hacia ese
 * microservicio: ningún dominio usa `HttpClient` directamente. Hoy expone el consentimiento explícito del
 * cliente (HU-W1.2-01). La verificación (`/v1/audit/consent-verifications`) es interna de `origination` y la
 * evidencia (`/v1/audit/consents/{id}`) es del portal de operación: ninguna se consume desde el canal embebido.
 * Para el portal de cumplimiento expone además el listado de consentimientos (HU-W4.2-01) y el estado y la revocación de
 * un consentimiento (HU-W4.2-02), que no traen el documento completo del titular.
 */
@Injectable({ providedIn: 'root' })
export class AuditoriaApiService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(CONFIGURACION_EJECUCION).apiGatewayUrl.replace(/\/+$/, '');

  /**
   * Consulta los términos vigentes (`GET /v1/audit/consent-terms/current`): finalidad, responsable, política
   * y, por fuente, qué datos lee y cuánto dura la autorización. Falla con `ErrorConsentimiento`.
   */
  consultarTerminosVigentes(): Observable<TerminosConsentimiento> {
    return this.http.get<TerminosConsentimientoDto>(`${this.base}/v1/audit/consent-terms/current`).pipe(
      map(mapearTerminosConsentimiento),
      catchError((error: unknown) => throwError(() => traducirErrorConsentimiento(error))),
    );
  }

  /**
   * Registra el consentimiento explícito (`POST /v1/audit/consents`, canal `embedded`): 201 con el registro
   * nuevo o 200 con el que ya existía para ese cliente, solicitud y versión (idempotente: reenviarlo es
   * seguro). Falla con `ErrorConsentimiento`: `validation_failed` trae todos los campos inválidos a la vez y
   * `terms_outdated` indica que hay que mostrar de nuevo los términos vigentes.
   */
  registrarConsentimiento(solicitud: SolicitudConsentimiento): Observable<Consentimiento> {
    return this.http
      .post<ConsentimientoDto>(`${this.base}/v1/audit/consents`, aSolicitudConsentimientoDto(solicitud))
      .pipe(
        map(mapearConsentimiento),
        catchError((error: unknown) => throwError(() => traducirErrorConsentimiento(error))),
      );
  }

  /**
   * Consulta el registro de auditoría de una decisión de suscripción (`GET /v1/audit/decisions/{id}`, solo
   * operaciones, HU-W4.1-01). Es de solo lectura. Falla con `ErrorDecision`: `decision_not_found` si no hay registro
   * para ese identificador.
   */
  consultarRegistroDecision(ofertaId: string): Observable<RegistroDecision> {
    return this.http
      .get<RegistroDecisionDto>(`${this.base}/v1/audit/decisions/${encodeURIComponent(ofertaId)}`)
      .pipe(
        map(mapearRegistroDecision),
        catchError((error: unknown) => throwError(() => traducirErrorDecision(error))),
      );
  }

  /**
   * Lista los consentimientos para el portal de cumplimiento (`GET /v1/audit/consents`, solo operaciones, HU-W4.2-01): la
   * página pedida con el filtro, el total, los cuatro indicadores (sobre todos, sin el filtro) y las entidades del filtro.
   * Solo envía los filtros con valor. Falla con `ErrorListado`: `validation_failed` trae todos los parámetros inválidos.
   */
  listarConsentimientos(filtro: FiltroConsentimientos): Observable<PaginaConsentimientos> {
    return this.http
      .get<PaginaConsentimientosDto>(`${this.base}/v1/audit/consents`, { params: aParametrosListado(filtro) })
      .pipe(
        map(mapearPaginaConsentimientos),
        catchError((error: unknown) => throwError(() => traducirErrorListado(error))),
      );
  }

  /**
   * Consulta el estado de revocación de un consentimiento (`GET /v1/audit/consents/{id}/revocation`, solo operaciones,
   * HU-W4.2-02): titular con documento enmascarado, alcance, entidades, si es revocable, la revocación con el avance del
   * aviso a cada entidad y el historial. Es también la lectura del sondeo. Falla con `ErrorRevocacion`.
   */
  consultarEstadoRevocacion(consentimientoId: string): Observable<EstadoRevocacion> {
    return this.http
      .get<EstadoRevocacionDto>(`${this.base}/v1/audit/consents/${encodeURIComponent(consentimientoId)}/revocation`)
      .pipe(
        map(mapearEstadoRevocacion),
        catchError((error: unknown) => throwError(() => traducirErrorRevocacion(error))),
      );
  }

  /**
   * Revoca el consentimiento desde el portal (`POST /v1/audit/consents/{id}/revocations`, HU-W4.2-02): 201 con la
   * revocación nueva o 200 con la que ya dejó esa `Idempotency-Key`. La clave se genera al abrir el modal y se reutiliza
   * en cada reintento del mismo modal. Falla con `ErrorRevocacion`: `validation_failed` trae todos los campos inválidos
   * a la vez y `consent_already_revoked` / `consent_not_active` indican que ya no se puede revocar.
   */
  revocarConsentimiento(
    consentimientoId: string,
    solicitud: SolicitudRevocacion,
    claveIdempotencia: string,
  ): Observable<EstadoRevocacion> {
    return this.http
      .post<EstadoRevocacionDto>(
        `${this.base}/v1/audit/consents/${encodeURIComponent(consentimientoId)}/revocations`,
        aSolicitudRevocacionDto(solicitud),
        { headers: { 'Idempotency-Key': claveIdempotencia } },
      )
      .pipe(
        map(mapearEstadoRevocacion),
        catchError((error: unknown) => throwError(() => traducirErrorRevocacion(error))),
      );
  }

  /**
   * Reintenta el aviso a las entidades que no confirmaron (`POST /v1/audit/consents/{id}/revocation-retries`, sin
   * cuerpo, HU-W4.2-02): 202 con las entidades avisadas de nuevo y el estado resultante. Falla con `ErrorRevocacion`:
   * `nothing_to_retry` y `consent_not_revoked` piden recargar el estado.
   */
  reintentarRevocacion(consentimientoId: string): Observable<ResultadoReintento> {
    return this.http
      .post<ResultadoReintentoDto>(
        `${this.base}/v1/audit/consents/${encodeURIComponent(consentimientoId)}/revocation-retries`,
        null,
      )
      .pipe(
        map(mapearResultadoReintento),
        catchError((error: unknown) => throwError(() => traducirErrorRevocacion(error))),
      );
  }
}
