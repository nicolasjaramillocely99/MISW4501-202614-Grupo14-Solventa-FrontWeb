import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import {
  ProveedorIdentidadFalso,
  crearProveedorIdentidadFalso,
  crearTokensPrueba,
  proveerSesionPrueba,
} from '@testing/sesion-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { ErrorIdentidad, MotivoErrorIdentidad } from '@core/auth/proveedor-identidad';
import { SesionService } from '@core/auth/sesion.service';

import { IniciarSesionPage } from './iniciar-sesion.page';

describe('IniciarSesionPage (P0)', () => {
  let proveedor: ProveedorIdentidadFalso;
  let navegar: ReturnType<typeof vi.spyOn>;

  async function renderizar(returnUrl: string | null = null) {
    proveedor = crearProveedorIdentidadFalso();
    await render(IniciarSesionPage, {
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter([]),
        ...proveerSesionPrueba(proveedor),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap(returnUrl ? { returnUrl } : {}) },
          },
        },
      ],
    });
    navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  }

  async function ingresar(correo: string, contrasena: string) {
    const usuario = userEvent.setup();
    if (correo) {
      await usuario.type(screen.getByLabelText('Correo electrónico'), correo);
    }
    if (contrasena) {
      await usuario.type(screen.getByLabelText('Contraseña'), contrasena);
    }
    await usuario.click(screen.getByRole('button', { name: 'Entrar' }));
  }

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('muestra el formulario con etiquetas permanentes y un único encabezado', async () => {
    await renderizar();

    expect(screen.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeTruthy();
    expect(screen.getByLabelText('Correo electrónico').getAttribute('autocomplete')).toBe('username');
    expect(screen.getByLabelText('Contraseña').getAttribute('type')).toBe('password');
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getAllByRole('heading')).toHaveLength(1);
  });

  it('valida cada campo sin llamar al proveedor y enfoca el primero inválido', async () => {
    await renderizar();

    await ingresar('', '');

    expect(screen.getByText('Escribe tu correo electrónico.')).toBeTruthy();
    expect(screen.getByText('Escribe tu contraseña.')).toBeTruthy();
    const correo = screen.getByLabelText('Correo electrónico');
    expect(correo.getAttribute('aria-invalid')).toBe('true');
    expect(correo.getAttribute('aria-describedby')).toBe('correo-error');
    expect(document.activeElement).toBe(correo);
    expect(proveedor.iniciarSesion).not.toHaveBeenCalled();
  });

  it('pide un correo con formato válido y enfoca la contraseña si solo ella falta', async () => {
    await renderizar();

    await ingresar('laura', '');
    expect(screen.getByText('Escribe un correo válido, por ejemplo nombre@empresa.co.')).toBeTruthy();

    await userEvent.setup().type(screen.getByLabelText('Correo electrónico'), '@solventa.co');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Entrar' }));
    expect(document.activeElement).toBe(screen.getByLabelText('Contraseña'));
  });

  it('inicia sesión y entra al inicio', async () => {
    await renderizar();
    proveedor.iniciarSesion.mockResolvedValue(crearTokensPrueba('asesor'));

    await ingresar('  asesor@solventa.co ', 'clave-correcta');

    expect(proveedor.iniciarSesion).toHaveBeenCalledWith('asesor@solventa.co', 'clave-correcta');
    expect(TestBed.inject(SesionService).rol()).toBe('asesor');
    expect(navegar).toHaveBeenCalledWith('/inicio');
  });

  it.each([
    ['/originacion/polizas?pagina=2', '/originacion/polizas?pagina=2'],
    ['//sitio-externo.example', '/inicio'],
    ['/\\sitio-externo.example', '/inicio'],
    ['https://sitio-externo.example', '/inicio'],
    ['/acceso/sesion-expirada', '/inicio'],
  ])('con returnUrl %s entra a %s', async (returnUrl, destino) => {
    await renderizar(returnUrl);
    proveedor.iniciarSesion.mockResolvedValue(crearTokensPrueba('asegurado'));

    await ingresar('asegurado@solventa.co', 'clave-correcta');

    expect(navegar).toHaveBeenCalledWith(destino);
  });

  it.each<[MotivoErrorIdentidad | 'otro', string]>([
    ['credenciales-invalidas', 'El correo o la contraseña no son correctos.'],
    ['servicio-no-disponible', 'No pudimos conectar con el servicio de acceso. Intenta de nuevo en unos minutos.'],
    ['sesion-invalida', 'No pudimos conectar con el servicio de acceso. Intenta de nuevo en unos minutos.'],
    ['accion-requerida', 'Tu cuenta necesita una acción adicional antes de ingresar. Contacta al administrador del portal.'],
    ['sin-rol', 'Tu usuario no tiene un rol asignado en el portal. Contacta al administrador.'],
    ['otro', 'No pudimos conectar con el servicio de acceso. Intenta de nuevo en unos minutos.'],
  ])('ante %s muestra el aviso y borra la contraseña', async (motivo, mensaje) => {
    await renderizar();
    proveedor.iniciarSesion.mockRejectedValue(
      motivo === 'otro' ? new Error('inesperado') : new ErrorIdentidad(motivo),
    );

    await ingresar('laura@solventa.co', 'clave-incorrecta');

    expect(screen.getByRole('alert').textContent).toContain(mensaje);
    expect((screen.getByLabelText('Contraseña') as HTMLInputElement).value).toBe('');
    expect(navegar).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Entrar' }).hasAttribute('disabled')).toBe(false);
  });

  it('mientras inicia sesión deshabilita el botón y no envía dos veces', async () => {
    await renderizar();
    let resolver: (valor: ReturnType<typeof crearTokensPrueba>) => void = () => undefined;
    proveedor.iniciarSesion.mockReturnValue(new Promise((r) => (resolver = r)));

    await ingresar('laura@solventa.co', 'clave');

    const boton = screen.getByRole('button', { name: 'Ingresando…' });
    expect(boton.hasAttribute('disabled')).toBe(true);
    expect(boton.getAttribute('aria-busy')).toBe('true');
    boton.closest('form')?.dispatchEvent(new Event('submit'));
    expect(proveedor.iniciarSesion).toHaveBeenCalledTimes(1);

    resolver(crearTokensPrueba('operaciones'));
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeTruthy();
  });

  it('cambia los textos a inglés en caliente con el selector de idioma y recuerda la elección', async () => {
    await renderizar();
    const usuario = userEvent.setup();

    await usuario.selectOptions(screen.getByRole('combobox', { name: 'Idioma' }), 'en-US');

    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeTruthy();
    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
    expect(screen.getByRole<HTMLSelectElement>('combobox', { name: 'Language' }).value).toBe('en-US');
    expect(localStorage.getItem('solventa.idioma')).toBe('en-US');
  });
});
