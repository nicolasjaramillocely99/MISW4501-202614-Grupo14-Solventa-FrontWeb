import { ChangeDetectionStrategy, Component, computed, effect, inject, input, linkedSignal, model, signal } from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucidePlus } from '@lucide/angular';

import {
  Beneficiario,
  BeneficiarioOneroso,
  CodigoCampoSolicitud,
  ErrorDeCampoSolicitud,
  PARENTESCOS,
  TIPOS_DOCUMENTO,
  ubicarCampo,
} from '@core/api/originacion/solicitud-modificacion.modelos';
import { InsigniaEstadoComponent } from '@shared/ui/insignia-estado/insignia-estado.component';

import { formatoDocumento, formatoParticipacion, nombreDelOneroso } from '../../modelos/formato-beneficiario';
import { BeneficiarioCaptura, claveMensaje, totalParticipacion } from '../../modelos/validaciones-cambio';

/** Lo que el asegurado escribe en «Nuevo beneficiario»: textos, tal cual los dejan los campos. */
interface Formulario {
  nombreCompleto: string;
  parentesco: string;
  tipoDocumento: string;
  numeroDocumento: string;
  participacion: string;
}

type ControlBeneficiario = keyof Formulario;

const VACIO: Formulario = { nombreCompleto: '', parentesco: '', tipoDocumento: '', numeroDocumento: '', participacion: '' };

function aCaptura(b: Beneficiario): BeneficiarioCaptura {
  return { ...b };
}

/** «60», «33,5» o «33.5» → número; vacío → `null`; lo demás → `NaN` (formato inválido). */
function leerParticipacion(texto: string): number | null {
  const limpio = texto.trim().replace(',', '.');
  if (!limpio) {
    return null;
  }
  return /^\d+(\.\d+)?$/.test(limpio) ? Number(limpio) : Number.NaN;
}

function aFormulario(b: BeneficiarioCaptura): Formulario {
  return {
    nombreCompleto: b.nombreCompleto,
    parentesco: b.parentesco,
    tipoDocumento: b.tipoDocumento,
    numeroDocumento: b.numeroDocumento,
    participacion: b.participacion === null || Number.isNaN(b.participacion) ? '' : String(b.participacion),
  };
}

/**
 * Captura de beneficiarios de A3 (HU-W1.4-01, frame `20:529`): «Beneficiarios actuales» con el beneficiario oneroso «No
 * modificable» (no viaja en la solicitud), «Editar» y «Quitar» por fila, y «Nuevo beneficiario» (nombre, parentesco, tipo y
 * número de documento, participación). La propuesta es la lista más lo que esté escrito en el formulario: así el error de
 * la suma («debe ser 100 % (actual: 120 %)») aparece mientras se escribe y «Radicar» la envía completa. Los errores llegan
 * de la página (propios y del `422`) con los nombres de campo del contrato; los del formulario son los del último índice.
 */
