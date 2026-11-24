import { DEVOLUCION_DTO } from '@testing/revision-radicacion-pruebas';
import { SINIESTRO_RADICADO_DTO } from '@testing/siniestros-pruebas';
import { TRIAGE_ASEGURADO_DTO } from '@testing/triage-pruebas';

import {
  HistorialSiniestroDto,
  mapearHistorialSiniestro,
} from '@core/api/siniestros/reenvio.modelos';
import { EstadoSiniestro, mapearDetalleSiniestro } from '@core/api/siniestros/siniestro.modelos';
import { TriageAsegurado, mapearTriageSiniestro } from '@core/api/siniestros/triage.modelos';

import { etapasSiniestro, queSigue } from './linea-tiempo';
import { INTERVALO_REFRESCO_MS, refrescoVisible } from './refresco';

const CASO = mapearDetalleSiniestro(SINIESTRO_RADICADO_DTO);
const TRIAGE = mapearTriageSiniestro(TRIAGE_ASEGURADO_DTO) as TriageAsegurado;
const APROBADA = {
  ...DEVOLUCION_DTO,
  outcome: 'approved' as const,
  reason_code: null,
  message: null,
};

function historial(estado: EstadoSiniestro, extra: Partial<HistorialSiniestroDto> = {}) {
  return mapearHistorialSiniestro({
    claim_id: CASO.id,
    filing_number: CASO.numeroRadicado,
    status: estado,
    last_changed_at: '2026-09-16T00:00:00Z',
    changes: [
      { id: 1, status: 'active', previous_status: null, changed_at: CASO.radicadoEn },
      {
        id: 2,
        status: 'in_evaluation',
        previous_status: 'active',
        changed_at: '2026-09-15T10:00:00Z',
      },
    ],
    reviews: [APROBADA],
    last_return: null,
    ...extra,
  });
}

const resumen = (
  estado: EstadoSiniestro,
  extra: Partial<HistorialSiniestroDto> = {},
  triage: TriageAsegurado | null = TRIAGE,
) => etapasSiniestro(CASO, historial(estado, extra), triage).map((e) => `${e.clave}:${e.estado}`);

