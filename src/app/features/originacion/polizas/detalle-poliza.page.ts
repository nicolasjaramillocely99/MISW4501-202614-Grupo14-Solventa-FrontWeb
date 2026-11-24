import { TitleCasePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import {
  LucideBan,
  LucideCircleAlert,
  LucideCircleCheck,
  LucideCircleX,
  LucideDownload,
  LucideFileText,
  LucidePencil,
  LucidePhone,
  LucideRefreshCw,
  LucideTriangleAlert,
} from '@lucide/angular';

import { DetallePoliza, ErrorPoliza } from '@core/api/originacion/detalle-poliza.modelos';
import { OriginacionApiService } from '@core/api/originacion/originacion-api.service';
import { MesPrima } from '@core/api/originacion/pago-poliza.modelos';
import {
  Beneficiario,
  BeneficiarioOneroso,
  CondicionesVigentes,
  FilaSolicitud,
} from '@core/api/originacion/solicitud-modificacion.modelos';
import { FormatoFechaHoraPipe } from '@shared/pipes/formato-fecha-hora.pipe';
import { FormatoFechaPipe } from '@shared/pipes/formato-fecha.pipe';
import { FormatoMonedaPipe } from '@shared/pipes/formato-moneda.pipe';
import {
  InsigniaEstadoComponent,
  TonoInsignia,
} from '@shared/ui/insignia-estado/insignia-estado.component';

import { DetalleCancelacionComponent } from '../cancelaciones/componentes/detalle-cancelacion/detalle-cancelacion.component';
import { EstadoSolicitudComponent } from '../endosos/componentes/estado-solicitud/estado-solicitud.component';
import { fechaCorta } from '../endosos/modelos/fecha-corta';
import { parametrosDesdeFiltro } from '../endosos/modelos/filtro-solicitudes';
import {
  formatoDocumento,
  formatoParticipacion,
  nombreDelOneroso,
} from '../endosos/modelos/formato-beneficiario';
import { estadoDePoliza, tonoDePoliza } from './modelos/estado-poliza';

type Fase = 'cargando' | 'listo' | 'noEncontrada' | 'error';

/** Lo que carga cada tarjeta de HU-W1.4-01 («Beneficiarios» y «Mis solicitudes»), aparte de la póliza. */
type FaseTarjeta = 'cargando' | 'listo' | 'error';

/** Las solicitudes más recientes de la póliza que muestra «Mis solicitudes»; «Ver todas» lleva a A11 con el resto. */
export const SOLICITUDES_EN_DETALLE = 5;

/** Un paso del historial de cobros (A2b): la cancelación o un mes de la prima. */
export interface PasoHistorial {
  clave: string;
  /** `cancelacion`, `pagado`, `rechazado` (con intentos) o `pendiente` (sin intentos aún). */
  tipo: 'cancelacion' | 'pagado' | 'rechazado' | 'pendiente';
  mes: number;
  fecha: string;
  monto: number;
  moneda: string;
  /** Las fechas de los intentos rechazados, en orden. */
  intentos: string[];
  codigo: string | null;
}

/** El historial de cobros, del más reciente al más antiguo: la cancelación (si la hay) y cada mes facturado. */
export function historialDe(poliza: DetallePoliza): PasoHistorial[] {
  const pasos: PasoHistorial[] = [];
  const c = poliza.cancelacion;
  // La cancelación a solicitud del asegurado (HU-W1.6-01) no es un paso del historial de cobros.
  if (c?.motivo === 'non_payment') {
    pasos.push({
      clave: 'cancelacion',
      tipo: 'cancelacion',
      mes: c.mes,
      fecha: c.canceladaEn,
      monto: c.monto,
      moneda: c.moneda,
      intentos: [],
      codigo: null,
    });
  }
  for (const m of poliza.meses) {
    pasos.push(pasoDe(m));
  }
  return pasos;
}

function pasoDe(m: MesPrima): PasoHistorial {
  const rechazos = m.intentos.filter((i) => i.resultado === 'declined');
  const ultimo = rechazos[rechazos.length - 1];
  const base = {
    clave: `mes-${m.mes}`,
    mes: m.mes,
    monto: m.monto,
    moneda: m.moneda,
    codigo: ultimo?.codigoRechazo ?? null,
  };
  if (m.estado === 'paid') {
    return { ...base, tipo: 'pagado', fecha: m.pagadoEn ?? m.venceEn, intentos: [] };
  }
  if (rechazos.length > 0) {
    return {
      ...base,
      tipo: 'rechazado',
      fecha: ultimo.intentadoEn,
      intentos: rechazos.map((i) => i.intentadoEn),
    };
  }
  return { ...base, tipo: 'pendiente', fecha: m.venceEn, intentos: [] };
}

/**
 * A2 · Detalle de la póliza y A2b · Póliza cancelada por no pago (HU-W1.6-02): el resumen con la prima mensual, el
 * estado del pago y el medio de pago, las coberturas y el historial de cobros. Una póliza en gracia avisa cuándo se
 * cobra de nuevo y cuándo se cancela; una cancelada dice el motivo, que no hay reembolso y que se avisó al asegurado.
 *
 * Los botones y las tarjetas del prototipo están todos. «Descargar póliza» y las condiciones particulares descargan el
 * documento contractual de HU-W1.3-03. Los que no tienen historia en el sistema aparecen deshabilitados y dicen
 * «Disponible próximamente»: las condiciones generales, el certificado de vigencia, «Hablar con un asesor» y «Solicitar
 * nueva cotización». Ruta: `/originacion/polizas/:id`. Exige la sesión del asegurado.
 *
 * HU-W1.6-01: «Cancelar póliza» lleva a A5 (`/originacion/polizas/:id/cancelar`). Una póliza cancelada a solicitud del
 * asegurado se muestra como A5b (D-8 a): su encabezado y el detalle del reembolso, en lugar del contenido de A2/A2b.
 *
 * HU-W1.4-01 (ajuste A-10): «Solicitar modificación» y el «Modificar» de «Beneficiarios» llevan a A3
 * (`/originacion/polizas/:id/modificar`); «Beneficiarios» muestra los vigentes con el oneroso, de las condiciones
 * vigentes (`current-terms`), y «Mis solicitudes», las más recientes de la póliza con su estado, con «Ver todas» hacia
 * A11 filtrada por la póliza. Una póliza cancelada no muestra nada de eso ni lo consulta.
 */
@Component({
  selector: 'app-detalle-poliza-page',
  imports: [
    RouterLink,
    TitleCasePipe,
    TranslocoDirective,
    InsigniaEstadoComponent,
    EstadoSolicitudComponent,
    DetalleCancelacionComponent,
    FormatoFechaPipe,
    FormatoFechaHoraPipe,
    FormatoMonedaPipe,
    LucideBan,
    LucideCircleAlert,
    LucideCircleCheck,
    LucideCircleX,
    LucideDownload,
    LucideFileText,
    LucidePencil,
    LucidePhone,
    LucideRefreshCw,
    LucideTriangleAlert,
  ],
  templateUrl: './detalle-poliza.page.html',
  styleUrl: './detalle-poliza.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetallePolizaPage implements OnInit {
  private readonly api = inject(OriginacionApiService);
  private readonly ruta = inject(ActivatedRoute);
  private readonly destruccion = inject(DestroyRef);
  private readonly transloco = inject(TranslocoService);

  protected readonly fase = signal<Fase>('cargando');
  /** El PDF de la póliza se está pidiendo, o no se pudo descargar. */
  protected readonly descargando = signal(false);
  protected readonly errorDescarga = signal(false);
  protected readonly poliza = signal<DetallePoliza | null>(null);

  protected readonly estado = computed(() => {
    const p = this.poliza();
    return p ? estadoDePoliza(p) : 'vigente';
  });
  protected readonly tono = computed<TonoInsignia>(() => tonoDePoliza(this.estado()));
  /** La cancelación a solicitud del asegurado (HU-W1.6-01): la página muestra A5b en lugar de A2/A2b. */
  protected readonly cancelacionAPedido = computed(() => {
    const c = this.poliza()?.cancelacion;
    return c?.motivo === 'insured_request' ? c : null;
  });
  /** La cancelación por no pago de A2b (HU-W1.6-02); `null` sin cancelación o si fue a solicitud del asegurado. */
  protected readonly cancelacionNoPago = computed(() => {
    const c = this.poliza()?.cancelacion;
    return c?.motivo === 'non_payment' ? c : null;
  });
  protected readonly historial = computed(() => {
    const p = this.poliza();
    return p ? historialDe(p) : [];
  });
  /** El último mes pagado: «Último pago recibido» de A2b. */
  protected readonly ultimoPago = computed(
    () => this.poliza()?.meses.find((m) => m.estado === 'paid') ?? null,
  );

  /** «Beneficiarios» (HU-W1.4-01): las condiciones vigentes de la póliza, con el oneroso. */
  protected readonly faseBeneficiarios = signal<FaseTarjeta>('cargando');
  protected readonly condiciones = signal<CondicionesVigentes | null>(null);
  /** «Mis solicitudes» (HU-W1.4-01): las más recientes de la póliza. */
  protected readonly faseSolicitudes = signal<FaseTarjeta>('cargando');
  protected readonly solicitudes = signal<FilaSolicitud[]>([]);
  /** «Ver todas»: A11 filtrada por la póliza, con la misma URL que arma A11. */
  protected readonly filtroSolicitudes = computed(() =>
    parametrosDesdeFiltro({ estado: null, polizaId: this.poliza()?.polizaId ?? null, desde: null }),
  );

  /** «Descargar póliza»: el documento contractual en PDF (HU-W1.3-03); el JWT lo adjunta el interceptor. */
  protected descargarPoliza(): void {
    const id = this.poliza()?.polizaId;
    if (!id || this.descargando()) {
      return;
    }
    this.descargando.set(true);
    this.errorDescarga.set(false);
    this.api
      .descargarDocumentoContractual(id)
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (pdf) => {
          const url = URL.createObjectURL(pdf);
          const enlace = document.createElement('a');
          enlace.href = url;
          enlace.download = `poliza-${id}.pdf`;
          enlace.click();
          URL.revokeObjectURL(url);
          this.descargando.set(false);
        },
        error: () => {
          this.descargando.set(false);
          this.errorDescarga.set(true);
        },
      });
  }

  /** Las condiciones vigentes de la póliza para «Beneficiarios» (HU-W1.4-01). */
  protected cargarBeneficiarios(): void {
    const id = this.poliza()?.polizaId;
    if (!id) {
      return;
    }
    this.faseBeneficiarios.set('cargando');
    this.api
      .consultarCondicionesVigentes(id)
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (condiciones) => {
          this.condiciones.set(condiciones);
          this.faseBeneficiarios.set('listo');
        },
        error: () => this.faseBeneficiarios.set('error'),
      });
  }

  /** Las solicitudes más recientes de la póliza para «Mis solicitudes» (HU-W1.4-01). */
  protected cargarSolicitudes(): void {
    const id = this.poliza()?.polizaId;
    if (!id) {
      return;
    }
    this.faseSolicitudes.set('cargando');
    this.api
      .listarMisSolicitudes({
        estado: null,
        polizaId: id,
        desde: null,
        pagina: 1,
        tamano: SOLICITUDES_EN_DETALLE,
      })
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (pagina) => {
          this.solicitudes.set(pagina.items);
          this.faseSolicitudes.set('listo');
        },
        error: () => this.faseSolicitudes.set('error'),
      });
  }

  protected nombreOneroso(oneroso: BeneficiarioOneroso): string {
    return nombreDelOneroso(
      oneroso,
      this.transloco.translate('originacion.solicitudes.beneficiarios.entidadGenerica'),
    );
  }

  protected documento(b: Beneficiario): string {
    return formatoDocumento(b.tipoDocumento, b.numeroDocumento, this.transloco.getActiveLang());
  }

  protected participacion(b: Beneficiario): string {
    return formatoParticipacion(b.participacion, this.transloco.getActiveLang());
  }

  /** «16/09/2026»: la fecha corta de A11. */
  protected fechaCorta(iso: string): string {
    return fechaCorta(iso, this.transloco.getActiveLang());
  }

  /** La clave del título de un paso del historial; un solo intento rechazado va en singular. */
  protected tituloDe(paso: PasoHistorial): string {
    return paso.tipo === 'rechazado' && paso.intentos.length === 1
      ? 'historial.rechazadoUno'
      : `historial.${paso.tipo}`;
  }

  ngOnInit(): void {
    this.cargar();
  }

  protected cargar(): void {
    const id = this.ruta.snapshot.paramMap.get('id') ?? '';
    this.fase.set('cargando');
    this.api
      .consultarPoliza(id)
      .pipe(takeUntilDestroyed(this.destruccion))
      .subscribe({
        next: (poliza) => {
          this.poliza.set(poliza);
          this.fase.set('listo');
          // HU-W1.4-01: una póliza cancelada no muestra beneficiarios ni solicitudes.
          if (!poliza.cancelacion) {
            this.cargarBeneficiarios();
            this.cargarSolicitudes();
          }
        },
        error: (error: unknown) =>
          this.fase.set(
            error instanceof ErrorPoliza && error.codigo === 'policy_not_found'
              ? 'noEncontrada'
              : 'error',
          ),
      });
  }
}
