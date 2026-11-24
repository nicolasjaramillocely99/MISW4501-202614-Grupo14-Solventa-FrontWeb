import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideX } from '@lucide/angular';

import { CampoInvalido } from '@core/api/siniestros/asignacion.modelos';
import { PasoIntervencion, SolicitudAvance } from '@core/api/siniestros/intervencion.modelos';

import { aFechaHoraLocal, desdeFechaHoraLocal } from '../../modelos/fecha-local';

/** Los campos del formulario, con el nombre que les da el contrato en `validation_failed`. */
type Campo =
  | 'occurred_at'
  | 'note'
  | 'report.cause'
  | 'report.damage'
  | 'report.repair_cost_minor'
  | 'report.repair_days'
  | 'report.photos';

const MAX_TEXTO = 300;
const MAX_OBSERVACION = 1000;

/**
 * Registrar un avance del prestador (HU-W2.3-02, CA-1): un `<dialog>` modal con el paso siguiente fijo, la fecha y hora
 * en que el prestador dice que ocurrió (por omisión, ahora) y la observación. En la visita pide además el informe:
 * causa, daño, costo en pesos (se envía en centavos), días y fotos. El envío lo hace la página; los errores del
 * servidor (`422`) se muestran en su campo hasta que el analista lo edita. El foco vuelve al botón que lo abrió.
 */
@Component({
  selector: 'app-registrar-avance',
  imports: [TranslocoDirective, LucideX],
  templateUrl: './registrar-avance.component.html',
  styleUrl: './registrar-avance.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistrarAvanceComponent {
  readonly guardando = input(false);
  /** Los campos que rechazó el servidor en el último envío. */
  readonly erroresServidor = input<readonly CampoInvalido[]>([]);

  readonly registrar = output<SolicitudAvance>();

  private readonly dialogo = viewChild<ElementRef<HTMLDialogElement>>('dialogo');
  private origen: HTMLElement | null = null;

  protected readonly paso = signal<PasoIntervencion | null>(null);
  protected readonly ahora = signal('');
  protected readonly fecha = signal('');
  protected readonly observacion = signal('');
  protected readonly causa = signal('');
  protected readonly dano = signal('');
  protected readonly costo = signal('');
  protected readonly dias = signal('');
  protected readonly fotos = signal('');
  protected readonly enviado = signal(false);
  /** Los campos editados después del último envío: su error del servidor ya no aplica. */
  private readonly editados = signal<ReadonlySet<Campo>>(new Set());

  protected readonly conInforme = computed(() => this.paso() === 'visit_done');
  protected readonly maxTexto = MAX_TEXTO;
  protected readonly maxObservacion = MAX_OBSERVACION;

  abrir(paso: PasoIntervencion): void {
    this.origen = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const ahora = aFechaHoraLocal(new Date());
    this.paso.set(paso);
    this.ahora.set(ahora);
    this.fecha.set(ahora);
    for (const campo of [
      this.observacion,
      this.causa,
      this.dano,
      this.costo,
      this.dias,
      this.fotos,
    ]) {
      campo.set('');
    }
    this.enviado.set(false);
    this.editados.set(new Set());
    this.dialogo()?.nativeElement.showModal();
  }

  cerrar(): void {
    this.dialogo()?.nativeElement.close();
  }

  protected pedirCierre(): void {
    if (!this.guardando()) {
      this.cerrar();
    }
  }

  protected alCancelarNativo(evento: Event): void {
    evento.preventDefault();
    this.pedirCierre();
  }

  protected alCerrar(): void {
    // El evento `close` llega en otra tarea: si el diálogo ya se volvió a abrir, ese cierre es viejo.
    if (this.dialogo()?.nativeElement.open) {
      return;
    }
    this.paso.set(null);
    this.origen?.focus();
  }

  protected editar(campo: Campo, valor: string): void {
    const senal = {
      occurred_at: this.fecha,
      note: this.observacion,
      'report.cause': this.causa,
      'report.damage': this.dano,
      'report.repair_cost_minor': this.costo,
      'report.repair_days': this.dias,
      'report.photos': this.fotos,
    }[campo];
    senal.set(valor);
    this.editados.update((e) => new Set([...e, campo]));
  }

  /** Código del error del campo (clave bajo `siniestros.intervencion.campos`), o `null`. */
  protected errorDe(campo: Campo): string | null {
    const servidor = this.erroresServidor().find((e) => e.campo === campo);
    if (servidor && !this.editados().has(campo)) {
      return campo === 'occurred_at' && servidor.codigo === 'out_of_range'
        ? 'fecha'
        : servidor.codigo;
    }
    return this.enviado() ? this.errorLocal(campo) : null;
  }

  protected enviar(evento: Event): void {
    evento.preventDefault();
    const paso = this.paso();
    if (!paso || this.guardando()) {
      return;
    }
    this.enviado.set(true);
    this.editados.set(new Set());
    const campos: Campo[] = ['occurred_at', 'note'];
    if (this.conInforme()) {
      campos.push(
        'report.cause',
        'report.damage',
        'report.repair_cost_minor',
        'report.repair_days',
        'report.photos',
      );
    }
    if (campos.some((c) => this.errorLocal(c) !== null)) {
      return;
    }
    const solicitud: SolicitudAvance = {
      paso,
      ocurridoEn: desdeFechaHoraLocal(this.fecha()) ?? '',
      observacion: this.observacion(),
    };
    if (this.conInforme()) {
      solicitud.informe = {
        causa: this.causa().trim(),
        dano: this.dano().trim(),
        costoReparacionCentavos: Math.round(Number(this.costo()) * 100),
        diasReparacion: Number(this.dias()),
        fotos: this.fotos() === '' ? 0 : Number(this.fotos()),
      };
    }
    this.registrar.emit(solicitud);
  }

  private errorLocal(campo: Campo): string | null {
    switch (campo) {
      case 'occurred_at': {
        const valor = desdeFechaHoraLocal(this.fecha());
        if (!valor) {
          return 'required';
        }
        return this.fecha() > this.ahora() ? 'fecha' : null;
      }
      case 'note':
        return this.observacion().trim().length > MAX_OBSERVACION ? 'out_of_range' : null;
      case 'report.cause':
        return texto(this.causa());
      case 'report.damage':
        return texto(this.dano());
      case 'report.repair_cost_minor':
        return numero(this.costo(), 0, Number.MAX_SAFE_INTEGER / 100, false);
      case 'report.repair_days':
        return numero(this.dias(), 0, 365, true);
      case 'report.photos':
        return this.fotos() === '' ? null : numero(this.fotos(), 0, 50, true);
    }
  }
}

function texto(valor: string): string | null {
  const limpio = valor.trim();
  if (!limpio) {
    return 'required';
  }
  return limpio.length < 3 || limpio.length > MAX_TEXTO ? 'out_of_range' : null;
}

function numero(valor: string, minimo: number, maximo: number, entero: boolean): string | null {
  if (valor.trim() === '') {
    return 'required';
  }
  const n = Number(valor);
  if (!Number.isFinite(n) || (entero && !Number.isInteger(n))) {
    return 'invalid_format';
  }
  return n < minimo || n > maximo ? 'out_of_range' : null;
}
