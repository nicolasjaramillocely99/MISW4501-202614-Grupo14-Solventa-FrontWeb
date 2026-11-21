import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { POLITICA_ASISTENCIA_DTO } from '@testing/asistencia-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { CampoInvalido } from '@core/api/siniestros/asignacion.modelos';

import { CierreAsistenciaComponent } from './cierre-asistencia.component';

const MOTIVOS = POLITICA_ASISTENCIA_DTO.close_reasons;

describe('CierreAsistenciaComponent (O9b · HU-W2.3-03, S16, CA-4)', () => {
  /** Como en la página: el formulario no tiene botón propio; lo envía uno de fuera con `form`. */
  const renderizar = async (erroresServidor: CampoInvalido[] = []) => {
    const cerrar = vi.fn();
    const vista = await render(
      `<app-cierre-asistencia [motivos]="motivos" [erroresServidor]="errores" (cerrar)="cerrar($event)" />
       <button type="submit" form="cierre-asistencia">Cerrar solicitud</button>`,
      {
        imports: [CierreAsistenciaComponent, proveerTranslocoPruebas()],
        componentProperties: { motivos: MOTIVOS, errores: erroresServidor, cerrar },
      },
    );
    return { ...vista, cerrar, usuario: userEvent.setup() };
  };

  const motivo = () =>
    screen.getByRole('combobox', { name: 'Motivo de la resolución' }) as HTMLSelectElement;
  const nota = () => screen.getByRole('textbox', { name: /^Nota/ }) as HTMLTextAreaElement;
  const enviar = () => screen.getByRole('button', { name: 'Cerrar solicitud' });

  it('ofrece los motivos de la política, sin ninguno elegido', async () => {
    await renderizar();

    expect(screen.getByRole('form', { name: 'Cerrar por otro medio' })).toBeTruthy();
    expect([...motivo().options].map((o) => o.textContent?.trim())).toEqual([
      'Selecciona un motivo',
      'Resuelto durante la llamada',
      'Solicitud repetida',
      'Cancelada por el asegurado',
      'No cubierta por la póliza',
      'Sin prestador disponible',
      'Otro',
    ]);
    expect(motivo().value).toBe('');
  });

  it('sin motivo no cierra: marca el campo y le lleva el foco', async () => {
    const { cerrar, usuario } = await renderizar();

    await usuario.click(enviar());

    expect(cerrar).not.toHaveBeenCalled();
    expect(motivo().getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Elige el motivo de la resolución.')).toBeTruthy();
    expect(document.activeElement).toBe(motivo());
  });

  it('con un motivo que no exige nota, cierra sin ella', async () => {
    const { cerrar, usuario } = await renderizar();

    expect(nota().labels?.[0].textContent).toContain('Opcional');
    await usuario.selectOptions(motivo(), 'resolved_by_phone');
    await usuario.click(enviar());

    expect(cerrar).toHaveBeenCalledWith({ motivo: 'resolved_by_phone' });
  });

  it('con «Otro» la nota es obligatoria y viaja sin espacios en los bordes', async () => {
    const { cerrar, usuario } = await renderizar();

    await usuario.selectOptions(motivo(), 'other');
    expect(nota().labels?.[0].textContent).toContain('Obligatoria');
    expect(nota().required).toBe(true);

    await usuario.click(enviar());
    expect(cerrar).not.toHaveBeenCalled();
    expect(screen.getByText('Escribe una nota: es obligatoria con «Otro».')).toBeTruthy();
    expect(document.activeElement).toBe(nota());

    await usuario.type(nota(), '  Le pasaron corriente  ');
    await usuario.click(enviar());
    expect(cerrar).toHaveBeenCalledWith({ motivo: 'other', nota: 'Le pasaron corriente' });
  });

  it('cuenta los caracteres y marca una nota corta al salir del campo', async () => {
    const { usuario } = await renderizar();

    expect(screen.getByText('0/500 caracteres')).toBeTruthy();
    await usuario.type(nota(), 'ab');
    expect(screen.getByText('2/500 caracteres')).toBeTruthy();
    expect(nota().maxLength).toBe(500);
    await usuario.tab();

    expect(screen.getByText('La nota debe tener entre 3 y 500 caracteres.')).toBeTruthy();
    expect(nota().getAttribute('aria-invalid')).toBe('true');
  });

  it('marca en su campo lo que rechazó el servidor', async () => {
    await renderizar([
      { campo: 'reason', codigo: 'required' },
      { campo: 'note', codigo: 'invalid_format' },
    ]);

    expect(screen.getByText('Elige el motivo de la resolución.')).toBeTruthy();
    expect(screen.getByText('La nota tiene caracteres no permitidos.')).toBeTruthy();
  });

  it('elegirMotivo() deja el motivo elegido y enfoca el formulario', async () => {
    const { fixture, cerrar, usuario } = await renderizar();
    const componente = fixture.debugElement.children[0]
      .componentInstance as CierreAsistenciaComponent;

    componente.elegirMotivo('no_provider_available');
    fixture.detectChanges();

    expect(motivo().value).toBe('no_provider_available');
    expect(document.activeElement).toBe(motivo());
    await usuario.click(enviar());
    expect(cerrar).toHaveBeenCalledWith({ motivo: 'no_provider_available' });
  });
});
