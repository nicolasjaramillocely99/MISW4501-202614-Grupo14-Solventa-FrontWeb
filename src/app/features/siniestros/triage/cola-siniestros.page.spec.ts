import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { fireEvent, render, screen, within } from '@testing-library/angular';
import {
  ID_CASO_INEXISTENTE,
  ID_CASO_TRIAGE,
  ID_CASO_TRIAGE_2,
  LOTE_TRIAGE_DTO,
  POLITICA_TRIAGE_DTO,
} from '@testing/triage-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { Observable, of, throwError } from 'rxjs';

import { ErrorSiniestro } from '@core/api/siniestros/siniestro.modelos';
import { SiniestrosApiService } from '@core/api/siniestros/siniestros-api.service';
import {
  PoliticaTriage,
  ResumenTriage,
  mapearPaginaTriage,
  mapearPoliticaTriage,
} from '@core/api/siniestros/triage.modelos';

import { ColaSiniestrosPage } from './cola-siniestros.page';

const POLITICA = mapearPoliticaTriage(POLITICA_TRIAGE_DTO);
const LOTE = mapearPaginaTriage(LOTE_TRIAGE_DTO);
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const pendiente = (id: string): ResumenTriage => ({
  siniestroId: id,
  estado: 'pending',
  nivel: null,
  severidad: null,
  banda: null,
  objetivo: null,
  evaluadoEn: null,
});
const asignado = (id: string): ResumenTriage => ({
  siniestroId: id,
  estado: 'assessed',
  nivel: 2,
  severidad: 'medium',
  banda: 'low',
  objetivo: { tipo: 'business_days', diasHabiles: 5, diasResolucion: 5 },
  evaluadoEn: '2026-10-31T04:20:28Z',
});

