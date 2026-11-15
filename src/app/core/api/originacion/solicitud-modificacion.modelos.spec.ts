import { HttpErrorResponse } from '@angular/common/http';
import {
  CONDICIONES_CON_ABIERTA_DTO,
  CONDICIONES_VENTA_ASESOR_DTO,
  PAGINA_SOLICITUDES_DTO,
  SOLICITUD_BENEFICIARIOS_DTO,
  SOLICITUD_CONTACTO_APLICADA_DTO,
  SOLICITUD_SUMA_EN_REVISION_DTO,
} from '@testing/solicitud-modificacion-pruebas';

import {
  aParametrosSolicitudes,
  aSolicitudNuevaDto,
  estadoParaAsegurado,
  mapearCondicionesVigentes,
  mapearPaginaSolicitudes,
  mapearSolicitudModificacion,
  traducirErrorSolicitud,
  ubicarCampo,
} from './solicitud-modificacion.modelos';

function errorHttp(status: number, cuerpo: unknown = null): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: cuerpo });
}

describe('solicitud-modificacion.modelos (HU-W1.4-01)', () => {
  it('proyecta los cinco estados como los ve el asegurado (ajuste A-1)', () => {
    expect(estadoParaAsegurado('filed', null)).toBe('radicada');
    expect(estadoParaAsegurado('in_review', null)).toBe('enRevision');
    expect(estadoParaAsegurado('applied', null)).toBe('aplicada');
    expect(estadoParaAsegurado('rejected', 'Falta el avalúo')).toBe('rechazada');
    expect(estadoParaAsegurado('not_applied', null)).toBe('enRevision');
    expect(estadoParaAsegurado('not_applied', 'Documento no válido')).toBe('rechazada');
    expect(estadoParaAsegurado('cancelled', null)).toBe('desconocido');
  });

  it('traduce las condiciones vigentes con el oneroso, el contacto y lo abierto', () => {
    const condiciones = mapearCondicionesVigentes(CONDICIONES_CON_ABIERTA_DTO);

    expect(condiciones.poliza).toEqual({
      polizaId: 'pol-acc-4f2a',
      linea: 'life',
      titular: 'Carolina Pérez',
      vigenciaDesde: '2026-07-16T12:00:00Z',
      vigenciaHasta: '2027-07-16T12:00:00Z',
      vigente: true,
    });
    expect(condiciones.valorAsegurado).toBe(68000000);
    expect(condiciones.beneficiarios).toEqual([
      { nombreCompleto: 'Mateo Pérez Gómez', parentesco: 'child', tipoDocumento: 'TI', numeroDocumento: '1140223001', participacion: 100 },
    ]);
    expect(condiciones.oneroso).toEqual({ aliadoId: 'aliado-banco-1', nombre: 'Banco Aliado', base: 'outstanding_balance' });
    expect(condiciones.contacto).toEqual({ direccion: null, correo: 'carolina@example.com', telefono: null });
    expect(condiciones.abiertas).toEqual([
      { solicitudId: 'SOL-MOD-2026-0042', tipo: 'beneficiaries', estadoGuardado: 'filed', radicadaEn: '2026-09-16T20:10:00Z' },
    ]);
    expect(condiciones.limites).toEqual({ valorMinimo: 10000000, valorMaximo: 2000000000, maxBeneficiarios: 10 });
    expect(mapearCondicionesVigentes(CONDICIONES_VENTA_ASESOR_DTO).oneroso).toEqual({
      aliadoId: null,
      nombre: null,
      base: 'outstanding_balance',
    });
  });

  it('traduce la solicitud con la foto, lo pedido y la diferencia', () => {
    const beneficiarios = mapearSolicitudModificacion(SOLICITUD_BENEFICIARIOS_DTO);
    expect(beneficiarios.estado).toBe('radicada');
    expect(beneficiarios.radicadaPor).toEqual({ correo: 'carolina@example.com', nombre: null });
    expect(beneficiarios.anterior).toEqual({
      beneficiarios: [],
      oneroso: { aliadoId: 'aliado-banco-1', nombre: 'Banco Aliado', base: 'outstanding_balance' },
    });
    expect(beneficiarios.solicitado.beneficiarios?.map((b) => b.participacion)).toEqual([60, 40]);
    expect(beneficiarios.cambios[0]).toEqual({
      campo: 'beneficiaries',
      anterior: null,
      nuevo: { nombreCompleto: 'Mateo Pérez Gómez', parentesco: 'child', tipoDocumento: 'TI', numeroDocumento: '1140223001', participacion: 60 },
    });

    const suma = mapearSolicitudModificacion(SOLICITUD_SUMA_EN_REVISION_DTO);
    expect(suma.anterior).toEqual({ valorAsegurado: 68000000, moneda: 'COP' });
    expect(suma.cambios).toEqual([{ campo: 'insured_amount', anterior: 68000000, nuevo: 80000000 }]);

    const contacto = mapearSolicitudModificacion(SOLICITUD_CONTACTO_APLICADA_DTO);
    expect(contacto.estado).toBe('aplicada');
    expect(contacto.solicitado.contacto).toEqual({ direccion: 'Calle 45 # 12-30, Bogotá', correo: null, telefono: '3012345678' });
    expect(contacto.cambios[0]).toEqual({ campo: 'personal_data.address', anterior: null, nuevo: 'Calle 45 # 12-30, Bogotá' });
  });

  it('traduce la página con los indicadores y la proyección de cada fila', () => {
    const pagina = mapearPaginaSolicitudes(PAGINA_SOLICITUDES_DTO);

    expect(pagina.items.map((f) => f.estado)).toEqual(['rechazada', 'enRevision', 'radicada', 'enRevision', 'aplicada', 'rechazada']);
    expect(pagina.total).toBe(6);
    expect(pagina.totalPaginas).toBe(1);
    expect(pagina.indicadores.abiertas.cantidad).toBe(3);
    expect(pagina.indicadores.aplicadasAnio.ultima?.solicitudId).toBe('SOL-MOD-2026-0018');
    expect(pagina.indicadores.rechazadas.ultima?.cambioEstadoEn).toBe('2026-09-18T15:00:00Z');
    expect(pagina.polizas).toEqual(['pol-acc-4f2a']);
  });

  it('arma el cuerpo con solo el miembro del tipo y el canal web', () => {
    expect(
      aSolicitudNuevaDto({
        tipo: 'beneficiaries',
        beneficiarios: [{ nombreCompleto: 'Ana Gómez', parentesco: 'parent', tipoDocumento: 'CC', numeroDocumento: '52123456', participacion: 100 }],
      }),
    ).toEqual({
      change_type: 'beneficiaries',
      channel: 'web',
      beneficiaries: [{ full_name: 'Ana Gómez', relationship: 'parent', document_type: 'CC', document_number: '52123456', share_percent: 100 }],
    });
    expect(aSolicitudNuevaDto({ tipo: 'insured_amount', valorAsegurado: 80000000 })).toEqual({
      change_type: 'insured_amount',
      channel: 'web',
      insured_amount: 80000000,
    });
    expect(aSolicitudNuevaDto({ tipo: 'personal_data', contacto: { direccion: 'Calle 10', correo: '', telefono: '3001234567' } })).toEqual({
      change_type: 'personal_data',
      channel: 'web',
      personal_data: { address: 'Calle 10', phone: '3001234567' },
    });
  });

  it('arma los parámetros de la lista con solo lo que tiene valor', () => {
    expect(aParametrosSolicitudes({ estado: null, polizaId: null, desde: null, pagina: 1, tamano: 20 }).toString()).toBe('page=1&page_size=20');
    expect(
      aParametrosSolicitudes({ estado: 'rejected', polizaId: 'pol-acc-4f2a', desde: '2026-01-01', pagina: 2, tamano: 20 }).toString(),
    ).toBe('page=2&page_size=20&status=rejected&policy_id=pol-acc-4f2a&filed_from=2026-01-01');
  });

  it('traduce los errores del contrato con sus campos y la solicitud abierta', () => {
    const invalida = traducirErrorSolicitud(
      errorHttp(422, {
        error: 'validation_failed',
        message: 'm',
        fields: [
          { field: 'beneficiaries', code: 'share_total_not_100' },
          { field: 'beneficiaries[1].document_number', code: 'invalid_format' },
          { field: 'raro', code: 'desconocido' },
          'basura',
        ],
      }),
    );
    expect(invalida.codigo).toBe('validation_failed');
    expect(invalida.campos).toEqual([
      { campo: 'beneficiaries', codigo: 'share_total_not_100' },
      { campo: 'beneficiaries[1].document_number', codigo: 'invalid_format' },
    ]);

    const abierta = traducirErrorSolicitud(errorHttp(409, { error: 'change_request_open', message: 'm', request_id: 'SOL-MOD-2026-0041' }));
    expect(abierta.codigo).toBe('change_request_open');
    expect(abierta.solicitudAbierta).toBe('SOL-MOD-2026-0041');

    expect(traducirErrorSolicitud(errorHttp(409, { error: 'policy_not_in_force', message: 'm' })).codigo).toBe('policy_not_in_force');
    expect(traducirErrorSolicitud(errorHttp(400)).codigo).toBe('invalid_request');
    expect(traducirErrorSolicitud(errorHttp(401)).codigo).toBe('unauthorized');
    expect(traducirErrorSolicitud(errorHttp(403)).codigo).toBe('forbidden');
    expect(traducirErrorSolicitud(errorHttp(404)).codigo).toBe('policy_not_found');
    expect(traducirErrorSolicitud(errorHttp(503)).codigo).toBe('change_request_unavailable');
    expect(traducirErrorSolicitud(new Error('red')).codigo).toBe('change_request_unavailable');
  });

  it('ubica cada campo del 422 en el formulario', () => {
    expect(ubicarCampo('change_type')).toEqual({ grupo: 'tipo', indice: null, control: null });
    expect(ubicarCampo('beneficiaries')).toEqual({ grupo: 'beneficiarios', indice: null, control: null });
    expect(ubicarCampo('beneficiaries[2].share_percent')).toEqual({ grupo: 'beneficiarios', indice: 2, control: 'participacion' });
    expect(ubicarCampo('beneficiaries[0].nit')).toBeNull();
    expect(ubicarCampo('insured_amount')).toEqual({ grupo: 'valorAsegurado', indice: null, control: 'valorAsegurado' });
    expect(ubicarCampo('personal_data')).toEqual({ grupo: 'contacto', indice: null, control: null });
    expect(ubicarCampo('personal_data.phone')).toEqual({ grupo: 'contacto', indice: null, control: 'telefono' });
    expect(ubicarCampo('personal_data.fax')).toBeNull();
    expect(ubicarCampo('otro')).toBeNull();
  });
});
