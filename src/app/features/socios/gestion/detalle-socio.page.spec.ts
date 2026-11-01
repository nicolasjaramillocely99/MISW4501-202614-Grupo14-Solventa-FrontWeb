import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { pulsarEscapeEnDialogo, simularDialogoNativo } from '@testing/dialogo-pruebas';
import {
  APROBACION_DTO,
  ROTACION_DTO,
  SECRETO,
  SOCIO_ACTIVO_DTO,
  SOCIO_CON_REVOCACION_DTO,
  SOCIO_ID,
  SOCIO_PENDIENTE_DTO,
  SOCIO_ROTANDO_DTO,
} from '@testing/socios-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { Observable, of, throwError } from 'rxjs';

import { SociosApiService } from '@core/api/socios/socios-api.service';
import {
  CodigoErrorSocios,
  CredencialesEmitidas,
  DetalleSocio,
  DetalleSocioDto,
  ErrorSocios,
  mapearCredencialesEmitidas,
  mapearDetalleSocio,
} from '@core/api/socios/socios.modelos';

import { DetalleSocioPage } from './detalle-socio.page';

const falla = (codigo: CodigoErrorSocios) => throwError(() => new ErrorSocios(codigo));

describe('DetalleSocioPage (O11 · HU-W3.1-01)', () => {
  let obtener: ReturnType<typeof vi.fn<(id: string) => Observable<DetalleSocio>>>;
  let aprobar: ReturnType<typeof vi.fn<(id: string) => Observable<CredencialesEmitidas>>>;
  let rotar: ReturnType<typeof vi.fn<(id: string, horas: number | null) => Observable<CredencialesEmitidas>>>;

  beforeAll(() => simularDialogoNativo());

  async function renderizar(
    lecturas: Observable<DetalleSocio>[],
    opciones: { aprobacion?: Observable<CredencialesEmitidas>; rotacion?: Observable<CredencialesEmitidas> } = {},
  ) {
    obtener = vi.fn();
    for (const lectura of lecturas) {
      obtener.mockReturnValueOnce(lectura);
    }
    aprobar = vi.fn().mockReturnValue(opciones.aprobacion ?? of(mapearCredencialesEmitidas(APROBACION_DTO)));
    rotar = vi.fn().mockReturnValue(opciones.rotacion ?? of(mapearCredencialesEmitidas(ROTACION_DTO)));
    return render(DetalleSocioPage, {
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter([]),
        { provide: SociosApiService, useValue: { obtener, aprobar, rotar } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: SOCIO_ID }) } } },
      ],
    });
  }

  const detalle = (dto: DetalleSocioDto) => of(mapearDetalleSocio(dto));
  const secretoVisible = () => document.querySelector('[data-testid="secreto-valor"]')?.textContent ?? null;

  it('muestra credenciales sin el secreto, cuota del día, aislamiento e historial', async () => {
    await renderizar([detalle(SOCIO_ACTIVO_DTO)]);

    expect(await screen.findByRole('heading', { name: 'Banco Aliado', level: 1 })).toBeTruthy();
    expect(obtener).toHaveBeenCalledWith(SOCIO_ID);
    const credenciales = screen.getByRole('region', { name: 'Credenciales de acceso' });
    expect(within(credenciales).getByText('sol_7f3a91c2e8d4b06f5a1c91e2')).toBeTruthy();
    expect(within(credenciales).getByText(/termina en a1c9/)).toBeTruthy();
    expect(within(credenciales).getByText('API key · cabecera x-api-key')).toBeTruthy();
    expect(within(credenciales).getByText('Sin rotaciones')).toBeTruthy();
    expect(within(credenciales).getByText(/tras el periodo de transición de 24 horas/)).toBeTruthy();
    expect(screen.getByText(/Consumo de hoy · 3\.120 de 5\.000 solicitudes \(62 %\)/)).toBeTruthy();
    expect(screen.getByText('5.000 solicitudes por día')).toBeTruthy();
    expect(screen.getByText('HTTP 429 al socio · sin afectar a los demás')).toBeTruthy();
    const historial = screen.getByRole('region', { name: 'Historial de credenciales' });
    expect(within(historial).getByText('Credenciales generadas')).toBeTruthy();
    expect(within(historial).getAllByText('Aplicado')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /Dar de baja/ })).toBeNull();
    expect(document.body.textContent).not.toContain(SECRETO);
  });

  it('durante una transición muestra la credencial anterior y la rotación «en transición»', async () => {
    await renderizar([detalle(SOCIO_ROTANDO_DTO)]);

    expect(await screen.findByText(/La credencial anterior \(sol_7f3a91c2e8d4b06f5a1c91e2\) sigue vigente/)).toBeTruthy();
    expect(screen.getByText('En transición')).toBeTruthy();
    expect(screen.getByText(/Nuevo par sol_0b6f1c2a3d4e5f60718293a4 · transición de 24 h/)).toBeTruthy();
  });

  it('la revocación del proceso aparece hecha por «Sistema»', async () => {
    await renderizar([detalle(SOCIO_CON_REVOCACION_DTO)]);

    const historial = await screen.findByRole('region', { name: 'Historial de credenciales' });
    expect(within(historial).getByText('Sistema')).toBeTruthy();
    expect(within(historial).getByText('Credencial anterior revocada')).toBeTruthy();
  });

  it('un socio inexistente muestra «no encontrado» y un error del servicio permite reintentar', async () => {
    await renderizar([falla('partner_not_found')]);
    expect(await screen.findByText('No encontramos este socio')).toBeTruthy();
  });

  it('reintenta tras un error del servicio', async () => {
    await renderizar([falla('service_unavailable'), detalle(SOCIO_ACTIVO_DTO)]);

    await userEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('heading', { name: 'Banco Aliado', level: 1 })).toBeTruthy();
  });

  describe('aprobación (CA-1, CA-4)', () => {
    it('aprueba, muestra el secreto una sola vez y lo olvida al confirmar', async () => {
      await renderizar([detalle(SOCIO_PENDIENTE_DTO)]);
      expect(await screen.findByText(/pendiente de aprobación. Al aprobarlo/)).toBeTruthy();

      await userEvent.click(screen.getByRole('button', { name: 'Aprobar y generar credenciales' }));

      expect(aprobar).toHaveBeenCalledWith(SOCIO_ID);
      const dialogo = screen.getByRole('dialog', { name: 'Credenciales generadas' });
      expect(secretoVisible()).toBe(SECRETO);
      expect(within(dialogo).getByText('Este secreto solo se muestra ahora')).toBeTruthy();
      // Escape no cierra: solo la confirmación explícita.
      pulsarEscapeEnDialogo(dialogo as HTMLDialogElement);
      expect(secretoVisible()).toBe(SECRETO);

      await userEvent.click(within(dialogo).getByRole('button', { name: 'Ya guardé el secreto' }));

      expect(secretoVisible()).toBeNull();
      expect(document.body.textContent).not.toContain(SECRETO);
      expect(screen.getByRole('button', { name: 'Rotar credenciales' })).toBeTruthy();
      expect(screen.getByText('sol_fintech0000000000000001')).toBeTruthy();
    });

    it('un socio ya aprobado avisa que el secreto no se vuelve a mostrar', async () => {
      await renderizar([detalle(SOCIO_PENDIENTE_DTO)], { aprobacion: falla('partner_not_pending') });

      await userEvent.click(await screen.findByRole('button', { name: 'Aprobar y generar credenciales' }));

      expect(await screen.findByText(/su secreto no se vuelve a mostrar/)).toBeTruthy();
      expect(secretoVisible()).toBeNull();
    });
  });

  describe('rotación (CA-5)', () => {
    it('rota con el periodo de transición elegido y muestra el nuevo secreto', async () => {
      await renderizar([detalle(SOCIO_ACTIVO_DTO)]);
      await userEvent.click(await screen.findByRole('button', { name: 'Rotar credenciales' }));
      const dialogo = screen.getByRole('dialog', { name: 'Rotar credenciales' });
      const horas = within(dialogo).getByLabelText('Periodo de transición (horas)') as HTMLInputElement;
      expect(horas.value).toBe('24');

      await userEvent.clear(horas);
      await userEvent.type(horas, '48');
      await userEvent.click(within(dialogo).getByRole('button', { name: 'Rotar credenciales' }));

      expect(rotar).toHaveBeenCalledWith(SOCIO_ID, 48);
      expect(secretoVisible()).toBe(SECRETO);
      expect(screen.getByText('En transición')).toBeTruthy();
    });

    it('no envía un periodo fuera de rango', async () => {
      await renderizar([detalle(SOCIO_ACTIVO_DTO)]);
      await userEvent.click(await screen.findByRole('button', { name: 'Rotar credenciales' }));
      const dialogo = screen.getByRole('dialog', { name: 'Rotar credenciales' });
      const horas = within(dialogo).getByLabelText('Periodo de transición (horas)');

      await userEvent.clear(horas);
      await userEvent.click(within(dialogo).getByRole('button', { name: 'Rotar credenciales' }));
      expect(within(dialogo).getByText('Escriba el periodo de transición.')).toBeTruthy();
      await userEvent.type(horas, '500');
      await userEvent.click(within(dialogo).getByRole('button', { name: 'Rotar credenciales' }));

      expect(within(dialogo).getByText(/entre 1 y 168 horas/)).toBeTruthy();
      expect(rotar).not.toHaveBeenCalled();
      await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
      expect(screen.queryByRole('dialog', { name: 'Rotar credenciales' })).toBeNull();
    });

    it('una rotación en curso o un gateway caído se avisan dentro del modal', async () => {
      await renderizar([detalle(SOCIO_ACTIVO_DTO)], { rotacion: falla('rotation_in_progress') });
      await userEvent.click(await screen.findByRole('button', { name: 'Rotar credenciales' }));
      const dialogo = screen.getByRole('dialog', { name: 'Rotar credenciales' });

      await userEvent.click(within(dialogo).getByRole('button', { name: 'Rotar credenciales' }));
      expect(await within(dialogo).findByText(/Ya hay una credencial anterior en periodo de transición/)).toBeTruthy();

      rotar.mockReturnValue(falla('gateway_unavailable'));
      await userEvent.click(within(dialogo).getByRole('button', { name: 'Rotar credenciales' }));
      expect(await within(dialogo).findByText(/No se cambió nada/)).toBeTruthy();

      rotar.mockReturnValue(falla('service_unavailable'));
      await userEvent.click(within(dialogo).getByRole('button', { name: 'Rotar credenciales' }));
      expect(await within(dialogo).findByText('No fue posible completar la operación. Intente de nuevo.')).toBeTruthy();
      expect(secretoVisible()).toBeNull();
    });
  });
});