describe('ColaSiniestrosPage (O5 provisional · HU-W2.2-01, F1)', () => {
  let api: {
    consultarPoliticaTriage: ReturnType<typeof vi.fn<() => Observable<PoliticaTriage>>>;
    consultarTriageLote: ReturnType<typeof vi.fn<(ids: readonly string[]) => Observable<ResumenTriage[]>>>;
  };
  let navegar: ReturnType<typeof vi.spyOn>;

  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] }));
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function renderizar({
    politica = of(POLITICA) as Observable<PoliticaTriage>,
    lote = of(LOTE) as Observable<ResumenTriage[]>,
    casos = null as string | null,
  } = {}) {
    navegar = vi.spyOn(Router.prototype, 'navigate').mockResolvedValue(true);
    api = {
      consultarPoliticaTriage: vi.fn().mockReturnValue(politica),
      consultarTriageLote: vi.fn().mockReturnValue(lote),
    };
    return render(ColaSiniestrosPage, {
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter([]),
        { provide: SiniestrosApiService, useValue: api },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: (k: string) => (k === 'casos' ? casos : null) } } },
        },
      ],
    });
  }

  const campo = () => screen.getByLabelText('Identificadores de caso') as HTMLTextAreaElement;
  const buscar = () => fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
  const escribir = (texto: string) => fireEvent.input(campo(), { target: { value: texto } });

  describe('estado inicial', () => {
    it('muestra el título, la regla con los umbrales de la política y los objetivos por nivel (CA-5)', async () => {
      await renderizar();

      expect(screen.getByRole('heading', { level: 1, name: 'Cola de siniestros' })).toBeTruthy();
      const regla = screen.getByRole('region', { name: 'Cómo se calcula la prioridad' });
      expect(regla.textContent).toMatch(/monto bajo, menos de \$\s5\.000\.000 COP; monto alto, más de \$\s30\.000\.000 COP/);
      expect(regla.textContent).toContain('triage-policy-v1');
      expect(screen.getByText('Atención inmediata')).toBeTruthy();
      expect(screen.getByText('Objetivo: 5 días hábiles')).toBeTruthy();
      expect(screen.getByText('Objetivo: 10 días hábiles')).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Busca un siniestro para ver su prioridad' })).toBeTruthy();
      expect(api.consultarTriageLote).not.toHaveBeenCalled();
    });

    it('si la política falla, los indicadores muestran su error y la búsqueda sigue funcionando', async () => {
      await renderizar({ politica: throwError(() => new ErrorSiniestro('claims_unavailable')) });

      expect(screen.getByText('No pudimos consultar el objetivo de cada nivel.')).toBeTruthy();
      expect(screen.getByRole('region', { name: 'Cómo se calcula la prioridad' }).textContent).not.toMatch(/menos de/);

      escribir(ID_CASO_TRIAGE);
      buscar();

      expect(screen.getByRole('rowheader', { name: ID_CASO_TRIAGE })).toBeTruthy();
    });

    it('«Reintentar» de los indicadores vuelve a pedir la política', async () => {
      await renderizar({ politica: throwError(() => new ErrorSiniestro('claims_unavailable')) });
      api.consultarPoliticaTriage.mockReturnValue(of(POLITICA));

      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

      expect(api.consultarPoliticaTriage).toHaveBeenCalledTimes(2);
      expect(screen.getByText('Objetivo: 5 días hábiles')).toBeTruthy();
    });
  });

  describe('búsqueda (CA-4)', () => {
    it('hace una sola llamada al lote con todos los ids y pinta una fila por caso', async () => {
      await renderizar();

      escribir(`${ID_CASO_TRIAGE}, ${ID_CASO_TRIAGE_2}\n${ID_CASO_INEXISTENTE}`);
      buscar();

      expect(api.consultarTriageLote).toHaveBeenCalledTimes(1);
      expect(api.consultarTriageLote).toHaveBeenCalledWith([ID_CASO_TRIAGE, ID_CASO_TRIAGE_2, ID_CASO_INEXISTENTE]);
      const tabla = screen.getByRole('table');
      expect(within(tabla).getAllByRole('row')).toHaveLength(3);
      const fila = within(tabla).getByRole('rowheader', { name: ID_CASO_TRIAGE }).closest('tr') as HTMLElement;
      expect(within(fila).getByText('Triage 1')).toBeTruthy();
      expect(within(fila).getByText('media')).toBeTruthy();
      expect(within(fila).getByText('monto alto')).toBeTruthy();
      expect(within(fila).getByText('Atención inmediata')).toBeTruthy();
    });

    it('avisa cuántos ids no existen y omite su fila', async () => {
      await renderizar();

      escribir(`${ID_CASO_TRIAGE} ${ID_CASO_TRIAGE_2} ${ID_CASO_INEXISTENTE}`);
      buscar();

      expect(screen.getByText('No encontramos 1 caso con los identificadores buscados.')).toBeTruthy();
      expect(screen.queryByRole('rowheader', { name: ID_CASO_INEXISTENTE })).toBeNull();
      expect(screen.getByText('2 siniestros')).toBeTruthy();
    });

    it('escribe ?casos= en la URL con los ids buscados', async () => {
      await renderizar();

      escribir(`${ID_CASO_TRIAGE} ${ID_CASO_TRIAGE_2}`);
      buscar();

      expect(navegar).toHaveBeenCalledWith(
        [],
        expect.objectContaining({ queryParams: { casos: `${ID_CASO_TRIAGE},${ID_CASO_TRIAGE_2}` }, replaceUrl: true }),
      );
      expect(screen.getAllByRole('link', { name: /Ver prioridad del caso/ })[0].getAttribute('href')).toContain(
        `casos=${ID_CASO_TRIAGE},${ID_CASO_TRIAGE_2}`,
      );
    });

    it('al cargar con ?casos= repite la consulta una vez y rellena el campo', async () => {
      await renderizar({ casos: `${ID_CASO_TRIAGE},${ID_CASO_TRIAGE_2}` });

      expect(api.consultarTriageLote).toHaveBeenCalledTimes(1);
      expect(api.consultarTriageLote).toHaveBeenCalledWith([ID_CASO_TRIAGE, ID_CASO_TRIAGE_2]);
      expect(campo().value).toBe(`${ID_CASO_TRIAGE}\n${ID_CASO_TRIAGE_2}`);
      expect(screen.getByRole('table')).toBeTruthy();
    });

    it('un ?casos= con ids inválidos no consulta', async () => {
      await renderizar({ casos: '../x,abc' });

      expect(api.consultarTriageLote).not.toHaveBeenCalled();
      expect(screen.getByRole('heading', { name: 'Busca un siniestro para ver su prioridad' })).toBeTruthy();
    });

    it('si ningún id existe dice que no hay prioridad para mostrar', async () => {
      await renderizar({ lote: of([LOTE[2]]) });

      escribir(ID_CASO_INEXISTENTE);
      buscar();

      expect(screen.getByRole('heading', { name: 'No hay prioridad para mostrar' })).toBeTruthy();
      expect(screen.queryByRole('table')).toBeNull();
    });

    it('«Limpiar» vuelve al estado inicial y quita ?casos=', async () => {
      await renderizar();
      escribir(ID_CASO_TRIAGE);
      buscar();

      fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));

      expect(campo().value).toBe('');
      expect(screen.queryByRole('table')).toBeNull();
      expect(navegar).toHaveBeenLastCalledWith([], expect.objectContaining({ queryParams: { casos: null } }));
    });
  });

  describe('validación de la búsqueda (S6)', () => {
    const error = () => screen.getByText(/./, { selector: '#casos-error' });

    it('vacío pide al menos un identificador y no llama', async () => {
      await renderizar();

      buscar();

      expect(error().textContent).toContain('Escribe al menos un identificador de caso.');
      expect(campo().getAttribute('aria-invalid')).toBe('true');
      expect(api.consultarTriageLote).not.toHaveBeenCalled();
    });

    it('lista los identificadores inválidos y no llama', async () => {
      await renderizar();

      escribir(`${ID_CASO_TRIAGE} ../x abc`);
      buscar();

      expect(error().textContent).toContain('Estos identificadores no son válidos: ../x, abc.');
      expect(api.consultarTriageLote).not.toHaveBeenCalled();
    });

    it('51 ids pasan del máximo y no llaman; 50 sí', async () => {
      await renderizar();

      escribir(Array.from({ length: 51 }, (_, i) => uuid(i + 1)).join(' '));
      buscar();
      expect(error().textContent).toContain('Pegaste 51 identificadores; el máximo es 50.');
      expect(api.consultarTriageLote).not.toHaveBeenCalled();

      escribir(Array.from({ length: 50 }, (_, i) => uuid(i + 1)).join(' '));
      buscar();
      expect(api.consultarTriageLote).toHaveBeenCalledTimes(1);
      expect(api.consultarTriageLote.mock.calls[0][0]).toHaveLength(50);
    });

    it('quita los repetidos y lo avisa', async () => {
      await renderizar();

      escribir(`${ID_CASO_TRIAGE} ${ID_CASO_TRIAGE} ${ID_CASO_TRIAGE_2}`);
      buscar();

      expect(api.consultarTriageLote).toHaveBeenCalledWith([ID_CASO_TRIAGE, ID_CASO_TRIAGE_2]);
      expect(screen.getByText('Se quitó 1 identificador repetido.')).toBeTruthy();
    });

    it('escribir limpia el error del campo', async () => {
      await renderizar();
      buscar();

      escribir(ID_CASO_TRIAGE);

      expect(screen.queryByText('Escribe al menos un identificador de caso.')).toBeNull();
    });
  });

  describe('errores y sondeo (S1)', () => {
    it('un 503 del lote muestra el estado de error y «Reintentar» vuelve a pedir', async () => {
      await renderizar({ lote: throwError(() => new ErrorSiniestro('claims_unavailable')) });
      escribir(ID_CASO_TRIAGE);
      buscar();
      expect(screen.getByRole('heading', { name: 'No pudimos consultar la prioridad' })).toBeTruthy();
      expect(screen.getByRole('alert').textContent).toContain('El servicio no respondió');

      api.consultarTriageLote.mockReturnValue(of([asignado(ID_CASO_TRIAGE)]));
      fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

      expect(api.consultarTriageLote).toHaveBeenCalledTimes(2);
      expect(screen.getByRole('rowheader', { name: ID_CASO_TRIAGE })).toBeTruthy();
    });

    it('una fila pending se actualiza con el sondeo pidiendo solo los ids pending', async () => {
      const { detectChanges } = await renderizar({ lote: of([asignado(uuid(1)), pendiente(uuid(2))]) });
      escribir(`${uuid(1)} ${uuid(2)}`);
      buscar();
      expect(screen.getByText('Calculando prioridad…', { selector: 'td' })).toBeTruthy();

      api.consultarTriageLote.mockReturnValue(of([asignado(uuid(2))]));
      await vi.advanceTimersByTimeAsync(5_000);
      detectChanges();

      expect(api.consultarTriageLote).toHaveBeenCalledTimes(2);
      expect(api.consultarTriageLote).toHaveBeenLastCalledWith([uuid(2)]);
      expect(screen.queryByText('Calculando prioridad…', { selector: 'td' })).toBeNull();
      expect(within(screen.getByRole('table')).getAllByText('Triage 2')).toHaveLength(2);
      await vi.advanceTimersByTimeAsync(30_000);
      expect(api.consultarTriageLote).toHaveBeenCalledTimes(2);
    });

    it('si sigue pending a los 90 s se detiene y ofrece «Actualizar»', async () => {
      const { detectChanges } = await renderizar({ lote: of([pendiente(uuid(1))]) });
      escribir(uuid(1));
      buscar();

      await vi.advanceTimersByTimeAsync(95_000);
      detectChanges();

      expect(screen.getByText('La prioridad aún no está disponible')).toBeTruthy();
      const llamadas = api.consultarTriageLote.mock.calls.length;
      api.consultarTriageLote.mockReturnValue(of([asignado(uuid(1))]));
      fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
      detectChanges();
      expect(api.consultarTriageLote).toHaveBeenCalledTimes(llamadas + 1);
      expect(screen.queryByText('La prioridad aún no está disponible')).toBeNull();
    });

    it('una nueva búsqueda cancela el sondeo anterior', async () => {
      await renderizar({ lote: of([pendiente(uuid(1))]) });
      escribir(uuid(1));
      buscar();

      api.consultarTriageLote.mockReturnValue(of([asignado(uuid(3))]));
      escribir(uuid(3));
      buscar();
      await vi.advanceTimersByTimeAsync(60_000);

      expect(api.consultarTriageLote).toHaveBeenCalledTimes(2);
    });

    it('un caso not_applicable se muestra «Sin prioridad» y no sondea', async () => {
      await renderizar({
        lote: of([{ ...pendiente(uuid(1)), estado: 'not_applicable' as const }]),
      });
      escribir(uuid(1));
      buscar();
      await vi.advanceTimersByTimeAsync(30_000);

      expect(screen.getByText('Sin prioridad (no está en evaluación)')).toBeTruthy();
      expect(api.consultarTriageLote).toHaveBeenCalledTimes(1);
    });
  });
});
