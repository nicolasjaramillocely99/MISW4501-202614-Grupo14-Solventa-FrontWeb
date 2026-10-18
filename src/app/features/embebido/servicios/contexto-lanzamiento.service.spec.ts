import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { CONTEXTO_LANZAMIENTO, codificarContexto } from '@testing/contexto-lanzamiento-pruebas';

import { ContextoAliadoService } from '@core/aliado/contexto-aliado.service';

import {
  ContextoLanzamientoService,
  LIMITES_CONTEXTO,
  ResultadoContexto,
} from './contexto-lanzamiento.service';
import { FlujoEmbebidoService } from './flujo-embebido.service';

/** Copia del contexto válido con un cambio puntual en `solicitud` o `cliente`. */
function con(cambios: {
  raiz?: Record<string, unknown>;
  solicitud?: Record<string, unknown>;
  cliente?: Record<string, unknown>;
}) {
  return {
    ...CONTEXTO_LANZAMIENTO,
    ...cambios.raiz,
    solicitud: { ...CONTEXTO_LANZAMIENTO.solicitud, ...cambios.solicitud },
    cliente: { ...CONTEXTO_LANZAMIENTO.cliente, ...cambios.cliente },
  };
}

describe('ContextoLanzamientoService (HU-W1.2-01)', () => {
  let servicio: ContextoLanzamientoService;
  let flujo: FlujoEmbebidoService;
  let aliado: ContextoAliadoService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    servicio = TestBed.inject(ContextoLanzamientoService);
    flujo = TestBed.inject(FlujoEmbebidoService);
    aliado = TestBed.inject(ContextoAliadoService);
  });

  function cargar(contexto: unknown): ResultadoContexto {
    return servicio.cargar(codificarContexto(contexto));
  }

  function noPublicaNada(): void {
    expect(servicio.cliente()).toBeNull();
    expect(servicio.aliadoId()).toBeNull();
    expect(flujo.solicitud()).toBeNull();
    expect(aliado.nombre()).toBeNull();
  }

  describe('contexto válido', () => {
    it('publica el cliente, la solicitud y el aliado', () => {
      expect(cargar(CONTEXTO_LANZAMIENTO)).toEqual({ estado: 'valido' });

      expect(servicio.cliente()).toEqual(CONTEXTO_LANZAMIENTO.cliente);
      expect(servicio.aliadoId()).toBe('aliado-banco-1');
      expect(servicio.consentimiento()).toBeNull();
      expect(flujo.solicitud()).toEqual({
        numero: '48213',
        aliado: 'Banco Aliado',
        banco: 'Banco Aliado',
        montoAprobado: 250000000,
        plazoAnios: 20,
        cuotaEstimada: 2180000,
        moneda: 'COP',
      });
      expect(aliado.nombre()).toBe('Banco Aliado');
    });

    it('acepta el base64url con relleno y los caracteres UTF-8', () => {
      const conRelleno = `${codificarContexto(CONTEXTO_LANZAMIENTO)}==`;

      expect(servicio.cargar(conRelleno)).toEqual({ estado: 'valido' });
      expect(servicio.cliente()?.nombreCompleto).toBe('Ana María Pérez');
    });

    it('no persiste nada en el navegador', () => {
      cargar(CONTEXTO_LANZAMIENTO);

      expect(localStorage.length).toBe(0);
      expect(sessionStorage.length).toBe(0);
    });

    it('guarda el comprobante del consentimiento', () => {
      cargar(CONTEXTO_LANZAMIENTO);

      servicio.registrarConsentimiento({ id: 'cns-1', fecha: '2026-10-18T02:48:14Z' });

      expect(servicio.consentimiento()).toEqual({ id: 'cns-1', fecha: '2026-10-18T02:48:14Z' });
    });

    it('descarta el consentimiento de un contexto anterior al cargar uno nuevo', () => {
      cargar(CONTEXTO_LANZAMIENTO);
      servicio.registrarConsentimiento({ id: 'cns-1', fecha: '2026-10-18T02:48:14Z' });

      cargar(con({ solicitud: { numero: '99999' } }));

      expect(servicio.consentimiento()).toBeNull();
    });
  });

  describe('contexto inválido', () => {
    it('rechaza un base64 roto', () => {
      expect(servicio.cargar('esto no es base64!')).toEqual({
        estado: 'invalido',
        motivo: 'codificacion',
        campo: undefined,
      });
      noPublicaNada();
    });

    it('rechaza un base64 que no decodifica a JSON', () => {
      expect(servicio.cargar(btoa('{no es json'))).toMatchObject({
        estado: 'invalido',
        motivo: 'codificacion',
      });
      noPublicaNada();
    });

    it('rechaza bytes que no son UTF-8', () => {
      expect(servicio.cargar(btoa('\xff\xfe\xfd'))).toMatchObject({
        estado: 'invalido',
        motivo: 'codificacion',
      });
    });

    it('rechaza un JSON que no es un objeto', () => {
      expect(cargar([1, 2])).toMatchObject({ estado: 'invalido', motivo: 'estructura' });
      expect(cargar('texto')).toMatchObject({ estado: 'invalido', motivo: 'estructura' });
      expect(cargar(null)).toMatchObject({ estado: 'invalido', motivo: 'estructura' });
    });

    it('rechaza un valor demasiado grande', () => {
      expect(servicio.cargar('A'.repeat(LIMITES_CONTEXTO.tamanoMaximo + 1))).toMatchObject({
        estado: 'invalido',
        motivo: 'demasiado-grande',
      });
    });

    it.each([
      ['aliado', (c: Record<string, unknown>) => ({ ...c, aliado: undefined })],
      ['aliadoId', (c: Record<string, unknown>) => ({ ...c, aliadoId: undefined })],
      ['banco', (c: Record<string, unknown>) => ({ ...c, banco: undefined })],
      ['solicitud', (c: Record<string, unknown>) => ({ ...c, solicitud: undefined })],
      ['cliente', (c: Record<string, unknown>) => ({ ...c, cliente: undefined })],
    ])('rechaza un contexto sin %s', (campo, quitar) => {
      expect(cargar(quitar({ ...CONTEXTO_LANZAMIENTO }))).toEqual({
        estado: 'invalido',
        motivo: 'campo',
        campo,
      });
      noPublicaNada();
    });

    it.each([
      ['solicitud.numero', con({ solicitud: { numero: undefined } })],
      ['solicitud.numero', con({ solicitud: { numero: 'con espacio' } })],
      ['solicitud.montoAprobado', con({ solicitud: { montoAprobado: '250000000' } })],
      ['solicitud.plazoAnios', con({ solicitud: { plazoAnios: undefined } })],
      ['solicitud.cuotaEstimada', con({ solicitud: { cuotaEstimada: 0 } })],
      ['solicitud.moneda', con({ solicitud: { moneda: 'USD' } })],
      ['cliente.id', con({ cliente: { id: '' } })],
      ['cliente.id', con({ cliente: { id: 'cliente 1' } })],
      ['cliente.nombreCompleto', con({ cliente: { nombreCompleto: 'Al' } })],
      ['cliente.nombreCompleto', con({ cliente: { nombreCompleto: '12345' } })],
      ['cliente.documento', con({ cliente: { documento: '12' } })],
      ['cliente.documento', con({ cliente: { documento: '1020-3040' } })],
      ['cliente.correo', con({ cliente: { correo: 'sin-arroba' } })],
      ['cliente.fechaNacimiento', con({ cliente: { fechaNacimiento: 'ayer' } })],
    ])('señala %s cuando es inválido', (campo, contexto) => {
      expect(cargar(contexto)).toEqual({ estado: 'invalido', motivo: 'campo', campo });
      noPublicaNada();
    });

    it('rechaza una fecha de nacimiento que no existe o es futura', () => {
      expect(cargar(con({ cliente: { fechaNacimiento: '2023-02-30' } }))).toMatchObject({
        estado: 'invalido',
        campo: 'cliente.fechaNacimiento',
      });
      expect(cargar(con({ cliente: { fechaNacimiento: '2999-01-01' } }))).toMatchObject({
        estado: 'invalido',
        campo: 'cliente.fechaNacimiento',
      });
      expect(cargar(con({ cliente: { fechaNacimiento: '1899-12-31' } }))).toMatchObject({
        estado: 'invalido',
        campo: 'cliente.fechaNacimiento',
      });
    });
  });

  describe('valores límite de monto y plazo', () => {
    it.each([LIMITES_CONTEXTO.montoMinimo, LIMITES_CONTEXTO.montoMaximo])(
      'acepta el monto límite %s',
      (monto: number) => {
        expect(cargar(con({ solicitud: { montoAprobado: monto } }))).toEqual({ estado: 'valido' });
      },
    );

    // Justo debajo del mínimo, justo encima del máximo, negativo y NaN (que JSON convierte en null).
    it.each([LIMITES_CONTEXTO.montoMinimo - 1, LIMITES_CONTEXTO.montoMaximo + 1, -1, Number.NaN])(
      'rechaza el monto %s',
      (monto: number) => {
        expect(cargar(con({ solicitud: { montoAprobado: monto } }))).toMatchObject({
          estado: 'invalido',
          campo: 'solicitud.montoAprobado',
        });
      },
    );

    it.each([LIMITES_CONTEXTO.plazoMinimoAnios, LIMITES_CONTEXTO.plazoMaximoAnios])(
      'acepta el plazo de %s años',
      (plazo) => {
        expect(cargar(con({ solicitud: { plazoAnios: plazo } }))).toEqual({ estado: 'valido' });
      },
    );

    it.each([0, LIMITES_CONTEXTO.plazoMaximoAnios + 1, 2.5, -3])(
      'rechaza el plazo de %s años',
      (plazo) => {
        expect(cargar(con({ solicitud: { plazoAnios: plazo } }))).toMatchObject({
          estado: 'invalido',
          campo: 'solicitud.plazoAnios',
        });
      },
    );
  });

  describe('cargarDesde (URL)', () => {
    function rutaCon(contexto: string | null): ActivatedRoute {
      return {
        snapshot: { queryParamMap: { get: (k: string) => (k === 'contexto' ? contexto : null) } },
      } as unknown as ActivatedRoute;
    }

    it('lee el parámetro, publica el contexto y lo quita de la URL con replaceUrl', () => {
      const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      const ruta = rutaCon(codificarContexto(CONTEXTO_LANZAMIENTO));

      expect(servicio.cargarDesde(ruta)).toEqual({ estado: 'valido' });

      expect(servicio.cliente()?.id).toBe('cliente-0001');
      expect(navegar).toHaveBeenCalledWith([], {
        relativeTo: ruta,
        queryParams: { contexto: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    });

    it('también quita el parámetro cuando el contexto es inválido', () => {
      const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

      expect(servicio.cargarDesde(rutaCon('###'))).toMatchObject({ estado: 'invalido' });

      expect(navegar).toHaveBeenCalledTimes(1);
      noPublicaNada();
    });

    it('sin parámetro y sin contexto previo responde ausente', () => {
      const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

      expect(servicio.cargarDesde(rutaCon(null))).toEqual({ estado: 'ausente' });
      expect(navegar).not.toHaveBeenCalled();
    });

    it('sin parámetro conserva el contexto cargado antes en la misma sesión de la página', () => {
      cargar(CONTEXTO_LANZAMIENTO);

      expect(servicio.cargarDesde(rutaCon(null))).toEqual({ estado: 'valido' });
    });
  });
});
