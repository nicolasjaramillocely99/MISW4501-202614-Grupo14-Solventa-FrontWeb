import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Navigation, Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import {
  SOLICITUD_BENEFICIARIOS_DTO,
  SOLICITUD_CONTACTO_APLICADA_DTO,
  SOLICITUD_NO_APLICADA_DEVUELTA_DTO,
  SOLICITUD_NO_APLICADA_DTO,
  SOLICITUD_RECHAZADA_DTO,
  SOLICITUD_SUMA_EN_REVISION_DTO,
} from '@testing/solicitud-modificacion-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { Observable, of, throwError } from 'rxjs';

import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';
import {
  BeneficiarioDto,
  CodigoErrorSolicitud,
  ErrorSolicitudModificacion,
  SolicitudModificacion,
  SolicitudModificacionDto,
  mapearSolicitudModificacion,
} from '@core/api/originacion/solicitud-modificacion.modelos';

import { EstadoSolicitudComponent } from './componentes/estado-solicitud/estado-solicitud.component';
import { SolicitudModificacionPage } from './solicitud-modificacion.page';

describe('SolicitudModificacionPage (A3b · HU-W1.4-01 · CA-2)', () => {
  const api = { consultarSolicitudModificacion: vi.fn<(id: string) => Observable<SolicitudModificacion>>() };

  async function renderizar(dto: SolicitudModificacionDto | CodigoErrorSolicitud, recienRadicada = false) {
    api.consultarSolicitudModificacion.mockReturnValue(
      typeof dto === 'string' ? throwError(() => new ErrorSolicitudModificacion(dto)) : of(mapearSolicitudModificacion(dto)),
    );
    return render(SolicitudModificacionPage, {
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter([]),
        { provide: OriginacionApiService, useValue: api },
        { provide: ActivatedRoute, useValue: { snapshot: { params: { id: 'SOL-MOD-2026-0042' } } } },
      ],
      configureTestBed: () => {
        if (recienRadicada) {
          const navegacion = { extras: { state: { recienRadicada: true } } } as unknown as Navigation;
          vi.spyOn(TestBed.inject(Router), 'currentNavigation').mockReturnValue(navegacion);
        }
      },
    });
  }

  beforeEach(() => vi.resetAllMocks());

  it('al venir de radicar confirma con el identificador, los pasos y quién la radicó', async () => {
    await renderizar(SOLICITUD_BENEFICIARIOS_DTO, true);

    expect(api.consultarSolicitudModificacion).toHaveBeenCalledWith('SOL-MOD-2026-0042');
    expect(screen.getByRole('heading', { name: 'Solicitud SOL-MOD-2026-0042' })).toBeTruthy();
    expect(screen.getByText('Tu solicitud quedó radicada')).toBeTruthy();
    expect(screen.getByText(/Te avisaremos por correo/)).toBeTruthy();
    expect(screen.getAllByText('Radicada').length).toBeGreaterThan(0);
    expect(screen.getByText(/Cambio de beneficiarios · Vida hipotecario pol-acc-4f2a/)).toBeTruthy();
    expect(screen.getByText('Hasta 2 días hábiles')).toBeTruthy();
    expect(screen.getByText('carolina@example.com · portal web')).toBeTruthy();
    expect(screen.getByText('Mientras tanto')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Volver a mis pólizas' }).getAttribute('href')).toBe('/originacion/polizas');
  });

  it('al recargar muestra el estado sin la confirmación', async () => {
    await renderizar(SOLICITUD_BENEFICIARIOS_DTO);

    expect(screen.queryByText('Tu solicitud quedó radicada')).toBeNull();
    expect(screen.getByText('Tu solicitud está radicada')).toBeTruthy();
  });

  it('en revisión, con el nombre de quien la radicó', async () => {
    await renderizar(SOLICITUD_SUMA_EN_REVISION_DTO);

    expect(screen.getByText('Tu solicitud está en revisión')).toBeTruthy();
    expect(screen.getByText('Carolina Pérez · portal web')).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Avance de la solicitud' }).querySelector('[aria-current="step"]')?.textContent).toContain('En revisión');
  });

  it('aplicada, con la fecha en que se aplicó', async () => {
    await renderizar(SOLICITUD_CONTACTO_APLICADA_DTO);

    expect(screen.getByText('Tu solicitud fue aplicada')).toBeTruthy();
    expect(screen.getByText('Aplicada el')).toBeTruthy();
    expect(screen.getByText('Tu póliza ya tiene las condiciones nuevas')).toBeTruthy();
  });

  const mateo60: BeneficiarioDto = { full_name: 'Mateo Pérez Gómez', relationship: 'child', document_type: 'TI', document_number: '1140223001', share_percent: 60 };
  const lucia40: BeneficiarioDto = { full_name: 'Lucía Pérez Gómez', relationship: 'child', document_type: 'TI', document_number: '1142998310', share_percent: 40 };
  const mateo100: BeneficiarioDto = { ...mateo60, share_percent: 100 };
  it.each<{ caso: string; dto: SolicitudModificacionDto; condiciones: string }>([
    {
      caso: 'beneficiarios, con uno retirado',
      dto: {
        ...SOLICITUD_BENEFICIARIOS_DTO,
        status: 'applied',
        previous: { ...SOLICITUD_BENEFICIARIOS_DTO.previous, beneficiaries: [mateo60, lucia40] },
        requested: { beneficiaries: [mateo100] },
        changes: [
          { field: 'beneficiaries', previous: mateo60, requested: mateo100 },
          { field: 'beneficiaries', previous: lucia40, requested: null },
        ],
      },
      condiciones: 'Beneficiarios: Mateo Pérez Gómez 100 % · Lucía Pérez Gómez (retirado).',
    },
    {
      caso: 'valor asegurado',
      dto: { ...SOLICITUD_SUMA_EN_REVISION_DTO, status: 'applied' },
      condiciones: 'Valor asegurado: $ 80.000.000 COP.',
    },
  ])('aplicada, el aviso enumera las condiciones nuevas: $caso', async ({ dto, condiciones }) => {
    await renderizar(dto);

    expect(screen.getByText('Tu póliza ya tiene las condiciones nuevas')).toBeTruthy();
    expect(screen.getByText(condiciones)).toBeTruthy();
  });

  it('rechazada con el motivo y «Radicar una nueva»', async () => {
    await renderizar(SOLICITUD_RECHAZADA_DTO);

    expect(screen.getByText('Tu solicitud fue rechazada')).toBeTruthy();
    expect(screen.getByText('Motivo')).toBeTruthy();
    expect(screen.getByText('Falta el avalúo del inmueble')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Radicar una nueva' }).getAttribute('href')).toBe('/originacion/polizas/pol-acc-4f2a/modificar');
  });

  it('no aplicada: devuelta con motivo se ve rechazada; sin motivo, en revisión (ajuste A-1)', async () => {
    await renderizar(SOLICITUD_NO_APLICADA_DEVUELTA_DTO);
    expect(screen.getByText('Tu solicitud fue rechazada')).toBeTruthy();
    expect(screen.getByText('El documento de un beneficiario no es válido')).toBeTruthy();
  });

  it('no aplicada sin motivo se ve en revisión', async () => {
    await renderizar(SOLICITUD_NO_APLICADA_DTO);
    expect(screen.getByText('Tu solicitud está en revisión')).toBeTruthy();
    expect(screen.queryByText('Motivo')).toBeNull();
  });

  it('404 dice que no existe; 403 lo resuelve el interceptor', async () => {
    await renderizar('change_request_not_found');
    expect(screen.getByText('No encontramos esta solicitud')).toBeTruthy();
  });

  it('403 no muestra aviso propio', async () => {
    await renderizar('forbidden');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('una falla del servicio permite reintentar', async () => {
    await renderizar('change_request_unavailable');
    expect(screen.getByText('No pudimos cargar la solicitud')).toBeTruthy();

    api.consultarSolicitudModificacion.mockReturnValue(of(mapearSolicitudModificacion(SOLICITUD_BENEFICIARIOS_DTO)));
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(screen.getByRole('heading', { name: 'Solicitud SOL-MOD-2026-0042' })).toBeTruthy();
  });
});

describe('EstadoSolicitudComponent (HU-W1.4-01)', () => {
  it('nombra el estado con su texto', async () => {
    const { fixture } = await render(EstadoSolicitudComponent, { imports: [proveerTranslocoPruebas()], inputs: { estado: 'rechazada' } });
    expect(fixture.nativeElement.textContent).toContain('Rechazada');
    expect(fixture.nativeElement.querySelector('app-insignia-estado').className).toContain('insignia--error');

    fixture.componentRef.setInput('estado', 'desconocido');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Sin estado conocido');
  });
});
