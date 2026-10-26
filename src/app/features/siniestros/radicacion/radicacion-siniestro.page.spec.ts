import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { fireEvent, render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { OPCIONES_RADICACION_DTO, SINIESTRO_RADICADO_DTO } from '@testing/siniestros-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { Observable, of, throwError } from 'rxjs';

import {
  ErrorRadicacion,
  OpcionesRadicacion,
  SolicitudRadicacion,
  SoporteSubido,
  mapearOpcionesRadicacion,
} from '@core/api/siniestros/radicacion.modelos';
import { DetalleSiniestro, ErrorSiniestro, mapearDetalleSiniestro } from '@core/api/siniestros/siniestro.modelos';
import { SiniestrosApiService } from '@core/api/siniestros/siniestros-api.service';

import { aLocal } from './modelos/formulario-radicacion';
import { RadicacionSiniestroPage } from './radicacion-siniestro.page';

const OPCIONES = mapearOpcionesRadicacion(OPCIONES_RADICACION_DTO);
const CASO = mapearDetalleSiniestro(SINIESTRO_RADICADO_DTO);
/** Dentro de la vigencia de la póliza de Autos (2025-11-01 → 2026-11-01). */
const AHORA = new Date('2026-09-20T15:00:00Z');

const foto = (nombre: string) => new File(['imagen'], nombre, { type: 'image/jpeg' });
const pdf = (nombre: string) => new File(['%PDF-1.7'], nombre, { type: 'application/pdf' });

describe('RadicacionSiniestroPage (A6 / A6b · HU-W2.1-01)', () => {
  let api: {
    consultarOpcionesRadicacion: ReturnType<typeof vi.fn<() => Observable<OpcionesRadicacion>>>;
    subirSoporte: ReturnType<typeof vi.fn<(archivo: File) => Observable<SoporteSubido>>>;
    radicar: ReturnType<typeof vi.fn<(s: SolicitudRadicacion, clave: string) => Observable<DetalleSiniestro>>>;
    consultarSiniestro: ReturnType<typeof vi.fn<(id: string) => Observable<DetalleSiniestro>>>;
    descargarRadicado: ReturnType<typeof vi.fn<(id: string) => Observable<Blob>>>;
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(AHORA);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function renderizar({
    opciones = of(OPCIONES) as Observable<OpcionesRadicacion>,
    radicacion = of(CASO) as Observable<DetalleSiniestro>,
    casoId = null as string | null,
    caso = of(CASO) as Observable<DetalleSiniestro>,
  } = {}) {
    const navegar = vi.spyOn(Router.prototype, 'navigate').mockResolvedValue(true);
    let siguiente = 1;
    api = {
      consultarOpcionesRadicacion: vi.fn().mockReturnValue(opciones),
      subirSoporte: vi.fn((archivo: File) =>
        of<SoporteSubido>({
          id: `sup-${siguiente++}`,
          nombreArchivo: archivo.name,
          tipoContenido: archivo.type,
          tamanoBytes: archivo.size,
          sha256: 'h',
          subidoEn: '2026-09-20T15:00:00Z',
        }),
      ),
      radicar: vi.fn().mockReturnValue(radicacion),
      consultarSiniestro: vi.fn().mockReturnValue(caso),
      descargarRadicado: vi.fn().mockReturnValue(of(new Blob(['%PDF'], { type: 'application/pdf' }))),
    };
    const resultado = await render(RadicacionSiniestroPage, {
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter([]),
        { provide: SiniestrosApiService, useValue: api },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: (k: string) => (k === 'caso' ? casoId : null) } } },
        },
      ],
    });
    const usuario = userEvent.setup({ applyAccept: false, advanceTimers: () => undefined });
    return { ...resultado, navegar, usuario };
  }

  // Consultas por etiqueta o texto: `getByRole` con nombre recorre todo el DOM de la página y la hace lenta.
  const radicar = () => screen.getByText('Radicar siniestro', { selector: 'button' }) as HTMLButtonElement;
  const selectorPoliza = () => screen.getByLabelText('Póliza afectada');
  const selectorTipo = () => screen.getByLabelText('Tipo de siniestro');
  const entradaSoporte = (nombre: string) => screen.getByLabelText(`Subir archivos de ${nombre}`);
  const aviso = () => screen.getByLabelText('Estado de la radicación');

  async function elegirColision(usuario: ReturnType<typeof userEvent.setup>) {
    await usuario.selectOptions(selectorPoliza(), 'AU-2025-118204');
    await usuario.selectOptions(selectorTipo(), 'collision');
  }

  async function llenarDatos(usuario: ReturnType<typeof userEvent.setup>, hecho = '2026-09-14T23:40:00Z') {
    await elegirColision(usuario);
    // `fireEvent` en lugar de `usuario.type`: escribir carácter a carácter hace lenta la prueba sin probar nada más.
    fireEvent.input(screen.getByLabelText('Fecha y hora del hecho'), { target: { value: aLocal(new Date(hecho)) } });
    fireEvent.input(screen.getByLabelText('Lugar del hecho'), { target: { value: 'Calle 80 con carrera 30, Bogotá' } });
    fireEvent.input(screen.getByLabelText('Descripción de los hechos'), {
      target: { value: 'Un vehículo golpeó la parte trasera.' },
    });
  }

  async function adjuntarTodo(usuario: ReturnType<typeof userEvent.setup>, conCroquis = true) {
    await usuario.upload(entradaSoporte('Fotos del vehículo'), [foto('1.jpg'), foto('2.jpg'), foto('3.jpg'), foto('4.jpg')]);
    await usuario.upload(entradaSoporte('Documento del conductor'), pdf('cedula.pdf'));
    if (conCroquis) {
      await usuario.upload(entradaSoporte('Informe de tránsito o croquis'), pdf('croquis.pdf'));
    }
  }

  describe('opciones (CA-1)', () => {
    it('ofrece solo las pólizas del backend y los tipos de la póliza elegida', async () => {
      const { usuario } = await renderizar();

      expect(screen.getByRole('heading', { level: 1, name: 'Radicar un siniestro' })).toBeTruthy();
      const polizas = within(selectorPoliza()).getAllByRole('option').map((opcion) => opcion.textContent?.trim());
      expect(polizas).toEqual([
        'Elige una póliza',
        'Autos · AU-2025-118204 · KJT-482',
        'Hogar · HG-2025-880231 · Calle 93 # 11-20, Bogotá',
      ]);
      expect((selectorTipo() as HTMLSelectElement).disabled).toBe(true);

      await usuario.selectOptions(selectorPoliza(), 'HG-2025-880231');

      expect(within(selectorTipo()).getAllByRole('option').map((opcion) => opcion.textContent?.trim())).toEqual([
        'Elige el tipo de siniestro',
        'Daño por agua',
      ]);
    });

    it('al elegir el tipo muestra sus soportes con los obligatorios y los de otros tipos como «No aplica»', async () => {
      const { usuario } = await renderizar();

      await elegirColision(usuario);

      const soportes = screen.getByRole('region', { name: 'Soportes' });
      expect(within(soportes).getByText('0 de 3 obligatorios adjuntos')).toBeTruthy();
      expect(within(soportes).getByText('Fotos del vehículo (mínimo 4)')).toBeTruthy();
      expect(within(soportes).getByText('Obligatorio · JPG o PNG · máx. 10 MB c/u · hasta 10')).toBeTruthy();
      expect(within(soportes).getAllByText('Falta')).toHaveLength(3);
      const denuncia = within(soportes).getByText('Denuncia ante autoridad').closest('li') as HTMLElement;
      expect(within(denuncia).getByText('No aplica')).toBeTruthy();
      expect(within(denuncia).queryByLabelText(/Subir archivos/)).toBeNull();
    });

    it('sin pólizas radicables muestra el estado vacío, no un error', async () => {
      await renderizar({ opciones: of({ versionCatalogo: 'claim-catalog-v1', polizas: [] }) });

      expect(screen.getByRole('heading', { name: 'No tienes pólizas activas para radicar' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Radicar siniestro' })).toBeNull();
    });

    it('si el core de pólizas no responde ofrece reintentar', async () => {
      const { usuario } = await renderizar({
        opciones: throwError(() => new ErrorRadicacion('policy_directory_unavailable')),
      });

      expect(screen.getByRole('heading', { name: 'No pudimos consultar tus pólizas' })).toBeTruthy();
      api.consultarOpcionesRadicacion.mockReturnValue(of(OPCIONES));
      await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));

      expect(radicar()).toBeTruthy();
    });
  });

  describe('qué falta (CA-2) y la vigencia (CA-3)', () => {
    it('no deja radicar y dice exactamente qué soporte falta', async () => {
      const { usuario } = await renderizar();
      await llenarDatos(usuario);

      await adjuntarTodo(usuario, false);

      expect((radicar() as HTMLButtonElement).disabled).toBe(true);
      expect(within(aviso()).getByText('Falta 1 soporte obligatorio')).toBeTruthy();
      expect(
        within(aviso()).getByText('No es posible radicar hasta completar: Informe de tránsito o croquis.'),
      ).toBeTruthy();
      expect(screen.getByText('2 de 3 obligatorios adjuntos')).toBeTruthy();
      expect(screen.getByText('Adjunto · 4 archivos')).toBeTruthy();
    });

    it('señala los datos que faltan al salir del campo', async () => {
      const { usuario } = await renderizar();
      await elegirColision(usuario);

      await usuario.click(screen.getByLabelText('Lugar del hecho'));
      await usuario.tab();

      expect(screen.getByLabelText('Lugar del hecho').getAttribute('aria-invalid')).toBe('true');
      expect(screen.getByText('Este dato es obligatorio.')).toBeTruthy();
      expect(within(aviso()).getByText(/Lugar del hecho/)).toBeTruthy();
    });

    it('marca la fecha fuera de la vigencia en «Antes de radicar» y no deja radicar', async () => {
      const { usuario } = await renderizar();
      await llenarDatos(usuario, '2025-10-30T12:00:00Z');
      await adjuntarTodo(usuario);

      expect(screen.getByText(/La fecha del hecho está fuera de la vigencia \(del/)).toBeTruthy();
      expect((radicar() as HTMLButtonElement).disabled).toBe(true);
    });

    it('confirma la póliza y la vigencia cuando todo está bien', async () => {
      const { usuario } = await renderizar();
      await llenarDatos(usuario);

      expect(screen.getByText('La póliza está activa y cubre el tipo de siniestro seleccionado.')).toBeTruthy();
      expect(screen.getByText('Fecha del hecho dentro de la vigencia.')).toBeTruthy();
    });
  });

  describe('soportes (CA-5)', () => {
    it('rechaza sin subirlo un PDF en las fotos y conserva el formulario y los demás archivos', async () => {
      const { usuario } = await renderizar();
      await llenarDatos(usuario);
      await usuario.upload(entradaSoporte('Fotos del vehículo'), [foto('1.jpg')]);

      await usuario.upload(entradaSoporte('Fotos del vehículo'), pdf('croquis.pdf'));

      expect(api.subirSoporte).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('alert').textContent).toContain('Formato no admitido para este soporte.');
      expect((screen.getByLabelText('Lugar del hecho') as HTMLInputElement).value).toBe('Calle 80 con carrera 30, Bogotá');
      expect(screen.getByText('1.jpg')).toBeTruthy();
    });

    it('quita un archivo de la lista', async () => {
      const { usuario } = await renderizar();
      await elegirColision(usuario);
      await usuario.upload(entradaSoporte('Documento del conductor'), pdf('cedula.pdf'));

      await usuario.click(screen.getByRole('button', { name: 'Quitar cedula.pdf' }));

      expect(screen.queryByText('cedula.pdf')).toBeNull();
    });
  });

  describe('radicación (CA-4)', () => {
    it('envía la solicitud con la Idempotency-Key y muestra la confirmación con ?caso=', async () => {
      const { usuario, navegar } = await renderizar();
      await llenarDatos(usuario);
      await adjuntarTodo(usuario);

      await usuario.click(radicar());

      const [solicitud, clave] = api.radicar.mock.calls[0];
      expect(clave).toMatch(/^[0-9a-f-]{36}$/);
      expect(solicitud).toEqual({
        polizaId: 'AU-2025-118204',
        tipoSiniestro: 'collision',
        ocurridoEn: '2026-09-14T23:40:00.000Z',
        lugar: 'Calle 80 con carrera 30, Bogotá',
        descripcion: 'Un vehículo golpeó la parte trasera.',
        soportes: [
          { codigoRequisito: 'vehicle_photos', soporteIds: ['sup-1', 'sup-2', 'sup-3', 'sup-4'] },
          { codigoRequisito: 'driver_document', soporteIds: ['sup-5'] },
          { codigoRequisito: 'traffic_report', soporteIds: ['sup-6'] },
        ],
      });
      expect(screen.getByRole('heading', { level: 1, name: 'Siniestro SIN-2026-01712' })).toBeTruthy();
      expect(screen.getByText('Tu siniestro quedó radicado')).toBeTruthy();
      expect(screen.getByText('3 de 3 obligatorios · 8 archivos')).toBeTruthy();
      expect(screen.queryByRole('button', { name: /Ver el estado/ })).toBeNull();
      expect(navegar).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: { caso: CASO.id }, replaceUrl: true }));
    });

    it('al recargar con ?caso= vuelve a leer el caso y muestra la confirmación', async () => {
      await renderizar({ casoId: CASO.id });

      expect(api.consultarSiniestro).toHaveBeenCalledWith(CASO.id);
      expect(api.consultarOpcionesRadicacion).not.toHaveBeenCalled();
      expect(screen.getByRole('heading', { level: 1, name: 'Siniestro SIN-2026-01712' })).toBeTruthy();
      expect(screen.getByText(/Colisión con daños al vehículo · Autos AU-2025-118204 · KJT-482 · Radicado el/)).toBeTruthy();
    });

    it('un ?caso= que no existe ofrece radicar uno nuevo', async () => {
      const { usuario } = await renderizar({
        casoId: 'otro',
        caso: throwError(() => new ErrorSiniestro('claim_not_found')),
      });

      expect(screen.getByRole('heading', { name: 'No encontramos ese siniestro' })).toBeTruthy();
      await usuario.click(screen.getByRole('button', { name: 'Radicar un siniestro' }));

      expect(api.consultarOpcionesRadicacion).toHaveBeenCalled();
      expect(radicar()).toBeTruthy();
    });

    it('descarga el PDF del radicado y avisa si falla', async () => {
      const crear = vi.fn().mockReturnValue('blob:radicado');
      const revocar = vi.fn();
      Object.assign(URL, { createObjectURL: crear, revokeObjectURL: revocar });
      const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
      const { usuario } = await renderizar({ casoId: CASO.id });

      await usuario.click(screen.getByRole('button', { name: 'Descargar radicado' }));
      expect(api.descargarRadicado).toHaveBeenCalledWith(CASO.id);
      expect(clic).toHaveBeenCalled();
      expect(revocar).toHaveBeenCalledWith('blob:radicado');

      api.descargarRadicado.mockReturnValue(throwError(() => new ErrorSiniestro('claims_unavailable')));
      await usuario.click(screen.getByRole('button', { name: 'Descargar radicado' }));
      expect(screen.getByRole('alert').textContent).toContain('No pudimos descargar el radicado');
    });
  });

  describe('rechazos del backend', () => {
    async function radicarCon(error: ErrorRadicacion) {
      const contexto = await renderizar({ radicacion: throwError(() => error) });
      await llenarDatos(contexto.usuario);
      await adjuntarTodo(contexto.usuario);
      await contexto.usuario.click(radicar());
      return contexto;
    }

    it('marca los campos y soportes del 422 validation_failed sin perder lo diligenciado', async () => {
      await radicarCon(
        new ErrorRadicacion('validation_failed', [
          { campo: 'soportes', codigo: 'not_found', requisito: 'traffic_report' },
          { campo: 'lugar', codigo: 'out_of_range' },
        ]),
      );

      expect(within(aviso()).getByText('No se pudo radicar')).toBeTruthy();
      expect(screen.getByText('Un archivo ya no está disponible. Quítalo y súbelo de nuevo.')).toBeTruthy();
      expect(screen.getByText('Escribe entre 3 y 160 caracteres.')).toBeTruthy();
      expect((screen.getByLabelText('Lugar del hecho') as HTMLInputElement).value).toBe('Calle 80 con carrera 30, Bogotá');
    });

    it('explica el motivo de policy_not_eligible con la vigencia', async () => {
      await radicarCon(
        new ErrorRadicacion('policy_not_eligible', [], 'occurred_outside_validity', '2025-11-01T05:00:00Z', '2026-11-01T05:00:00Z'),
      );

      expect(within(aviso()).getByText('El hecho ocurrió fuera de la vigencia')).toBeTruthy();
      expect(within(aviso()).getByText(/^Vigencia de la póliza: del /)).toBeTruthy();
    });

    it('con la póliza que ya no está activa ofrece volver a cargar las pólizas', async () => {
      const { usuario } = await radicarCon(new ErrorRadicacion('policy_not_eligible', [], 'policy_not_active'));

      await usuario.click(screen.getByRole('button', { name: 'Volver a cargar mis pólizas' }));

      expect(api.consultarOpcionesRadicacion).toHaveBeenCalledTimes(2);
    });

    it('reintenta un 503 con la misma Idempotency-Key', async () => {
      const { usuario } = await radicarCon(new ErrorRadicacion('filing_unavailable'));
      expect(within(aviso()).getByText('No pudimos completar la radicación')).toBeTruthy();

      api.radicar.mockReturnValue(of(CASO));
      await usuario.click(within(aviso()).getByRole('button', { name: 'Reintentar' }));

      expect(api.radicar).toHaveBeenCalledTimes(2);
      expect(api.radicar.mock.calls[1][1]).toBe(api.radicar.mock.calls[0][1]);
      expect(screen.getByText('Tu siniestro quedó radicado')).toBeTruthy();
    });

    it('ante idempotency_key_reused radica como un caso nuevo con otra clave', async () => {
      const { usuario } = await radicarCon(new ErrorRadicacion('idempotency_key_reused'));
      expect(within(aviso()).getByText('Esta solicitud ya se usó para otro siniestro')).toBeTruthy();

      api.radicar.mockReturnValue(of(CASO));
      await usuario.click(screen.getByRole('button', { name: 'Radicar como un caso nuevo' }));

      expect(api.radicar.mock.calls[1][1]).not.toBe(api.radicar.mock.calls[0][1]);
    });
  });
});
