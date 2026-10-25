/**
 * Datos de las E2E de la revocación de consentimientos desde el portal de cumplimiento (HU-W4.2-02), con la forma de las
 * respuestas de `audit` (contrato `HU-W4.2-02-api.md`, `openapi.yaml` 0.5.0). Los plazos se calculan respecto a «ahora»:
 * el sondeo se detiene 30 s después del mayor plazo, así que con fechas fijas el estado «en curso» no se sondearía.
 */

export const CONSENTIMIENTO_ID = 'cns-4f1c2a9be0d34c6f8a7e5d1b2c3a4f5e';

/** Una respuesta simulada del API Gateway. */
export interface RespuestaConsentimiento {
  estado: number;
  cuerpo: unknown;
}

const TITULAR = { full_name: 'Ana María Pérez', document_masked: '******4050' };

const ALCANCE = [
  { code: 'open_finance', data_categories: ['credit_products', 'balances', 'payment_behavior'], validity: '12_months' },
  { code: 'open_data', data_categories: ['public_records'], validity: '12_months' },
  { code: 'kyc', data_categories: ['identity_verification'], validity: 'single_use' },
];

const BANCO_ALIADO = { code: 'aliado-banco-1', name: 'Banco Aliado' };
const BANCO_CENTRAL = { code: 'banco-central', name: 'Banco Central' };

const OTORGADO = {
  status: 'granted',
  occurred_at: '2026-10-20T15:00:00Z',
  entity_code: null,
  actor_type: null,
  reason: null,
  reference: null,
};

type EstadoEntidad = 'pending' | 'confirmed' | 'not_confirmed';

interface EntidadAviso {
  entidad: { code: string; name: string };
  estado: EstadoEntidad;
  /** Minutos desde ahora a los que vence (o venció, si es negativo) su ventana. */
  plazoEnMinutos: number;
  confirmadaHaceMinutos?: number;
}

const minutos = (desdeAhora: number): string => new Date(Date.now() + desdeAhora * 60_000).toISOString();

function revocacion(opciones: {
  aviso: 'in_progress' | 'completed' | 'partial';
  entidades: EntidadAviso[];
  canal?: string;
  solicitante?: { type: string; id: string };
  motivo?: string | null;
  referencia?: string | null;
}) {
  const desdeApp = opciones.canal === 'mobile_app';
  return {
    receipt_number: 'REV-2026-0089',
    requested_at: minutos(-1),
    effective_at: minutos(-1),
    channel: opciones.canal ?? 'compliance_portal',
    notice_status: opciones.aviso,
    requested_by: opciones.solicitante ?? { type: 'operations', id: 'sub-operaciones' },
    reason: opciones.motivo === undefined ? (desdeApp ? null : 'customer_request') : opciones.motivo,
    reference: opciones.referencia === undefined ? (desdeApp ? null : 'TCK-2026-0412') : opciones.referencia,
    entities: opciones.entidades.map((e) => ({
      code: e.entidad.code,
      name: e.entidad.name,
      status: e.estado,
      confirmed_at: e.estado === 'confirmed' ? minutos(-(e.confirmadaHaceMinutos ?? 0.5)) : null,
      deadline_at: minutos(e.plazoEnMinutos),
    })),
  };
}

function estado(
  status: 'active' | 'expired' | 'revoked' | 'partially_revoked',
  opciones: { entidades?: { code: string; name: string }[]; revocacion?: ReturnType<typeof revocacion> | null; historial?: unknown[] } = {},
) {
  return {
    consent_id: CONSENTIMIENTO_ID,
    status,
    revocable: status === 'active',
    holder: TITULAR,
    scope: ALCANCE,
    entities: opciones.entidades ?? [BANCO_ALIADO],
    revocation: opciones.revocacion ?? null,
    history: opciones.historial ?? [OTORGADO],
  };
}

const SOLICITADA = {
  status: 'revocation_requested',
  occurred_at: minutos(-1),
  entity_code: null,
  actor_type: 'operations',
  reason: 'customer_request',
  reference: 'TCK-2026-0412',
};
const REVOCADO_EN_SOLVENTA = { ...SOLICITADA, status: 'revoked', reason: null, reference: null };

/** Consentimiento activo: abre el modal. */
export const activo = () => estado('active');

/** Revocado desde el portal, con la entidad todavía `pending` (la respuesta del 201). */
export const enCurso = () =>
  estado('revoked', {
    revocacion: revocacion({ aviso: 'in_progress', entidades: [{ entidad: BANCO_ALIADO, estado: 'pending', plazoEnMinutos: 4 }] }),
    historial: [OTORGADO, SOLICITADA, REVOCADO_EN_SOLVENTA],
  });

