import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { LucideArrowLeft, LucideCircleAlert, LucideFileText, LucideInfo } from '@lucide/angular';
import { map } from 'rxjs';

import { EntradaHistorial, ErrorEndoso, HistorialEndosos } from '@core/api/originacion/endosos.modelos';
import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';
import { InsigniaEstadoComponent } from '@shared/ui/insignia-estado/insignia-estado.component';

import { formatoDe, resumenCambio, textoValidacion } from '../endosos/modelos/formato-endoso';

/** Fase de la carga del historial. */
export type FaseHistorialEndosos = 'cargando' | 'listo' | 'noEncontrada' | 'error';

/** Una fila de la tabla ya en texto. */
interface FilaHistorial {
  aplicado: boolean;
  anterior: string;
  nuevo: string;
  /** «Solicitud SOL-MOD-…», y la validación que no cumplió si no se aplicó. */
  origen: string;
  rol: string;
}

const P = 'originacion.endosos.historial';

/**
 * O4 · Historial de endosos de la póliza (HU-W1.4-02, frame `39:4018`, CA-4): de solo lectura, con los endosos aplicados
 * y los intentos no aplicados, cada uno con la fecha y la hora, el número de endoso (o «No aplicado»), qué cambió y la
 * solicitud de origen, el valor anterior y el nuevo, y quién lo hizo con su rol. El registro es inmutable: la pantalla no
 * ofrece ninguna acción sobre las entradas. Sin endosos, el historial se muestra vacío sin errores. Sin «Exportar
 * historial» (decisión D-11).
 *
 * Ruta: `/originacion/polizas/:id/endosos` (solo operaciones).
 */
@Component({
  selector: 'app-historial-endosos-page',
  imports: [
    RouterLink,
    TranslocoDirective,
    InsigniaEstadoComponent,
    FormatoFechaHoraPipe,
    LucideArrowLeft,
    LucideCircleAlert,
    LucideFileText,
    LucideInfo,
  ],
  templateUrl: './historial-endosos.page.html',
  styleUrl: './historial-endosos.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistorialEndososPage implements OnInit {
  private readonly api = inject(OriginacionApiService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly transloco = inject(TranslocoService);
  private readonly destruccion = inject(DestroyRef);
  private polizaId = '';

  protected readonly fase = signal<FaseHistorialEndosos>('cargando');
  protected readonly historial = signal<HistorialEndosos | null>(null);

  ngOnInit(): void {
    this.ruta.paramMap
      .pipe(
        map((parametros) => parametros.get('id') ?? ''),
        takeUntilDestroyed(this.destruccion),
      )
      .subscribe((id) => {
        this.polizaId = id;
        this.cargar();
      });
  }

  protected cargar(): void {
    this.fase.set('cargando');
    this.api.consultarHistorialEndosos(this.polizaId).subscribe({
      next: (historial) => {
        this.historial.set(historial);
        this.fase.set('listo');
      },
      error: (error: unknown) => {
        const codigo = error instanceof ErrorEndoso ? error.codigo : 'endorsement_unavailable';
        if (codigo === 'unauthorized' || codigo === 'forbidden') {
          return;
        }
        this.fase.set(codigo === 'policy_not_found' || codigo === 'change_request_not_found' ? 'noEncontrada' : 'error');
      },
    });
  }

  /** «3 entradas en orden cronológico…», «1 entrada…» o «0 entradas · esta póliza no tiene endosos». */
  protected subtitulo(historial: HistorialEndosos): string {
    const n = historial.entradas.length;
    if (n === 0) {
      return this.transloco.translate(`${P}.subtituloVacio`);
    }
    return n === 1 ? this.transloco.translate(`${P}.subtituloUno`) : this.transloco.translate(`${P}.subtitulo`, { n });
  }

  protected fila(entrada: EntradaHistorial): FilaHistorial {
    const f = formatoDe(this.transloco);
    const aplicado = entrada.resultado === 'applied';
    const resumen = resumenCambio(f, entrada.cambios, entrada.prima, entrada.prima?.moneda);
    let origen = this.transloco.translate(`${P}.solicitud`, { id: entrada.solicitudId });
    if (!aplicado && entrada.fallidas.length > 0) {
      const titulo = textoValidacion(f, { codigo: entrada.fallidas[0], resultado: 'failed', parametros: {} }).titulo;
      const validacion = titulo.charAt(0).toLocaleLowerCase(f.idioma) + titulo.slice(1);
      origen = `${origen} · ${this.transloco.translate(`${P}.fallo`, { validacion })}`;
    }
    const claveRol = `${P}.rol.${entrada.por.rol}`;
    const rol = this.transloco.translate(claveRol);
    return {
      aplicado,
      anterior: resumen.anterior,
      nuevo: aplicado ? resumen.nuevo : this.transloco.translate(`${P}.sinCambio`),
      origen,
      rol: rol === claveRol ? entrada.por.rol : rol,
    };
  }
}
