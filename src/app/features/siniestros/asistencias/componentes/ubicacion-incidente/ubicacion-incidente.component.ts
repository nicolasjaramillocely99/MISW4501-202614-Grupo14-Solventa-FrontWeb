import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { CampoInvalido, SolicitudUbicacion } from '@core/api/siniestros/asignacion.modelos';

import { Coordenadas } from '../../modelos/mapa';
import {
  DIRECCION_MAXIMA,
  FormularioUbicacion,
  ProblemaUbicacion,
  coordenadaATexto,
  leerCoordenada,
  validarUbicacion,
} from '../../modelos/presentacion-asignacion';

type Campo = keyof FormularioUbicacion;

/** Campo del contrato (`validation_failed.fields[].field`) → campo del formulario. */
const CAMPO_DEL_CONTRATO: Readonly<Record<string, Campo>> = {
  address: 'direccion',
  latitude: 'latitud',
  longitude: 'longitud',
};

/**
 * Ubicación alternativa del incidente (HU-W2.3-01, CA-1): sin coordenadas de la app, el analista escribe la dirección y
 * ubica el incidente con el pin del mapa (F1, sin geocodificador). Los campos de latitud y longitud siguen al pin y son
 * la alternativa por teclado: escribir una coordenada válida mueve el pin (`pinEscrito`). Valida con los límites del
 * contrato antes de enviar; el `422` del servidor se marca en el campo. El envío lo hace la página.
 */
@Component({
  selector: 'app-ubicacion-incidente',
  imports: [TranslocoDirective],
  templateUrl: './ubicacion-incidente.component.html',
  styleUrl: './ubicacion-incidente.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UbicacionIncidenteComponent {
  /** Dirección con la que arranca el formulario (al corregir la que registró el analista). */
  readonly direccionInicial = input('');
  /** La posición del pin del mapa; al moverlo, los campos la siguen. */
  readonly pin = input<Coordenadas | null>(null);
  readonly guardando = input(false);
  /** Campos que rechazó el servidor (`validation_failed`). */
  readonly erroresServidor = input<readonly CampoInvalido[]>([]);
  /** «Cancelar» solo al corregir una ubicación ya registrada. */
  readonly cancelable = input(false);

  readonly pinEscrito = output<Coordenadas>();
  readonly guardar = output<SolicitudUbicacion>();
  readonly cancelar = output<void>();

  protected readonly maximo = DIRECCION_MAXIMA;
  protected readonly coordenadas = ['latitud', 'longitud'] as const;
  protected readonly formulario = signal<FormularioUbicacion>({
    direccion: '',
    latitud: '',
    longitud: '',
  });
  private readonly tocados = signal<ReadonlySet<Campo>>(new Set());
  private readonly intentado = signal(false);

  private readonly validacion = computed(() => validarUbicacion(this.formulario()));

  /** Problema visible por campo: el del cliente tras tocarlo o intentar guardar, o el del servidor. */
  protected readonly problemas = computed(() => {
    const visibles: Partial<Record<Campo, ProblemaUbicacion>> = {};
    for (const error of this.erroresServidor()) {
      const campo = CAMPO_DEL_CONTRATO[error.campo];
      if (campo) {
        visibles[campo] = problemaDelServidor(campo, error.codigo);
      }
    }
    const cliente = this.validacion().problemas;
    for (const campo of ['direccion', 'latitud', 'longitud'] as const) {
      if (cliente[campo] && (this.intentado() || this.tocados().has(campo))) {
        visibles[campo] = cliente[campo];
      }
    }
    return visibles;
  });

  constructor() {
    effect(() => {
      const direccion = this.direccionInicial();
      untracked(() => this.formulario.update((f) => ({ ...f, direccion })));
    });
    // El pin manda sobre los campos, salvo que ya digan lo mismo (no se reescribe lo que el analista está tecleando).
    effect(() => {
      const pin = this.pin();
      if (!pin) {
        return;
      }
      untracked(() => {
        const actual = this.formulario();
        if (
          leerCoordenada(actual.latitud) !== pin.latitud ||
          leerCoordenada(actual.longitud) !== pin.longitud
        ) {
          this.formulario.set({
            ...actual,
            latitud: coordenadaATexto(pin.latitud),
            longitud: coordenadaATexto(pin.longitud),
          });
        }
      });
    });
  }

  protected escribir(campo: Campo, valor: string): void {
    this.formulario.update((f) => ({ ...f, [campo]: valor }));
    if (campo === 'direccion') {
      return;
    }
    const { problemas } = this.validacion();
    const f = this.formulario();
    const latitud = leerCoordenada(f.latitud);
    const longitud = leerCoordenada(f.longitud);
    if (!problemas.latitud && !problemas.longitud && latitud !== null && longitud !== null) {
      this.pinEscrito.emit({ latitud, longitud });
    }
  }

  protected tocar(campo: Campo): void {
    this.tocados.update((tocados) => new Set([...tocados, campo]));
  }

  protected enviar(evento: Event): void {
    evento.preventDefault();
    this.intentado.set(true);
    const { solicitud } = this.validacion();
    if (solicitud && !this.guardando()) {
      this.guardar.emit(solicitud);
    }
  }
}

function problemaDelServidor(campo: Campo, codigo: string): ProblemaUbicacion {
  if (codigo === 'required') {
    return 'requerido';
  }
  if (codigo === 'out_of_range') {
    return campo === 'direccion' ? 'longitud' : 'rango';
  }
  return campo === 'direccion' ? 'longitud' : 'formato';
}
