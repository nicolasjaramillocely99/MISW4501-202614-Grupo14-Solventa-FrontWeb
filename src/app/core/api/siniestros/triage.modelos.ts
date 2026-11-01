/**
 * Modelos de la prioridad automática del siniestro (triage; HU-W2.2-01), tipados según
 * `services/claims/api/openapi.yaml` del backend (v0.6.0) y su contrato para el front
 * (`docs/contratos/HU-W2.2-01-api.md`). El cliente traduce el JSON del contrato (snake_case) a estos tipos (camelCase).
 *
 * El front **no calcula** el nivel ni fija severidades, umbrales o plazos: los pinta tal como llegan. Los campos que
 * pueden crecer con la política (`causas`, `tipoSiniestro`, `cobertura`, `actor`) se tipan como `string` para que un
 * código nuevo no rompa la pantalla.
 */

export type NivelTriage = 1 | 2 | 3;
export type Severidad = 'high' | 'medium' | 'low';
/** `unknown`: el caso no declaró monto, así que la banda no empuja el nivel. */
export type BandaMonto = 'high' | 'medium' | 'low' | 'unknown';
/** `not_found` solo aparece en la lectura por lote. */
export type EstadoTriage = 'pending' | 'assessed' | 'not_applicable' | 'not_found';

/** Objetivo de atención de un nivel (CA-5) y tiempo estimado de resolución que ve el asegurado. */
export interface ObjetivoTriage {
  /** `immediate`: atención inmediata; `business_days`: dentro de `diasHabiles`. */
  tipo: 'immediate' | 'business_days';
  /** `null` con `immediate`. */
  diasHabiles: number | null;
  diasResolucion: number;
}

/** El cálculo vigente (vista `operations`). */
export interface EvaluacionTriage {
  nivel: NivelTriage;
  severidad: Severidad;
  banda: BandaMonto;
  /** Centavos de COP; `null` si el caso no tenía monto. */
  montoEstimadoMinor: number | null;
  moneda: string;
  tipoSiniestro: string;
  cobertura: string;
  versionPolitica: string;
  objetivo: ObjetivoTriage;
  /** RFC 3339 (UTC). */
  evaluadoEn: string;
}

/** Un cálculo del historial (CA-3). */
export interface EntradaHistorialTriage {
  nivel: NivelTriage;
  /** `null` en el primer cálculo; igual a `nivel` si cambió la información pero no el nivel. */
  nivelAnterior: NivelTriage | null;
  severidad: Severidad;
  banda: BandaMonto;
  montoEstimadoMinor: number | null;
  tipoSiniestro: string;
  /** Códigos estables (`entered_evaluation`, `estimated_amount_changed`…); pueden crecer. */
  causas: string[];
  /** Hoy siempre `system`. */
  actor: string;
  versionPolitica: string;
  evaluadoEn: string;
}

/** Vista completa del analista de operaciones. */
export interface TriageOperaciones {
  vista: 'operations';
  siniestroId: string;
  estado: Exclude<EstadoTriage, 'not_found'>;
  /** `null` si el estado no es `assessed`. */
  actual: EvaluacionTriage | null;
  /** Del más reciente al más antiguo. */
  historial: EntradaHistorialTriage[];
}

/** Vista reducida del asegurado dueño del caso: sin severidad, monto ni historial. */
export interface TriageAsegurado {
  vista: 'insured';
  siniestroId: string;
  estado: Exclude<EstadoTriage, 'not_found'>;
  nivel: NivelTriage | null;
  diasResolucion: number | null;
  evaluadoEn: string | null;
}

/** La respuesta de `GET /v1/claims/{id}/triage` se distingue por `vista`. */
export type TriageSiniestro = TriageOperaciones | TriageAsegurado;

/** Fila de la lectura por lote: todo salvo `siniestroId` y `estado` es `null` si no está `assessed`. */
export interface ResumenTriage {
  siniestroId: string;
  estado: EstadoTriage;
  nivel: NivelTriage | null;
  severidad: Severidad | null;
  banda: BandaMonto | null;
  objetivo: ObjetivoTriage | null;
  evaluadoEn: string | null;
}

/** Política vigente: de aquí salen los indicadores por nivel y los umbrales que explica la cola. */
export interface PoliticaTriage {
  version: string;
  moneda: string;
  umbrales: { bajoMenorQueMinor: number; altoMayorQueMinor: number };
  severidades: { ramo: string; tipoSiniestro: string; severidad: Severidad }[];
  objetivos: { nivel: NivelTriage; objetivo: ObjetivoTriage }[];
}

interface ObjetivoTriageDto {
  kind: ObjetivoTriage['tipo'];
  business_days: number | null;
  resolution_business_days: number;
}

interface EvaluacionTriageDto {
  level: NivelTriage;
  severity: Severidad;
  amount_band: BandaMonto;
  estimated_amount_minor: number | null;
  currency: string;
  incident_type: string;
  coverage: string;
  policy_version: string;
  target: ObjetivoTriageDto;
  assessed_at: string;
}

