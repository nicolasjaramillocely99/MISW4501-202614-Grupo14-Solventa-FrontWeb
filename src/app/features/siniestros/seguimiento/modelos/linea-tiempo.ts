import { HistorialSiniestro } from '@core/api/siniestros/reenvio.modelos';
import { DetalleSiniestro, EstadoSiniestro } from '@core/api/siniestros/siniestro.modelos';
import { TriageAsegurado } from '@core/api/siniestros/triage.modelos';

/**
 * Línea de tiempo de A8 (HU-W2.1-02): las etapas del caso con la actual resaltada, sin Angular. Sale del caso
 * (`GET /v1/claims/{id}`), de su historial (`GET /v1/claims/{id}/history`: cambios, revisiones, decisión y prestador) y
 * de la prioridad del asegurado. Cada texto es una clave bajo `siniestros.detalle.lineaTiempo` con sus parámetros.
 */

export type EstadoEtapa = 'hecha' | 'actual' | 'pendiente';

export type ClaveEtapa =
  'radicado' | 'revision' | 'evaluacion' | 'aprobado' | 'pagado' | 'rechazado';

export interface Texto {
  clave: string;
  parametros?: Record<string, unknown>;
}

export interface EtapaSiniestro {
  clave: ClaveEtapa;
  estado: EstadoEtapa;
  /** El título de la etapa, que puede depender de cómo terminó («Revisión del asesor: aprobada»). */
  titulo: Texto;
  /** Cuándo llegó a la etapa; `null` si aún no llega. */
  fecha: string | null;
  /** Líneas de detalle, en orden. */
  detalle: Texto[];
}

/** El orden de las etapas: un caso avanza por ellas y no vuelve atrás (salvo una devolución). */
const ORDEN: Readonly<Record<EstadoSiniestro, number>> = {
  active: 1,
  returned: 1,
  in_evaluation: 2,
  approved: 3,
  payment_exception: 3,
  rejected: 3,
  paid: 4,
};

/** El primer instante en que el caso entró a alguno de los estados, según el historial. */
function entradaA(h: HistorialSiniestro, ...estados: EstadoSiniestro[]): string | null {
  const cambio = h.cambios.find((c) => estados.includes(c.estado));
  return cambio?.en ?? null;
}

function ultimaEntradaA(h: HistorialSiniestro, estado: EstadoSiniestro): string | null {
  const cambios = h.cambios.filter((c) => c.estado === estado);
  return cambios.length > 0 ? cambios[cambios.length - 1].en : null;
}

function estadoEtapa(posicion: number, actual: number): EstadoEtapa {
  return posicion < actual ? 'hecha' : posicion === actual ? 'actual' : 'pendiente';
}

