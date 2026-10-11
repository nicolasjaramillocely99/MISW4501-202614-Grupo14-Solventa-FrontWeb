import { expect, test } from '@playwright/test';

import { verificarAccesibilidad } from '../../accesibilidad/verificar-accesibilidad';
import {
  CONTRASENA_PRUEBA,
  ROLES_PRUEBA,
  RolPrueba,
  USUARIOS_PRUEBA,
  simularCognito,
} from '../../fixtures/sesion-por-rol';
import { InicioSesionPagina } from '../../paginas/inicio-sesion.pagina';

/** Inicio y menú propios de cada rol (frames A0, S0, O0 y D-12 para el socio). */
const ESPERADO: Readonly<Record<RolPrueba, { titulo: string; menu: string[] }>> = {
  asegurado: {
    titulo: 'Hola, Carolina',
    menu: ['Inicio', 'Mis pólizas', 'Mis siniestros', 'Mis solicitudes', 'Mi perfil'],
  },
  asesor: {
    titulo: 'Hola, Laura',
    menu: ['Inicio', 'Cotizaciones', 'Bandeja de decisión', 'Renovaciones', 'Siniestros'],
  },
  operaciones: {
    titulo: 'Centro de operaciones',
    menu: ['Inicio', 'Emisiones', 'Endosos', 'Siniestros', 'Asistencias', 'Socios', 'Auditoría', 'Consentimientos'],
  },
  socio: { titulo: 'Hola, Banco', menu: ['Tablero', 'Desempeño técnico', 'Credenciales'] },
};

test.describe('Acceso al portal por rol (HA-S01)', () => {
  for (const rol of ROLES_PRUEBA) {
    test(`el usuario con rol ${rol} inicia sesión y ve su inicio y su menú`, async ({ page }) => {
      await simularCognito(page);
      const inicioSesion = new InicioSesionPagina(page);

      await inicioSesion.abrir();
      await inicioSesion.ingresar(USUARIOS_PRUEBA[rol].correo, CONTRASENA_PRUEBA);

      await expect(page).toHaveURL(/\/inicio$/);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(ESPERADO[rol].titulo);
      await expect(
        page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link'),
      ).toHaveText(ESPERADO[rol].menu);
      await expect(page.getByRole('banner')).toContainText(USUARIOS_PRUEBA[rol].nombre);
    });
  }

  test('el inicio del asesor dentro del portal no tiene violaciones de accesibilidad', async ({ page }) => {
    await simularCognito(page);
    const inicioSesion = new InicioSesionPagina(page);
    await inicioSesion.abrir();
    await inicioSesion.ingresar(USUARIOS_PRUEBA.asesor.correo, CONTRASENA_PRUEBA);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hola, Laura');

    await verificarAccesibilidad(page);
  });

  test('con credenciales inválidas muestra un error genérico y no da acceso', async ({ page }) => {
    await simularCognito(page);
    const inicioSesion = new InicioSesionPagina(page);

    await inicioSesion.abrir();
    await inicioSesion.ingresar(USUARIOS_PRUEBA.asesor.correo, 'clave-equivocada');

    await expect(inicioSesion.aviso).toHaveText('El correo o la contraseña no son correctos.');
    await expect(inicioSesion.contrasena).toHaveValue('');
    await expect(page).toHaveURL(/\/acceso\/iniciar-sesion$/);

    await page.goto('/inicio');
    await expect(page).toHaveURL(/\/acceso\/iniciar-sesion\?returnUrl=%2Finicio$/);
  });

  test('si el token de renovación fue revocado, al recargar pide autenticarse de nuevo', async ({ page }) => {
    const cognito = await simularCognito(page);
    const inicioSesion = new InicioSesionPagina(page);
    await inicioSesion.abrir();
    await inicioSesion.ingresar(USUARIOS_PRUEBA.operaciones.correo, CONTRASENA_PRUEBA);
    await expect(page).toHaveURL(/\/inicio$/);

    cognito.renovacionRechazada = true;
    await page.reload();

    await expect(page).toHaveURL(/\/acceso\/sesion-expirada$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tu sesión expiró');
    expect(cognito.llamadas).toContain('InitiateAuth:REFRESH_TOKEN_AUTH');

    await page.getByRole('link', { name: 'Iniciar sesión de nuevo' }).click();
    await expect(page).toHaveURL(/\/acceso\/iniciar-sesion$/);
    await page.goto('/inicio');
    await expect(page).toHaveURL(/\/acceso\/iniciar-sesion\?returnUrl=%2Finicio$/);
  });

  test('cerrar sesión revoca el token y deja el portal protegido', async ({ page }) => {
    const cognito = await simularCognito(page);
    const inicioSesion = new InicioSesionPagina(page);
    await inicioSesion.abrir();
    await inicioSesion.ingresar(USUARIOS_PRUEBA.asegurado.correo, CONTRASENA_PRUEBA);
    await expect(page).toHaveURL(/\/inicio$/);

    await page.getByRole('button', { name: 'Cerrar sesión' }).click();

    await expect(page).toHaveURL(/\/acceso\/iniciar-sesion$/);
    expect(cognito.llamadas).toContain('RevokeToken');
    await page.goto('/inicio');
    await expect(page).toHaveURL(/\/acceso\/iniciar-sesion\?returnUrl=%2Finicio$/);
  });
});
