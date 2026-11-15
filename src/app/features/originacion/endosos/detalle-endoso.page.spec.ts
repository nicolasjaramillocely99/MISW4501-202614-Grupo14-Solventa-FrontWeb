import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import {
  APLICACION_APLICADA_DTO,
  APLICACION_NO_APLICADA_DTO,
  DETALLE_APLICADO_DTO,
  DETALLE_BENEFICIARIOS_DTO,
  DETALLE_DATOS_DTO,
  DETALLE_DEVUELTO_DTO,
  DETALLE_NO_APLICADO_DTO,
  DETALLE_RECHAZADO_DTO,
  DETALLE_SUMA_DTO,
} from '@testing/endosos-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { Observable, of, throwError } from 'rxjs';

import {
  DetalleEndoso,
  DetalleEndosoDto,
  ErrorEndoso,
  ResultadoAplicacion,
  SolicitudEndoso,
  mapearDetalleEndoso,
  mapearResultadoAplicacion,
} from '@core/api/originacion/endosos.modelos';
import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';

import { DetalleEndosoPage } from './detalle-endoso.page';

@Component({ selector: 'app-pagina-falsa', template: '' })
class PaginaFalsa {}

const detalle = (dto: DetalleEndosoDto) => of(mapearDetalleEndoso(dto));

