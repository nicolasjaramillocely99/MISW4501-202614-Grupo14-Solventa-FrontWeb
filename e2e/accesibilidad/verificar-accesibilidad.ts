import AxeBuilder from '@axe-core/playwright';
import { Page, expect } from '@playwright/test';

/**
 * Ejecuta axe-core sobre la página actual y falla ante cualquier violación (contraste, etiquetas,
 * navegación, landmarks). OBJ 13 de la estrategia de pruebas.
 */
export async function verificarAccesibilidad(page: Page): Promise<void> {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const resumen = violations.map(
    (v) => `${v.id} (${v.impact}): ${v.help} → ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
  expect(resumen, 'violaciones de accesibilidad').toEqual([]);
}
