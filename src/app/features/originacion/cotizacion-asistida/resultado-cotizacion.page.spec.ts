import { ActivatedRoute, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { COTIZACION_DTO } from '@testing/cotizacion-asistida-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { Observable, Subject, of, throwError } from 'rxjs';

import {
  CotizacionAsistida,
  ErrorCotizacionAsistida,
  mapearCotizacionAsistida,
} from '@core/api/originacion/cotizacion-asistida.modelos';
import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';

import { ResultadoCotizacionPage } from './resultado-cotizacion.page';

const VIGENTE = mapearCotizacionAsistida(COTIZACION_DTO);

const CACHE: CotizacionAsistida = {
  ...VIGENTE,
  modo: 'provisional',
  origen: 'cache',
  fuenteNoDisponible: 'open_finance',
  aviso: 'last_profile_in_use',
  fechaPerfil: '2026-10-10T12:00:00Z',
};

const BASE: CotizacionAsistida = {
  ...VIGENTE,
  modo: 'provisional',
  origen: 'base_actuarial',
  categoria: 'base_actuarial',
  fechaPerfil: null,
  fuenteNoDisponible: 'open_finance',
  aviso: 'personalization_unavailable',
};

const VENCIDA: CotizacionAsistida = {
  ...VIGENTE,
  estado: 'expired',
  puedeFormalizar: false,
  motivoBloqueo: 'quote_expired',
};

describe('ResultadoCotizacionPage (S2 / S2b · HU-W1.1-01)', () => {
  let consultar: ReturnType<typeof vi.fn<(id: string) => Observable<CotizacionAsistida>>>;

  async function renderizar(respuesta: Observable<CotizacionAsistida>) {
    consultar = vi.fn().mockReturnValue(respuesta);
    return render(ResultadoCotizacionPage, {
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter([]),
        { provide: OriginacionApiService, useValue: { consultarCotizacionAsistida: consultar } },
        { provide: ActivatedRoute, useValue: { snapshot: { params: { id: VIGENTE.cotizacionId } } } },
      ],
    });
  }

  it('consulta la cotización de la ruta y mientras tanto informa que carga', async () => {
    await renderizar(new Subject<CotizacionAsistida>());

    expect(consultar).toHaveBeenCalledWith(VIGENTE.cotizacionId);
    expect(screen.getByRole('status').textContent).toContain('Cargando la cotización');
  });

  describe('cotización vigente', () => {
    it('muestra la prima mensual, las coberturas, la vigencia y los datos del cliente', async () => {
      await renderizar(of(VIGENTE));

      expect(screen.getByRole('heading', { level: 1, name: 'Cotización asistida' })).toBeTruthy();
      expect(screen.getByText(`Código ${VIGENTE.cotizacionId}`)).toBeTruthy();
      expect(screen.getByText('Vigente 24 h')).toBeTruthy();
      expect(screen.getByText(/132\.800 COP/)).toBeTruthy();
      expect(screen.getByText('Prima mensual')).toBeTruthy();
      expect(screen.getByText('Fallecimiento del asegurado')).toBeTruthy();
      expect(screen.getByText('Incapacidad total y permanente')).toBeTruthy();
      expect(screen.getAllByText(/250\.000\.000 COP/).length).toBeGreaterThanOrEqual(3);
      expect(screen.getByText('Ana María Pérez')).toBeTruthy();
      expect(screen.getByText('1032456789')).toBeTruthy();
      expect(screen.getByText('ana@example.com')).toBeTruthy();
      expect(screen.getByText('180 meses')).toBeTruthy();
      expect(screen.getByText('Estándar')).toBeTruthy();
      expect(screen.getByText('Fuentes externas en línea')).toBeTruthy();
      expect(screen.getByText('v1')).toBeTruthy();
    });

    it('ofrece formalizar la compra, que lleva a la pantalla de formalización (HU-W1.1-03)', async () => {
      await renderizar(of(VIGENTE));

      const formalizar = screen.getByRole('link', { name: 'Formalizar compra' });

      expect(formalizar.getAttribute('href')).toBe(`/originacion/cotizaciones/${VIGENTE.cotizacionId}/formalizar`);
    });

    it('confirma que la cotización quedó generada con su vigencia y ofrece una nueva', async () => {
      await renderizar(of(VIGENTE));

      expect(screen.getByText('Cotización generada')).toBeTruthy();
      expect(screen.getByText(/Está vigente hasta el/)).toBeTruthy();
      expect(screen.queryByText('La cotización venció')).toBeNull();
      const nueva = screen.getByRole('link', { name: 'Nueva cotización' });
      expect(nueva.getAttribute('href')).toBe('/originacion/cotizaciones/nueva');
    });
  });

  describe('modo degradado (S2b, criterio 5)', () => {
    it('con el último perfil en caché lo dice en la propia pantalla, con la fecha del perfil', async () => {
      await renderizar(of(CACHE));

      expect(screen.getByText('Provisional')).toBeTruthy();
      expect(screen.getByText('Cotización en modo degradado')).toBeTruthy();
      expect(screen.getByText(/se usó el último perfil del cliente en caché, del/)).toBeTruthy();
      expect(screen.getByText('Perfil reciente en caché')).toBeTruthy();
      expect(screen.getByText('Fecha del perfil')).toBeTruthy();
      expect(screen.queryByText('Cotización generada')).toBeNull();
    });

    it('con el perfil actuarial base advierte que el precio no está personalizado', async () => {
      await renderizar(of(BASE));

      expect(screen.getByText(/perfil actuarial base\. El precio no está personalizado/)).toBeTruthy();
      expect(screen.getAllByText('Actuarial base').length).toBeGreaterThan(0);
      expect(screen.getByText('Perfil actuarial base')).toBeTruthy();
      expect(screen.queryByText('Fecha del perfil')).toBeNull();
    });
  });

  describe('cotización vencida (criterio 6)', () => {
    it('informa el motivo, tacha la prima y ofrece generar una nueva con el documento del cliente', async () => {
      await renderizar(of(VENCIDA));

      expect(screen.getByText('Vencida')).toBeTruthy();
      expect(screen.getByRole('alert').textContent).toContain('no se puede formalizar');
      expect(screen.getByText('La cotización venció')).toBeTruthy();
      expect(screen.queryByText('Cotización generada')).toBeNull();
      expect(screen.queryByRole('link', { name: 'Formalizar compra' })).toBeNull();
      const nueva = screen.getByRole('link', { name: 'Generar una nueva cotización' });
      expect(nueva.getAttribute('href')).toBe('/originacion/cotizaciones/nueva?documento=1032456789');
      expect(screen.queryByRole('link', { name: 'Nueva cotización' })).toBeNull();
    });

    it('una vencida que además fue degradada muestra ambos avisos', async () => {
      await renderizar(of({ ...CACHE, estado: 'expired', puedeFormalizar: false, motivoBloqueo: 'quote_expired' }));

      expect(screen.getByText('La cotización venció')).toBeTruthy();
      expect(screen.getByText('Cotización en modo degradado')).toBeTruthy();
    });
  });

  describe('errores', () => {
    it('una cotización que no existe lo dice y ofrece generar una nueva', async () => {
      await renderizar(throwError(() => new ErrorCotizacionAsistida('quote_not_found')));

      expect(screen.getByRole('heading', { name: 'No encontramos la cotización' })).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Nueva cotización' }).getAttribute('href')).toBe('/originacion/cotizaciones/nueva');
    });

    it('un fallo del servicio muestra la alerta y permite reintentar', async () => {
      const usuario = userEvent.setup();
      await renderizar(throwError(() => new ErrorCotizacionAsistida('quote_unavailable')));

      expect(screen.getByRole('alert').textContent).toContain('Hubo un problema al consultar la cotización');

      consultar.mockReturnValue(of(VIGENTE));
      await usuario.click(screen.getByRole('button', { name: 'Reintentar' }));

      expect(consultar).toHaveBeenCalledTimes(2);
      expect(screen.getByText('Cotización generada')).toBeTruthy();
    });
  });
});