@Component({
  selector: 'app-cambio-beneficiarios',
  imports: [TranslocoDirective, InsigniaEstadoComponent, LucidePlus],
  templateUrl: './cambio-beneficiarios.component.html',
  styleUrl: './cambio-beneficiarios.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CambioBeneficiariosComponent {
  private readonly transloco = inject(TranslocoService);

  /** Los beneficiarios designados hoy (vacío mientras HU-W1.4-02 no aplique un cambio). */
  readonly actuales = input<readonly Beneficiario[]>([]);
  readonly oneroso = input<BeneficiarioOneroso | null>(null);
  /** Los errores de la propuesta (propios y del servicio). */
  readonly errores = input<readonly ErrorDeCampoSolicitud[]>([]);
  /** El asegurado intentó radicar: se muestran también los errores de los campos que no ha tocado. */
  readonly mostrarTodos = input(false);
  readonly deshabilitado = input(false);
  /** La propuesta completa, enlazada con la página. */
  readonly propuesta = model<BeneficiarioCaptura[]>([]);

  protected readonly parentescos = PARENTESCOS;
  protected readonly tiposDocumento = TIPOS_DOCUMENTO;
  protected readonly filas = linkedSignal<readonly Beneficiario[], BeneficiarioCaptura[]>({
    source: this.actuales,
    computation: (actuales) => actuales.map(aCaptura),
  });
  protected readonly formulario = signal<Formulario>(VACIO);
  protected readonly editando = signal(false);
  private readonly tocados = signal<ReadonlySet<ControlBeneficiario>>(new Set());

  /** Lo escrito en el formulario, si hay algo. */
  private readonly entrada = computed<BeneficiarioCaptura | null>(() => {
    const f = this.formulario();
    const algo = Object.values(f).some((v) => v.trim() !== '');
    return algo
      ? {
          nombreCompleto: f.nombreCompleto,
          parentesco: f.parentesco,
          tipoDocumento: f.tipoDocumento,
          numeroDocumento: f.numeroDocumento,
          participacion: leerParticipacion(f.participacion),
        }
      : null;
  });

  private readonly combinada = computed(() => {
    const entrada = this.entrada();
    return entrada ? [...this.filas(), entrada] : [...this.filas()];
  });

  /** Índice del formulario dentro de la propuesta. */
  protected readonly indiceFormulario = computed(() => this.filas().length);
  protected readonly total = computed(() => totalParticipacion(this.combinada()));

  constructor() {
    effect(() => this.propuesta.set(this.combinada()));
  }

  /** El código de error de un campo de la propuesta, o `null`. */
  protected codigoDe(indice: number, control: ControlBeneficiario): CodigoCampoSolicitud | null {
    const error = this.errores().find((e) => {
      const ubicacion = ubicarCampo(e.campo);
      return ubicacion?.grupo === 'beneficiarios' && ubicacion.indice === indice && ubicacion.control === control;
    });
    return error?.codigo ?? null;
  }

  /** El error de un campo del formulario, solo cuando ya se tocó o el asegurado intentó radicar. */
  protected errorFormulario(control: ControlBeneficiario): string | null {
    if (!this.mostrarTodos() && !this.tocados().has(control)) {
      return null;
    }
    const codigo = this.codigoDe(this.indiceFormulario(), control);
    return codigo ? this.mensaje(control, codigo) : null;
  }

  /** El error de una fila de la lista (p. ej. un documento repetido), si lo hay. */
  protected errorFila(indice: number): string | null {
    for (const control of ['nombreCompleto', 'parentesco', 'tipoDocumento', 'numeroDocumento', 'participacion'] as const) {
      const codigo = this.codigoDe(indice, control);
      if (codigo) {
        return this.mensaje(control, codigo);
      }
    }
    return null;
  }

  /** El error de la lista entera (suma, ninguno, sin cambios). `required` solo tras intentar radicar. */
  protected readonly errorLista = computed(() => {
    const error = this.errores().find((e) => e.campo === 'beneficiaries');
    if (!error || (error.codigo === 'required' && !this.mostrarTodos())) {
      return null;
    }
    return error.codigo === 'share_total_not_100'
      ? this.transloco.translate('originacion.solicitudes.errores.share_total_not_100', { total: this.porcentaje(this.total()) })
      : this.mensaje('beneficiarios', error.codigo);
  });

  protected cambiar(control: ControlBeneficiario, evento: Event): void {
    const valor = (evento.target as HTMLInputElement | HTMLSelectElement).value;
    this.formulario.update((f) => ({ ...f, [control]: valor }));
  }

  protected tocar(control: ControlBeneficiario): void {
    this.tocados.update((t) => new Set(t).add(control));
  }

  /** Lleva lo escrito a la lista si sus campos son válidos y deja el formulario listo para otro. */
  protected agregar(): void {
    const entrada = this.entrada();
    if (!entrada) {
      return;
    }
    const indice = this.indiceFormulario();
    const conError = (['nombreCompleto', 'parentesco', 'tipoDocumento', 'numeroDocumento', 'participacion'] as const).some(
      (c) => this.codigoDe(indice, c) !== null,
    );
    if (conError) {
      this.tocados.set(new Set(['nombreCompleto', 'parentesco', 'tipoDocumento', 'numeroDocumento', 'participacion']));
      return;
    }
    this.filas.update((filas) => [...filas, entrada]);
    this.formulario.set(VACIO);
    this.tocados.set(new Set());
    this.editando.set(false);
  }

  /** Lleva una fila al formulario; lo que hubiera escrito vuelve a la lista para no perderlo. */
  protected editar(indice: number): void {
    const fila = this.filas()[indice];
    const entrada = this.entrada();
    this.filas.update((filas) => {
      const resto = filas.filter((_, i) => i !== indice);
      return entrada ? [...resto, entrada] : resto;
    });
    this.formulario.set(aFormulario(fila));
    this.tocados.set(new Set());
    this.editando.set(true);
  }

  protected quitar(indice: number): void {
    this.filas.update((filas) => filas.filter((_, i) => i !== indice));
  }

  /** El nombre del beneficiario oneroso: el del aliado, su código o la etiqueta genérica. */
  protected nombreOneroso(oneroso: BeneficiarioOneroso): string {
    return nombreDelOneroso(oneroso, this.transloco.translate('originacion.solicitudes.beneficiarios.entidadGenerica'));
  }

  /** «TI 1.140.223.001»: un documento numérico con separadores de miles del idioma; otro (p. ej. un pasaporte), tal cual. */
  protected documento(b: BeneficiarioCaptura): string {
    return formatoDocumento(b.tipoDocumento, b.numeroDocumento, this.transloco.getActiveLang());
  }

  /** «60» o «33,5» en el formato del idioma. */
  protected porcentaje(valor: number | null): string {
    return formatoParticipacion(valor, this.transloco.getActiveLang());
  }

  private mensaje(control: string, codigo: CodigoCampoSolicitud): string {
    return this.transloco.translate(`originacion.solicitudes.${claveMensaje(control, codigo)}`);
  }
}
