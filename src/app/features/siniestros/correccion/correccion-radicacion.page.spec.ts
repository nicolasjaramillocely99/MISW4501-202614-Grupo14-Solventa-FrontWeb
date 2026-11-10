import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import {
  CASO_DEVUELTO_DTO,
  HISTORIAL_DEVUELTO_DTO,
  ID_DEVUELTO,
  RESULTADO_REENVIO_DTO,
} from '@testing/reenvio-radicacion-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { Observable, of, throwError } from 'rxjs';

import {
  ErrorReenvio,
  HistorialSiniestroDto,
  mapearHistorialSiniestro,
  mapearResultadoReenvio,
} from '@core/api/siniestros/reenvio.modelos';
import { ErrorSiniestro, mapearDetalleSiniestro } from '@core/api/siniestros/siniestro.modelos';
import { SiniestrosApiService } from '@core/api/siniestros/siniestros-api.service';

import { CorreccionRadicacionPage } from './correccion-radicacion.page';

const foto = (nombre: string) => new File(['imagen'], nombre, { type: 'image/jpeg' });
const pdf = (nombre: string) => new File(['%PDF-1.7'], nombre, { type: 'application/pdf' });

describe('CorreccionRadicacionPage (A9 · HU-W2.1-04)', () => {
  let api: {
    consultarSiniestro: ReturnType<typeof vi.fn>;
    consultarHistorial: ReturnType<typeof vi.fn>;
    reenviarRadicacion: ReturnType<typeof vi.fn>;
    subirSoporte: ReturnType<typeof vi.fn>;
  };

  async function renderizar(
    historial: HistorialSiniestroDto | Observable<never> = HISTORIAL_DEVUELTO_DTO,
  ) {
    let subidos = 0;
    api = {
      consultarSiniestro: vi.fn().mockReturnValue(of(mapearDetalleSiniestro(CASO_DEVUELTO_DTO))),
      consultarHistorial: vi
        .fn()
        .mockReturnValue(
          'subscribe' in historial ? historial : of(mapearHistorialSiniestro(historial)),
        ),
      reenviarRadicacion: vi
        .fn()
        .mockReturnValue(of(mapearResultadoReenvio(RESULTADO_REENVIO_DTO))),
      subirSoporte: vi.fn().mockImplementation((archivo: File) =>
        of({
          id: `sup-nuevo-${++subidos}`,
          nombreArchivo: archivo.name,
          tipoContenido: archivo.type,
          tamanoBytes: archivo.size,
          sha256: 'x',
          subidoEn: '2026-09-16T15:00:00Z',
        }),
      ),
    };
    await render(CorreccionRadicacionPage, {
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter([]),
        { provide: SiniestrosApiService, useValue: api },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: ID_DEVUELTO }) } },
        },
      ],
    });
    return userEvent.setup();
  }

  const fila = (codigo: string) =>
    document.querySelector<HTMLElement>(`[data-codigo="${codigo}"]`)!;
  const reenviar = () => screen.getByRole('button', { name: 'Reenviar radicación' });

  it('muestra el motivo, los datos radicados y lo que pidió el asesor (CA-1)', async () => {
    await renderizar();

    expect(api.consultarSiniestro).toHaveBeenCalledWith(ID_DEVUELTO);
    expect(api.consultarHistorial).toHaveBeenCalledWith(ID_DEVUELTO);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Siniestro SIN-2026-01877' }),
    ).toBeTruthy();
    expect(screen.getByText('Devuelto al cliente')).toBeTruthy();
    expect(screen.getByText(/por Juan Ríos \(asesor de siniestros\)/)).toBeTruthy();
    expect(
      screen.getByText('El informe de tránsito no se puede leer y falta la foto de la placa.'),
    ).toBeTruthy();

    expect((screen.getByLabelText(/Lugar del hecho/) as HTMLInputElement).value).toBe(
      'Calle 80 con carrera 30, Bogotá',
    );
    expect(screen.getByText('Pedido por el asesor')).toBeTruthy();
    expect((screen.getByLabelText(/Monto estimado/) as HTMLInputElement).value).toBe('4800000');

    expect(screen.getByText('2 pendientes')).toBeTruthy();
    expect(
      within(fila('traffic_report')).getByText(/el archivo no es legible\. borroso/),
    ).toBeTruthy();
    expect(
      within(fila('traffic_report')).getByLabelText(
        'Reemplazar archivos de Informe de tránsito o croquis',
      ),
    ).toBeTruthy();
    expect(within(fila('plate_photo')).getByText('Solicitado por el asesor')).toBeTruthy();
    expect(
      within(fila('plate_photo')).getByLabelText('Subir archivos de Fotografía de la placa'),
    ).toBeTruthy();
    expect(within(fila('vehicle_photos')).getByText('Fotos del vehículo (6)')).toBeTruthy();
    expect(
      within(fila('vehicle_photos')).getByLabelText('Agregar archivos a Fotos del vehículo'),
    ).toBeTruthy();

    const historial = screen.getByRole('heading', {
      name: 'Historial de la radicación',
    }).parentElement!;
    expect(within(historial).getByText('Radicado')).toBeTruthy();
    expect(within(historial).getByText('Devuelto por Juan Ríos')).toBeTruthy();
    expect(within(historial).getByText('Reenvío pendiente')).toBeTruthy();
  });

  it('no reenvía mientras falte algo y dice qué falta (CA-3)', async () => {
    const usuario = await renderizar();

    await usuario.click(reenviar());

    const resumen = screen.getByRole('alert');
    expect(
      within(resumen).getByText(/Informe de tránsito o croquis: sube un archivo nuevo/),
    ).toBeTruthy();
    expect(within(resumen).getByText(/Fotografía de la placa: súbelo/)).toBeTruthy();
    expect(api.reenviarRadicacion).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(resumen);
  });

  it('señala un dato inválido apenas se edita', async () => {
    const usuario = await renderizar();
    const lugar = screen.getByLabelText(/Lugar del hecho/);

    await usuario.clear(lugar);
    await usuario.type(lugar, 'ab');

    expect(screen.getByText('El lugar debe tener entre 3 y 160 caracteres.')).toBeTruthy();
    expect(lugar.getAttribute('aria-invalid')).toBe('true');
  });

  it('reenvía lo corregido con el conjunto completo de cada soporte y conserva el número (CA-2 y CA-4)', async () => {
    const usuario = await renderizar();

    await usuario.upload(
      screen.getByLabelText('Reemplazar archivos de Informe de tránsito o croquis'),
      pdf('croquis-nuevo.pdf'),
    );
    await usuario.upload(
      screen.getByLabelText('Subir archivos de Fotografía de la placa'),
      foto('placa.jpg'),
    );
    await usuario.upload(
      screen.getByLabelText('Agregar archivos a Fotos del vehículo'),
      foto('7.jpg'),
    );
    const lugar = screen.getByLabelText(/Lugar del hecho/);
    await usuario.clear(lugar);
    await usuario.type(lugar, 'Calle 80 con carrera 30, frente al centro comercial, Bogotá');

    expect(screen.getByText('0 pendientes')).toBeTruthy();
    expect(
      within(fila('traffic_report')).getByText(
        'Al reenviar, los archivos nuevos reemplazan los 1 anteriores.',
      ),
    ).toBeTruthy();
    await usuario.click(reenviar());

    expect(api.reenviarRadicacion).toHaveBeenCalledTimes(1);
    const [id, solicitud] = api.reenviarRadicacion.mock.calls[0];
    expect(id).toBe(ID_DEVUELTO);
    expect(solicitud.revisionSecuencia).toBe(1);
    expect(solicitud.lugar).toBe('Calle 80 con carrera 30, frente al centro comercial, Bogotá');
    expect(solicitud.ocurridoEn).toBeUndefined();
    const fotos = CASO_DEVUELTO_DTO.supports.items[0].files.map((f) => f.support_id);
    expect(solicitud.soportes).toEqual([
      { codigoRequisito: 'vehicle_photos', soporteIds: [...fotos, 'sup-nuevo-3'] },
      { codigoRequisito: 'traffic_report', soporteIds: ['sup-nuevo-1'] },
      { codigoRequisito: 'plate_photo', soporteIds: ['sup-nuevo-2'] },
    ]);
    expect(screen.getByRole('heading', { name: 'Radicación reenviada' })).toBeTruthy();
    expect(screen.getByText(/El siniestro SIN-2026-01877 conserva su número/)).toBeTruthy();
  });

  it('muestra en su soporte lo que el servidor dijo que falta (422)', async () => {
    const usuario = await renderizar();
    api.reenviarRadicacion.mockReturnValue(
      throwError(
        () =>
          new ErrorReenvio('validation_failed', [
            { campo: 'supports.traffic_report', codigo: 'not_found' },
          ]),
      ),
    );
    await usuario.upload(
      screen.getByLabelText('Reemplazar archivos de Informe de tránsito o croquis'),
      pdf('croquis.pdf'),
    );
    await usuario.upload(
      screen.getByLabelText('Subir archivos de Fotografía de la placa'),
      foto('placa.jpg'),
    );

    await usuario.click(reenviar());

    expect(
      within(fila('traffic_report')).getByText('un archivo no se pudo usar; súbelo de nuevo'),
    ).toBeTruthy();
  });

  it('si el asesor volvió a revisarla pide recargar', async () => {
    const usuario = await renderizar();
    api.reenviarRadicacion.mockReturnValue(throwError(() => new ErrorReenvio('stale_return')));
    await usuario.upload(
      screen.getByLabelText('Reemplazar archivos de Informe de tránsito o croquis'),
      pdf('croquis.pdf'),
    );
    await usuario.upload(
      screen.getByLabelText('Subir archivos de Fotografía de la placa'),
      foto('placa.jpg'),
    );

    await usuario.click(reenviar());
    expect(screen.getByText(/El asesor volvió a revisar esta radicación/)).toBeTruthy();

    await usuario.click(screen.getByRole('button', { name: 'Recargar la radicación' }));
    expect(api.consultarHistorial).toHaveBeenCalledTimes(2);
  });

  it('un fallo del servidor no pierde lo corregido', async () => {
    const usuario = await renderizar();
    api.reenviarRadicacion.mockReturnValue(
      throwError(() => new ErrorReenvio('claims_unavailable')),
    );
    await usuario.upload(
      screen.getByLabelText('Reemplazar archivos de Informe de tránsito o croquis'),
      pdf('croquis.pdf'),
    );
    await usuario.upload(
      screen.getByLabelText('Subir archivos de Fotografía de la placa'),
      foto('placa.jpg'),
    );

    await usuario.click(reenviar());

    expect(screen.getByText(/No pudimos reenviar la radicación/)).toBeTruthy();
    expect(screen.getByText('0 pendientes')).toBeTruthy();
    expect((reenviar() as HTMLButtonElement).disabled).toBe(false);
  });

  it('quitar un archivo nuevo vuelve a dejar pendiente el soporte', async () => {
    const usuario = await renderizar();
    await usuario.upload(
      screen.getByLabelText('Subir archivos de Fotografía de la placa'),
      foto('placa.jpg'),
    );
    expect(screen.getByText('1 pendientes')).toBeTruthy();

    await usuario.click(screen.getByRole('button', { name: 'Quitar placa.jpg' }));

    expect(screen.getByText('2 pendientes')).toBeTruthy();
  });

  it('una radicación que no está devuelta no se edita', async () => {
    await renderizar({ ...HISTORIAL_DEVUELTO_DTO, status: 'active', last_return: null });

    expect(screen.getByRole('heading', { name: 'Esta radicación no está devuelta' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ver el siniestro' }).getAttribute('href')).toBe(
      `/siniestros/${ID_DEVUELTO}`,
    );
    expect(screen.queryByRole('button', { name: 'Reenviar radicación' })).toBeNull();
  });

  it('un caso que no existe o es ajeno se informa, y un fallo se puede reintentar', async () => {
    await renderizar(throwError(() => new ErrorSiniestro('claim_not_found')));
    expect(screen.getByRole('heading', { name: 'No encontramos este siniestro' })).toBeTruthy();
  });

  it('un fallo al cargar se puede reintentar', async () => {
    const usuario = await renderizar(throwError(() => new ErrorReenvio('claims_unavailable')));
    expect(screen.getByRole('heading', { name: 'No pudimos cargar la radicación' })).toBeTruthy();

    api.consultarHistorial.mockReturnValue(of(mapearHistorialSiniestro(HISTORIAL_DEVUELTO_DTO)));
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(
      screen.getByRole('heading', { level: 1, name: 'Siniestro SIN-2026-01877' }),
    ).toBeTruthy();
  });
});
