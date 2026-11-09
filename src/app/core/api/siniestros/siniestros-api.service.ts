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
import {
  FiltroCola,
  PaginaColaPrioridad,
  PaginaColaPrioridadDto,
  PaginaCola as PaginaRevisiones,
  PaginaColaDto as PaginaRevisionesDto,
  mapearPaginaColaPrioridad,
  mapearPaginaCola as mapearPaginaRevisiones,
} from './evaluacion.modelos';
import {
  RadicacionEnRevision,
  RadicacionEnRevisionDto,
  ResultadoRevision,
  ResultadoRevisionDto,
  SolicitudDevolucion,
  aDevolucionDto,
  mapearRadicacionEnRevision,
  mapearResultadoRevision,
  traducirErrorRevision,
} from './revision.modelos';
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
import {
  Decision,
  DecisionDto,
  DestinoPago,
  Evaluacion,
  EvaluacionDto,
  PaginaCola,
  PaginaColaDto,
  aDestinoDto,
  mapearDecision,
  mapearEvaluacion,
  mapearPaginaCola,
  traducirErrorEvaluacion,
} from './evaluacion.modelos';
import {
  AsignacionSiniestro,
  AsignacionSiniestroDto,
  FiltroPrestadores,
  ListaPrestadoresDto,
  PaginaAsignacionesDto,
  PoliticaAsignacion,
  PoliticaAsignacionDto,
  Prestador,
  PrestadorDto,
  ResumenAsignacion,
  SolicitudDisponibilidad,
  SolicitudUbicacion,
  aDisponibilidadDto,
  aUbicacionDto,
  mapearAsignacionSiniestro,
  mapearListaPrestadores,
  mapearPaginaAsignaciones,
  mapearPoliticaAsignacion,
  mapearPrestador,
  traducirErrorAsignacion,
} from './asignacion.modelos';

