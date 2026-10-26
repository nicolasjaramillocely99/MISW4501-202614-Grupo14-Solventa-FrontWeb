import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { CONFIGURACION_EJECUCION } from '@core/configuracion/configuracion';
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
  Cobro,
  CobroDto,
  MedioDePagoNuevo,
  aCuerpoMedioDePago,
  mapearCobro,
  traducirErrorCobro,
} from './cobro.modelos';
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
  AccionEmision,
  FiltroEmisiones,
  ListaAccionesDto,
  ListaEmisiones,
  ListaEmisionesDto,
  ReintentoEmision,
  ReintentoEmisionDto,
  aParametrosEmisiones,
  mapearListaAcciones,
  mapearListaEmisiones,
  mapearReintento,
  traducirErrorEmision as traducirErrorMonitoreo,
} from './emision-monitor.modelos';
import {
  ConfirmacionEnviada,
  ConfirmacionEnviadaDto,
  Formalizacion,
  FormalizacionDto,
  ResultadoFormalizacion,
  SolicitudFormalizacion,
  aSolicitudFormalizacionDto,
  mapearConfirmacionEnviada,
  mapearFormalizacion,
  traducirErrorFormalizacion,
} from './formalizacion.modelos';
import {
  EmisionContractual,
  EmisionContractualDto,
  mapearEmisionContractual,
  traducirErrorEmision,
} from './emision-contractual.modelos';
import {
  Oferta,
  OfertaDto,
  SolicitudOferta,
  aSolicitudOfertaDto,
  mapearOferta,
  traducirErrorOferta,
} from './oferta.modelos';
import {
  PerfilRiesgo,
  PerfilRiesgoDto,
  SolicitudPerfilRiesgo,
  mapearPerfilRiesgo,
} from './perfil-riesgo.modelos';
import {
  FiltroBandeja,
  ListaSolicitudesRevision,
  ListaSolicitudesRevisionDto,
  RegistroDecision,
  SolicitudRevision,
  SolicitudRevisionDto,
  aRegistroDecisionDto,
  mapearListaSolicitudesRevision,
  mapearSolicitudRevision,
  traducirErrorRevision,
} from './revision.modelos';

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
 * aceptación de la oferta (HU-W1.3-01), la cotización asistida por asesor (HU-W1.1-01), la emisión contractual
 * (HU-W1.3-03), el estado del cobro de la prima (HA-D02), la bandeja de decisión humana del asesor (HU-W1.1-02), la
 * oferta personalizada (HU-W1.2-03) y el monitoreo de emisiones y excepciones de operaciones (HU-W1.3-04).
 */
