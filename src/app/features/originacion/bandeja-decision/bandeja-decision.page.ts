import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, inject, signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideCircleAlert, LucideCircleCheck } from '@lucide/angular';
import { Subscription } from 'rxjs';

import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';
import {
  ConteosBandeja,
  EstadoSolicitudRevision,
  OrdenLlegada,
  SolicitudRevision,
} from '@core/api/originacion/revision.modelos';

import { TablaSolicitudesComponent } from './componentes/tabla-solicitudes/tabla-solicitudes.component';
import { MOTIVOS_ENRUTAMIENTO } from './modelos/motivos';
import { AvisoDecision, AvisoDecisionService } from './servicios/aviso-decision.service';

export type FaseBandeja = 'cargando' | 'listo' | 'error';

const PESTANAS: readonly EstadoSolicitudRevision[] = ['pending', 'decided'];

/**
 * S4 · Bandeja de decisión humana (HU-W1.1-02) y S4b · «Decisión registrada». El asesor ve las solicitudes que la
 * suscripción automática enrutó a revisión (CA-1), las separa en «Pendientes» y «Decididas» con sus conteos, las
 * filtra por motivo y las ordena por fecha de llegada (CA-5), y abre cada una para decidir. Al volver del detalle
 * tras registrar una decisión, la misma página anuncia «Decisión registrada» (S4b). Estados de carga, vacío y error
 * con reintento dentro de la página. El filtro y el orden los aplica el backend.
 *
 * Ruta: `/originacion/bandeja-decision` (solo asesor).
 */
@Component({
  selector: 'app-bandeja-decision-page',
  imports: [TranslocoDirective, TablaSolicitudesComponent, LucideCircleAlert, LucideCircleCheck],
  templateUrl: './bandeja-decision.page.html',
  styleUrl: './bandeja-decision.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BandejaDecisionPage implements OnInit {
  private readonly api = inject(OriginacionApiService);
  private readonly avisos = inject(AvisoDecisionService);
  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);
  private consulta: Subscription | null = null;

  protected readonly pestanas = PESTANAS;
  protected readonly motivos = MOTIVOS_ENRUTAMIENTO;

  protected readonly estado = signal<EstadoSolicitudRevision>('pending');
  protected readonly motivo = signal<string | null>(null);
  protected readonly orden = signal<OrdenLlegada>('asc');
  protected readonly fase = signal<FaseBandeja>('cargando');
  protected readonly solicitudes = signal<readonly SolicitudRevision[]>([]);
  protected readonly conteos = signal<ConteosBandeja | null>(null);
  /** S4b: decisión recién registrada en el detalle. */
  protected readonly aviso = signal<AvisoDecision | null>(null);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.consulta?.unsubscribe());
  }

  ngOnInit(): void {
    this.aviso.set(this.avisos.consumir());
    this.cargar();
  }

  protected cargar(): void {
    this.consulta?.unsubscribe();
    this.fase.set('cargando');
    this.consulta = this.api
      .listarSolicitudesRevision({ estado: this.estado(), motivo: this.motivo(), orden: this.orden() })
      .subscribe({
        next: (lista) => {
          this.solicitudes.set(lista.solicitudes);
          this.conteos.set(lista.conteos);
          this.fase.set('listo');
        },
        // 401 y 403 los resuelve el interceptor; el resto se muestra como error con reintento.
        error: () => this.fase.set('error'),
      });
  }

  protected seleccionarPestana(estado: EstadoSolicitudRevision): void {
    if (estado === this.estado()) {
      return;
    }
    this.estado.set(estado);
    this.cargar();
  }

  /** Flechas izquierda/derecha, Inicio y Fin mueven entre pestañas (patrón de pestañas de WAI-ARIA). */
  protected alTeclearPestana(evento: KeyboardEvent): void {
    const actual = PESTANAS.indexOf(this.estado());
    const destino: Partial<Record<string, number>> = {
      ArrowRight: (actual + 1) % PESTANAS.length,
      ArrowLeft: (actual - 1 + PESTANAS.length) % PESTANAS.length,
      Home: 0,
      End: PESTANAS.length - 1,
    };
    const indice = destino[evento.key];
    if (indice === undefined) {
      return;
    }
    evento.preventDefault();
    this.seleccionarPestana(PESTANAS[indice]);
    this.elemento.nativeElement.querySelector<HTMLElement>(`#pestana-${PESTANAS[indice]}`)?.focus();
  }

  protected cambiarMotivo(evento: Event): void {
    const valor = (evento.target as HTMLSelectElement).value;
    this.motivo.set(valor === '' ? null : valor);
    this.cargar();
  }

  protected cambiarOrden(evento: Event): void {
    this.orden.set((evento.target as HTMLSelectElement).value === 'desc' ? 'desc' : 'asc');
    this.cargar();
  }
}
