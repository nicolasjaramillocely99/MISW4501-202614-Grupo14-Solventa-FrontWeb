import { Locator, Page } from '@playwright/test';

/** Page object de P0 · Inicio de sesión del portal (`/acceso/iniciar-sesion`). */
export class InicioSesionPagina {
  readonly correo: Locator;
  readonly contrasena: Locator;
  readonly entrar: Locator;
  readonly aviso: Locator;

  constructor(private readonly page: Page) {
    this.correo = page.getByLabel('Correo electrónico');
    this.contrasena = page.getByLabel('Contraseña');
    this.entrar = page.getByRole('button', { name: 'Entrar' });
    this.aviso = page.getByRole('alert');
  }

  async abrir(): Promise<void> {
    await this.page.goto('/acceso/iniciar-sesion');
    await this.correo.waitFor();
  }

  async ingresar(correo: string, contrasena: string): Promise<void> {
    await this.correo.fill(correo);
    await this.contrasena.fill(contrasena);
    await this.entrar.click();
  }
}
