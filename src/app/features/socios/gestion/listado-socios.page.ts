import { ChangeDetectionStrategy, Component, OnInit, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideCircleAlert, LucidePlus } from '@lucide/angular';

import { SociosApiService } from '@core/api/socios/socios-api.service';
import { ErrorSocios, ListadoSocios, SolicitudRegistroSocio } from '@core/api/socios/socios.modelos';
import { FormatoFechaPipe } from '@shared/pipes/formato-fecha.pipe';
import { FormatoNumeroPipe } from '@shared/pipes/formato-numero.pipe';
import { InsigniaEstadoComponent } from '@shared/ui/insignia-estado/insignia-estado.component';

import { RegistrarSocioComponent } from './componentes/registrar-socio/registrar-socio.component';
import { anchoBarra, etiquetaCredenciales, etiquetaEstadoSocio, tonoConsumo } from './modelos/presentacion-socios';

/** Fase del listado. */
export type FaseListadoSocios = 'cargando' | 'lista' | 'vacio' | 'error';

/**
 * O10 · Socios comerciales (HU-W3.1-01): tres indicadores (socios activos, cuota media usada hoy y alertas de socios
 * cerca del límite), la tabla con credenciales, cuota y consumo de hoy y el estado de cada socio, y «Registrar socio»
 * (el socio queda pendiente de aprobación; la aprobación y las credenciales están en el detalle). La cuota es diaria
 * (usage plans de API Gateway, decisión del equipo). Un 503 muestra «Reintentar»; 401 y 403 los resuelve el
 * interceptor.
 *
 * Ruta: `/socios` (solo operaciones).
 */
@Component({
  selector: 'app-listado-socios-page',
  imports: [
    RouterLink,
    TranslocoDirective,
    InsigniaEstadoComponent,
    FormatoFechaPipe,
    FormatoNumeroPipe,
    RegistrarSocioComponent,
    LucideCircleAlert,
    LucidePlus,
  ],
  templateUrl: './listado-socios.page.html',
  styleUrl: './listado-socios.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListadoSociosPage implements OnInit {
  private readonly api = inject(SociosApiService);
  private readonly router = inject(Router);
  private readonly registro = viewChild.required(RegistrarSocioComponent);

  protected readonly fase = signal<FaseListadoSocios>('cargando');
  protected readonly listado = signal<ListadoSocios | null>(null);
  protected readonly registrando = signal(false);
  protected readonly errorRegistro = signal<ErrorSocios | null>(null);

  protected readonly etiquetaEstado = etiquetaEstadoSocio;
  protected readonly etiquetaCredenciales = etiquetaCredenciales;
  protected readonly tonoConsumo = tonoConsumo;
  protected readonly anchoBarra = anchoBarra;

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    this.fase.set('cargando');
    this.api.listar().subscribe({
      next: (listado) => {
        this.listado.set(listado);
        this.fase.set(listado.items.length > 0 ? 'lista' : 'vacio');
      },
      error: (error: unknown) => {
        const codigo = error instanceof ErrorSocios ? error.codigo : 'service_unavailable';
        if (codigo !== 'unauthorized' && codigo !== 'forbidden') {
          this.fase.set('error');
        }
      },
    });
  }

  protected abrirRegistro(): void {
    this.errorRegistro.set(null);
    this.registro().abrir();
  }

  protected registrar(solicitud: SolicitudRegistroSocio): void {
    this.registrando.set(true);
    this.errorRegistro.set(null);
    this.api.registrar(solicitud).subscribe({
      next: (socio) => {
        this.registrando.set(false);
        this.registro().cerrar();
        void this.router.navigate(['/socios', socio.socioId]);
      },
      error: (error: unknown) => {
        this.registrando.set(false);
        this.errorRegistro.set(error instanceof ErrorSocios ? error : new ErrorSocios('service_unavailable'));
      },
    });
  }
}
