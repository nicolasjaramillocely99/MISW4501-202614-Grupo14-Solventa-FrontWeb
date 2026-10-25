import { ActivatedRoute, provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { REGISTRO_DECISION_DTO } from '@testing/decision-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { Observable, of, throwError } from 'rxjs';

import { AuditoriaApiService } from '@core/api/auditoria/auditoria-api.service';
import { CodigoErrorDecision, ErrorDecision, RegistroDecision, mapearRegistroDecision } from '@core/api/auditoria/decision.modelos';

import { RegistroAuditoriaPage } from './registro-auditoria.page';
import { RegistroConsultadoService } from './servicios/registro-consultado.service';

const REGISTRO = mapearRegistroDecision(REGISTRO_DECISION_DTO);
const falla = (codigo: CodigoErrorDecision) => throwError(() => new ErrorDecision(codigo));

describe('RegistroAuditoriaPage (O13 · HU-W4.1-01)', () => {
  let consultar: ReturnType<typeof vi.fn<(id: string) => Observable<RegistroDecision>>>;

  async function renderizar(respuestas: Observable<RegistroDecision>[], guardado?: RegistroDecision) {
    consultar = vi.fn();
    for (const r of respuestas) {
      consultar.mockReturnValueOnce(r);
    }
    const consultado = new RegistroConsultadoService();
    if (guardado) {
      consultado.guardar(guardado);
    }
    await render(RegistroAuditoriaPage, {
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter([]),
        { provide: AuditoriaApiService, useValue: { consultarRegistroDecision: consultar } },
        { provide: RegistroConsultadoService, useValue: consultado },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map([['id', REGISTRO.ofertaId]]) } } },
      ],
    });
  }

  it('muestra el registro completo del proceso de suscripción (CA-3)', async () => {
    await renderizar([of(REGISTRO)]);

    expect(await screen.findByRole('heading', { name: 'Póliza off-4f2a9c' })).toBeTruthy();
    expect(screen.getAllByText('Diferido')).toHaveLength(2);
    // Fecha y hora de la solicitud con zona horaria, y versión del motor de rating.
    const solicitud = within(screen.getByRole('region', { name: 'Solicitud de suscripción' }));
    expect(solicitud.getByText('Fecha y hora de la solicitud')).toBeTruthy();
    expect(solicitud.getByText(/\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}:\d{2} (GMT|UTC)/)).toBeTruthy();
    expect(solicitud.getByText('v1')).toBeTruthy();
    // Fuentes consultadas con su resultado.
    const fuentes = within(screen.getByRole('table', { name: 'Fuentes de datos consultadas' }));
    expect(fuentes.getByRole('row', { name: /Open Finance Respondió 85 ms/ })).toBeTruthy();
    expect(fuentes.getByRole('row', { name: /KYC Sin respuesta a tiempo 700 ms/ })).toBeTruthy();
    // Reglas en su orden de ejecución con el valor de salida.
    const reglas = within(screen.getByRole('table', { name: 'Reglas de rating aplicadas' })).getAllByRole('row');
    expect(reglas[1].textContent).toContain('1Tasa mensual base0.0011');
    expect(reglas[2].textContent).toContain('2Factor por edad1.2');
    // Prima, decisión y motivo.
    const resultado = within(screen.getByRole('region', { name: 'Resultado' }));
    expect(resultado.getByText(/120\.000/)).toBeTruthy();
    expect(resultado.getByText('Se usó el perfil actuarial base porque una fuente no respondió')).toBeTruthy();
  });

  it('es de solo lectura: no ofrece ningún campo ni acción de edición (CA-4)', async () => {
    await renderizar([of(REGISTRO)]);

    await screen.findByRole('heading', { name: 'Póliza off-4f2a9c' });
    expect(screen.getByText('Registro de solo lectura: ningún dato puede modificarse.')).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('usa el registro que encontró la búsqueda sin consultarlo de nuevo', async () => {
    await renderizar([], REGISTRO);

    expect(await screen.findByRole('heading', { name: 'Póliza off-4f2a9c' })).toBeTruthy();
    expect(consultar).not.toHaveBeenCalled();
  });

  it('muestra «sin resultados» si el identificador no existe', async () => {
    await renderizar([falla('decision_not_found')]);

    expect(await screen.findByRole('heading', { name: 'Sin resultados' })).toBeTruthy();
  });

  it('permite reintentar cuando el servicio no responde', async () => {
    await renderizar([falla('service_unavailable'), of(REGISTRO)]);

    expect((await screen.findByRole('alert')).textContent).toContain('El servicio de auditoría no respondió');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('heading', { name: 'Póliza off-4f2a9c' })).toBeTruthy();
    expect(consultar).toHaveBeenCalledTimes(2);
  });

  it('un 403 lo resuelve el interceptor: la página no muestra error propio', async () => {
    await renderizar([falla('forbidden')]);

    expect(screen.queryByRole('alert')).toBeNull();
  });
});
