import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { OPCIONES_RADICACION_DTO } from '@testing/siniestros-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { RequisitoSoporte, mapearOpcionesRadicacion } from '@core/api/siniestros/radicacion.modelos';

import { requisitosDelTipo, soportesNoAplica } from '../../modelos/formulario-radicacion';
import { ArchivoSoporte } from '../../servicios/carga-soportes.service';
import { AgregarArchivos, QuitarArchivo, SoportesRadicacionComponent } from './soportes-radicacion.component';

const [AUTOS] = mapearOpcionesRadicacion(OPCIONES_RADICACION_DTO).polizas;
const COLISION = requisitosDelTipo(AUTOS, 'collision');
const HURTO = requisitosDelTipo(AUTOS, 'theft');

const archivo = (clave: number, cambios: Partial<ArchivoSoporte> = {}): ArchivoSoporte => ({
  clave,
  nombre: `foto-${clave}.jpg`,
  tamanoBytes: 482113,
  estado: 'adjunto',
  soporteId: `sup-${clave}`,
  motivo: null,
  ...cambios,
});

describe('SoportesRadicacionComponent (A6 · HU-W2.1-01)', () => {
  async function renderizar(entradas: {
    requisitos?: readonly RequisitoSoporte[];
    noAplica?: readonly RequisitoSoporte[];
    archivos?: Record<string, readonly ArchivoSoporte[]>;
    erroresServidor?: Record<string, 'falta' | 'noEncontrado'>;
    deshabilitado?: boolean;
  } = {}) {
    const agregar = vi.fn<(evento: AgregarArchivos) => void>();
    const quitar = vi.fn<(evento: QuitarArchivo) => void>();
    await render(SoportesRadicacionComponent, {
      imports: [proveerTranslocoPruebas()],
      inputs: { requisitos: COLISION, noAplica: soportesNoAplica(AUTOS, 'collision'), ...entradas },
      on: { agregar, quitar },
    });
    return { agregar, quitar, usuario: userEvent.setup({ applyAccept: false }) };
  }

  const fila = (nombre: string) => screen.getByText(nombre).closest('li') as HTMLElement;

  it('cuenta los obligatorios adjuntos y muestra el estado de cada soporte con texto', async () => {
    await renderizar({
      archivos: {
        vehicle_photos: [1, 2, 3, 4, 5, 6].map((clave) => archivo(clave)),
        driver_document: [archivo(7)],
      },
    });

    expect(screen.getByText('2 de 3 obligatorios adjuntos')).toBeTruthy();
    expect(within(fila('Fotos del vehículo (mínimo 4)')).getByText('Adjunto · 6 archivos')).toBeTruthy();
    expect(within(fila('Documento del conductor')).getByText('Adjunto', { selector: 'app-insignia-estado' })).toBeTruthy();
    expect(within(fila('Informe de tránsito o croquis')).getByText('Falta')).toBeTruthy();
    expect(within(fila('Documento del conductor')).getByText('Obligatorio · PDF o imagen · máx. 10 MB c/u · hasta 2')).toBeTruthy();
  });

  it('un soporte opcional con un archivo queda «Adjunto» y no exige mínimo', async () => {
    await renderizar({ requisitos: HURTO, archivos: { vehicle_photos: [archivo(1)] } });

    const fotos = fila('Fotos del vehículo');
    expect(within(fotos).getAllByText('Adjunto').length).toBeGreaterThan(0);
    expect(within(fotos).getByText('Opcional · JPG o PNG · máx. 10 MB c/u · hasta 10')).toBeTruthy();
  });

  it('un soporte opcional sin archivos dice «Opcional» y no «Falta»', async () => {
    await renderizar({ requisitos: HURTO });

    const fotos = fila('Fotos del vehículo');
    expect(within(fotos).getAllByText('Opcional').length).toBeGreaterThan(0);
    expect(within(fotos).queryByText('Falta')).toBeNull();
  });

  it('con menos del mínimo indica cuántos tiene de los que pide', async () => {
    await renderizar({ archivos: { vehicle_photos: [archivo(1), archivo(2), archivo(3)] } });

    expect(within(fila('Fotos del vehículo (mínimo 4)')).getByText('3 de 4 mínimo')).toBeTruthy();
  });

  it('lista los soportes de otros tipos como «No aplica» y sin acción de subir', async () => {
    await renderizar();

    const denuncia = fila('Denuncia ante autoridad');
    expect(within(denuncia).getByText('No aplica')).toBeTruthy();
    expect(within(denuncia).getByText('No aplica para este tipo de siniestro')).toBeTruthy();
    expect(within(denuncia).queryByLabelText(/Subir archivos/)).toBeNull();
  });

  it('emite los archivos elegidos con su requisito', async () => {
    const { agregar, usuario } = await renderizar();
    const croquis = new File(['%PDF'], 'croquis.pdf', { type: 'application/pdf' });

    await usuario.upload(screen.getByLabelText('Subir archivos de Informe de tránsito o croquis'), croquis);

    expect(agregar).toHaveBeenCalledWith({ requisito: COLISION[2], archivos: [croquis] });
  });

  it('dice «Subir» sin archivos, «Agregar» con alguno y deshabilita la acción en el máximo', async () => {
    await renderizar({ archivos: { driver_document: [archivo(1), archivo(2)], vehicle_photos: [archivo(3)] } });

    expect(within(fila('Informe de tránsito o croquis')).getByText('Subir')).toBeTruthy();
    expect(within(fila('Fotos del vehículo (mínimo 4)')).getByText('Agregar')).toBeTruthy();
    expect((screen.getByLabelText('Subir archivos de Documento del conductor') as HTMLInputElement).disabled).toBe(true);
  });

  it('muestra cada archivo con su estado y el motivo del rechazo, y emite «Quitar»', async () => {
    const { quitar, usuario } = await renderizar({
      archivos: {
        vehicle_photos: [
          archivo(1, { estado: 'subiendo', soporteId: null }),
          archivo(2, { nombre: 'enorme.jpg', estado: 'rechazado', soporteId: null, motivo: 'file_too_large' }),
          archivo(3, { nombre: 'once.jpg', estado: 'rechazado', soporteId: null, motivo: 'limite' }),
        ],
      },
    });

    expect(screen.getByText('Subiendo…')).toBeTruthy();
    expect(screen.getAllByText('471 KB', { selector: '.archivo__tamano' })).toHaveLength(3);
    const alertas = screen.getAllByRole('alert').map((alerta) => alerta.textContent?.trim());
    expect(alertas).toEqual(['El archivo supera 10 MB.', 'Este soporte admite como máximo 10 archivos.']);

    await usuario.click(screen.getByRole('button', { name: 'Quitar enorme.jpg' }));

    expect(quitar).toHaveBeenCalledWith({ codigo: 'vehicle_photos', clave: 2 });
  });

  it('muestra el problema que devolvió el backend en la fila del soporte', async () => {
    await renderizar({ erroresServidor: { traffic_report: 'noEncontrado' } });

    const entrada = screen.getByLabelText('Subir archivos de Informe de tránsito o croquis');
    expect(entrada.getAttribute('aria-describedby')).toBe('error-soporte-traffic_report');
    expect(screen.getByText('Un archivo ya no está disponible. Quítalo y súbelo de nuevo.')).toBeTruthy();
  });

  it('deshabilitado no deja subir ni quitar', async () => {
    await renderizar({ deshabilitado: true, archivos: { vehicle_photos: [archivo(1)] } });

    expect((screen.getByLabelText('Subir archivos de Fotos del vehículo') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Quitar foto-1.jpg' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