interface EntradaHistorialTriageDto {
  level: NivelTriage;
  previous_level: NivelTriage | null;
  severity: Severidad;
  amount_band: BandaMonto;
  estimated_amount_minor: number | null;
  incident_type: string;
  causes: string[];
  actor: string;
  policy_version: string;
  assessed_at: string;
}

interface TriageOperacionesDto {
  view: 'operations';
  claim_id: string;
  state: TriageOperaciones['estado'];
  current: EvaluacionTriageDto | null;
  history: EntradaHistorialTriageDto[];
}

interface TriageAseguradoDto {
  view: 'insured';
  claim_id: string;
  state: TriageAsegurado['estado'];
  level: NivelTriage | null;
  estimated_resolution_business_days: number | null;
  assessed_at: string | null;
}

/** Respuesta cruda de `GET /v1/claims/{claim_id}/triage`. */
export type TriageSiniestroDto = TriageOperacionesDto | TriageAseguradoDto;

export interface ResumenTriageDto {
  claim_id: string;
  state: EstadoTriage;
  level: NivelTriage | null;
  severity: Severidad | null;
  amount_band: BandaMonto | null;
  target: ObjetivoTriageDto | null;
  assessed_at: string | null;
}

/** Respuesta cruda de `GET /v1/claims/triage?claim_id=…`. */
export interface PaginaTriageDto {
  items: ResumenTriageDto[];
}

/** Respuesta cruda de `GET /v1/claims/triage-policy`. */
export interface PoliticaTriageDto {
  version: string;
  currency: string;
  amount_thresholds: { low_below_minor: number; high_above_minor: number };
  severity: { line: string; incident_type: string; severity: Severidad }[];
  targets: { level: NivelTriage; target: ObjetivoTriageDto }[];
}

function mapearObjetivo(dto: ObjetivoTriageDto): ObjetivoTriage {
  return { tipo: dto.kind, diasHabiles: dto.business_days, diasResolucion: dto.resolution_business_days };
}

function mapearEvaluacion(dto: EvaluacionTriageDto): EvaluacionTriage {
  return {
    nivel: dto.level,
    severidad: dto.severity,
    banda: dto.amount_band,
    montoEstimadoMinor: dto.estimated_amount_minor ?? null,
    moneda: dto.currency,
    tipoSiniestro: dto.incident_type,
    cobertura: dto.coverage,
    versionPolitica: dto.policy_version,
    objetivo: mapearObjetivo(dto.target),
    evaluadoEn: dto.assessed_at,
  };
}

function mapearEntradaHistorial(dto: EntradaHistorialTriageDto): EntradaHistorialTriage {
  return {
    nivel: dto.level,
    nivelAnterior: dto.previous_level ?? null,
    severidad: dto.severity,
    banda: dto.amount_band,
    montoEstimadoMinor: dto.estimated_amount_minor ?? null,
    tipoSiniestro: dto.incident_type,
    causas: dto.causes,
    actor: dto.actor,
    versionPolitica: dto.policy_version,
    evaluadoEn: dto.assessed_at,
  };
}

/** Distingue la vista por `view` (la del rol del token). */
export function mapearTriageSiniestro(dto: TriageSiniestroDto): TriageSiniestro {
  if (dto.view === 'insured') {
    return {
      vista: 'insured',
      siniestroId: dto.claim_id,
      estado: dto.state,
      nivel: dto.level ?? null,
      diasResolucion: dto.estimated_resolution_business_days ?? null,
      evaluadoEn: dto.assessed_at ?? null,
    };
  }
  return {
    vista: 'operations',
    siniestroId: dto.claim_id,
    estado: dto.state,
    actual: dto.current ? mapearEvaluacion(dto.current) : null,
    historial: (dto.history ?? []).map(mapearEntradaHistorial),
  };
}

/** Las filas vuelven en el orden en que se pidieron los ids. */
export function mapearPaginaTriage(dto: PaginaTriageDto): ResumenTriage[] {
  return dto.items.map((item) => ({
    siniestroId: item.claim_id,
    estado: item.state,
    nivel: item.level ?? null,
    severidad: item.severity ?? null,
    banda: item.amount_band ?? null,
    objetivo: item.target ? mapearObjetivo(item.target) : null,
    evaluadoEn: item.assessed_at ?? null,
  }));
}

export function mapearPoliticaTriage(dto: PoliticaTriageDto): PoliticaTriage {
  return {
    version: dto.version,
    moneda: dto.currency,
    umbrales: {
      bajoMenorQueMinor: dto.amount_thresholds.low_below_minor,
      altoMayorQueMinor: dto.amount_thresholds.high_above_minor,
    },
    severidades: dto.severity.map((fila) => ({
      ramo: fila.line,
      tipoSiniestro: fila.incident_type,
      severidad: fila.severity,
    })),
    objetivos: dto.targets.map((fila) => ({ nivel: fila.level, objetivo: mapearObjetivo(fila.target) })),
  };
}
