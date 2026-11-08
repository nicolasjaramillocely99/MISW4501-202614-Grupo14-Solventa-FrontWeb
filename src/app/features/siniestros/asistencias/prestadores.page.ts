import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideCircleAlert, LucideCircleCheck } from '@lucide/angular';
import { finalize } from 'rxjs';

import {
  DisponibilidadPrestador,
  FiltroPrestadores,
  Prestador,
} from '@core/api/siniestros/asignacion.modelos';
import { SiniestrosApiService } from '@core/api/siniestros/siniestros-api.service';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';
import { FormatoFechaPipe } from '@shared/pipes/formato-fecha.pipe';
import {
  InsigniaEstadoComponent,
  TonoInsignia,
} from '@shared/ui/insignia-estado/insignia-estado.component';

import { Traductor } from '../modelos/catalogo-siniestros';
import {
  CambioDisponibilidad,
  DisponibilidadPrestadorComponent,
} from './componentes/disponibilidad-prestador/disponibilidad-prestador.component';
import {
  ESPECIALIDADES_CONOCIDAS,
  aFechaLocal,
  fechaLocal,
  nombreEspecialidad,
  nombresEspecialidades,
} from './modelos/presentacion-asignacion';

export type FasePrestadores = 'cargando' | 'listo' | 'error';

const DISPONIBILIDADES: readonly DisponibilidadPrestador[] = ['available', 'unavailable', 'busy'];
const TONO: Readonly<Record<DisponibilidadPrestador, TonoInsignia>> = {
  available: 'exito',
  unavailable: 'error',
  busy: 'advertencia',
};
const CARGA_INICIAL = 'reference-data';

/**
 * Administración mínima de prestadores (HU-W2.3-01, CA-2 «registro administrable por operaciones», decisión F2; sin frame
 * en Figma): el registro por nombre con filtros de especialidad y disponibilidad (en `?especialidad=&disponibilidad=`)
 * y el cambio de disponibilidad. «Liberar» marca disponible a un prestador ocupado en un caso (D13): lo hará solo
 * HU-W2.3-02 al cerrar la intervención. Ruta: `/siniestros/prestadores` (solo operaciones).
 */
// Provisional (HU-W2.3-01 F2): el alta y la edición del perfil del prestador quedan pendientes (la API existe).
@Component({
  selector: 'app-prestadores-page',
  imports: [
    RouterLink,
    TranslocoDirective,
    InsigniaEstadoComponent,
    DisponibilidadPrestadorComponent,
    FormatoFechaPipe,
    FormatoFechaHoraPipe,
    LucideCircleAlert,
    LucideCircleCheck,
  ],
  templateUrl: './prestadores.page.html',
  styleUrl: './prestadores.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrestadoresPage implements OnInit {
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(SiniestrosApiService);
  private readonly destruccion = inject(DestroyRef);
  private readonly dialogo = viewChild(DisponibilidadPrestadorComponent);

  protected readonly fase = signal<FasePrestadores>('cargando');
  protected readonly prestadores = signal<Prestador[]>([]);
  protected readonly filtro = signal<FiltroPrestadores>({});
  protected readonly guardando = signal(false);
  protected readonly errorGuardado = signal(false);
  /** Nombre del último prestador actualizado, para el aviso. */
  protected readonly actualizado = signal<string | null>(null);

  protected readonly especialidades = ESPECIALIDADES_CONOCIDAS;
  protected readonly disponibilidades = DISPONIBILIDADES;
  protected readonly cargaInicial = CARGA_INICIAL;
  protected readonly hoy = fechaLocal(new Date());
  protected readonly aFechaLocal = aFechaLocal;
  protected readonly conFiltros = computed(
    () => !!this.filtro().especialidad || !!this.filtro().disponibilidad,
  );

  ngOnInit(): void {
    const params = this.ruta.snapshot.queryParamMap;
    const disponibilidad = params.get('disponibilidad');
    this.filtro.set({
      especialidad: params.get('especialidad') || undefined,
      disponibilidad: DISPONIBILIDADES.find((d) => d === disponibilidad),
    });
    this.cargar();
  }

  protected cargar(): void {
    this.fase.set('cargando');
    this.api
      .listarPrestadores(this.filtro())
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (prestadores) => {
          this.prestadores.set(prestadores);
          this.fase.set('listo');
        },
        error: () => this.fase.set('error'),
      });
  }

  protected filtrar(campo: keyof FiltroPrestadores, valor: string): void {
    this.filtro.update((f) => ({ ...f, [campo]: valor || undefined }));
    this.escribirFiltroEnUrl();
    this.cargar();
  }

  protected limpiar(): void {
    this.filtro.set({});
    this.escribirFiltroEnUrl();
    this.cargar();
  }

  protected abrir(prestador: Prestador): void {
    this.errorGuardado.set(false);
    this.actualizado.set(null);
    this.dialogo()?.abrir(prestador);
  }

  protected guardar({ prestador, solicitud }: CambioDisponibilidad): void {
    if (this.guardando()) {
      return;
    }
    this.guardando.set(true);
    this.errorGuardado.set(false);
    this.api
      .cambiarDisponibilidadPrestador(prestador.id, solicitud)
      .pipe(
        finalize(() => this.guardando.set(false)),
        takeUntilDestroyed(this.destruccion),
      )
      .subscribe({
        next: (cambiado) => {
          this.prestadores.update((lista) =>
            lista.map((p) => (p.id === cambiado.id ? cambiado : p)),
          );
          this.actualizado.set(cambiado.nombre);
          this.dialogo()?.cerrar();
        },
        error: () => this.errorGuardado.set(true),
      });
  }

  protected especialidad(t: Traductor, codigo: string): string {
    return nombreEspecialidad(t, codigo);
  }

  protected especialidadesDe(t: Traductor, p: Prestador): string {
    return nombresEspecialidades(t, p.especialidades);
  }

  protected tono(disponibilidad: DisponibilidadPrestador): TonoInsignia {
    return TONO[disponibilidad] ?? 'neutro';
  }

  private escribirFiltroEnUrl(): void {
    const f = this.filtro();
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: {
        especialidad: f.especialidad ?? null,
        disponibilidad: f.disponibilidad ?? null,
      },
      replaceUrl: true,
    });
  }
}
