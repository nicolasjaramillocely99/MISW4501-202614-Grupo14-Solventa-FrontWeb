import { HttpErrorResponse } from '@angular/common/http';
import {
  DETALLE_DEVUELTO_DTO,
  DETALLE_NO_APLICADO_DTO,
  DETALLE_SUMA_DTO,
  HISTORIAL_ENDOSOS_DTO,
  PAGINA_ENDOSOS_DTO,
} from '@testing/endosos-pruebas';

import {
  aParametrosEndosos,
  estadoParaAnalista,
  mapearDetalleEndoso,
  mapearHistorialEndosos,
  mapearPaginaEndosos,
  traducirErrorEndoso,
} from './endosos.modelos';

describe('modelos de los endosos (HU-W1.4-02)', () => {
  it('el analista ve «No aplicado» se haya devuelto o no, y un estado desconocido neutro', () => {
    expect(['filed', 'in_review', 'applied', 'rejected', 'not_applied', 'otro'].map(estadoParaAnalista)).toEqual([
      'radicada',
      'enRevision',
      'aplicada',
      'rechazada',
      'noAplicado',
      'desconocido',
    ]);
  });

  it('la bandeja trae el titular de cada fila y los indicadores', () => {
    const pagina = mapearPaginaEndosos(PAGINA_ENDOSOS_DTO);

    expect(pagina.items[0].titular).toEqual({ nombre: 'Carolina Pérez Ruiz', documento: '1020345678' });
    expect(pagina.indicadores).toEqual({
      pendientes: 5,
      vencidas: 2,
      aplicadasHoy: 8,
      tiempoMedioSegundos: 12000,
      rechazadas7Dias: 1,
      motivoFrecuente: 'shares_total_100',
    });
  });

  it('el detalle de una suma asegurada trae la prima del motor y el de una devuelta, lo decidido', () => {
    expect(mapearDetalleEndoso(DETALLE_SUMA_DTO).prima).toEqual({ anterior: 68500, nueva: 82200, moneda: 'COP', versionMotor: 'v1' });

    const devuelto = mapearDetalleEndoso(DETALLE_DEVUELTO_DTO);
    expect(devuelto.solicitud.devuelta).toBe(true);
    expect(devuelto.origenValidaciones).toBe('attempt');
    expect(devuelto.decision).toEqual({
      resultado: 'returned',
      por: { nombre: 'Andrés Ruiz', rol: 'operations' },
      en: '2026-09-16T21:30:00Z',
      observaciones: 'El documento de Lucía no está en la Registraduría. Corrígelo y radica de nuevo.',
      endosoId: null,
      fallidas: ['identity_documents_valid'],
    });
    expect(mapearDetalleEndoso(DETALLE_NO_APLICADO_DTO).validaciones[2]).toEqual({
      codigo: 'identity_documents_valid',
      resultado: 'failed',
      parametros: { checks: '2', not_found: '1', document: 'TI 1142998000' },
    });
  });

  it('el historial conserva el orden y la prima de una suma aplicada', () => {
    const historial = mapearHistorialEndosos(HISTORIAL_ENDOSOS_DTO);

    expect(historial.entradas.map((e) => e.endosoId)).toEqual(['END-2026-0102', null, 'END-2026-0090']);
    expect(historial.entradas[2].prima).toEqual({ anterior: 55000, nueva: 68500, moneda: 'COP' });
    expect(historial.entradas[1].fallidas).toEqual(['identity_documents_valid']);
  });

  it('la bandeja solo envía los filtros que tienen valor', () => {
    const solo = aParametrosEndosos({ tipo: null, estado: 'pending', desde: null, pagina: 1, tamano: 20 });
    expect(solo.keys()).toEqual(['status', 'page', 'page_size']);

    const todos = aParametrosEndosos({ tipo: 'insured_amount', estado: 'all', desde: '2026-09-09', pagina: 2, tamano: 50 });
    expect(todos.get('change_type')).toBe('insured_amount');
    expect(todos.get('filed_from')).toBe('2026-09-09');
  });

  it('traduce los errores del contrato con el estado que dejó otro analista y las no verificables', () => {
    const conflicto = traducirErrorEndoso(
      new HttpErrorResponse({ status: 409, error: { error: 'request_already_decided', message: 'm', status: 'applied' } }),
    );
    expect([conflicto.codigo, conflicto.estadoActual]).toEqual(['request_already_decided', 'applied']);

    const caida = traducirErrorEndoso(
      new HttpErrorResponse({ status: 503, error: { error: 'validation_unverifiable', message: 'm', unverifiable: ['identity_documents_valid'] } }),
    );
    expect(caida.noVerificables).toEqual(['identity_documents_valid']);

    expect(
      [400, 401, 403, 404, 409, 500].map((status) => traducirErrorEndoso(new HttpErrorResponse({ status, error: 'x' })).codigo),
    ).toEqual(['invalid_request', 'unauthorized', 'forbidden', 'change_request_not_found', 'request_already_decided', 'endorsement_unavailable']);
    expect(traducirErrorEndoso(new Error('red')).codigo).toBe('endorsement_unavailable');
  });
});
