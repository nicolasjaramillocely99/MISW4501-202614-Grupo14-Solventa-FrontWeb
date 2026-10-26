import { provideRouter, Router } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { REGISTRO_DECISION_DTO } from '@testing/decision-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { Observable, of, throwError } from 'rxjs';

import { AuditoriaApiService } from '@core/api/auditoria/auditoria-api.service';
import { CodigoErrorDecision, ErrorDecision, RegistroDecision, mapearRegistroDecision } from '@core/api/auditoria/decision.modelos';

import { BusquedaRegistroPage } from './busqueda-registro.page';
import { RegistroConsultadoService } from './servicios/registro-consultado.service';

const REGISTRO = mapearRegistroDecision(REGISTRO_DECISION_DTO);
const falla = (codigo: CodigoErrorDecision) => throwError(() => new ErrorDecision(codigo));

describe('BusquedaRegistroPage (O12 · HU-W4.1-01)', () => {
  let consultar: ReturnType<typeof vi.fn<(id: string) => Observable<RegistroDecision>>>;
  let consultado: RegistroConsultadoService;

  async function renderizar(respuesta: Observable<RegistroDecision> = of(REGISTRO)) {
    consultar = vi.fn().mockReturnValue(respuesta);
    consultado = new RegistroConsultadoService();
    const vista = await render(BusquedaRegistroPage, {
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter([]),
        { provide: AuditoriaApiService, useValue: { consultarRegistroDecision: consultar } },
        { provide: RegistroConsultadoService, useValue: consultado },
      ],
    });
    const navegar = vi.spyOn(vista.fixture.debugElement.injector.get(Router), 'navigate').mockResolvedValue(true);
    return { navegar };
  }

  it('pide el identificador y no consulta si falta', async () => {
    await renderizar();

    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    expect((screen.getByRole('alert')).textContent).toContain('Ingresa el identificador de la póliza.');
    expect(consultar).not.toHaveBeenCalled();
  });

  it('rechaza un identificador con caracteres no admitidos', async () => {
    await renderizar();

    await userEvent.type(screen.getByLabelText('Identificador de póliza'), 'off 1/2');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    expect((screen.getByRole('alert')).textContent).toContain('solo admite letras');
    expect(consultar).not.toHaveBeenCalled();
  });

  it('con un identificador existente guarda el registro y abre su pantalla (CA-1)', async () => {
    const { navegar } = await renderizar();

    await userEvent.type(screen.getByLabelText('Identificador de póliza'), '  off-4f2a9c ');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(consultar).toHaveBeenCalledWith('off-4f2a9c');
    expect(consultado.de('off-4f2a9c')).toEqual(REGISTRO);
    expect(navegar).toHaveBeenCalledWith(['/auditoria/registro', 'off-4f2a9c']);
  });

  it('muestra «sin resultados» sin datos internos cuando no existe (CA-2)', async () => {
    const { navegar } = await renderizar(falla('decision_not_found'));

    await userEvent.type(screen.getByLabelText('Identificador de póliza'), 'off-nada');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(await screen.findByRole('heading', { name: 'No encontramos resultados para off-nada' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Por seguridad no se muestra información interna del sistema.');
    expect(navegar).not.toHaveBeenCalled();
  });

  it('«Limpiar búsqueda» vacía el campo y vuelve al estado inicial (O12b)', async () => {
    await renderizar(falla('decision_not_found'));
    const campo = screen.getByLabelText('Identificador de póliza') as HTMLInputElement;
    await userEvent.type(campo, 'off-nada');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Limpiar búsqueda' }));

    expect(campo.value).toBe('');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('lista lo que incluye el registro y acepta número de oferta o de solicitud (O12)', async () => {
    await renderizar();

    expect(screen.getByRole('heading', { name: 'Auditoría de suscripción', level: 1 })).toBeTruthy();
    expect(screen.getByText(/También acepta el número de oferta/)).toBeTruthy();
    const incluye = within(screen.getByRole('complementary', { name: 'Qué incluye el registro' }));
    expect(incluye.getAllByRole('listitem')).toHaveLength(5);
    expect(incluye.getByText(/el valor devuelto por cada una/)).toBeTruthy();
  });

  it('avisa cuando el servicio no responde y deja reintentar', async () => {
    await renderizar(falla('service_unavailable'));

    await userEvent.type(screen.getByLabelText('Identificador de póliza'), 'off-1');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    expect((await screen.findByRole('alert')).textContent).toContain('No pudimos consultar el registro');
    expect((screen.getByRole('button', { name: 'Buscar' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('no muestra aviso propio ante un 401 o 403, que resuelve el interceptor', async () => {
    await renderizar(falla('forbidden'));

    await userEvent.type(screen.getByLabelText('Identificador de póliza'), 'off-1');
    await userEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/No encontramos resultados/)).toBeNull();
  });
});
