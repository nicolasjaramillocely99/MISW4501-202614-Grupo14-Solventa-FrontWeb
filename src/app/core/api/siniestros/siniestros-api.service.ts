import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { CONFIGURACION_EJECUCION } from '@core/configuracion/configuracion';
import { Observable, catchError, map, throwError } from 'rxjs';

import {
  OpcionesRadicacion,
  OpcionesRadicacionDto,
  SolicitudRadicacion,
  SoporteSubido,
  SoporteSubidoDto,
  aSolicitudRadicacionDto,
  mapearOpcionesRadicacion,
  mapearSoporteSubido,
  traducirErrorOpciones,
  traducirErrorRadicacion,
  traducirErrorSoporte,
} from './radicacion.modelos';
import {
  DetalleSiniestro,
  DetalleSiniestroDto,
  FiltroSiniestros,
  PaginaSiniestros,
  PaginaSiniestrosDto,
  mapearDetalleSiniestro,
  mapearPaginaSiniestros,
  traducirErrorSiniestro,
} from './siniestro.modelos';

/**
 * Cliente del servicio de siniestros (`claims`) vía API Gateway. Única salida HTTP hacia ese microservicio: ningún
 * dominio usa `HttpClient` directamente. Hoy expone la radicación web con soportes del asegurado (HU-W2.1-01): las
 * opciones del formulario, la subida de cada soporte, la radicación, el detalle, el PDF del radicado y «Mis
 * siniestros». Todas son rutas humanas del rol `insured` (el interceptor adjunta el token).
 */
@Injectable({ providedIn: 'root' })
export class SiniestrosApiService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(CONFIGURACION_EJECUCION).apiGatewayUrl.replace(/\/+$/, '');

  /**
   * Pólizas activas del asegurado que se radican, con los tipos que cubre cada una y los soportes de cada tipo
   * (`GET /v1/claims/filing-options`, CA-1). Falla con `ErrorRadicacion` (`policy_directory_unavailable` si el core
   * de pólizas no responde).
   */
  consultarOpcionesRadicacion(): Observable<OpcionesRadicacion> {
    return this.http.get<OpcionesRadicacionDto>(`${this.base}/v1/claims/filing-options`).pipe(
      map(mapearOpcionesRadicacion),
      catchError((error: unknown) => throwError(() => traducirErrorOpciones(error))),
    );
  }

  /**
   * Sube **un** soporte (`POST /v1/claims/supports`, multipart con el campo `file`). El backend lo valida por su
   * contenido; un rechazo (`413`, `415`, `422`, `429`) afecta solo a ese archivo. Falla con `ErrorSoporte`.
   */
  subirSoporte(archivo: File): Observable<SoporteSubido> {
    // Provisional (HU-W2.1-01 §9): con HU-M2.1-01 la subida pasará a una URL firmada de S3; la firma de este método se conserva.
    const cuerpo = new FormData();
    cuerpo.append('file', archivo, archivo.name);
    return this.http.post<SoporteSubidoDto>(`${this.base}/v1/claims/supports`, cuerpo).pipe(
      map(mapearSoporteSubido),
      catchError((error: unknown) => throwError(() => traducirErrorSoporte(error))),
    );
  }

  /**
   * Radica el siniestro (`POST /v1/claims/web-filings`): 201 con el caso nuevo o 200 con el mismo caso si se repite
   * con la misma clave y el mismo cuerpo. `claveIdempotencia` se genera una vez por formulario y se reutiliza en cada
   * reintento. Falla con `ErrorRadicacion`.
   */
  radicar(solicitud: SolicitudRadicacion, claveIdempotencia: string): Observable<DetalleSiniestro> {
    return this.http
      .post<DetalleSiniestroDto>(`${this.base}/v1/claims/web-filings`, aSolicitudRadicacionDto(solicitud), {
        headers: new HttpHeaders({ 'Idempotency-Key': claveIdempotencia }),
      })
      .pipe(
        map(mapearDetalleSiniestro),
        catchError((error: unknown) => throwError(() => traducirErrorRadicacion(error))),
      );
  }

  /** Detalle de un caso propio (`GET /v1/claims/{claim_id}`). Falla con `ErrorSiniestro`. */
  consultarSiniestro(id: string): Observable<DetalleSiniestro> {
    return this.http.get<DetalleSiniestroDto>(`${this.base}/v1/claims/${encodeURIComponent(id)}`).pipe(
      map(mapearDetalleSiniestro),
      catchError((error: unknown) => throwError(() => traducirErrorSiniestro(error))),
    );
  }

  /** PDF del radicado (`GET /v1/claims/{claim_id}/filing-receipt`). Falla con `ErrorSiniestro`. */
  descargarRadicado(id: string): Observable<Blob> {
    return this.http
      .get(`${this.base}/v1/claims/${encodeURIComponent(id)}/filing-receipt`, { responseType: 'blob' })
      .pipe(catchError((error: unknown) => throwError(() => traducirErrorSiniestro(error))));
  }

  /**
   * «Mis siniestros» (`GET /v1/claims`): casos del asegurado de los dos canales, del más reciente al más antiguo.
   * Los filtros vacíos no se envían. Falla con `ErrorSiniestro`.
   */
  listarSiniestros(filtro: FiltroSiniestros = {}): Observable<PaginaSiniestros> {
    let params = new HttpParams();
    if (filtro.polizaId) {
      params = params.set('policy_id', filtro.polizaId);
    }
    if (filtro.desde) {
      params = params.set('from', filtro.desde);
    }
    if (filtro.tamanoPagina) {
      params = params.set('page_size', filtro.tamanoPagina);
    }
    if (filtro.tokenPagina) {
      params = params.set('page_token', filtro.tokenPagina);
    }
    return this.http.get<PaginaSiniestrosDto>(`${this.base}/v1/claims`, { params }).pipe(
      map(mapearPaginaSiniestros),
      catchError((error: unknown) => throwError(() => traducirErrorSiniestro(error))),
    );
  }
}
