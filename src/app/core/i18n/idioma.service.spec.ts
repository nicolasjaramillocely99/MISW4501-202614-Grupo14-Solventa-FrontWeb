import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';

import { CLAVE_PREFERENCIA_IDIOMA, IdiomaService } from './idioma.service';

describe('IdiomaService', () => {
  let servicio: IdiomaService;
  let transloco: TranslocoService;
  let documento: Document;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [proveerTranslocoPruebas()] });
    servicio = TestBed.inject(IdiomaService);
    transloco = TestBed.inject(TranslocoService);
    documento = TestBed.inject(DOCUMENT);
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('ofrece es-CO y en-US y empieza en el idioma predeterminado', () => {
    expect(servicio.disponibles).toEqual(['es-CO', 'en-US']);
    expect(servicio.idioma()).toBe('es-CO');
  });

  it('cambia el idioma en caliente, actualiza lang del documento y recuerda la elección', () => {
    servicio.cambiar('en-US');

    expect(transloco.getActiveLang()).toBe('en-US');
    expect(servicio.idioma()).toBe('en-US');
    expect(documento.documentElement.lang).toBe('en-US');
    expect(localStorage.getItem(CLAVE_PREFERENCIA_IDIOMA)).toBe('en-US');
    expect(transloco.translate('acceso.iniciarSesion.titulo')).toBe('Sign in');
  });

  it('ignora un idioma que el portal no ofrece', () => {
    servicio.cambiar('fr-FR');

    expect(transloco.getActiveLang()).toBe('es-CO');
    expect(localStorage.getItem(CLAVE_PREFERENCIA_IDIOMA)).toBeNull();
  });

  it('sigue los cambios hechos directamente sobre Transloco', () => {
    transloco.setActiveLang('en-US');

    expect(servicio.idioma()).toBe('en-US');
  });

  it('restaura la preferencia guardada', () => {
    localStorage.setItem(CLAVE_PREFERENCIA_IDIOMA, 'en-US');

    servicio.restaurar();

    expect(transloco.getActiveLang()).toBe('en-US');
    expect(documento.documentElement.lang).toBe('en-US');
  });

  it('sin preferencia válida conserva el idioma predeterminado y lo declara en el documento', () => {
    localStorage.setItem(CLAVE_PREFERENCIA_IDIOMA, 'xx-XX');

    servicio.restaurar();

    expect(transloco.getActiveLang()).toBe('es-CO');
    expect(documento.documentElement.lang).toBe('es-CO');
  });

  it('funciona sin almacenamiento disponible (modo privado estricto)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('sin almacenamiento');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('sin almacenamiento');
    });

    servicio.restaurar();
    servicio.cambiar('en-US');

    expect(transloco.getActiveLang()).toBe('en-US');
  });
});
