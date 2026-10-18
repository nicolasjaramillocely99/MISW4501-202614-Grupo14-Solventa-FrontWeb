import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideCircleAlert, LucideCircleCheck, LucideTriangleAlert } from '@lucide/angular';

import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';
import { CotizacionAsistida, ErrorCotizacionAsistida } from '@core/api/originacion/cotizacion-asistida.modelos';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';
import { FormatoFechaPipe } from '@shared/pipes/formato-fecha.pipe';
import { FormatoMonedaPipe } from '@shared/pipes/formato-moneda.pipe';
import { InsigniaEstadoComponent, TonoInsignia } from '@shared/ui/insignia-estado/insignia-estado.component';

export type FaseResultado = 'cargando' | 'listo' | 'noEncontrada' | 'error';

type TonoAviso = 'exito' | 'advertencia' | 'error';

/** Aviso del resultado; los textos son claves bajo `originacion.cotizacionAsistida.resultado.avisos`. */
export interface AvisoResultado {
  tono: TonoAviso;
  titulo: string;
  texto: string;
  /** Fecha que se interpola como `{{fecha}}` en el texto. */
  fecha: string | null;
}

const CATEGORIAS_CONOCIDAS: readonly string[] = ['preferred', 'standard', 'high_risk', 'base_actuarial'];

/**
 * S2 · Cotización asistida · Resultado (HU-W1.1-01), con sus estados: resultado normal, **modo degradado**
 * (S2b: la cotización se generó con el último perfil en caché o con el perfil actuarial base porque las
 * fuentes externas no respondieron) y **cotización vencida** (pasadas 24 horas no se puede formalizar: se
 * informa el motivo y se ofrece generar una nueva). Los estados viven en la misma página.
 *
 * Ruta: `/originacion/cotizaciones/:id`. Siempre consulta la cotización por su id; el backend decide el
 * estado (`valid` o `expired`).
 */
@Component({
  selector: 'app-resultado-cotizacion-page',
  imports: [
    RouterLink,
    TranslocoDirective,
    InsigniaEstadoComponent,
    FormatoMonedaPipe,
    FormatoFechaPipe,
    FormatoFechaHoraPipe,
    LucideCircleAlert,
    LucideCircleCheck,
    LucideTriangleAlert,
  ],
  templateUrl: './resultado-cotizacion.page.html',
  styleUrl: './resultado-cotizacion.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultadoCotizacionPage implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly api = inject(OriginacionApiService);
  private readonly destruccion = inject(DestroyRef);

  protected readonly fase = signal<FaseResultado>('cargando');
  protected readonly cotizacion = signal<CotizacionAsistida | null>(null);

  protected readonly vencida = computed(() => this.cotizacion()?.estado === 'expired');

  /** Insignia del estado de la cotización: vencida, provisional (modo degradado) o vigente. */
  protected readonly insignia = computed<{ tono: TonoInsignia; texto: string } | null>(() => {
    const c = this.cotizacion();
    if (!c) {
      return null;
    }
    if (c.estado === 'expired') {
      return { tono: 'error', texto: 'insignia.vencida' };
    }
    return c.modo === 'provisional'
      ? { tono: 'advertencia', texto: 'insignia.provisional' }
      : { tono: 'exito', texto: 'insignia.vigente' };
  });

  protected readonly avisos = computed<AvisoResultado[]>(() => {
    const c = this.cotizacion();
    if (!c) {
      return [];
    }
    const avisos: AvisoResultado[] = [];
    if (c.estado === 'expired') {
      avisos.push({ tono: 'error', titulo: 'vencida.titulo', texto: 'vencida.texto', fecha: c.venceEn });
    }
    if (c.modo === 'provisional') {
      avisos.push(
        c.aviso === 'last_profile_in_use' && c.fechaPerfil
          ? { tono: 'advertencia', titulo: 'ultimoPerfil.titulo', texto: 'ultimoPerfil.texto', fecha: c.fechaPerfil }
          : { tono: 'advertencia', titulo: 'perfilBase.titulo', texto: 'perfilBase.texto', fecha: null },
      );
    }
    if (c.estado === 'valid' && c.modo === 'normal') {
      avisos.push({ tono: 'exito', titulo: 'generada.titulo', texto: 'generada.texto', fecha: c.venceEn });
    }
    return avisos;
  });

  /** Horas de vigencia de la cotización, derivadas de sus fechas (hoy 24 h) para el texto de la insignia. */
  protected readonly horasVigencia = computed(() => {
    const c = this.cotizacion();
    return c ? Math.round((new Date(c.venceEn).getTime() - new Date(c.creadaEn).getTime()) / 3_600_000) : 0;
  });

  /** Clave de la categoría de riesgo; una categoría desconocida se muestra tal cual. */
  protected readonly categoriaConocida = computed(() => CATEGORIAS_CONOCIDAS.includes(this.cotizacion()?.categoria ?? ''));

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    const { id } = this.ruta.snapshot.params;
    this.fase.set('cargando');
    this.api
      .consultarCotizacionAsistida(id)
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (cotizacion) => {
          this.cotizacion.set(cotizacion);
          this.fase.set('listo');
        },
        error: (error: unknown) => {
          this.fase.set(
            error instanceof ErrorCotizacionAsistida && error.codigo === 'quote_not_found' ? 'noEncontrada' : 'error',
          );
        },
      });
  }
}
