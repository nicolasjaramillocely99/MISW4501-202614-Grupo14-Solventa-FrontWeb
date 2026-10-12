import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '@env/environment';
import { Observable, map } from 'rxjs';

import {
  PerfilRiesgo,
  PerfilRiesgoDto,
  SolicitudPerfilRiesgo,
  mapearPerfilRiesgo,
} from './perfil-riesgo.modelos';

/**
 * Cliente del servicio de originación vía API Gateway. Única salida HTTP hacia ese microservicio:
 * ningún dominio usa `HttpClient` directamente. Hoy expone el perfilamiento de riesgo (HU-W1.2-02);
 * cotización, emisión y cobro se suman aquí con sus historias.
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
}
