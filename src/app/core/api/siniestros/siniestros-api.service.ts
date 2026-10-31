import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { CONFIGURACION_EJECUCION } from '@core/configuracion/configuracion';
import { Observable, catchError, from, map, switchMap, throwError } from 'rxjs';

import {
  OpcionesRadicacion,
  OpcionesRadicacionDto,
  SolicitudRadicacion,
  SoporteDeclaradoDto,
  SoporteSubido,
  SoporteSubidoDto,
  aDeclaracionSoporteDto,
  aSolicitudRadicacionDto,
  ErrorSoporte,
  mapearOpcionesRadicacion,
  mapearSoporteDeclarado,
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
import { calcularSha256 } from './sha256';
import {
  PaginaTriageDto,
  PoliticaTriage,
  PoliticaTriageDto,
  ResumenTriage,
  TriageSiniestro,
  TriageSiniestroDto,
  mapearPaginaTriage,
  mapearPoliticaTriage,
  mapearTriageSiniestro,
} from './triage.modelos';

/**
 * Cliente del servicio de siniestros (`claims`) vía API Gateway. Única salida HTTP hacia ese microservicio: ningún
 * dominio usa `HttpClient` directamente. Hoy expone la radicación web con soportes del asegurado (HU-W2.1-01): las
 * opciones del formulario, la subida de cada soporte (declarar, S3 y confirmar), la radicación, el detalle, el PDF del radicado y «Mis
 * siniestros» (rol `insured`), y la prioridad automática del siniestro (HU-W2.2-01: detalle, lote y política; el rol
 * `operations` lee las tres y el `insured` solo la de su caso). El interceptor adjunta el token.
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
   * Sube **un** soporte en tres pasos (HU-W2.1-01): declara el archivo con su SHA-256 (`POST /v1/claims/supports`),
   * lo sube directo a S3 con la URL firmada y las cabeceras que devolvió, y lo confirma
   * (`POST /v1/claims/supports/{id}/confirmation`). El archivo no pasa por el API Gateway. Un rechazo en cualquier
   * paso afecta solo a ese archivo. Falla con `ErrorSoporte`; un fallo del `PUT` a S3 (URL vencida, firma distinta,
   * red) es `supports_unavailable`.
   */
  subirSoporte(archivo: File): Observable<SoporteSubido> {
    return from(calcularSha256(archivo)).pipe(
      switchMap((sha256) =>
        this.http.post<SoporteDeclaradoDto>(`${this.base}/v1/claims/supports`, aDeclaracionSoporteDto(archivo, sha256)),
      ),
      map(mapearSoporteDeclarado),
      switchMap((declarado) =>
        // La URL es de S3, no del gateway: no lleva `Authorization` y solo se envían las cabeceras que cubre la firma.
        // `Content-Length` también está firmada, pero el navegador no deja fijarla: la calcula él con el cuerpo.
        this.http
          .put(declarado.urlSubida, archivo, { headers: cabecerasDeSubida(declarado.cabecerasSubida) })
          .pipe(
            catchError(() => throwError(() => new ErrorSoporte('supports_unavailable'))),
            switchMap(() =>
              this.http.post<SoporteSubidoDto>(
                `${this.base}/v1/claims/supports/${encodeURIComponent(declarado.id)}/confirmation`,
                null,
              ),
            ),
          ),
      ),
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

  /**
   * Prioridad de un caso (`GET /v1/claims/{claim_id}/triage`). La vista depende del rol del token: `operations` trae el
   * cálculo completo con su historial; `insured` (solo el dueño) trae el nivel y el tiempo estimado. Falla con
   * `ErrorSiniestro`.
   */
  consultarTriage(siniestroId: string): Observable<TriageSiniestro> {
    return this.http.get<TriageSiniestroDto>(`${this.base}/v1/claims/${encodeURIComponent(siniestroId)}/triage`).pipe(
      map(mapearTriageSiniestro),
      catchError((error: unknown) => throwError(() => traducirErrorSiniestro(error))),
    );
  }

  /**
   * Prioridad de una página de casos en **una** llamada (`GET /v1/claims/triage?claim_id=…`, rol `operations`): de 1 a
   * 50 ids sin repetir, que viajan como `claim_id` repetido. Devuelve una fila por id, en el orden pedido; un id que no
   * existe vuelve con `estado: 'not_found'`. Falla con `ErrorSiniestro`.
   */
  consultarTriageLote(ids: readonly string[]): Observable<ResumenTriage[]> {
    const params = new HttpParams().appendAll({ claim_id: [...ids] });
    return this.http.get<PaginaTriageDto>(`${this.base}/v1/claims/triage`, { params }).pipe(
      map(mapearPaginaTriage),
      catchError((error: unknown) => throwError(() => traducirErrorSiniestro(error))),
    );
  }

  /** Política de triage vigente (`GET /v1/claims/triage-policy`, rol `operations`). Falla con `ErrorSiniestro`. */
  consultarPoliticaTriage(): Observable<PoliticaTriage> {
    return this.http.get<PoliticaTriageDto>(`${this.base}/v1/claims/triage-policy`).pipe(
      map(mapearPoliticaTriage),
      catchError((error: unknown) => throwError(() => traducirErrorSiniestro(error))),
    );
  }
}

function cabecerasDeSubida(firmadas: Readonly<Record<string, string>>): HttpHeaders {
  return new HttpHeaders(
    Object.fromEntries(Object.entries(firmadas).filter(([nombre]) => nombre.toLowerCase() !== 'content-length')),
  );
}