@Injectable({ providedIn: 'root' })
export class OriginacionApiService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(CONFIGURACION_EJECUCION).apiGatewayUrl.replace(/\/+$/, '');

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
   * Genera la oferta personalizada (`POST /v1/offers`, canal del aliado, sin sesión): 201 con la oferta, vigente
   * 24 horas; con las fuentes caídas también es 201, con `modo: provisional`. Exige el consentimiento activo del
   * cliente: `consent_required` y `consent_mismatch` (422) no consultan ninguna fuente. Falla con `ErrorOferta`.
   */
  generarOferta(solicitud: SolicitudOferta): Observable<Oferta> {
    return this.http.post<OfertaDto>(`${this.base}/v1/offers`, aSolicitudOfertaDto(solicitud)).pipe(
      map(mapearOferta),
      catchError((error: unknown) => throwError(() => traducirErrorOferta(error))),
    );
  }

  /**
   * Consulta la oferta (`GET /v1/offers/{offer_id}`). El primer asegurado que la abre con sesión la reclama; otro
   * recibe 403. Una vencida o reemplazada sigue siendo legible (`estado`). Las ofertas ajustadas y de
   * demostración llegan con una vista reducida. Falla con `ErrorOferta`.
   */
  consultarOferta(ofertaId: string): Observable<Oferta> {
    return this.http.get<OfertaDto>(`${this.base}/v1/offers/${encodeURIComponent(ofertaId)}`).pipe(
      map(mapearOferta),
      catchError((error: unknown) => throwError(() => traducirErrorOferta(error))),
    );
  }

  /**
   * Renueva una oferta vencida (`POST /v1/offers/{offer_id}/renewal`, solo su dueño): 201 con la oferta nueva o
   * 200 con la que ya existía (idempotente). `offer_still_valid` y `offer_superseded` (409) piden volver a la
   * oferta o abrir la que la reemplazó. Falla con `ErrorOferta`.
   */
  renovarOferta(ofertaId: string): Observable<Oferta> {
    return this.http.post<OfertaDto>(`${this.base}/v1/offers/${encodeURIComponent(ofertaId)}/renewal`, null).pipe(
      map(mapearOferta),
      catchError((error: unknown) => throwError(() => traducirErrorOferta(error))),
    );
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
   * Pide el código de confirmación de la compra (`POST /v1/assisted-quotes/{quote_id}/consent`, HU-W1.1-03):
   * el servicio se lo envía por correo al cliente y responde solo con el correo enmascarado. Un código nuevo
   * reemplaza al anterior, hasta 3 por cotización. Falla con `ErrorFormalizacion`.
   */
  solicitarConfirmacion(cotizacionId: string): Observable<ConfirmacionEnviada> {
    return this.http
      .post<ConfirmacionEnviadaDto>(
        `${this.base}/v1/assisted-quotes/${encodeURIComponent(cotizacionId)}/consent`,
        null,
      )
      .pipe(
        map(mapearConfirmacionEnviada),
        catchError((error: unknown) => throwError(() => traducirErrorFormalizacion(error))),
      );
  }

  /**
   * Formaliza la compra de una cotización vigente en nombre del cliente
   * (`POST /v1/assisted-quotes/{quote_id}/formalization`, HU-W1.1-03) registrando cómo y cuándo aceptó el
   * cliente. 201 la primera vez, 200 si el mismo asesor repite una formalización ya completa. Falla con
   * `ErrorFormalizacion`: `validation_failed` trae todos los campos inválidos a la vez; también
   * `quote_expired`, `already_formalized`, `invalid_confirmation_code`…
   */
  formalizarCompra(cotizacionId: string, solicitud: SolicitudFormalizacion): Observable<ResultadoFormalizacion> {
    return this.http
      .post<FormalizacionDto>(
        `${this.base}/v1/assisted-quotes/${encodeURIComponent(cotizacionId)}/formalization`,
        aSolicitudFormalizacionDto(solicitud),
        { observe: 'response' },
      )
      .pipe(
        map((respuesta) => ({
          formalizacion: mapearFormalizacion(respuesta.body as FormalizacionDto),
          creada: respuesta.status === 201,
        })),
        catchError((error: unknown) => throwError(() => traducirErrorFormalizacion(error))),
      );
  }

  /**
   * Consulta la formalización de una cotización (`GET /v1/assisted-quotes/{quote_id}/formalization`).
   * `formalization_not_found` significa que la cotización aún no se formalizó.
   */
  consultarFormalizacion(cotizacionId: string): Observable<Formalizacion> {
    return this.http
      .get<FormalizacionDto>(`${this.base}/v1/assisted-quotes/${encodeURIComponent(cotizacionId)}/formalization`)
      .pipe(
        map(mapearFormalizacion),
        catchError((error: unknown) => throwError(() => traducirErrorFormalizacion(error))),
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

  /**
   * Entrega el medio de pago de E4 (`POST /v1/acceptances/{id}/charge/payment-method`, HU-W1.3-02) y con eso
   * hace vencer el intento del cobro, que hasta entonces esperaba. Devuelve el cobro ya con su `medioDePago`.
   *
   * **El número de tarjeta no viaja por aquí**: el navegador lo tokeniza antes contra la pasarela
   * (`PasarelaPagosService`) y lo único que llega a Solventa es el token. Falla con `ErrorCobro`;
   * `charge_not_payable` significa que ese cobro ya no admite otro medio de pago.
   */
  entregarMedioDePago(aceptacionId: string, medio: MedioDePagoNuevo): Observable<Cobro> {
    return this.http
      .post<CobroDto>(
        `${this.base}/v1/acceptances/${encodeURIComponent(aceptacionId)}/charge/payment-method`,
        aCuerpoMedioDePago(medio),
      )
      .pipe(
        map(mapearCobro),
        catchError((error: unknown) => throwError(() => traducirErrorCobro(error))),
      );
  }

  /**
   * Lista la bandeja de decisión humana (`GET /v1/review-requests`, solo asesor; HU-W1.1-02) filtrada por estado y,
   * opcionalmente, por motivo, en el orden de llegada pedido. Los conteos alimentan las dos pestañas. Falla con
   * `ErrorRevision`.
   */
  listarSolicitudesRevision(filtro: FiltroBandeja): Observable<ListaSolicitudesRevision> {
    const params: Record<string, string> = { status: filtro.estado, order: filtro.orden };
    if (filtro.motivo) {
      params['reason'] = filtro.motivo;
    }
    return this.http.get<ListaSolicitudesRevisionDto>(`${this.base}/v1/review-requests`, { params }).pipe(
      map(mapearListaSolicitudesRevision),
      catchError((error: unknown) => throwError(() => traducirErrorRevision(error, 'review_unavailable'))),
    );
  }

  /**
   * Abre un caso de la bandeja (`GET /v1/review-requests/{acceptance_id}`): la solicitud con el modo y la vigencia
   * de la oferta y, si ya se decidió, el registro completo de la decisión. `review_request_not_found` si no existe.
   */
  consultarSolicitudRevision(aceptacionId: string): Observable<SolicitudRevision> {
    return this.http
      .get<SolicitudRevisionDto>(`${this.base}/v1/review-requests/${encodeURIComponent(aceptacionId)}`)
      .pipe(
        map(mapearSolicitudRevision),
        catchError((error: unknown) => throwError(() => traducirErrorRevision(error, 'review_unavailable'))),
      );
  }

  /**
   * Registra la decisión del asesor (`POST /v1/review-requests/{acceptance_id}/decision`): 201 con el caso decidido.
   * `review_request_already_decided` (409) si otro asesor se adelantó; `decision_continuation_pending` (503) pide
   * reenviar la misma decisión, que completa el flujo. Falla con `ErrorRevision`.
   */
  registrarDecision(aceptacionId: string, registro: RegistroDecision): Observable<SolicitudRevision> {
    return this.http
      .post<SolicitudRevisionDto>(
        `${this.base}/v1/review-requests/${encodeURIComponent(aceptacionId)}/decision`,
        aRegistroDecisionDto(registro),
      )
      .pipe(
        map(mapearSolicitudRevision),
        catchError((error: unknown) => throwError(() => traducirErrorRevision(error, 'decision_not_registered'))),
      );
  }

  /**
   * Lista las emisiones con su estado para operaciones (`GET /v1/issuances`, solo `operations`; HU-W1.3-04),
   * la más reciente primero, con los filtros de estado, canal y fecha de aceptación, y los conteos de todas las
   * emisiones para las tarjetas (el «hoy» es el del analista). Sin resultados es una lista vacía, no un error.
   * Falla con `ErrorEmision`.
   */
  listarEmisiones(filtro: FiltroEmisiones): Observable<ListaEmisiones> {
    return this.http
      .get<ListaEmisionesDto>(`${this.base}/v1/issuances`, { params: aParametrosEmisiones(filtro) })
      .pipe(
        map(mapearListaEmisiones),
        catchError((error: unknown) => throwError(() => traducirErrorMonitoreo(error))),
      );
  }

  /**
   * Acciones que los analistas tomaron sobre una emisión (`GET /v1/issuances/{id}/actions`), la más reciente
   * primero, con su autor, nota y fecha. Falla con `ErrorEmision`.
   */
  listarAccionesEmision(aceptacionId: string): Observable<readonly AccionEmision[]> {
    return this.http
      .get<ListaAccionesDto>(`${this.base}/v1/issuances/${encodeURIComponent(aceptacionId)}/actions`)
      .pipe(
        map(mapearListaAcciones),
        catchError((error: unknown) => throwError(() => traducirErrorMonitoreo(error))),
      );
  }

  /**
   * Reintenta lo que falló en una emisión, desde la aceptación registrada (`POST /v1/issuances/{id}/retry`, solo
   * `operations`): el cobro de la prima, o el documento y el aviso si el cobro ya se confirmó. La nota es
   * obligatoria (1 a 500 caracteres) y queda registrada con el autor y la fecha. Es idempotente:
   * `issuance_not_retryable` (409) significa que otro analista o el proceso automático ya lo reintentó. Falla con
   * `ErrorEmision`.
   */
  reintentarEmision(aceptacionId: string, nota: string): Observable<ReintentoEmision> {
    return this.http
      .post<ReintentoEmisionDto>(`${this.base}/v1/issuances/${encodeURIComponent(aceptacionId)}/retry`, { note: nota })
      .pipe(
        map(mapearReintento),
        catchError((error: unknown) => throwError(() => traducirErrorMonitoreo(error))),
      );
  }
}
