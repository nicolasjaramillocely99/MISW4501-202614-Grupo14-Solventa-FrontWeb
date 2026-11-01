import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { LISTA_POLIZAS_DTO, POLIZA_LISTADA_DTO, RESUMEN_ACEPTADA_DTO } from '@testing/renovacion-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { Observable, Subject, of, throwError } from 'rxjs';

import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';
import { ErrorRenovacion, PolizaListada, mapearPolizaListada } from '@core/api/originacion/renovacion.modelos';

import { MisPolizasPage } from './mis-polizas.page';

const LISTA = LISTA_POLIZAS_DTO.items.map(mapearPolizaListada);

describe('MisPolizasPage (A1 · HU-W1.5-02)', () => {
  const api = { listarPolizas: vi.fn<() => Observable<PolizaListada[]>>() };

  async function renderizar(lista: Observable<PolizaListada[]> = of(LISTA)) {
    api.listarPolizas.mockReturnValue(lista);
    return render(MisPolizasPage, {
      imports: [proveerTranslocoPruebas()],
      providers: [provideRouter([]), { provide: OriginacionApiService, useValue: api }],
    });
  }

  beforeEach(() => vi.resetAllMocks());

  afterEach(() => vi.useRealTimers());

  it('mientras consulta informa que carga', async () => {
    await renderizar(new Subject<PolizaListada[]>());

    expect(screen.getByRole('status').textContent).toContain('Cargando tus pólizas');
  });

  it('muestra el resumen, el aviso de la póliza por vencer y la tabla (criterio 3: solo se renueva dentro de la ventana)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-16T12:00:00Z'));
    await renderizar();

    expect(screen.getByRole('heading', { level: 1, name: 'Mis pólizas' })).toBeTruthy();
    expect(screen.getByText('Coberturas, vigencia y renovación de Carolina Pérez')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Radicar un siniestro' }).getAttribute('href')).toBe('/siniestros/radicar');
    expect(screen.getByText('Pólizas activas').nextElementSibling?.textContent).toBe('2');
    expect(screen.getByText('Próximas a vencer').nextElementSibling?.textContent).toBe('1');
    expect(screen.getAllByText(/Vence el 2 de octubre de 2026/).length).toBeGreaterThan(0);
    expect(screen.getByText('Tu póliza pol-acc-118204 vence en 17 días')).toBeTruthy();
    expect(screen.getAllByRole('row')).toHaveLength(3);
    expect(screen.getByText('2 pólizas')).toBeTruthy();
    const renovar = screen.getAllByRole('link', { name: 'Renovar' });
    expect(renovar).toHaveLength(1);
    expect(renovar[0].getAttribute('href')).toBe('/originacion/polizas/pol-acc-118204/renovar');
    expect(screen.getByText('Activa', { selector: 'app-insignia-estado' })).toBeTruthy();
  });

  it('el filtro por estado deja solo las pólizas de ese estado y actualiza el contador', async () => {
    await renderizar();

    await userEvent.selectOptions(screen.getByLabelText('Estado'), 'Por vencer');

    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getByText('1 póliza')).toBeTruthy();
    expect(screen.queryByText('pol-acc-220331')).toBeNull();
  });

  it('una póliza con renovación en curso muestra su estado y lleva a verla', async () => {
    const enCurso = mapearPolizaListada({ ...POLIZA_LISTADA_DTO, can_renew: false, renewal: RESUMEN_ACEPTADA_DTO });
    await renderizar(of([enCurso]));

    expect(screen.getByText('Renovación en curso', { selector: 'app-insignia-estado' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Renovar' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Ver renovación' }).getAttribute('href')).toBe('/originacion/polizas/pol-acc-118204/renovar');
  });

  it('muestra los estados renovada, no renovada y finalizada', async () => {
    const base = { ...POLIZA_LISTADA_DTO, can_renew: false };
    await renderizar(
      of([
        mapearPolizaListada({ ...base, policy_id: 'a', renewal: { ...RESUMEN_ACEPTADA_DTO, status: 'renewed' } }),
        mapearPolizaListada({ ...base, policy_id: 'b', renewal: { ...RESUMEN_ACEPTADA_DTO, status: 'not_renewed', reason: 'no_response' } }),
        mapearPolizaListada({ ...base, policy_id: 'c', coverage_end: '2020-01-01T00:00:00Z' }),
      ]),
    );

    for (const estado of ['Renovada', 'No renovada', 'Finalizada']) {
      expect(screen.getByText(estado, { selector: 'app-insignia-estado' })).toBeTruthy();
    }
  });

  it('sin pólizas lo dice', async () => {
    await renderizar(of([]));

    expect(screen.getByRole('heading', { name: 'Aún no tienes pólizas activas' })).toBeTruthy();
  });

  it('si falla la consulta avisa y deja reintentar', async () => {
    await renderizar(throwError(() => new ErrorRenovacion('renewal_unavailable')));
    api.listarPolizas.mockReturnValue(of(LISTA));

    expect(screen.getByRole('alert').textContent).toContain('Intenta de nuevo');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findAllByRole('row')).toHaveLength(3);
  });
});
