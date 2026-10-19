import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { CONFIGURACION_EJECUCION } from '@core/configuracion/configuracion';
import { Observable, catchError, map, throwError } from 'rxjs';

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

/**
 * Cliente del servicio de auditoría y consentimientos vía API Gateway. Única salida HTTP hacia ese
 * microservicio: ningún dominio usa `HttpClient` directamente. Hoy expone el consentimiento explícito del
 * cliente (HU-W1.2-01). La verificación (`/v1/audit/consent-verifications`) es interna de `origination` y la
 * evidencia (`/v1/audit/consents/{id}`) es del portal de operación: ninguna se consume desde el canal embebido.
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
}
