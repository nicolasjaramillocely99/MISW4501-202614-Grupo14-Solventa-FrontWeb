import { ChangeDetectionStrategy, Component, OnInit, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideArrowLeft, LucideCircleAlert, LucideInfo, LucideKeyRound } from '@lucide/angular';
import { Observable } from 'rxjs';

import { SociosApiService } from '@core/api/socios/socios-api.service';
import { CredencialesEmitidas, DetalleSocio, ErrorSocios } from '@core/api/socios/socios.modelos';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';
import { FormatoFechaPipe } from '@shared/pipes/formato-fecha.pipe';
import { FormatoNumeroPipe } from '@shared/pipes/formato-numero.pipe';
import { InsigniaEstadoComponent } from '@shared/ui/insignia-estado/insignia-estado.component';

import { RotarCredencialesComponent } from './componentes/rotar-credenciales/rotar-credenciales.component';
import { SecretoEmitidoComponent } from './componentes/secreto-emitido/secreto-emitido.component';
import { anchoBarra, etiquetaEstadoSocio, tonoConsumo, valoresDetalle } from './modelos/presentacion-socios';

/** Fase del detalle. */
export type FaseDetalleSocio = 'cargando' | 'listo' | 'noEncontrado' | 'error';

/** Errores de la aprobación y la rotación con texto propio (`socios.errores.*`); cualquier otro usa `generico`. */
const ERRORES_CON_TEXTO: readonly string[] = ['partner_not_pending', 'partner_not_active', 'rotation_in_progress', 'gateway_unavailable'];

function claveError(error: unknown): string {
  const codigo = error instanceof ErrorSocios ? error.codigo : 'service_unavailable';
  return ERRORES_CON_TEXTO.includes(codigo) ? codigo : 'generico';
}

/**
 * O11 · Detalle del socio y credenciales (HU-W3.1-01): datos del socio, credenciales de acceso (el secreto nunca se
 * vuelve a mostrar: solo su pista), cuota diaria y consumo de hoy, aislamiento por socio e historial de credenciales.
 * Un socio pendiente se aprueba aquí («Aprobar y generar credenciales», CA-1); uno activo rota sus credenciales con un
 * periodo de transición (CA-5). Tras aprobar o rotar, el secreto se muestra una sola vez en un modal (CA-4) y la página
 * se actualiza con la respuesta. «Dar de baja» es de HU-W3.1-02 y no se muestra. «Uso reciente» llegará con el tablero
 * de desempeño (HU-W3.2-01).
 *
 * Ruta: `/socios/:id` (solo operaciones).
 */
@Component({
  selector: 'app-detalle-socio-page',
  imports: [
    RouterLink,
    TranslocoDirective,
    InsigniaEstadoComponent,
    FormatoFechaPipe,
    FormatoFechaHoraPipe,
    FormatoNumeroPipe,
    RotarCredencialesComponent,
    SecretoEmitidoComponent,
    LucideArrowLeft,
    LucideCircleAlert,
    LucideInfo,
    LucideKeyRound,
  ],
  templateUrl: './detalle-socio.page.html',
  styleUrl: './detalle-socio.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetalleSocioPage implements OnInit {
  private readonly api = inject(SociosApiService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly rotacion = viewChild.required(RotarCredencialesComponent);
  private readonly secreto = viewChild.required(SecretoEmitidoComponent);

  protected readonly fase = signal<FaseDetalleSocio>('cargando');
  protected readonly socio = signal<DetalleSocio | null>(null);
  protected readonly aprobando = signal(false);
  protected readonly errorAprobacion = signal<string | null>(null);
  protected readonly rotando = signal(false);
  protected readonly errorRotacion = signal<string | null>(null);

  protected readonly etiquetaEstado = etiquetaEstadoSocio;
  protected readonly tonoConsumo = tonoConsumo;
  protected readonly anchoBarra = anchoBarra;
  protected readonly valoresDetalle = valoresDetalle;

  private get socioId(): string {
    return this.ruta.snapshot.paramMap.get('id') ?? '';
  }

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.fase.set('cargando');
    this.api.obtener(this.socioId).subscribe({
      next: (socio) => {
        this.socio.set(socio);
        this.fase.set('listo');
      },
      error: (error: unknown) => {
        const codigo = error instanceof ErrorSocios ? error.codigo : 'service_unavailable';
        if (codigo === 'partner_not_found') {
          this.fase.set('noEncontrado');
        } else if (codigo !== 'unauthorized' && codigo !== 'forbidden') {
          this.fase.set('error');
        }
      },
    });
  }

  /** «Aprobar y generar credenciales» (CA-1). */
  protected aprobar(): void {
    if (this.aprobando()) {
      return;
    }
    this.aprobando.set(true);
    this.errorAprobacion.set(null);
    this.emitir(this.api.aprobar(this.socioId), () => this.aprobando.set(false), (clave) => this.errorAprobacion.set(clave));
  }

  protected abrirRotacion(): void {
    this.errorRotacion.set(null);
    this.rotacion().abrir();
  }

  /** Confirmación del modal de rotación (CA-5). */
  protected rotar(horas: number): void {
    this.rotando.set(true);
    this.errorRotacion.set(null);
    this.emitir(
      this.api.rotar(this.socioId, horas),
      () => {
        this.rotando.set(false);
        this.rotacion().cerrar();
      },
      (clave) => {
        this.rotando.set(false);
        this.errorRotacion.set(clave);
      },
    );
  }

  /** Actualiza la página con la respuesta y muestra el secreto una sola vez (CA-4). */
  private emitir(solicitud: Observable<CredencialesEmitidas>, alTerminar: () => void, alFallar: (clave: string) => void): void {
    solicitud.subscribe({
      next: ({ socio, secreto }) => {
        alTerminar();
        this.socio.set(socio);
        this.secreto().mostrar(secreto);
      },
      error: (error: unknown) => {
        this.aprobando.set(false);
        alFallar(claveError(error));
      },
    });
  }
}
