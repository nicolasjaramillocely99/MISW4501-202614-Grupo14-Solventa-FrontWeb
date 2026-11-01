import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { CONFIGURACION_EJECUCION } from '@core/configuracion/configuracion';
import { Observable, catchError, map, throwError } from 'rxjs';

import {
  CredencialesEmitidas,
  CredencialesEmitidasDto,
  DetalleSocio,
  DetalleSocioDto,
  ListadoSocios,
  ListadoSociosDto,
  SolicitudRegistroSocio,
  aSolicitudRegistroDto,
  mapearCredencialesEmitidas,
  mapearDetalleSocio,
  mapearListadoSocios,
  traducirErrorSocios,
} from './socios.modelos';

/**
 * Cliente del servicio de socios B2B (`partners`) vía API Gateway. Única salida HTTP hacia ese microservicio. Hoy expone
 * la incorporación de socios y sus credenciales (HU-W3.1-01, solo `operations`): listado, registro, detalle, aprobación y
 * rotación. El secreto de una credencial solo llega en la respuesta de la aprobación y de la rotación (CA-4); este
 * cliente no lo guarda ni lo registra.
 */
@Injectable({ providedIn: 'root' })
export class SociosApiService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(CONFIGURACION_EJECUCION).apiGatewayUrl.replace(/\/+$/, '');

  /** `GET /v1/partners`: socios con su cuota y el consumo de hoy, más los tres indicadores. Falla con `ErrorSocios`. */
  listar(): Observable<ListadoSocios> {
    return this.http.get<ListadoSociosDto>(`${this.base}/v1/partners`).pipe(
      map(mapearListadoSocios),
      catchError((error: unknown) => throwError(() => traducirErrorSocios(error))),
    );
  }

  /**
   * `POST /v1/partners`: registra un socio en `pending_approval`, sin credenciales. Falla con `ErrorSocios`:
   * `validation_failed` trae todos los campos inválidos y `partner_code_taken` indica que el código ya existe.
   */
  registrar(solicitud: SolicitudRegistroSocio): Observable<DetalleSocio> {
    return this.http.post<DetalleSocioDto>(`${this.base}/v1/partners`, aSolicitudRegistroDto(solicitud)).pipe(
      map(mapearDetalleSocio),
      catchError((error: unknown) => throwError(() => traducirErrorSocios(error))),
    );
  }

  /** `GET /v1/partners/{id}`: detalle con credenciales (sin secreto), cuota, consumo e historial. */
  obtener(socioId: string): Observable<DetalleSocio> {
    return this.http.get<DetalleSocioDto>(`${this.base}/v1/partners/${encodeURIComponent(socioId)}`).pipe(
      map(mapearDetalleSocio),
      catchError((error: unknown) => throwError(() => traducirErrorSocios(error))),
    );
  }

  /**
   * `POST /v1/partners/{id}/approval` (sin cuerpo): aprueba al socio y genera sus credenciales (CA-1). Devuelve el socio y
   * el secreto, que no se puede volver a consultar. Falla con `partner_not_pending` o `gateway_unavailable`.
   */
  aprobar(socioId: string): Observable<CredencialesEmitidas> {
    return this.http
      .post<CredencialesEmitidasDto>(`${this.base}/v1/partners/${encodeURIComponent(socioId)}/approval`, null)
      .pipe(
        map(mapearCredencialesEmitidas),
        catchError((error: unknown) => throwError(() => traducirErrorSocios(error))),
      );
  }

  /**
   * `POST /v1/partners/{id}/credential-rotations`: emite un par nuevo y deja el anterior vigente durante `horasTransicion`
   * (CA-5; sin valor, el servidor usa su periodo por defecto). Falla con `partner_not_active`, `rotation_in_progress`,
   * `validation_failed` o `gateway_unavailable`.
   */
  rotar(socioId: string, horasTransicion: number | null): Observable<CredencialesEmitidas> {
    const cuerpo = horasTransicion === null ? {} : { grace_period_hours: horasTransicion };
    return this.http
      .post<CredencialesEmitidasDto>(`${this.base}/v1/partners/${encodeURIComponent(socioId)}/credential-rotations`, cuerpo)
      .pipe(
        map(mapearCredencialesEmitidas),
        catchError((error: unknown) => throwError(() => traducirErrorSocios(error))),
      );
  }
}