describe('Línea de tiempo de A8 (HU-W2.1-02)', () => {
  it('un caso por revisar está en la revisión del asesor, con la radicación hecha', () => {
    const etapas = etapasSiniestro(CASO, historial('active', { reviews: [], changes: [] }), null);

    expect(etapas.map((e) => `${e.clave}:${e.estado}`)).toEqual([
      'radicado:hecha',
      'revision:actual',
      'evaluacion:pendiente',
      'aprobado:pendiente',
      'pagado:pendiente',
    ]);
    expect(etapas[0].detalle).toEqual([
      { clave: 'canal.web' },
      { clave: 'soportes', parametros: { n: 8 } },
    ]);
    expect(etapas[1].titulo.clave).toBe('revision.pendiente');
    expect(etapas[2].fecha).toBeNull();
  });

  it('un caso reenviado espera otra vez al asesor', () => {
    const etapas = etapasSiniestro(
      CASO,
      historial('active', {
        resubmissions: [
          {
            seq: 1,
            review_seq: 1,
            resubmitted_by: 'sub',
            resubmitted_at: '2026-09-16T10:00:00Z',
            changed_facts: [],
            changed_supports: [],
          },
        ],
      }),
      null,
    );

    expect(etapas[1].titulo.clave).toBe('revision.reenviada');
    expect(etapas[1].fecha).toBe('2026-09-16T10:00:00Z');
  });

  it('un caso devuelto espera al asegurado en la revisión', () => {
    const etapas = etapasSiniestro(
      CASO,
      historial('returned', { last_return: DEVOLUCION_DTO }),
      null,
    );

    expect(etapas[1]).toMatchObject({
      estado: 'actual',
      titulo: { clave: 'revision.devuelta' },
      fecha: DEVOLUCION_DTO.reviewed_at,
      detalle: [{ clave: 'revision.por', parametros: { asesor: 'Juan Ríos' } }],
    });
  });

  it('en evaluación muestra la prioridad y el prestador; después solo el prestador', () => {
    const conPrestador = {
      provider: {
        name: 'Servicios Hogar Norte',
        distance_km: 2.3,
        assigned_at: '2026-09-15T11:00:00Z',
      },
    };
    const evaluacion = etapasSiniestro(CASO, historial('in_evaluation', conPrestador), TRIAGE)[2];

    expect(evaluacion).toMatchObject({ estado: 'actual', fecha: '2026-09-15T10:00:00Z' });
    expect(evaluacion.detalle).toEqual([
      { clave: 'evaluacion.prioridad', parametros: { nivel: 3, dias: 10 } },
      { clave: 'evaluacion.prestador', parametros: { nombre: 'Servicios Hogar Norte', km: 2.3 } },
    ]);
    const despues = etapasSiniestro(CASO, historial('approved', conPrestador), TRIAGE)[2];
    expect(despues.detalle.map((t) => t.clave)).toEqual(['evaluacion.prestador']);
    expect(resumen('in_evaluation', {}, null)).toContain('evaluacion:actual');
  });

  it('aprobado, con el pago en curso o con un problema', () => {
    const decision = {
      outcome: 'approved' as const,
      decided_at: '2026-09-17T10:00:00Z',
      amount_minor: 435_000_000,
      currency: 'COP',
      payout_status: 'pending' as const,
      paid_at: null,
      rejection_reason: null,
    };
    const aprobado = etapasSiniestro(CASO, historial('approved', { decision }), TRIAGE)[3];

    expect(aprobado).toMatchObject({ estado: 'actual', fecha: '2026-09-17T10:00:00Z' });
    expect(aprobado.detalle).toEqual([
      { clave: 'aprobado.monto', parametros: { pesos: 4_350_000 } },
      { clave: 'aprobado.enCurso' },
    ]);
    const excepcion = etapasSiniestro(
      CASO,
      historial('payment_exception', { decision }),
      TRIAGE,
    )[3];
    expect(excepcion.detalle.map((t) => t.clave)).toEqual(['aprobado.monto', 'aprobado.excepcion']);
  });

  it('pagado: todo hecho y el pago con su fecha', () => {
    const decision = {
      outcome: 'approved' as const,
      decided_at: '2026-09-17T10:00:00Z',
      amount_minor: 435_000_000,
      currency: 'COP',
      payout_status: 'confirmed' as const,
      paid_at: '2026-09-18T10:00:00Z',
      rejection_reason: null,
    };

    const etapas = etapasSiniestro(CASO, historial('paid', { decision }), TRIAGE);

    expect(etapas.map((e) => `${e.clave}:${e.estado}`)).toEqual([
      'radicado:hecha',
      'revision:hecha',
      'evaluacion:hecha',
      'aprobado:hecha',
      'pagado:actual',
    ]);
    expect(etapas[4].fecha).toBe('2026-09-18T10:00:00Z');
    expect(etapas[1].detalle).toEqual([
      { clave: 'revision.por', parametros: { asesor: 'Juan Ríos' } },
    ]);
  });

  it('rechazado termina en el rechazo con su motivo, sin pago', () => {
    const decision = {
      outcome: 'rejected' as const,
      decided_at: '2026-09-17T10:00:00Z',
      amount_minor: null,
      currency: null,
      payout_status: null,
      paid_at: null,
      rejection_reason: 'No cubierto.',
    };

    const etapas = etapasSiniestro(CASO, historial('rejected', { decision }), TRIAGE);

    expect(etapas.map((e) => e.clave)).toEqual(['radicado', 'revision', 'evaluacion', 'rechazado']);
    expect(etapas[3]).toMatchObject({
      estado: 'actual',
      fecha: '2026-09-17T10:00:00Z',
      detalle: [{ clave: 'rechazado.motivo', parametros: { motivo: 'No cubierto.' } }],
    });
    expect(etapasSiniestro(CASO, historial('rejected'), null)[3].detalle).toEqual([]);
  });

  it('«Qué sigue» depende de la etapa, del prestador y del tiempo estimado', () => {
    expect(queSigue(historial('active'), null)).toEqual({ clave: 'active' });
    expect(queSigue(historial('returned'), null)).toEqual({ clave: 'returned' });
    expect(queSigue(historial('in_evaluation'), null)).toEqual({ clave: 'in_evaluation.base' });
    expect(queSigue(historial('in_evaluation'), TRIAGE)).toEqual({
      clave: 'in_evaluation.dias',
      parametros: { dias: 10 },
    });
    expect(
      queSigue(
        historial('in_evaluation', {
          provider: { name: 'Taller Norte', distance_km: 1, assigned_at: '2026-09-15T11:00:00Z' },
        }),
        TRIAGE,
      ),
    ).toEqual({ clave: 'in_evaluation.prestador', parametros: { nombre: 'Taller Norte' } });
    expect(queSigue(historial('paid'), null)).toEqual({ clave: 'paid' });
  });
});

describe('refresco de A7 y A8 (CA-2)', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }));
  afterEach(() => vi.useRealTimers());

  it('emite cada minuto solo con la pestaña visible', () => {
    let visible: DocumentVisibilityState = 'visible';
    const documento = {
      get visibilityState() {
        return visible;
      },
    } as Document;
    let emisiones = 0;
    const sub = refrescoVisible(INTERVALO_REFRESCO_MS, documento).subscribe(() => emisiones++);

    vi.advanceTimersByTime(INTERVALO_REFRESCO_MS);
    expect(emisiones).toBe(1);
    visible = 'hidden';
    vi.advanceTimersByTime(3 * INTERVALO_REFRESCO_MS);
    expect(emisiones).toBe(1);
    visible = 'visible';
    vi.advanceTimersByTime(INTERVALO_REFRESCO_MS);
    expect(emisiones).toBe(2);
    sub.unsubscribe();
    expect(INTERVALO_REFRESCO_MS).toBeLessThanOrEqual(5 * 60_000);
  });
});
