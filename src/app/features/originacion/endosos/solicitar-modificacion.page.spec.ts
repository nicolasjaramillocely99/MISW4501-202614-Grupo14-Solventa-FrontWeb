import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import {
  CONDICIONES_CON_ABIERTA_DTO,
  CONDICIONES_NO_VIGENTE_DTO,
  CONDICIONES_VIGENTES_DTO,
  SOLICITUD_BENEFICIARIOS_DTO,
} from '@testing/solicitud-modificacion-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { Observable, of, throwError } from 'rxjs';

import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';
import {
  CodigoErrorSolicitud,
  CondicionesVigentes,
  ErrorDeCampoSolicitud,
  ErrorSolicitudModificacion,
  SolicitudModificacion,
  SolicitudNueva,
  mapearCondicionesVigentes,
  mapearSolicitudModificacion,
} from '@core/api/originacion/solicitud-modificacion.modelos';

import { SolicitarModificacionPage } from './solicitar-modificacion.page';

const VIGENTES = mapearCondicionesVigentes(CONDICIONES_VIGENTES_DTO);
const RADICADA = mapearSolicitudModificacion(SOLICITUD_BENEFICIARIOS_DTO);
const falla = (codigo: CodigoErrorSolicitud, campos: ErrorDeCampoSolicitud[] = [], abierta: string | null = null) =>
  throwError(() => new ErrorSolicitudModificacion(codigo, campos, abierta));