/** Las etapas de A8, de la radicación al pago (o al rechazo). */
export function etapasSiniestro(
  caso: DetalleSiniestro,
  h: HistorialSiniestro,
  triage: TriageAsegurado | null,
): EtapaSiniestro[] {
  const estado = h.estado;
  const actual = ORDEN[estado] ?? 1;
  const etapas: EtapaSiniestro[] = [];

  const detalleRadicado: Texto[] = [{ clave: `canal.${caso.canal}` }];
  if (caso.soportes.archivos > 0) {
    detalleRadicado.push({ clave: 'soportes', parametros: { n: caso.soportes.archivos } });
  }
  etapas.push({
    clave: 'radicado',
    estado: 'hecha',
    titulo: { clave: 'radicado.titulo' },
    fecha: caso.radicadoEn,
    detalle: detalleRadicado,
  });

  etapas.push(etapaRevision(h, actual));

  const evaluacion: Texto[] = [];
  if (triage?.estado === 'assessed' && triage.nivel !== null) {
    evaluacion.push({
      clave: 'evaluacion.prioridad',
      parametros: { nivel: triage.nivel, dias: triage.diasResolucion },
    });
  }
  if (h.prestador) {
    evaluacion.push({
      clave: 'evaluacion.prestador',
      parametros: { nombre: h.prestador.nombre, km: h.prestador.distanciaKm },
    });
  }
  etapas.push({
    clave: 'evaluacion',
    estado: estadoEtapa(2, actual),
    titulo: { clave: 'evaluacion.titulo' },
    fecha: actual >= 2 ? entradaA(h, 'in_evaluation') : null,
    detalle:
      actual === 2
        ? evaluacion
        : actual > 2
          ? evaluacion.filter((t) => t.clave !== 'evaluacion.prioridad')
          : [],
  });

  const d = h.decision;
  if (estado === 'rejected') {
    etapas.push({
      clave: 'rechazado',
      estado: 'actual',
      titulo: { clave: 'rechazado.titulo' },
      fecha: d?.decididaEn ?? ultimaEntradaA(h, 'rejected'),
      detalle: d?.motivoRechazo
        ? [{ clave: 'rechazado.motivo', parametros: { motivo: d.motivoRechazo } }]
        : [],
    });
    return etapas;
  }

  const aprobado: Texto[] = [];
  if (d?.montoMinor != null) {
    aprobado.push({ clave: 'aprobado.monto', parametros: { pesos: d.montoMinor / 100 } });
  }
  if (estado === 'payment_exception') {
    aprobado.push({ clave: 'aprobado.excepcion' });
  } else if (estado === 'approved') {
    aprobado.push({ clave: 'aprobado.enCurso' });
  }
  etapas.push({
    clave: 'aprobado',
    estado: estadoEtapa(3, actual),
    titulo: { clave: 'aprobado.titulo' },
    fecha: actual >= 3 ? (d?.decididaEn ?? entradaA(h, 'approved')) : null,
    detalle: actual >= 3 ? aprobado : [{ clave: 'aprobado.pendiente' }],
  });

  etapas.push({
    clave: 'pagado',
    estado: estado === 'paid' ? 'actual' : 'pendiente',
    titulo: { clave: 'pagado.titulo' },
    fecha: estado === 'paid' ? (d?.pagadoEn ?? ultimaEntradaA(h, 'paid')) : null,
    detalle: [{ clave: estado === 'paid' ? 'pagado.hecho' : 'pagado.pendiente' }],
  });
  return etapas;
}

/** La revisión del asesor: pendiente, devuelta (espera al asegurado), reenviada o aprobada. */
function etapaRevision(h: HistorialSiniestro, actual: number): EtapaSiniestro {
  const ultima = h.revisiones.length > 0 ? h.revisiones[h.revisiones.length - 1] : null;
  if (h.estado === 'returned') {
    return {
      clave: 'revision',
      estado: 'actual',
      titulo: { clave: 'revision.devuelta' },
      fecha: h.ultimaDevolucion?.revisadaEn ?? ultimaEntradaA(h, 'returned'),
      detalle: [
        { clave: 'revision.por', parametros: { asesor: h.ultimaDevolucion?.nombreRevisor ?? '' } },
      ],
    };
  }
  if (actual === 1) {
    const reenviada = h.reenvios.length > 0;
    return {
      clave: 'revision',
      estado: 'actual',
      titulo: { clave: reenviada ? 'revision.reenviada' : 'revision.pendiente' },
      fecha: reenviada ? h.reenvios[h.reenvios.length - 1].reenviadoEn : null,
      detalle: [{ clave: 'revision.espera' }],
    };
  }
  const aprobada = [...h.revisiones].reverse().find((r) => r.resultado === 'approved') ?? ultima;
  return {
    clave: 'revision',
    estado: 'hecha',
    titulo: { clave: 'revision.aprobada' },
    fecha: aprobada?.revisadaEn ?? null,
    detalle: aprobada
      ? [{ clave: 'revision.por', parametros: { asesor: aprobada.nombreRevisor } }]
      : [],
  };
}

/** «Qué sigue» según la etapa: una clave bajo `siniestros.detalle.queSigue` con sus parámetros. */
export function queSigue(h: HistorialSiniestro, triage: TriageAsegurado | null): Texto {
  switch (h.estado) {
    case 'active':
      return { clave: 'active' };
    case 'returned':
      return { clave: 'returned' };
    case 'in_evaluation':
      if (h.prestador) {
        return { clave: 'in_evaluation.prestador', parametros: { nombre: h.prestador.nombre } };
      }
      if (triage?.estado === 'assessed' && triage.diasResolucion !== null) {
        return { clave: 'in_evaluation.dias', parametros: { dias: triage.diasResolucion } };
      }
      return { clave: 'in_evaluation.base' };
    default:
      return { clave: h.estado };
  }
}
