import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { ContextoAliadoService } from '@core/aliado/contexto-aliado.service';

/**
 * Shell del canal embebido (sistema de diseño §5): barra superior de 64 px con el marcador del logotipo
 * del aliado a la izquierda y «Protegido por Solventa» a la derecha. Es público: el socio no inicia
 * sesión con Cognito. El indicador de pasos lo compone cada pantalla del flujo (`shared/ui`).
 */
@Component({
  selector: 'app-embebido-shell',
  imports: [RouterOutlet, TranslocoDirective],
  templateUrl: './embebido-shell.component.html',
  styleUrl: './embebido-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmbebidoShellComponent {
  protected readonly aliado = inject(ContextoAliadoService).nombre;
}
