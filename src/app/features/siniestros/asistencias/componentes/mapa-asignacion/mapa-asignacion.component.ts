import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import type { DivIcon, LayerGroup, Map as MapaLeaflet } from 'leaflet';

import {
  CARGAR_LEAFLET,
  CENTRO_SIN_PIN,
  Coordenadas,
  RELLENO_ENCUADRE,
  ZOOM_MAXIMO_ENCUADRE,
  MarcadorMapa,
  ModuloLeaflet,
  URL_DERECHOS_OSM,
  URL_TESELAS,
  ZOOM_SIN_PIN,
  zoomParaRadio,
} from '../../modelos/mapa';

/**
 * Mapa de la asignación del prestador (O7 y O7b; HU-W2.3-01, decisión F1): el incidente, el círculo del radio de
 * búsqueda y los prestadores con su distancia. En modo `editable` (ubicación alternativa, CA-1) un clic pone el pin y
 * arrastrarlo lo mueve; los campos de latitud y longitud de `UbicacionIncidenteComponent` son la alternativa por
 * teclado. Los marcadores no son interactivos: la tabla de candidatos es la alternativa accesible.
 *
 * Leaflet se carga de forma perezosa (`CARGAR_LEAFLET`) e inserta sus marcadores fuera de la plantilla, por eso los
 * estilos no se encapsulan y todas las clases llevan el prefijo `mapa-asignacion`.
 *
 * También lo usan las asistencias en sitio (HU-W2.3-03), en el mismo dominio, sin promoverlo a `shared/ui/`: la bandeja
 * (O9) lo usa **sin** incidente y con un marcador por solicitud abierta, y entonces la vista encuadra los marcadores; el
 * detalle (O9b) lo usa como O7. `etiquetaRegion`, `leyenda` y `etiquetaIncidente` adaptan los textos a cada pantalla; sin
 * ellas, son los de O7.
 */
