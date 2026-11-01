import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';

import {
  ErrorSoporte,
  RequisitoSoporte,
  SoporteSubido,
} from '@core/api/siniestros/radicacion.modelos';
import { SiniestrosApiService } from '@core/api/siniestros/siniestros-api.service';

import { CargaSoportesService } from './carga-soportes.service';

const FOTOS: RequisitoSoporte = {
  codigo: 'vehicle_photos',
  etiqueta: 'Fotos del vehículo',
  obligatorio: true,
  minArchivos: 4,
  maxArchivos: 2,
  formatos: ['jpeg', 'png'],
};

const foto = (nombre: string, tamano = 100) => new File(['x'.repeat(tamano)], nombre, { type: 'image/jpeg' });
const soporte = (id: string): SoporteSubido => ({
  id,
  nombreArchivo: 'x',
  tipoContenido: 'image/jpeg',
  tamanoBytes: 1,
  sha256: 'h',
  subidoEn: '2026-09-14T23:58:02Z',
});

describe('CargaSoportesService (HU-W2.1-01)', () => {
  let servicio: CargaSoportesService;
  let respuestas: Subject<SoporteSubido>[];
  let subirSoporte: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    respuestas = [];
    subirSoporte = vi.fn(() => {
      const respuesta = new Subject<SoporteSubido>();
      respuestas.push(respuesta);
      return respuesta;
    });
    TestBed.configureTestingModule({
      providers: [CargaSoportesService, { provide: SiniestrosApiService, useValue: { subirSoporte } }],
    });
    servicio = TestBed.inject(CargaSoportesService);
  });

  const responder = (indice: number, id: string) => {
    respuestas[indice].next(soporte(id));
    respuestas[indice].complete();
  };

  it('sube los archivos elegidos uno por uno, en orden, y los marca como adjuntos', () => {
    servicio.agregar(FOTOS, [foto('a.jpg'), foto('b.jpg')]);

    expect(subirSoporte).toHaveBeenCalledTimes(1);
    expect(servicio.subiendo()).toBe(true);
    responder(0, 'sup-a');
    expect(subirSoporte).toHaveBeenCalledTimes(2);
    expect((subirSoporte.mock.calls[1][0] as File).name).toBe('b.jpg');
    responder(1, 'sup-b');

    expect(servicio.subiendo()).toBe(false);
    expect(servicio.adjuntos()).toEqual({ vehicle_photos: 2 });
    expect(servicio.soporteIds()).toEqual({ vehicle_photos: ['sup-a', 'sup-b'] });
  });

  it('una respuesta inmediata del servidor encuentra su archivo y lo deja adjunto', () => {
    subirSoporte.mockImplementation(() => of(soporte('sup-inmediato')));

    servicio.agregar(FOTOS, [foto('a.jpg')]);

    expect(servicio.archivos()['vehicle_photos'][0].estado).toBe('adjunto');
    expect(servicio.soporteIds()).toEqual({ vehicle_photos: ['sup-inmediato'] });
  });

  it('rechaza sin petición lo que no pasa la prevalidación o excede el máximo del soporte', () => {
    servicio.agregar(FOTOS, [
      new File(['%PDF'], 'croquis.pdf', { type: 'application/pdf' }),
      new File([], 'vacio.jpg', { type: 'image/jpeg' }),
      foto('a.jpg'),
      foto('b.jpg'),
      foto('c.jpg'),
    ]);

    const lista = servicio.archivos()['vehicle_photos'];
    expect(lista.map((archivo) => [archivo.nombre, archivo.estado, archivo.motivo])).toEqual([
      ['croquis.pdf', 'rechazado', 'unsupported_file_type'],
      ['vacio.jpg', 'rechazado', 'empty_file'],
      ['a.jpg', 'subiendo', null],
      ['b.jpg', 'subiendo', null],
      ['c.jpg', 'rechazado', 'limite'],
    ]);
    responder(0, 'sup-a');
    responder(1, 'sup-b');
    expect(subirSoporte).toHaveBeenCalledTimes(2);
  });

  it('un rechazo del servidor afecta solo a ese archivo y la cola sigue (CA-5)', () => {
    servicio.agregar(FOTOS, [foto('renombrado.jpg'), foto('b.jpg')]);

    respuestas[0].error(new ErrorSoporte('unsupported_file_type'));
    responder(1, 'sup-b');

    const lista = servicio.archivos()['vehicle_photos'];
    expect(lista.map((archivo) => [archivo.estado, archivo.motivo])).toEqual([
      ['rechazado', 'unsupported_file_type'],
      ['adjunto', null],
    ]);
    expect(servicio.soporteIds()).toEqual({ vehicle_photos: ['sup-b'] });
  });

  it('muestra el 429 de demasiados pendientes y trata un error desconocido como indisponible', () => {
    servicio.agregar(FOTOS, [foto('a.jpg'), foto('b.jpg')]);

    respuestas[0].error(new ErrorSoporte('too_many_pending_supports'));
    respuestas[1].error(new Error('red'));

    expect(servicio.archivos()['vehicle_photos'].map((archivo) => archivo.motivo)).toEqual([
      'too_many_pending_supports',
      'supports_unavailable',
    ]);
  });

  it('los rechazados no ocupan cupo: al quitar uno se puede volver a agregar', () => {
    servicio.agregar(FOTOS, [foto('a.jpg'), foto('b.jpg')]);
    responder(0, 'sup-a');
    responder(1, 'sup-b');
    const [primero] = servicio.archivos()['vehicle_photos'];

    servicio.quitar('vehicle_photos', primero.clave);
    servicio.agregar(FOTOS, [foto('c.jpg')]);
    responder(2, 'sup-c');

    expect(servicio.soporteIds()).toEqual({ vehicle_photos: ['sup-b', 'sup-c'] });
  });

  it('descarta la respuesta de un archivo quitado mientras subía', () => {
    servicio.agregar(FOTOS, [foto('a.jpg')]);
    const [archivo] = servicio.archivos()['vehicle_photos'];

    servicio.quitar('vehicle_photos', archivo.clave);
    responder(0, 'sup-a');

    expect(servicio.archivos()['vehicle_photos']).toEqual([]);
    expect(servicio.soporteIds()).toEqual({ vehicle_photos: [] });
  });

  it('reiniciar vacía la lista y descarta las subidas que estaban en curso', () => {
    servicio.agregar(FOTOS, [foto('a.jpg')]);

    servicio.reiniciar();
    responder(0, 'sup-a');

    expect(servicio.archivos()).toEqual({});
    expect(servicio.subiendo()).toBe(false);
  });
});
