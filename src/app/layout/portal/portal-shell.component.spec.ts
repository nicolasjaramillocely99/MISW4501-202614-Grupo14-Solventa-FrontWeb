import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { TranslocoService } from '@jsverse/transloco';
import {
  ProveedorIdentidadFalso,
  crearProveedorIdentidadFalso,
  iniciarSesionComo,
  proveerSesionPrueba,
} from '@testing/sesion-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { Rol } from '@core/auth/modelos/rol';
import { SesionService } from '@core/auth/sesion.service';

import { PortalShellComponent } from './portal-shell.component';

@Component({ selector: 'app-pagina-prueba', template: '<p>contenido de la página</p>' })
class PaginaPrueba {}

describe('PortalShellComponent', () => {
  let proveedor: ProveedorIdentidadFalso;

  async function renderizar(rol: Rol, url = '/inicio') {
    proveedor = crearProveedorIdentidadFalso();
    const resultado = await render(PortalShellComponent, {
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter([
          { path: 'inicio', component: PaginaPrueba },
          { path: 'siniestros/cola', component: PaginaPrueba },
          { path: 'siniestros/radicar', component: PaginaPrueba },
          { path: 'acceso/sesion-expirada', component: PaginaPrueba },
          { path: 'acceso/iniciar-sesion', component: PaginaPrueba },
        ]),
        ...proveerSesionPrueba(proveedor),
      ],
    });
    await iniciarSesionComo(rol);
    await TestBed.inject(Router).navigateByUrl(url);
    await resultado.fixture.whenStable();
    return resultado;
  }

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  function textosDelMenu(): string[] {
    const navegacion = screen.getByRole('navigation', { name: 'Navegación principal' });
    return within(navegacion)
      .getAllByRole('link')
      .map((enlace) => enlace.textContent?.trim() ?? '');
  }

  it.each<[Rol, string[]]>([
    ['asegurado', ['Inicio', 'Mis pólizas', 'Mis siniestros', 'Mis solicitudes', 'Mi perfil']],
    ['asesor', ['Inicio', 'Cotizaciones', 'Bandeja de decisión', 'Renovaciones', 'Siniestros']],
    [
      'operaciones',
      ['Inicio', 'Emisiones', 'Endosos', 'Siniestros', 'Asistencias', 'Socios', 'Auditoría', 'Consentimientos'],
    ],
    ['socio', ['Tablero', 'Desempeño técnico', 'Credenciales']],
  ])('muestra el menú propio del rol %s', async (rol, textos) => {
    await renderizar(rol);

    expect(textosDelMenu()).toEqual(textos);
  });

  it('muestra el usuario con su rol, el módulo activo y el contenido de la página', async () => {
    await renderizar('asesor');

    expect(screen.getByText('Laura Gómez')).toBeTruthy();
    expect(screen.getByText('Asesor comercial')).toBeTruthy();
    expect(screen.getByText('LG')).toBeTruthy();
    expect(screen.getByRole('banner').textContent).toContain('Inicio');
    expect(screen.getByRole('main').textContent).toContain('contenido de la página');
  });

  it('marca el ítem activo con aria-current y nombra el módulo en la barra superior', async () => {
    await renderizar('operaciones', '/siniestros/cola');

    const siniestros = screen.getByRole('link', { name: 'Siniestros' });
    expect(siniestros.getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Inicio' }).getAttribute('aria-current')).toBeNull();
    expect(screen.getByRole('banner').textContent).toContain('Siniestros');
  });

  it('en la radicación del asegurado marca «Mis siniestros» y nombra ese módulo (HU-W2.1-01)', async () => {
    await renderizar('asegurado', '/siniestros/radicar?caso=8f14e45f');

    const misSiniestros = screen.getByRole('link', { name: 'Mis siniestros' });
    expect(misSiniestros.getAttribute('aria-current')).toBe('page');
    expect(misSiniestros.classList.contains('menu__item--activo')).toBe(true);
    expect(screen.getByRole('link', { name: 'Inicio' }).classList.contains('menu__item--activo')).toBe(false);
    expect(screen.getByRole('banner').textContent).toContain('Mis siniestros');
  });

  it('cerrar sesión revoca el token y lleva al inicio de sesión', async () => {
    await renderizar('asegurado');

    await userEvent.setup().click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(proveedor.revocar).toHaveBeenCalledWith('renovacion-asegurado');
    expect(TestBed.inject(Router).url).toBe('/acceso/iniciar-sesion');
  });

  it('si la sesión expira lleva a sesión expirada', async () => {
    const { fixture } = await renderizar('operaciones');

    TestBed.inject(SesionService).marcarExpirada();
    await fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/acceso/sesion-expirada');
  });

  it('conserva el idioma elegido antes de entrar y lo cambia en caliente desde la barra superior', async () => {
    await renderizar('asesor');
    const transloco = TestBed.inject(TranslocoService);
    transloco.setActiveLang('en-US');

    expect(await screen.findByRole('link', { name: 'Quotes' })).toBeTruthy();
    expect(screen.getByRole<HTMLSelectElement>('combobox', { name: 'Language' }).value).toBe('en-US');

    await userEvent
      .setup()
      .selectOptions(screen.getByRole('combobox', { name: 'Language' }), 'es-CO');

    expect(await screen.findByRole('link', { name: 'Cotizaciones' })).toBeTruthy();
    expect(transloco.getActiveLang()).toBe('es-CO');
  });
});
