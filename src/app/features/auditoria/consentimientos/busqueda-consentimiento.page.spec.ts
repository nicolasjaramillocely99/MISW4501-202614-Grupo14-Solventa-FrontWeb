import { provideRouter, Router } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { ESTADO_ACTIVO_DTO } from '@testing/revocacion-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { Observable, of, throwError } from 'rxjs';

import { AuditoriaApiService } from '@core/api/auditoria/auditoria-api.service';
import {
  CodigoErrorRevocacion,
  ErrorRevocacion,
  EstadoRevocacion,
  mapearEstadoRevocacion,
} from '@core/api/auditoria/revocacion.modelos';

import { BusquedaConsentimientoPage } from './busqueda-consentimiento.page';
import { EstadoConsultadoService } from './servicios/estado-consultado.service';

const ESTADO = mapearEstadoRevocacion(ESTADO_ACTIVO_DTO);
const falla = (codigo: CodigoErrorRevocacion) => throwError(() => new ErrorRevocacion(codigo));

describe('BusquedaConsentimientoPage (O14 provisional · HU-W4.2-02 F1)', () => {
  let consultar: ReturnType<typeof vi.fn<(id: string) => Observable<EstadoRevocacion>>>;
  let consultado: EstadoConsultadoService;

  async function renderizar(respuesta: Observable<EstadoRevocacion> = of(ESTADO)) {
    consultar = vi.fn().mockReturnValue(respuesta);
    consultado = new EstadoConsultadoService();
    const vista = await render(BusquedaConsentimientoPage, {
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter([]),
        { provide: AuditoriaApiService, useValue: { consultarEstadoRevocacion: consultar } },
        { provide: EstadoConsultadoService, useValue: consultado },
      ],
    });
    const navegar = vi.spyOn(vista.fixture.debugElement.injector.get(Router), 'navigate').mockResolvedValue(true);
    return { navegar };
  }

  const campo = () => screen.getByLabelText('Identificador del consentimiento') as HTMLInputElement;
  const buscar = () => userEvent.click(screen.getByRole('button', { name: 'Buscar' }));

  it('pide el identificador y no consulta si falta', async () => {
    await renderizar();

    await buscar();

    expect(screen.getByRole('alert').textContent).toContain('Ingresa el identificador del consentimiento.');
    expect(consultar).not.toHaveBeenCalled();
  });

  it.each([
    ['con espacios', 'cns 1/2'],
    ['con recorrido de ruta', '../x'],
    ['de 65 caracteres', 'a'.repeat(65)],
  ])('rechaza un identificador %s', async (_caso, texto) => {
    await renderizar();

    await userEvent.type(campo(), texto);
    await buscar();

    expect(screen.getByRole('alert').textContent).toContain('El identificador solo admite letras');
    expect(consultar).not.toHaveBeenCalled();
  });

  it('acepta un identificador de 64 caracteres y lo consulta recortado', async () => {
    await renderizar();

    await userEvent.type(campo(), `  ${'a'.repeat(64)}  `);
    await buscar();

    expect(consultar).toHaveBeenCalledWith('a'.repeat(64));
  });

  it('con un identificador existente guarda el estado y abre el detalle', async () => {
    const { navegar } = await renderizar();

    await userEvent.type(campo(), ' cns-4f1c2a9be0d34c6f8a7e5d1b2c3a4f5e ');
    await buscar();

    expect(consultar).toHaveBeenCalledWith('cns-4f1c2a9be0d34c6f8a7e5d1b2c3a4f5e');
    expect(consultado.de(ESTADO.consentimientoId)).toEqual(ESTADO);
    expect(navegar).toHaveBeenCalledWith(['/auditoria/consentimientos', ESTADO.consentimientoId]);
  });

  it('muestra «sin resultados» sin datos internos cuando no existe', async () => {
    const { navegar } = await renderizar(falla('consent_not_found'));

    await userEvent.type(campo(), 'cns-nada');
    await buscar();

    expect(await screen.findByRole('heading', { name: 'No encontramos un consentimiento con el identificador cns-nada' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Por seguridad no se muestra información interna del sistema.');
    expect(navegar).not.toHaveBeenCalled();
  });

  it('«Limpiar búsqueda» vacía el campo y vuelve al estado inicial', async () => {
    await renderizar(falla('consent_not_found'));
    await userEvent.type(campo(), 'cns-nada');
    await buscar();

    await userEvent.click(await screen.findByRole('button', { name: 'Limpiar búsqueda' }));

    expect(campo().value).toBe('');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('avisa cuando el servicio no responde y deja reintentar', async () => {
    await renderizar(falla('service_unavailable'));
    await userEvent.type(campo(), 'cns-1');
    await buscar();
    expect((await screen.findByRole('alert')).textContent).toContain('No pudimos consultar el consentimiento');

    consultar.mockReturnValue(of(ESTADO));
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(consultar).toHaveBeenCalledTimes(2);
    expect(consultado.de(ESTADO.consentimientoId)).toEqual(ESTADO);
  });

  it('no muestra aviso propio ante un 401 o 403, que resuelve el interceptor', async () => {
    await renderizar(falla('forbidden'));

    await userEvent.type(campo(), 'cns-1');
    await buscar();

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('dice qué muestra el detalle', async () => {
    await renderizar();

    expect(screen.getByRole('heading', { name: 'Consentimientos Open Finance', level: 1 })).toBeTruthy();
    const incluye = within(screen.getByRole('complementary', { name: 'Qué muestra el detalle' }));
    expect(incluye.getAllByRole('listitem')).toHaveLength(4);
  });
});
