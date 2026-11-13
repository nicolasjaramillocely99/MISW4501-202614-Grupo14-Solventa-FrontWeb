import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import {
  APROBACION_PAGADA_DTO,
  EVALUACION_DTO,
  ID_EVALUADO,
  RECHAZO_DTO,
  evaluacionCon,
} from '@testing/evaluacion-pruebas';
import { proveerTranslocoPruebas } from '@testing/transloco-pruebas';
import { of } from 'rxjs';

import { EvaluacionDto, mapearEvaluacion } from '@core/api/siniestros/evaluacion.modelos';
import { SiniestrosApiService } from '@core/api/siniestros/siniestros-api.service';

import { EvaluacionSiniestroPage } from './evaluacion-siniestro.page';

/** HU-W2.3-01 (F3): la única edición de O6 es el enlace «Asignar prestador»; sus pruebas van aparte. */
describe('EvaluacionSiniestroPage · enlace a la asignación del prestador (HU-W2.3-01)', () => {
  async function renderizar(detalle: EvaluacionDto) {
    await render(EvaluacionSiniestroPage, {
      imports: [proveerTranslocoPruebas()],
      providers: [
        provideRouter([]),
        {
          provide: SiniestrosApiService,
          useValue: { consultarEvaluacion: () => of(mapearEvaluacion(detalle)) },
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: ID_EVALUADO }) } },
        },
      ],
    });
  }

  const enlace = () => screen.queryByRole('link', { name: 'Asignar prestador' });

  it('con el caso en evaluación lleva a «Asignar prestador»', async () => {
    await renderizar(EVALUACION_DTO);

    expect(enlace()?.getAttribute('href')).toBe(`/siniestros/${ID_EVALUADO}/asignar-prestador`);
  });

  it('con el caso pagado sigue visible: la asignación hecha se consulta', async () => {
    await renderizar(evaluacionCon(APROBACION_PAGADA_DTO));

    expect(enlace()).toBeTruthy();
  });

  it('no aparece en una radicación sin revisar', async () => {
    await renderizar({ ...EVALUACION_DTO, claim: { ...EVALUACION_DTO.claim, status: 'active' } });
    expect(enlace()).toBeNull();
  });

  it('no aparece en un caso rechazado', async () => {
    await renderizar(evaluacionCon(RECHAZO_DTO));
    expect(enlace()).toBeNull();
  });
});
