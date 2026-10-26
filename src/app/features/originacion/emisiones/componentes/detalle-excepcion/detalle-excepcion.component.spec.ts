import { fireEvent, render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import {
  ACCIONES_DTO,
  EMISION_DOCUMENTO_FALLIDO_DTO,
  EMISION_EXCEPCION_DTO,
  EMISION_NOTIFICADA_DTO,
} from '@testing/emision-monitor-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { Observable, of, throwError } from 'rxjs';

import {
  AccionEmision,
  CodigoErrorEmision,
  Emision,
  ErrorEmision,
  ReintentoEmision,
  mapearEmision,
  mapearListaAcciones,
} from '@core/api/originacion/emision-monitor.modelos';
import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';

import { DetalleExcepcionComponent } from './detalle-excepcion.component';

const EXCEPCION = mapearEmision(EMISION_EXCEPCION_DTO);
const ACCIONES = mapearListaAcciones({ items: ACCIONES_DTO });
const falla = (codigo: CodigoErrorEmision) => throwError(() => new ErrorEmision(codigo));
const REINTENTO: ReintentoEmision = { aceptacionId: 'acc-0004', accion: 'resume' };

describe('DetalleExcepcionComponent (O1b · HU-W1.3-04)', () => {
  let acciones: ReturnType<typeof vi.fn<(id: string) => Observable<readonly AccionEmision[]>>>;
  let reintentar: ReturnType<typeof vi.fn<(id: string, nota: string) => Observable<ReintentoEmision>>>;
  const cerrar = vi.fn();
  const reintentada = vi.fn();

  async function renderizar(
    opciones: {
      emision?: Emision;
      historial?: Observable<readonly AccionEmision[]>;
      reintento?: Observable<ReintentoEmision>;
    } = {},
  ) {
    acciones = vi.fn().mockReturnValue(opciones.historial ?? of(ACCIONES));
    reintentar = vi.fn().mockReturnValue(opciones.reintento ?? of(REINTENTO));
    cerrar.mockClear();
    reintentada.mockClear();
    return render(DetalleExcepcionComponent, {
      imports: [proveerTranslocoPruebas()],
      inputs: { emision: opciones.emision ?? EXCEPCION },
      on: { cerrar, reintentada },
      providers: [
        { provide: OriginacionApiService, useValue: { listarAccionesEmision: acciones, reintentarEmision: reintentar } },
      ],
    });
  }

  it('es un diálogo modal que toma el foco y muestra por qué falló la emisión', async () => {
    await renderizar();

    const dialogo = screen.getByRole('dialog', { name: 'Excepción de emisión' });
    expect(dialogo.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Excepción de emisión' }));
    expect(within(dialogo).getByText('acc-0004')).toBeTruthy();
    expect(within(dialogo).getByText('Luis Fernando Castro')).toBeTruthy();
    expect(within(dialogo).getByText('La pasarela de pagos no respondió en la ventana de 24 horas')).toBeTruthy();
    expect(within(dialogo).getByText('Lleva más de 30 minutos sin que un analista la atienda.')).toBeTruthy();
  });

  it('explica el motivo de una excepción de la emisión contractual', async () => {
    await renderizar({ emision: mapearEmision(EMISION_DOCUMENTO_FALLIDO_DTO) });

    expect(screen.getByText('El generador de documentos falló tras todos los intentos')).toBeTruthy();
    expect(screen.getByText('pol-acc-0005')).toBeTruthy();
  });

  it('lista las acciones ya registradas con su tipo, autor, nota y fecha, la más reciente primero', async () => {
    await renderizar();

    expect(acciones).toHaveBeenCalledWith('acc-0004');
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain('Emisión contractual reintentada');
    expect(items[0].textContent).toContain('Por ops-2');
    expect(items[0].textContent).toContain('El generador volvió');
    expect(items[1].textContent).toContain('Cobro reintentado');
    expect(items[1].textContent).toContain('Pasarela restablecida');
  });

  it('sin acciones lo dice', async () => {
    await renderizar({ historial: of([]) });

    expect(screen.getByText('Aún nadie ha actuado sobre esta emisión.')).toBeTruthy();
  });

  it('si el historial falla lo avisa y no impide reintentar', async () => {
    await renderizar({ historial: falla('charge_unavailable') });

    expect(screen.getByText('No pudimos cargar el historial.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
  });

  it('exige una nota para reintentar y no llama al servidor sin ella', async () => {
    await renderizar();

    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(screen.getByText('Escribe una nota para reintentar.')).toBeTruthy();
    expect(screen.getByLabelText('Nota del reintento').getAttribute('aria-invalid')).toBe('true');
    expect(reintentar).not.toHaveBeenCalled();
  });

  it('una nota de solo espacios tampoco vale', async () => {
    await renderizar();

    await userEvent.type(screen.getByLabelText('Nota del reintento'), '    ');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(screen.getByText('Escribe una nota para reintentar.')).toBeTruthy();
    expect(reintentar).not.toHaveBeenCalled();
  });

  it('reintenta con la nota sin espacios sobrantes y avisa a la lista (CA-3)', async () => {
    await renderizar();

    await userEvent.type(screen.getByLabelText('Nota del reintento'), '  Pasarela restablecida  ');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(reintentar).toHaveBeenCalledWith('acc-0004', 'Pasarela restablecida');
    expect(reintentada).toHaveBeenCalledWith('acc-0004');
  });

  it('si otro analista ya lo reintentó lo explica, no repite nada y ofrece actualizar la lista (CA-7)', async () => {
    await renderizar({ reintento: falla('issuance_not_retryable') });

    await userEvent.type(screen.getByLabelText('Nota del reintento'), 'otra');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Ya no hay nada que reintentar');
    expect(reintentada).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar lista' }));
    expect(reintentada).toHaveBeenCalledWith('acc-0004');
  });

  it('ante una falla del servicio deja reintentar con la misma nota', async () => {
    await renderizar({ reintento: falla('charge_unavailable') });

    await userEvent.type(screen.getByLabelText('Nota del reintento'), 'intento');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect((await screen.findByRole('alert')).textContent).toContain('No pudimos reintentar');
    expect((screen.getByLabelText('Nota del reintento') as HTMLTextAreaElement).value).toBe('intento');
    expect((screen.getByRole('button', { name: 'Reintentar' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('no muestra aviso propio ante un 401 o un 403, que resuelve el interceptor', async () => {
    await renderizar({ reintento: falla('forbidden') });

    await userEvent.type(screen.getByLabelText('Nota del reintento'), 'intento');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(screen.queryByRole('alert')).toBeNull();
    expect(reintentada).not.toHaveBeenCalled();
  });

  it('una emisión sin excepción solo se consulta: sin formulario y sin ninguna acción (CA-5)', async () => {
    await renderizar({ emision: mapearEmision(EMISION_NOTIFICADA_DTO) });

    expect(screen.getByRole('dialog', { name: 'Detalle de la emisión' })).toBeTruthy();
    expect(screen.getByText('Documento generado y notificado')).toBeTruthy();
    expect(screen.getByText('pol-acc-0006')).toBeTruthy();
    expect(screen.queryByLabelText('Nota del reintento')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
    await userEvent.click(screen.getAllByRole('button', { name: 'Cerrar' })[1]);
    expect(cerrar).toHaveBeenCalledTimes(1);
  });

  it('se cierra con Cancelar, con la equis, con el velo y con Escape', async () => {
    const { container } = await renderizar();

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    fireEvent.click(container.querySelector('.velo') as Element);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(cerrar).toHaveBeenCalledTimes(4);
  });

  it('el foco no sale del diálogo con Tab', async () => {
    await renderizar();
    screen.getByRole('button', { name: 'Reintentar' }).focus();

    await userEvent.tab();

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cerrar' }));
  });
});