@Component({
  selector: 'app-mapa-asignacion',
  imports: [TranslocoDirective],
  templateUrl: './mapa-asignacion.component.html',
  styleUrl: './mapa-asignacion.component.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapaAsignacionComponent {
  readonly incidente = input<Coordenadas | null>(null);
  readonly radioKm = input<number | null>(null);
  readonly marcadores = input<readonly MarcadorMapa[]>([]);
  readonly editable = input(false);
  /** `aria-label` de la región; por omisión, «Mapa del incidente y de los prestadores». */
  readonly etiquetaRegion = input<string | null>(null);
  /** Texto bajo el mapa en lugar del radio de búsqueda (HU-W2.3-03, bandeja). */
  readonly leyenda = input<string | null>(null);
  /** Rótulo del pin; por omisión, «Incidente». */
  readonly etiquetaIncidente = input<string | null>(null);
  /** Nueva posición del pin (clic o arrastre), solo en modo `editable`. */
  readonly pinMovido = output<Coordenadas>();

  private readonly cargarLeaflet = inject(CARGAR_LEAFLET);
  private readonly transloco = inject(TranslocoService);
  private readonly contenedor = viewChild.required<ElementRef<HTMLElement>>('contenedor');

  /** El mapa no carga (Leaflet no llegó): la página sigue usable con la tabla y los campos. */
  protected readonly fallo = signal(false);
  private readonly listo = signal(false);
  private leaflet?: ModuloLeaflet;
  private mapa?: MapaLeaflet;
  private capas?: LayerGroup;
  private ultimaVista?: string;
  private destruido = false;

  constructor() {
    afterNextRender(() => void this.iniciar());
    effect(() => {
      const datos = {
        incidente: this.incidente(),
        radioKm: this.radioKm(),
        marcadores: this.marcadores(),
        editable: this.editable(),
        etiquetaIncidente: this.etiquetaIncidente(),
      };
      if (this.listo()) {
        untracked(() =>
          this.pintar(
            datos.incidente,
            datos.radioKm,
            datos.marcadores,
            datos.editable,
            datos.etiquetaIncidente,
          ),
        );
      }
    });
    inject(DestroyRef).onDestroy(() => {
      this.destruido = true;
      this.mapa?.remove();
    });
  }

  private async iniciar(): Promise<void> {
    let L: ModuloLeaflet;
    try {
      L = await this.cargarLeaflet();
    } catch {
      this.fallo.set(true);
      return;
    }
    if (this.destruido) {
      return;
    }
    const t = (clave: string) => this.transloco.translate(`siniestros.mapa.${clave}`);
    const mapa = L.map(this.contenedor().nativeElement, {
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false,
    });
    L.control.zoom({ zoomInTitle: t('acercar'), zoomOutTitle: t('alejar') }).addTo(mapa);
    L.control.attribution({ prefix: 'Leaflet' }).addTo(mapa);
    L.tileLayer(URL_TESELAS, {
      maxZoom: 19,
      attribution: `&copy; <a href="${URL_DERECHOS_OSM}">${t('atribucion')}</a>`,
    }).addTo(mapa);
    mapa.on('click', (evento) => {
      if (this.editable()) {
        this.pinMovido.emit({ latitud: evento.latlng.lat, longitud: evento.latlng.lng });
      }
    });
    this.leaflet = L;
    this.mapa = mapa;
    this.capas = L.layerGroup().addTo(mapa);
    this.listo.set(true);
  }

  private pintar(
    incidente: Coordenadas | null,
    radioKm: number | null,
    marcadores: readonly MarcadorMapa[],
    editable: boolean,
    etiquetaIncidente: string | null,
  ): void {
    const L = this.leaflet;
    const mapa = this.mapa;
    const capas = this.capas;
    if (!L || !mapa || !capas) {
      return;
    }
    capas.clearLayers();
    if (incidente) {
      const centro = L.latLng(incidente.latitud, incidente.longitud);
      if (radioKm) {
        L.circle(centro, {
          radius: radioKm * 1000,
          className: 'mapa-asignacion__radio',
          interactive: false,
        }).addTo(capas);
      }
      const etiqueta =
        etiquetaIncidente ?? this.transloco.translate<string>('siniestros.mapa.incidente');
      const pin = L.marker(centro, {
        icon: this.icono(L, etiqueta, 'incidente'),
        draggable: editable,
        interactive: editable,
        keyboard: false,
      });
      if (editable) {
        pin.on('dragend', () => {
          const posicion = pin.getLatLng();
          this.pinMovido.emit({ latitud: posicion.lat, longitud: posicion.lng });
        });
      }
      pin.addTo(capas);
    }
    for (const marcador of marcadores) {
      L.marker(L.latLng(marcador.latitud, marcador.longitud), {
        icon: this.icono(L, marcador.etiqueta, marcador.tipo),
        interactive: false,
        keyboard: false,
      }).addTo(capas);
    }
    // Al editar, la vista no salta con cada clic: solo se centra cuando aparece el primer pin. Sin incidente y con
    // marcadores (la bandeja de HU-W2.3-03), encuadra los marcadores y solo vuelve a hacerlo si cambia cuáles son: el
    // refresco periódico de la bandeja no mueve la vista que el analista ajustó.
    const encuadrar = !incidente && !editable && marcadores.length > 0;
    const vista = incidente
      ? editable
        ? 'editando'
        : `${incidente.latitud},${incidente.longitud},${radioKm}`
      : encuadrar
        ? `encuadre:${marcadores
            .map((m) => m.id)
            .sort()
            .join('|')}`
        : 'sin-pin';
    if (vista !== this.ultimaVista) {
      this.ultimaVista = vista;
      if (incidente) {
        mapa.setView([incidente.latitud, incidente.longitud], zoomParaRadio(radioKm));
      } else if (encuadrar) {
        mapa.fitBounds(
          L.latLngBounds(marcadores.map((m) => L.latLng(m.latitud, m.longitud))),
          { padding: [RELLENO_ENCUADRE, RELLENO_ENCUADRE], maxZoom: ZOOM_MAXIMO_ENCUADRE },
        );
      } else {
        mapa.setView([CENTRO_SIN_PIN.latitud, CENTRO_SIN_PIN.longitud], ZOOM_SIN_PIN);
      }
    }
  }

  /** Marcador con su etiqueta como texto (nunca HTML: el nombre del prestador viene del registro). */
  private icono(
    L: ModuloLeaflet,
    etiqueta: string,
    tipo: 'incidente' | MarcadorMapa['tipo'],
  ): DivIcon {
    const raiz = document.createElement('div');
    const texto = document.createElement('span');
    texto.className = 'mapa-asignacion__etiqueta';
    texto.textContent = etiqueta;
    const punto = document.createElement('span');
    punto.className = 'mapa-asignacion__punto';
    punto.setAttribute('aria-hidden', 'true');
    raiz.append(texto, punto);
    return L.divIcon({
      html: raiz,
      className: `mapa-asignacion__marcador mapa-asignacion__marcador--${tipo}`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
  }
}