/**
 * Cliente del servicio de siniestros (`claims`) vía API Gateway. Única salida HTTP hacia ese microservicio: ningún
 * dominio usa `HttpClient` directamente. Hoy expone la radicación web con soportes del asegurado (HU-W2.1-01): las
 * opciones del formulario, la subida de cada soporte (declarar, S3 y confirmar), la radicación, el detalle, el PDF del radicado y «Mis
 * siniestros» (rol `insured`), la prioridad automática del siniestro (HU-W2.2-01: detalle, lote y política; el rol
 * `operations` lee las tres y el `insured` solo la de su caso) y, para `operations`, la evaluación y la decisión
 * (HU-W2.2-03): los casos en evaluación, las excepciones de pago, el detalle de la evaluación, aprobar, rechazar y
 * reintentar el pago, y la asignación del prestador más cercano (HU-W2.3-01): ubicación, búsqueda, asignación, lote,
 * política y la administración de prestadores (listado y disponibilidad). El interceptor adjunta el token.
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
   * Cola de operaciones (HU-W2.2-03): los casos en evaluación (`GET /v1/claims/evaluations`) o las excepciones de pago
   * (`GET /v1/claims/payment-exceptions`), del más antiguo al más nuevo, con su prioridad. Falla con `ErrorEvaluacion`.
   */
  listarCola(lista: ListaOperaciones, tokenPagina?: string): Observable<PaginaCola> {
    const params = tokenPagina ? new HttpParams().set('page_token', tokenPagina) : new HttpParams();
    return this.http.get<PaginaColaDto>(`${this.base}/v1/claims/${lista}`, { params }).pipe(
      map(mapearPaginaCola),
      catchError((error: unknown) => throwError(() => traducirErrorEvaluacion(error))),
    );
  }

  /**
   * Cola de operaciones ordenada por prioridad (`GET /v1/claims/evaluations`, HU-W2.2-02, O5): Triage 1, 2 y 3, luego lo
   * que el triage aún no calcula, y en cada nivel el que más espera; con los filtros, el asegurado de cada caso y los
   * indicadores de toda la cola. Falla con `ErrorEvaluacion`.
   */
  listarColaPrioridad(filtro: FiltroCola = {}, tokenPagina?: string): Observable<PaginaColaPrioridad> {
    let params = new HttpParams();
    if (filtro.nivel) {
      params = params.set('level', filtro.nivel);
    }
    if (filtro.ramo) {
      params = params.set('line', filtro.ramo);
    }
    if (filtro.estado) {
      params = params.set('status', filtro.estado);
    }
    if (tokenPagina) {
      params = params.set('page_token', tokenPagina);
    }
    return this.http.get<PaginaColaPrioridadDto>(`${this.base}/v1/claims/evaluations`, { params }).pipe(
      map(mapearPaginaColaPrioridad),
      catchError((error: unknown) => throwError(() => traducirErrorEvaluacion(error))),
    );
  }

  /** Todo lo que el analista decide con (`GET /v1/claims/{claim_id}/evaluation`, O6 y O6b). Falla con `ErrorEvaluacion`. */
  consultarEvaluacion(id: string): Observable<Evaluacion> {
    return this.http.get<EvaluacionDto>(`${this.base}/v1/claims/${encodeURIComponent(id)}/evaluation`).pipe(
      map(mapearEvaluacion),
      catchError((error: unknown) => throwError(() => traducirErrorEvaluacion(error))),
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

  /**
   * Aprueba el caso por el costo **bruto** en pesos (`POST /v1/claims/{claim_id}/approval`, `202`): el backend descuenta
   * el deducible y paga el neto. Falla con `ErrorEvaluacion`.
   */
  aprobar(id: string, brutoPesos: number): Observable<Decision> {
    return this.decidir(id, 'approval', { gross_amount_minor: Math.round(brutoPesos * 100) });
  }

  /** Rechaza el caso con su motivo (`POST /v1/claims/{claim_id}/rejection`). Falla con `ErrorEvaluacion`. */
  rechazar(id: string, motivo: string): Observable<Decision> {
    return this.decidir(id, 'rejection', { reason: motivo });
  }

  /**
   * Reintenta el pago de una excepción con la misma clave (`POST /v1/claims/{claim_id}/payout-retry`), al destino
   * corregido o, sin destino, al mismo. Falla con `ErrorEvaluacion`.
   */
  reintentarPago(id: string, destino?: DestinoPago): Observable<Decision> {
    return this.decidir(id, 'payout-retry', destino ? { destination: aDestinoDto(destino) } : {});
  }

  /**
   * Radicaciones que esperan la revisión del asesor (`GET /v1/claims/reviews`, HU-W2.1-03), de la más antigua a la más
   * nueva. Aún no tienen prioridad. Falla con `ErrorRevision`.
   */
  listarRevisiones(tokenPagina?: string): Observable<PaginaRevisiones> {
    const params = tokenPagina ? new HttpParams().set('page_token', tokenPagina) : new HttpParams();
    return this.http.get<PaginaRevisionesDto>(`${this.base}/v1/claims/reviews`, { params }).pipe(
      map(mapearPaginaRevisiones),
      catchError((error: unknown) => throwError(() => traducirErrorRevision(error))),
    );
  }

  /** Todo lo que el asesor revisa (`GET /v1/claims/{claim_id}/review`, S8). Falla con `ErrorRevision`. */
  consultarRevision(id: string): Observable<RadicacionEnRevision> {
    return this.http.get<RadicacionEnRevisionDto>(`${this.base}/v1/claims/${encodeURIComponent(id)}/review`).pipe(
      map(mapearRadicacionEnRevision),
      catchError((error: unknown) => throwError(() => traducirErrorRevision(error))),
    );
  }

  /**
   * Aprueba la radicación: todos los soportes adjuntos son válidos y el caso pasa a evaluación
   * (`POST /v1/claims/{claim_id}/review-approval`). Falla con `ErrorRevision`.
   */
  aprobarRadicacion(id: string): Observable<ResultadoRevision> {
    return this.revisar(id, 'review-approval', {});
  }

  /**
   * Devuelve la radicación al asegurado con el motivo, el mensaje y el veredicto de los soportes que no sirven
   * (`POST /v1/claims/{claim_id}/review-return`). Falla con `ErrorRevision`.
   */
  devolverRadicacion(id: string, solicitud: SolicitudDevolucion): Observable<ResultadoRevision> {
    return this.revisar(id, 'review-return', aDevolucionDto(solicitud));
  }

  /**
   * Asignación del prestador de un caso (`GET /v1/claims/{claim_id}/assignment`, HU-W2.3-01, rol `operations`): estado,
   * especialidad, ubicación, última búsqueda y asignación. Falla con `ErrorAsignacion`.
   */
  consultarAsignacion(id: string): Observable<AsignacionSiniestro> {
    return this.http.get<AsignacionSiniestroDto>(`${this.base}/v1/claims/${encodeURIComponent(id)}/assignment`).pipe(
      map(mapearAsignacionSiniestro),
      catchError((error: unknown) => throwError(() => traducirErrorAsignacion(error))),
    );
  }

  /**
   * Registra la dirección y las coordenadas del pin cuando el caso no tiene las de la app
   * (`POST /v1/claims/{claim_id}/incident-location`, CA-1). Devuelve la asignación del caso. Falla con `ErrorAsignacion`.
   */
  registrarUbicacionIncidente(id: string, solicitud: SolicitudUbicacion): Observable<AsignacionSiniestro> {
    return this.escribirAsignacion(id, 'incident-location', aUbicacionDto(solicitud));
  }

  /**
   * Busca el prestador más cercano (`POST /v1/claims/{claim_id}/provider-searches`): sin cuerpo empieza en el radio
   * inicial («Buscar» y «Reintentar búsqueda»); con `desdeRadioKm`, en ese radio («Ampliar radio»). Devuelve la
   * asignación del caso, `proposed` o `pending_assignment`. Falla con `ErrorAsignacion`.
   */
  buscarPrestador(id: string, desdeRadioKm?: number): Observable<AsignacionSiniestro> {
    return this.escribirAsignacion(id, 'provider-searches', desdeRadioKm === undefined ? null : { from_radius_km: desdeRadioKm });
  }

  /**
   * Confirma el prestador (`POST /v1/claims/{claim_id}/assignment`, CA-5) con la búsqueda que el analista tiene en
   * pantalla. Falla con `ErrorAsignacion` (`provider_unavailable`, `search_outdated`, `assignment_exists`…).
   */
  asignarPrestador(id: string, prestadorId: string, secuenciaBusqueda: number): Observable<AsignacionSiniestro> {
    return this.escribirAsignacion(id, 'assignment', { provider_id: prestadorId, search_seq: secuenciaBusqueda });
  }

  /**
   * Estado de la asignación de una página de casos en **una** llamada (`GET /v1/claims/assignments?claim_id=…`): de 1 a
   * 50 ids sin repetir, en el orden pedido; un id que no existe vuelve con `estado: 'not_found'`. Falla con
   * `ErrorAsignacion`.
   */
  consultarAsignacionesLote(ids: readonly string[]): Observable<ResumenAsignacion[]> {
    const params = new HttpParams().appendAll({ claim_id: [...ids] });
    return this.http.get<PaginaAsignacionesDto>(`${this.base}/v1/claims/assignments`, { params }).pipe(
      map(mapearPaginaAsignaciones),
      catchError((error: unknown) => throwError(() => traducirErrorAsignacion(error))),
    );
  }

  /** Política de asignación vigente (`GET /v1/claims/assignment-policy`). Falla con `ErrorAsignacion`. */
  consultarPoliticaAsignacion(): Observable<PoliticaAsignacion> {
    return this.http.get<PoliticaAsignacionDto>(`${this.base}/v1/claims/assignment-policy`).pipe(
      map(mapearPoliticaAsignacion),
      catchError((error: unknown) => throwError(() => traducirErrorAsignacion(error))),
    );
  }

  /**
   * Registro de prestadores por nombre (`GET /v1/claims/providers`, máximo 200). Los filtros vacíos no se envían. Falla
   * con `ErrorAsignacion`.
   */
  listarPrestadores(filtro: FiltroPrestadores = {}): Observable<Prestador[]> {
    let params = new HttpParams();
    if (filtro.especialidad) {
      params = params.set('specialty', filtro.especialidad);
    }
    if (filtro.disponibilidad) {
      params = params.set('availability', filtro.disponibilidad);
    }
    return this.http.get<ListaPrestadoresDto>(`${this.base}/v1/claims/providers`, { params }).pipe(
      map(mapearListaPrestadores),
      catchError((error: unknown) => throwError(() => traducirErrorAsignacion(error))),
    );
  }

  /** Un prestador (`GET /v1/claims/providers/{provider_id}`). Falla con `ErrorAsignacion` (`provider_not_found`). */
  consultarPrestador(id: string): Observable<Prestador> {
    return this.http.get<PrestadorDto>(`${this.base}/v1/claims/providers/${encodeURIComponent(id)}`).pipe(
      map(mapearPrestador),
      catchError((error: unknown) => throwError(() => traducirErrorAsignacion(error))),
    );
  }

  /**
   * Cambia la disponibilidad de un prestador (`POST /v1/claims/providers/{provider_id}/availability`): `available` libera
   * también a uno ocupado en un caso. Falla con `ErrorAsignacion`.
   */
  cambiarDisponibilidadPrestador(id: string, solicitud: SolicitudDisponibilidad): Observable<Prestador> {
    const ruta = `${this.base}/v1/claims/providers/${encodeURIComponent(id)}/availability`;
    return this.http.post<PrestadorDto>(ruta, aDisponibilidadDto(solicitud)).pipe(
      map(mapearPrestador),
      catchError((error: unknown) => throwError(() => traducirErrorAsignacion(error))),
    );
  }

  private escribirAsignacion(id: string, accion: string, cuerpo: object | null): Observable<AsignacionSiniestro> {
    return this.http.post<AsignacionSiniestroDto>(`${this.base}/v1/claims/${encodeURIComponent(id)}/${accion}`, cuerpo).pipe(
      map(mapearAsignacionSiniestro),
      catchError((error: unknown) => throwError(() => traducirErrorAsignacion(error))),
    );
  }

  private revisar(id: string, accion: string, cuerpo: object): Observable<ResultadoRevision> {
    return this.http.post<ResultadoRevisionDto>(`${this.base}/v1/claims/${encodeURIComponent(id)}/${accion}`, cuerpo).pipe(
      map(mapearResultadoRevision),
      catchError((error: unknown) => throwError(() => traducirErrorRevision(error))),
    );
  }

  private decidir(id: string, accion: string, cuerpo: object): Observable<Decision> {
    return this.http.post<DecisionDto>(`${this.base}/v1/claims/${encodeURIComponent(id)}/${accion}`, cuerpo).pipe(
      map(mapearDecision),
      catchError((error: unknown) => throwError(() => traducirErrorEvaluacion(error))),
    );
  }
}

/** Página de la cola de operaciones: `evaluations` (en evaluación) o `payment-exceptions`. */
export type ListaOperaciones = 'evaluations' | 'payment-exceptions';

function cabecerasDeSubida(firmadas: Readonly<Record<string, string>>): HttpHeaders {
  return new HttpHeaders(
    Object.fromEntries(Object.entries(firmadas).filter(([nombre]) => nombre.toLowerCase() !== 'content-length')),
  );
}