describe('DetalleEndosoPage (O3 · O3b · HU-W1.4-02)', () => {
  let consultar: ReturnType<typeof vi.fn<(id: string) => Observable<DetalleEndoso>>>;
  let aplicar: ReturnType<typeof vi.fn<(id: string) => Observable<ResultadoAplicacion>>>;
  let rechazar: ReturnType<typeof vi.fn<(id: string, observaciones: string) => Observable<SolicitudEndoso>>>;
  let devolver: ReturnType<typeof vi.fn<(id: string, observaciones: string) => Observable<SolicitudEndoso>>>;
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    consultar = vi.fn<(id: string) => Observable<DetalleEndoso>>().mockReturnValue(detalle(DETALLE_BENEFICIARIOS_DTO));
    aplicar = vi.fn<(id: string) => Observable<ResultadoAplicacion>>();
    rechazar = vi.fn<(id: string, observaciones: string) => Observable<SolicitudEndoso>>();
    devolver = vi.fn<(id: string, observaciones: string) => Observable<SolicitudEndoso>>();
    TestBed.configureTestingModule({
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter([
          { path: 'originacion/endosos', component: PaginaFalsa },
          { path: 'originacion/endosos/:id', component: DetalleEndosoPage },
          { path: 'originacion/polizas/:id/endosos', component: PaginaFalsa },
        ]),
        {
          provide: OriginacionApiService,
          useValue: {
            consultarSolicitudEndoso: consultar,
            aplicarEndoso: aplicar,
            rechazarSolicitudEndoso: rechazar,
            devolverSolicitudEndoso: devolver,
          },
        },
      ],
    });
    harness = await RouterTestingHarness.create();
  });

  const abrir = (id = 'SOL-MOD-2026-0042') => harness.navigateByUrl(`/originacion/endosos/${id}`);
  const filasCambio = () =>
    within(screen.getByRole('table'))
      .getAllByRole('row')
      .slice(1)
      .map((fila) => Array.from(fila.querySelectorAll('th, td'), (celda) => celda.textContent?.trim()).join(' | '));
  const insignia = () => harness.routeNativeElement?.querySelector('.encabezado app-insignia-estado')?.textContent?.trim();
  const validacion = (titulo: string) => screen.getByText(titulo).closest('li') as HTMLElement;
  const estable = () => harness.fixture.whenStable();

  it('beneficiarios en revisión: cambio, validaciones, panel de la póliza y acciones (CA-1)', async () => {
    await abrir();

    expect(consultar).toHaveBeenCalledWith('SOL-MOD-2026-0042');
    expect(screen.getByRole('heading', { level: 1, name: 'Endoso · SOL-MOD-2026-0042' })).toBeTruthy();
    expect(insignia()).toBe('En revisión');
    expect(screen.getByText(/Cambio de beneficiarios · Vida hipotecario pol-acc-4f2a · Carolina Pérez Ruiz · radicada el .* desde el portal/)).toBeTruthy();
    expect(filasCambio()).toEqual([
      'Beneficiario 1 | Mateo Pérez Gómez · TI 1.140.223.001 · 100 % | Mateo Pérez Gómez · TI 1.140.223.001 · 60 %',
      'Beneficiario 2 | — | Lucía Pérez Gómez · TI 1.142.998.310 · 40 %',
      'Beneficiario oneroso | Banco Aliado · saldo insoluto | Sin cambio',
    ]);
    expect(screen.getAllByText('Cumple')).toHaveLength(5);
    expect(validacion('Suma de participaciones igual a 100 %').textContent).toContain('60 % + 40 %');
    expect(validacion('Documentos de identidad válidos').textContent).toContain('Registraduría · 2 verificaciones');
    expect(validacion('Solicitante = tomador autenticado').textContent).toContain('Carolina Pérez Ruiz · portal web');

    const poliza = screen.getByRole('heading', { name: 'Póliza' }).closest('section') as HTMLElement;
    expect(poliza.textContent).toContain('Activa');
    expect(poliza.textContent).toMatch(/250\.000\.000 COP/);
    expect(poliza.textContent).toMatch(/68\.500 COP/);
    const historial = within(poliza).getByRole('link', { name: /1 · último: datos personales \(16\/09\/2026\)/ });
    expect(historial.getAttribute('href')).toBe('/originacion/polizas/pol-acc-4f2a/endosos');
    expect(screen.getByRole('heading', { name: 'Al aplicar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rechazar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Aplicar endoso' })).toBeTruthy();
    expect(screen.getByLabelText('Observaciones (obligatorias al rechazar)')).toBeTruthy();
  });

  it('suma asegurada: el valor y la prima que recalcula el motor', async () => {
    consultar.mockReturnValue(detalle(DETALLE_SUMA_DTO));
    await abrir('SOL-MOD-2026-0045');

    const [valor, prima] = filasCambio();
    expect(valor).toMatch(/^Valor asegurado \| \$\s250\.000\.000 COP \| \$\s300\.000\.000 COP$/);
    expect(prima).toMatch(/^Prima mensual \| \$\s68\.500 COP \| \$\s82\.200 COP · recalculada con el motor v1$/);
    expect(validacion('Suma asegurada dentro de los límites del producto').textContent).toMatch(
      /\$\s300\.000\.000 · entre \$\s10\.000\.000 y \$\s2\.000\.000\.000/,
    );
    expect(screen.getByText(/La diferencia de prima no se cobra/)).toBeTruthy();
  });

  it('datos personales: cada dato con su formato y el canal de la app', async () => {
    consultar.mockReturnValue(detalle(DETALLE_DATOS_DTO));
    await abrir('SOL-MOD-2026-0046');

    expect(filasCambio()).toEqual(['Dirección | No registrada | Calle 100 # 15-20, Bogotá', 'Teléfono | No registrado | 301 234 5678']);
    expect(validacion('Solicitante = tomador autenticado').textContent).toContain('Carolina Pérez Ruiz · app móvil');
    expect(screen.getByText(/El correo con el que inicia sesión no cambia/)).toBeTruthy();
  });

  it('«Aplicar endoso» con todo en «Cumple» deja la solicitud aplicada con su número (CA-2, CA-3)', async () => {
    aplicar.mockReturnValue(of(mapearResultadoAplicacion(APLICACION_APLICADA_DTO)));
    await abrir();
    consultar.mockReturnValue(detalle(DETALLE_APLICADO_DTO));

    await userEvent.click(screen.getByRole('button', { name: 'Aplicar endoso' }));
    await estable();

    expect(aplicar).toHaveBeenCalledWith('SOL-MOD-2026-0042');
    expect(screen.getByRole('status').textContent).toContain('END-2026-0102 quedó registrado y el asegurado ya ve los cambios.');
    expect(insignia()).toBe('Aplicada');
    expect(screen.getByRole('link', { name: 'Ver historial' }).getAttribute('href')).toBe('/originacion/polizas/pol-acc-4f2a/endosos');
    expect(screen.getByText(/END-2026-0102 · aplicado por Andrés Ruiz \(operaciones\)/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Aplicar endoso' })).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('una validación en «No cumple» deja el intento no aplicado y propone devolverla (O3b, CA-2)', async () => {
    aplicar.mockReturnValue(of(mapearResultadoAplicacion(APLICACION_NO_APLICADA_DTO)));
    await abrir();
    // Aunque la relectura falle, lo que devolvió «Aplicar» ya se ve.
    consultar.mockReturnValue(throwError(() => new ErrorEndoso('endorsement_unavailable')));

    await userEvent.click(screen.getByRole('button', { name: 'Aplicar endoso' }));
    await estable();

    const alerta = screen.getByRole('alert');
    expect(alerta.textContent).toContain('El endoso no se aplicó');
    expect(alerta.textContent).toContain('La validación «Documentos de identidad válidos» no se cumple.');
    expect(within(validacion('Documentos de identidad válidos')).getByText('No cumple')).toBeTruthy();
    expect(validacion('Documentos de identidad válidos').textContent).toContain('Registraduría · TI 1.142.998.000 no encontrado');
    expect(screen.getByRole('heading', { name: 'Por qué no se aplicó' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Volver a la bandeja' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Devolver al asegurado' })).toBeTruthy();
    expect(screen.getByLabelText('Observaciones (obligatorias al devolver)')).toBeTruthy();
  });

  it('un 503 avisa qué no se pudo verificar y no cambia nada (falla cerrada)', async () => {
    aplicar.mockReturnValue(throwError(() => new ErrorEndoso('validation_unverifiable', null, ['identity_documents_valid'])));
    await abrir();

    await userEvent.click(screen.getByRole('button', { name: 'Aplicar endoso' }));

    expect(screen.getByRole('alert').textContent).toContain(
      'La verificación de documentos no respondió. No se cambió nada: la solicitud sigue como estaba.',
    );
    expect(within(validacion('Documentos de identidad válidos')).getByText('No verificable')).toBeTruthy();
    expect(validacion('Documentos de identidad válidos').textContent).toContain('Registraduría sin respuesta');
    expect(insignia()).toBe('En revisión');
    expect(consultar).toHaveBeenCalledTimes(1);
    expect((screen.getByRole('button', { name: 'Aplicar endoso' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('un 409 avisa que otro analista ya decidió y recarga el detalle', async () => {
    aplicar.mockReturnValue(throwError(() => new ErrorEndoso('request_already_decided', 'applied')));
    await abrir();
    consultar.mockReturnValue(detalle(DETALLE_APLICADO_DTO));

    await userEvent.click(screen.getByRole('button', { name: 'Aplicar endoso' }));
    await estable();

    expect(screen.getByRole('alert').textContent).toContain('Ahora está en «Aplicada».');
    expect(consultar).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('link', { name: 'Ver historial' })).toBeTruthy();
  });

  it('si otro endoso de la póliza ganó, avisa que aplique de nuevo', async () => {
    aplicar.mockReturnValue(throwError(() => new ErrorEndoso('policy_changed')));
    await abrir();

    await userEvent.click(screen.getByRole('button', { name: 'Aplicar endoso' }));

    expect(screen.getByRole('alert').textContent).toContain('La póliza cambió mientras validabas');
    expect(consultar).toHaveBeenCalledTimes(2);
  });

  it('«Rechazar» exige observaciones de 10 a 500 caracteres y deja la solicitud rechazada (CA-5)', async () => {
    const motivo = 'El parentesco declarado no permite esta designación.';
    rechazar.mockReturnValue(of(mapearDetalleEndoso(DETALLE_RECHAZADO_DTO).solicitud));
    await abrir();
    const campo = screen.getByLabelText('Observaciones (obligatorias al rechazar)');

    await userEvent.click(screen.getByRole('button', { name: 'Rechazar' }));
    expect(screen.getByText('Escribe entre 10 y 500 caracteres: el asegurado los leerá.')).toBeTruthy();
    expect(campo.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(campo);

    await userEvent.type(campo, 'Muy corto');
    await userEvent.click(screen.getByRole('button', { name: 'Rechazar' }));
    expect(rechazar).not.toHaveBeenCalled();

    consultar.mockReturnValue(detalle(DETALLE_RECHAZADO_DTO));
    await userEvent.clear(campo);
    await userEvent.type(campo, `  ${motivo}  `);
    expect(campo.getAttribute('aria-invalid')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Rechazar' }));
    await estable();

    expect(rechazar).toHaveBeenCalledWith('SOL-MOD-2026-0042', motivo);
    expect(screen.getByRole('status').textContent).toContain('Solicitud rechazada');
    expect(insignia()).toBe('Rechazada');
    expect(screen.getByText(motivo)).toBeTruthy();
    expect(screen.getByText(/Rechazada por Andrés Ruiz \(operaciones\)/)).toBeTruthy();
    expect(screen.getByText(/no se ejecutaron las validaciones/)).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('«Devolver al asegurado» registra las observaciones de la no aplicada', async () => {
    const motivo = 'El documento de Lucía no está en la Registraduría. Corrígelo y radica de nuevo.';
    consultar.mockReturnValue(detalle(DETALLE_NO_APLICADO_DTO));
    devolver.mockReturnValue(of(mapearDetalleEndoso(DETALLE_DEVUELTO_DTO).solicitud));
    await abrir('SOL-MOD-2026-0043');
    consultar.mockReturnValue(detalle(DETALLE_DEVUELTO_DTO));

    await userEvent.type(screen.getByLabelText('Observaciones (obligatorias al devolver)'), motivo);
    await userEvent.click(screen.getByRole('button', { name: 'Devolver al asegurado' }));
    await estable();

    expect(devolver).toHaveBeenCalledWith('SOL-MOD-2026-0043', motivo);
    expect(screen.getByRole('status').textContent).toContain('Solicitud devuelta');
    expect(screen.getByText(/Andrés Ruiz lo devolvió al asegurado el/)).toBeTruthy();
    expect(screen.getByText(motivo)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Devolver al asegurado' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Volver a la bandeja' })).toBeTruthy();
  });

  it('una solicitud que no existe muestra «No encontramos la solicitud»', async () => {
    consultar.mockReturnValue(throwError(() => new ErrorEndoso('change_request_not_found')));
    await abrir('SOL-MOD-2026-9999');

    expect(screen.getByRole('heading', { level: 1, name: 'No encontramos la solicitud' })).toBeTruthy();
  });

  it('una falla al cargar ofrece «Reintentar»', async () => {
    consultar.mockReturnValueOnce(throwError(() => new ErrorEndoso('endorsement_unavailable')));
    await abrir();
    expect(screen.getByRole('heading', { level: 1, name: 'No pudimos cargar la solicitud' })).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Endoso · SOL-MOD-2026-0042' })).toBeTruthy();
  });
});