describe('SolicitarModificacionPage (A3 · HU-W1.4-01)', () => {
  const api = {
    consultarCondicionesVigentes: vi.fn<(id: string) => Observable<CondicionesVigentes>>(),
    radicarSolicitudModificacion: vi.fn<(id: string, s: SolicitudNueva) => Observable<SolicitudModificacion>>(),
  };

  async function renderizar() {
    const vista = await render(SolicitarModificacionPage, {
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter([]),
        { provide: OriginacionApiService, useValue: api },
        { provide: ActivatedRoute, useValue: { snapshot: { params: { id: 'pol-acc-4f2a' } } } },
      ],
    });
    const router = vista.fixture.debugElement.injector.get(Router);
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    return { ...vista, navegar };
  }

  const radicar = () => screen.getByRole('button', { name: /Radicar solicitud/ }) as HTMLButtonElement;

  async function escribirBeneficiario(nombre: string, documento: string, participacion: string): Promise<void> {
    await userEvent.type(screen.getByLabelText('Nombre completo'), nombre);
    await userEvent.selectOptions(screen.getByLabelText('Parentesco'), 'child');
    await userEvent.selectOptions(screen.getByLabelText('Tipo de documento'), 'TI');
    await userEvent.type(screen.getByLabelText('Número de documento'), documento);
    await userEvent.type(screen.getByLabelText('Participación (%)'), participacion);
  }

  beforeEach(() => {
    vi.resetAllMocks();
    api.consultarCondicionesVigentes.mockReturnValue(of(VIGENTES));
    api.radicarSolicitudModificacion.mockReturnValue(of(RADICADA));
  });

  it('muestra la póliza, los tres tipos, el oneroso y radica beneficiarios (CA-1, CA-2)', async () => {
    const { navegar } = await renderizar();

    expect(api.consultarCondicionesVigentes).toHaveBeenCalledWith('pol-acc-4f2a');
    expect(screen.getByRole('heading', { name: 'Solicitar una modificación' })).toBeTruthy();
    expect(screen.getByText(/Vida hipotecario · pol-acc-4f2a/)).toBeTruthy();
    expect((screen.getByRole('radio', { name: /Beneficiarios/ }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText('Banco Aliado')).toBeTruthy();
    expect(radicar().disabled).toBe(true);

    await escribirBeneficiario('Mateo Pérez Gómez', '1.140.223.001', '60');
    expect(screen.getByRole('alert').textContent).toContain('(actual: 60 %)');
    expect(radicar().disabled).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: /Agregar beneficiario/ }));
    await escribirBeneficiario('Lucía Pérez Gómez', '1142998310', '40');

    expect(screen.getByText('Mateo Pérez Gómez · 60 % · Lucía Pérez Gómez · 40 %')).toBeTruthy();
    expect(radicar().disabled).toBe(false);
    await userEvent.click(radicar());

    expect(api.radicarSolicitudModificacion).toHaveBeenCalledWith('pol-acc-4f2a', {
      tipo: 'beneficiaries',
      beneficiarios: [
        { nombreCompleto: 'Mateo Pérez Gómez', parentesco: 'child', tipoDocumento: 'TI', numeroDocumento: '1140223001', participacion: 60 },
        { nombreCompleto: 'Lucía Pérez Gómez', parentesco: 'child', tipoDocumento: 'TI', numeroDocumento: '1142998310', participacion: 40 },
      ],
    });
    expect(navegar).toHaveBeenCalledWith(['/originacion/solicitudes', 'SOL-MOD-2026-0042'], { state: { recienRadicada: true } });
  });

  it('radica la suma asegurada como un entero', async () => {
    await renderizar();

    await userEvent.click(screen.getByRole('radio', { name: /Sumas aseguradas/ }));
    await userEvent.type(screen.getByLabelText('Nuevo valor asegurado (COP)'), '300.000.000');
    await userEvent.click(radicar());
    expect(api.radicarSolicitudModificacion).toHaveBeenLastCalledWith('pol-acc-4f2a', { tipo: 'insured_amount', valorAsegurado: 300000000 });
    expect(screen.getByRole('button', { name: /Radicando/ })).toBeTruthy();
  });

  it('radica los datos personales con solo lo que cambia', async () => {
    await renderizar();

    await userEvent.click(screen.getByRole('radio', { name: /Datos personales/ }));
    await userEvent.type(screen.getByLabelText('Teléfono'), '+57 301 234 5678');
    await userEvent.click(radicar());
    expect(api.radicarSolicitudModificacion).toHaveBeenLastCalledWith('pol-acc-4f2a', {
      tipo: 'personal_data',
      contacto: { direccion: '', correo: '', telefono: '3012345678' },
    });
  });

  it('no deja radicar con errores y pinta el 422 del servicio en su campo (CA-3)', async () => {
    api.radicarSolicitudModificacion.mockReturnValue(falla('validation_failed', [{ campo: 'insured_amount', codigo: 'out_of_range' }]));
    await renderizar();

    await userEvent.click(screen.getByRole('radio', { name: /Sumas aseguradas/ }));
    await userEvent.type(screen.getByLabelText('Nuevo valor asegurado (COP)'), '68.000.000');
    await userEvent.tab();
    expect(screen.getByText('Es igual al valor asegurado actual.')).toBeTruthy();
    expect(radicar().disabled).toBe(true);

    await userEvent.clear(screen.getByLabelText('Nuevo valor asegurado (COP)'));
    await userEvent.type(screen.getByLabelText('Nuevo valor asegurado (COP)'), '90.000.000');
    await userEvent.click(radicar());

    expect(screen.getByRole('alert').textContent).toMatch(/Debe estar entre/);
    expect(screen.getByLabelText('Nuevo valor asegurado (COP)').getAttribute('aria-invalid')).toBe('true');
  });

  it('un 409 de una abierta bloquea el tipo con su enlace (D-6)', async () => {
    api.radicarSolicitudModificacion.mockReturnValue(falla('change_request_open', [], 'SOL-MOD-2026-0041'));
    await renderizar();

    await userEvent.click(screen.getByRole('radio', { name: /Sumas aseguradas/ }));
    await userEvent.type(screen.getByLabelText('Nuevo valor asegurado (COP)'), '90000000');
    await userEvent.click(radicar());

    expect(screen.getAllByText(/Ya tienes la solicitud SOL-MOD-2026-0041 en curso/).length).toBeGreaterThan(0);
    expect((screen.getByRole('radio', { name: /Sumas aseguradas/ }) as HTMLInputElement).disabled).toBe(true);
    expect(radicar().disabled).toBe(true);
  });

  it('el tipo con una solicitud abierta llega bloqueado y se elige el siguiente', async () => {
    api.consultarCondicionesVigentes.mockReturnValue(of(mapearCondicionesVigentes(CONDICIONES_CON_ABIERTA_DTO)));
    await renderizar();

    expect((screen.getByRole('radio', { name: /Beneficiarios/ }) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('radio', { name: /Sumas aseguradas/ }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole('link', { name: 'Ver solicitud' }).getAttribute('href')).toBe('/originacion/solicitudes/SOL-MOD-2026-0042');
  });

  it('una póliza no vigente no deja radicar, también si vence al radicar', async () => {
    api.consultarCondicionesVigentes.mockReturnValue(of(mapearCondicionesVigentes(CONDICIONES_NO_VIGENTE_DTO)));
    await renderizar();

    expect(screen.getByRole('alert').textContent).toContain('Esta póliza no está vigente');
    expect(screen.queryByRole('group', { name: 'Tipo de cambio' })).toBeNull();
    expect(radicar().disabled).toBe(true);
  });

  it('un 409 de póliza no vigente al radicar cambia a ese estado', async () => {
    api.radicarSolicitudModificacion.mockReturnValue(falla('policy_not_in_force'));
    await renderizar();

    await userEvent.click(screen.getByRole('radio', { name: /Sumas aseguradas/ }));
    await userEvent.type(screen.getByLabelText('Nuevo valor asegurado (COP)'), '90000000');
    await userEvent.click(radicar());

    expect(screen.getByRole('alert').textContent).toContain('Esta póliza no está vigente');
  });

  it('la falla del servicio al radicar lo dice; el 403 lo resuelve el interceptor', async () => {
    api.radicarSolicitudModificacion.mockReturnValueOnce(falla('change_request_unavailable')).mockReturnValueOnce(falla('forbidden'));
    await renderizar();
    await userEvent.click(screen.getByRole('radio', { name: /Sumas aseguradas/ }));
    await userEvent.type(screen.getByLabelText('Nuevo valor asegurado (COP)'), '90000000');

    await userEvent.click(radicar());
    expect(screen.getByRole('alert').textContent).toContain('No pudimos radicar tu solicitud');

    await userEvent.click(radicar());
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('una póliza ajena al origen no se encuentra y una falla al cargar permite reintentar', async () => {
    api.consultarCondicionesVigentes.mockReturnValueOnce(falla('policy_not_found'));
    const { fixture } = await renderizar();
    expect(screen.getByText('No encontramos esta póliza')).toBeTruthy();

    api.consultarCondicionesVigentes.mockReturnValueOnce(falla('change_request_unavailable')).mockReturnValueOnce(of(VIGENTES));
    (fixture.componentInstance as unknown as { cargar: () => void }).cargar();
    fixture.detectChanges();
    expect(screen.getByText('No pudimos cargar tu póliza')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(screen.getByRole('group', { name: 'Tipo de cambio' })).toBeTruthy();
  });
});
