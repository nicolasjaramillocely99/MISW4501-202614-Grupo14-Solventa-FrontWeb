import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { HISTORIAL_ENDOSOS_DTO, HISTORIAL_VACIO_DTO } from '@testing/endosos-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { Observable, of, throwError } from 'rxjs';

import { ErrorEndoso, HistorialEndosos, mapearHistorialEndosos } from '@core/api/originacion/endosos.modelos';
import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';

import { HistorialEndososPage } from './historial-endosos.page';

@Component({ selector: 'app-pagina-falsa', template: '' })
class PaginaFalsa {}

describe('HistorialEndososPage (O4 · HU-W1.4-02 · CA-4)', () => {
  let consultar: ReturnType<typeof vi.fn<(polizaId: string) => Observable<HistorialEndosos>>>;
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    consultar = vi
      .fn<(polizaId: string) => Observable<HistorialEndosos>>()
      .mockReturnValue(of(mapearHistorialEndosos(HISTORIAL_ENDOSOS_DTO)));
    TestBed.configureTestingModule({
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter([
          { path: 'originacion/endosos', component: PaginaFalsa },
          { path: 'originacion/polizas/:id/endosos', component: HistorialEndososPage },
        ]),
        { provide: OriginacionApiService, useValue: { consultarHistorialEndosos: consultar } },
      ],
    });
    harness = await RouterTestingHarness.create();
  });

  const abrir = (polizaId = 'pol-acc-4f2a') => harness.navigateByUrl(`/originacion/polizas/${polizaId}/endosos`);
  const celdas = () =>
    within(screen.getByRole('table'))
      .getAllByRole('row')
      .slice(1)
      .map((fila) =>
        Array.from(fila.querySelectorAll('td'), (celda) =>
          Array.from(celda.childNodes, (nodo) => nodo.textContent?.trim())
            .filter(Boolean)
            .join(' '),
        ),
      );

  it('aplicados e intentos no aplicados con qué cambió, el valor anterior y el nuevo, y quién (CA-4)', async () => {
    await abrir();

    expect(consultar).toHaveBeenCalledWith('pol-acc-4f2a');
    expect(screen.getByRole('heading', { level: 1, name: 'Historial de endosos' })).toBeTruthy();
    expect(screen.getByText('Solo lectura')).toBeTruthy();
    expect(screen.getByText('3 entradas en orden cronológico · endosos aplicados e intentos no aplicados')).toBeTruthy();
    expect(screen.getByText('Póliza pol-acc-4f2a · Carolina Pérez Ruiz')).toBeTruthy();
    expect(screen.getByText('Registro inmutable')).toBeTruthy();

    const [aplicado, noAplicado, suma] = celdas();
    expect(aplicado.slice(1)).toEqual([
      'END-2026-0102',
      'Beneficiarios Solicitud SOL-MOD-2026-0042',
      'Mateo Pérez Gómez 100 %',
      'Mateo Pérez Gómez 60 % · Lucía Pérez Gómez 40 %',
      'Andrés Ruiz Analista de operaciones',
    ]);
    expect(noAplicado.slice(1, 5)).toEqual([
      'No aplicado',
      'Beneficiarios Solicitud SOL-MOD-2026-0041 · documentos de identidad válidos: no cumple',
      'Mateo Pérez Gómez 100 %',
      'Sin cambio (no se aplicó)',
    ]);
    expect(suma[1]).toBe('END-2026-0090');
    expect(suma[3]).toMatch(/^\$\s200\.000\.000 · Prima \$\s55\.000$/);
    expect(suma[4]).toMatch(/^\$\s250\.000\.000 · Prima \$\s68\.500$/);
    // Registro inmutable: ninguna entrada se edita ni se elimina.
    expect(within(screen.getByRole('table')).queryAllByRole('button')).toHaveLength(0);
  });

  it('una póliza sin endosos muestra el historial vacío sin errores', async () => {
    consultar.mockReturnValue(of(mapearHistorialEndosos(HISTORIAL_VACIO_DTO)));
    await abrir('pol-acc-sin');

    expect(screen.getByText('0 entradas · esta póliza no tiene endosos')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Esta póliza no tiene endosos' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('una póliza que no existe lo dice', async () => {
    consultar.mockReturnValue(throwError(() => new ErrorEndoso('policy_not_found')));
    await abrir('pol-no-existe');

    expect(screen.getByRole('alert').textContent).toContain('No encontramos la póliza');
  });

  it('una falla del servicio ofrece «Reintentar»', async () => {
    consultar.mockReturnValueOnce(throwError(() => new ErrorEndoso('endorsement_unavailable')));
    await abrir();
    expect(screen.getByRole('alert').textContent).toContain('No pudimos cargar el historial');

    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(celdas()).toHaveLength(3);
  });
});
