import { TestBed } from '@angular/core/testing';
import {
  ProveedorIdentidadFalso,
  crearJwtPrueba,
  crearProveedorIdentidadFalso,
  crearTokensPrueba,
  proveerSesionPrueba,
} from '@testing/sesion-pruebas';

import { ErrorIdentidad } from './proveedor-identidad';
import {
  CLAVE_RENOVACION,
  ESPERA_MINIMA_RENOVACION_MS,
  MARGEN_RENOVACION_MS,
  SesionService,
} from './sesion.service';

describe('SesionService', () => {
  let proveedor: ProveedorIdentidadFalso;
  let sesion: SesionService;

  beforeEach(() => {
    sessionStorage.clear();
    proveedor = crearProveedorIdentidadFalso();
    TestBed.configureTestingModule({ providers: proveerSesionPrueba(proveedor) });
    sesion = TestBed.inject(SesionService);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  async function motivoDe(promesa: Promise<unknown>): Promise<string> {
    try {
      await promesa;
    } catch (error) {
      expect(error).toBeInstanceOf(ErrorIdentidad);
      return (error as ErrorIdentidad).motivo;
    }
    throw new Error('se esperaba un ErrorIdentidad');
  }

  describe('iniciarSesion', () => {
    it('arma la sesión con las claims del ID token y guarda solo el token de renovación', async () => {
      proveedor.iniciarSesion.mockResolvedValue(crearTokensPrueba('asesor'));

      const usuario = await sesion.iniciarSesion('asesor@solventa.co', 'clave');

      expect(proveedor.iniciarSesion).toHaveBeenCalledWith('asesor@solventa.co', 'clave');
      expect(usuario).toEqual({
        id: 'sub-asesor',
        correo: 'asesor@solventa.co',
        nombre: 'Laura Gómez',
        rol: 'asesor',
        socioId: null,
      });
      expect(sesion.autenticado()).toBe(true);
      expect(sesion.rol()).toBe('asesor');
      expect(sesion.usuario()).toEqual(usuario);
      expect(sesion.idToken()).toBe(sesion.sesion()?.idToken);
      expect(sesion.expirada()).toBe(false);
      expect(sessionStorage.getItem(CLAVE_RENOVACION)).toBe('renovacion-asesor');
      // Los tokens de acceso nunca se persisten.
      expect(JSON.stringify(sessionStorage)).not.toContain(sesion.idToken());
    });

    it('lee la titularidad del socio de custom:partner_id', async () => {
      proveedor.iniciarSesion.mockResolvedValue(crearTokensPrueba('socio'));

      const usuario = await sesion.iniciarSesion('socio@solventa.co', 'clave');

      expect(usuario.rol).toBe('socio');
      expect(usuario.socioId).toBe('socio-001');
    });

    it('usa el correo como nombre si el token no trae name', async () => {
      proveedor.iniciarSesion.mockResolvedValue(
        crearTokensPrueba('operaciones', { claims: { name: undefined } }),
      );

      const usuario = await sesion.iniciarSesion('operaciones@solventa.co', 'clave');

      expect(usuario.nombre).toBe('operaciones@solventa.co');
    });

    it('rechaza a un usuario sin grupo del portal y revoca su token de renovación', async () => {
      proveedor.iniciarSesion.mockResolvedValue(crearTokensPrueba('asesor', { grupos: ['admin'] }));

      expect(await motivoDe(sesion.iniciarSesion('x@solventa.co', 'clave'))).toBe('sin-rol');
      expect(proveedor.revocar).toHaveBeenCalledWith('renovacion-asesor');
      expect(sesion.autenticado()).toBe(false);
      expect(sessionStorage.getItem(CLAVE_RENOVACION)).toBeNull();
    });

    it('rechaza un usuario sin grupos aunque no haya token de renovación que revocar', async () => {
      proveedor.iniciarSesion.mockResolvedValue(
        crearTokensPrueba('asesor', { claims: { 'cognito:groups': undefined }, sinRenovacion: true }),
      );

      expect(await motivoDe(sesion.iniciarSesion('x@solventa.co', 'clave'))).toBe('sin-rol');
      expect(proveedor.revocar).not.toHaveBeenCalled();
    });

    it.each([
      ['un ID token malformado', { idToken: 'no-es-jwt', accessToken: 'a' }],
      [
        'un ID token sin sub',
        { idToken: crearJwtPrueba({ 'cognito:groups': ['advisor'], exp: 9999999999 }), accessToken: 'a' },
      ],
      [
        'un ID token sin exp',
        { idToken: crearJwtPrueba({ sub: 's', 'cognito:groups': ['advisor'] }), accessToken: 'a' },
      ],
    ])('rechaza %s como sesión inválida', async (_caso, tokens) => {
      proveedor.iniciarSesion.mockResolvedValue(tokens);

      expect(await motivoDe(sesion.iniciarSesion('x@solventa.co', 'clave'))).toBe('sesion-invalida');
      expect(sesion.autenticado()).toBe(false);
    });

    it('propaga el error del proveedor sin crear sesión', async () => {
      proveedor.iniciarSesion.mockRejectedValue(new ErrorIdentidad('credenciales-invalidas'));

      expect(await motivoDe(sesion.iniciarSesion('x@solventa.co', 'mala'))).toBe(
        'credenciales-invalidas',
      );
      expect(sesion.autenticado()).toBe(false);
    });
  });

  describe('renovación', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-10-10T12:00:00Z'));
    });

    it('renueva el ID token un minuto antes de que venza', async () => {
      proveedor.iniciarSesion.mockResolvedValue(crearTokensPrueba('operaciones'));
      await sesion.iniciarSesion('operaciones@solventa.co', 'clave');
      const primerToken = sesion.idToken();
      proveedor.refrescar.mockImplementation(async () =>
        crearTokensPrueba('operaciones', { sinRenovacion: true }),
      );

      await vi.advanceTimersByTimeAsync(300_000 - MARGEN_RENOVACION_MS - 1);
      expect(proveedor.refrescar).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);
      expect(proveedor.refrescar).toHaveBeenCalledTimes(1);
      expect(proveedor.refrescar).toHaveBeenCalledWith('renovacion-operaciones');
      expect(sesion.idToken()).not.toBe(primerToken);
      expect(sesion.autenticado()).toBe(true);
      // La renovación no rotó el token: se conserva el anterior.
      expect(sessionStorage.getItem(CLAVE_RENOVACION)).toBe('renovacion-operaciones');
    });

    it('con un token casi vencido espera el mínimo y guarda el token de renovación rotado', async () => {
      proveedor.iniciarSesion.mockResolvedValue(crearTokensPrueba('asegurado', { vigenciaSegundos: 30 }));
      await sesion.iniciarSesion('asegurado@solventa.co', 'clave');
      proveedor.refrescar.mockImplementation(async () => ({
        ...crearTokensPrueba('asegurado'),
        refreshToken: 'renovacion-rotada',
      }));

      await vi.advanceTimersByTimeAsync(ESPERA_MINIMA_RENOVACION_MS - 1);
      expect(proveedor.refrescar).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);
      expect(proveedor.refrescar).toHaveBeenCalledTimes(1);
      expect(sessionStorage.getItem(CLAVE_RENOVACION)).toBe('renovacion-rotada');
    });

    it('si la renovación falla, la sesión expira y no conserva las claims anteriores', async () => {
      proveedor.iniciarSesion.mockResolvedValue(crearTokensPrueba('asesor'));
      await sesion.iniciarSesion('asesor@solventa.co', 'clave');
      proveedor.refrescar.mockRejectedValue(new ErrorIdentidad('sesion-invalida'));

      await vi.advanceTimersByTimeAsync(300_000);

      expect(sesion.expirada()).toBe(true);
      expect(sesion.autenticado()).toBe(false);
      expect(sesion.rol()).toBeNull();
      expect(sesion.idToken()).toBeNull();
      expect(sessionStorage.getItem(CLAVE_RENOVACION)).toBeNull();
    });
  });

  describe('restaurar', () => {
    it('recupera la sesión tras recargar con el token de renovación de sessionStorage', async () => {
      sessionStorage.setItem(CLAVE_RENOVACION, 'renovacion-guardada');
      proveedor.refrescar.mockResolvedValue(crearTokensPrueba('asegurado', { sinRenovacion: true }));

      const [primera, segunda] = await Promise.all([sesion.restaurar(), sesion.restaurar()]);

      expect(primera).toBe(true);
      expect(segunda).toBe(true);
      expect(proveedor.refrescar).toHaveBeenCalledTimes(1);
      expect(proveedor.refrescar).toHaveBeenCalledWith('renovacion-guardada');
      expect(sesion.rol()).toBe('asegurado');
    });

    it('sin token de renovación no hay nada que recuperar', async () => {
      expect(await sesion.restaurar()).toBe(false);
      expect(proveedor.refrescar).not.toHaveBeenCalled();
      expect(sesion.expirada()).toBe(false);
    });

    it('con una sesión activa no llama al proveedor', async () => {
      proveedor.iniciarSesion.mockResolvedValue(crearTokensPrueba('socio'));
      await sesion.iniciarSesion('socio@solventa.co', 'clave');

      expect(await sesion.restaurar()).toBe(true);
      expect(proveedor.refrescar).not.toHaveBeenCalled();
    });

    it('si el token de renovación fue revocado o venció, la sesión queda expirada', async () => {
      sessionStorage.setItem(CLAVE_RENOVACION, 'revocado');
      proveedor.refrescar.mockRejectedValue(new ErrorIdentidad('sesion-invalida'));

      expect(await sesion.restaurar()).toBe(false);
      expect(sesion.expirada()).toBe(true);
      expect(sessionStorage.getItem(CLAVE_RENOVACION)).toBeNull();
    });
  });

  describe('cerrarSesion y marcarExpirada', () => {
    it('cerrar sesión revoca el token de renovación y borra la sesión', async () => {
      proveedor.iniciarSesion.mockResolvedValue(crearTokensPrueba('asesor'));
      await sesion.iniciarSesion('asesor@solventa.co', 'clave');

      await sesion.cerrarSesion();

      expect(proveedor.revocar).toHaveBeenCalledWith('renovacion-asesor');
      expect(sesion.autenticado()).toBe(false);
      expect(sesion.expirada()).toBe(false);
      expect(sessionStorage.getItem(CLAVE_RENOVACION)).toBeNull();
    });

    it('cerrar sesión no falla si la revocación falla ni si no hay token que revocar', async () => {
      proveedor.iniciarSesion.mockResolvedValue(crearTokensPrueba('asesor'));
      await sesion.iniciarSesion('asesor@solventa.co', 'clave');
      proveedor.revocar.mockRejectedValue(new ErrorIdentidad('servicio-no-disponible'));

      await expect(sesion.cerrarSesion()).resolves.toBeUndefined();
      await expect(sesion.cerrarSesion()).resolves.toBeUndefined();
      expect(proveedor.revocar).toHaveBeenCalledTimes(1);
      expect(sesion.autenticado()).toBe(false);
    });

    it('marcar expirada borra la sesión y lo indica', async () => {
      proveedor.iniciarSesion.mockResolvedValue(crearTokensPrueba('operaciones'));
      await sesion.iniciarSesion('operaciones@solventa.co', 'clave');

      sesion.marcarExpirada();

      expect(sesion.expirada()).toBe(true);
      expect(sesion.autenticado()).toBe(false);
      expect(sessionStorage.getItem(CLAVE_RENOVACION)).toBeNull();
    });

    it('un inicio de sesión nuevo limpia el estado de expirada', async () => {
      sesion.marcarExpirada();
      proveedor.iniciarSesion.mockResolvedValue(crearTokensPrueba('asesor'));

      await sesion.iniciarSesion('asesor@solventa.co', 'clave');

      expect(sesion.expirada()).toBe(false);
    });
  });

  it('funciona sin sessionStorage (la sesión dura lo que dure la página)', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    proveedor.iniciarSesion.mockResolvedValue(crearTokensPrueba('asesor'));

    await sesion.iniciarSesion('asesor@solventa.co', 'clave');
    expect(sesion.autenticado()).toBe(true);

    await sesion.cerrarSesion();
    expect(proveedor.revocar).not.toHaveBeenCalled();
    expect(await sesion.restaurar()).toBe(false);
  });

  it('cancela la renovación programada al destruir el inyector', async () => {
    vi.useFakeTimers();
    proveedor.iniciarSesion.mockResolvedValue(crearTokensPrueba('asesor'));
    await sesion.iniciarSesion('asesor@solventa.co', 'clave');

    TestBed.resetTestingModule();
    await vi.advanceTimersByTimeAsync(300_000);

    expect(proveedor.refrescar).not.toHaveBeenCalled();
  });
});