/** Todas las entidades confirmaron. */
export const revocado = () =>
  estado('revoked', {
    revocacion: revocacion({ aviso: 'completed', entidades: [{ entidad: BANCO_ALIADO, estado: 'confirmed', plazoEnMinutos: 4 }] }),
    historial: [
      OTORGADO,
      SOLICITADA,
      REVOCADO_EN_SOLVENTA,
      { status: 'revocation_confirmed', occurred_at: minutos(-0.5), entity_code: 'aliado-banco-1', actor_type: 'system', reason: null, reference: null },
    ],
  });

/** O15c: Banco Aliado confirmó y Banco Central no confirmó dentro de su plazo. */
export const parcial = () =>
  estado('partially_revoked', {
    entidades: [BANCO_ALIADO, BANCO_CENTRAL],
    revocacion: revocacion({
      aviso: 'partial',
      entidades: [
        { entidad: BANCO_ALIADO, estado: 'confirmed', plazoEnMinutos: -1, confirmadaHaceMinutos: 3 },
        { entidad: BANCO_CENTRAL, estado: 'not_confirmed', plazoEnMinutos: -1 },
      ],
    }),
    historial: [
      OTORGADO,
      SOLICITADA,
      REVOCADO_EN_SOLVENTA,
      { status: 'revocation_confirmed', occurred_at: minutos(-3), entity_code: 'aliado-banco-1', actor_type: 'system', reason: null, reference: null },
      { status: 'revocation_not_confirmed', occurred_at: minutos(-1), entity_code: 'banco-central', actor_type: 'system', reason: null, reference: null },
    ],
  });

/** Tras el reintento: la entidad que no confirmó vuelve a `pending` con una ventana nueva; el aviso sigue `partial`. */
export const reintentoEnCurso = () =>
  estado('partially_revoked', {
    entidades: [BANCO_ALIADO, BANCO_CENTRAL],
    revocacion: revocacion({
      aviso: 'partial',
      entidades: [
        { entidad: BANCO_ALIADO, estado: 'confirmed', plazoEnMinutos: -1, confirmadaHaceMinutos: 3 },
        { entidad: BANCO_CENTRAL, estado: 'pending', plazoEnMinutos: 5 },
      ],
    }),
    historial: [OTORGADO, SOLICITADA, REVOCADO_EN_SOLVENTA],
  });

/** Después del reintento ambas entidades confirmaron. */
export const parcialResuelto = () =>
  estado('revoked', {
    entidades: [BANCO_ALIADO, BANCO_CENTRAL],
    revocacion: revocacion({
      aviso: 'completed',
      entidades: [
        { entidad: BANCO_ALIADO, estado: 'confirmed', plazoEnMinutos: -1, confirmadaHaceMinutos: 3 },
        { entidad: BANCO_CENTRAL, estado: 'confirmed', plazoEnMinutos: 5 },
      ],
    }),
    historial: [OTORGADO, SOLICITADA, REVOCADO_EN_SOLVENTA],
  });

/** Revocado por el titular desde la app: sin motivo ni referencia y con un canal que el portal conoce. */
export const revocadoDesdeApp = () =>
  estado('revoked', {
    revocacion: revocacion({
      aviso: 'completed',
      canal: 'mobile_app',
      solicitante: { type: 'holder', id: 'sub-titular' },
      entidades: [{ entidad: BANCO_ALIADO, estado: 'confirmed', plazoEnMinutos: 4 }],
    }),
  });

/** Vencido: no se puede revocar. */
export const vencido = () =>
  estado('expired', {
    historial: [OTORGADO, { status: 'expired', occurred_at: '2027-10-20T15:00:00Z', entity_code: null, actor_type: null, reason: null, reference: null }],
  });

export const ok = (cuerpo: unknown, estadoHttp = 200): RespuestaConsentimiento => ({ estado: estadoHttp, cuerpo });

export const errorHttp = (estadoHttp: number, codigo: string, extra: Record<string, unknown> = {}): RespuestaConsentimiento => ({
  estado: estadoHttp,
  cuerpo: { error: codigo, message: codigo, ...extra },
});

/** 400 `validation_failed` con los tres campos del modal, como lo manda `audit`. */
export const validacionFallida = (): RespuestaConsentimiento =>
  errorHttp(400, 'validation_failed', {
    fields: [
      { field: 'reason', code: 'required' },
      { field: 'reference', code: 'invalid_format' },
      { field: 'role_confirmed', code: 'must_be_true' },
    ],
  });

export const noEncontrado = (): RespuestaConsentimiento => errorHttp(404, 'consent_not_found');
