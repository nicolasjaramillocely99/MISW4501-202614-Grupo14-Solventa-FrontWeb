import { RolPrueba } from './sesion-por-rol';

/**
 * Inicio y menú propios de cada rol (frames A0, S0, O0 y D-12 para el socio). Los usan las E2E del acceso
 * con Cognito simulado y el humo contra el Cognito local (Moto), cuyos usuarios tienen los mismos nombres.
 */
export const INICIO_Y_MENU_POR_ROL: Readonly<
  Record<RolPrueba, { titulo: string; menu: string[] }>
> = {
  asegurado: {
    titulo: 'Hola, Carolina',
    menu: ['Inicio', 'Mis pólizas', 'Mis siniestros', 'Mis solicitudes', 'Mi perfil'],
  },
  asesor: {
    titulo: 'Hola, Laura',
    menu: ['Inicio', 'Cotizaciones', 'Bandeja de decisión', 'Renovaciones', 'Siniestros'],
  },
  operaciones: {
    titulo: 'Centro de operaciones',
    menu: [
      'Inicio',
      'Emisiones',
      'Endosos',
      'Siniestros',
      'Asistencias',
      'Socios',
      'Auditoría',
      'Consentimientos',
    ],
  },
  socio: { titulo: 'Hola, Banco', menu: ['Tablero', 'Desempeño técnico', 'Credenciales'] },
};
