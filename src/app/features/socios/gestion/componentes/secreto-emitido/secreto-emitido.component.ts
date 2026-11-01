import { ChangeDetectionStrategy, Component, ElementRef, inject, output, signal, viewChild } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { LucideCopy, LucideTriangleAlert } from '@lucide/angular';

import { SecretoEmitido } from '@core/api/socios/socios.modelos';

/** Qué se copió por última vez, para el aviso accesible «Copiado». */
type Copiado = 'clientId' | 'secreto' | 'error' | null;

/**
 * Secreto recién emitido (HU-W3.1-01 CA-4): un `<dialog>` modal que muestra el `client_id` y el secreto una sola vez,
 * con botones para copiarlos y el aviso de que no se volverá a mostrar. No cierra con `Escape` ni haciendo clic fuera:
 * solo con «Ya guardé el secreto», que lo borra de la memoria del componente (la señal vuelve a `null`). El secreto
 * nunca pasa por la URL, el almacenamiento del navegador ni los registros.
 */
@Component({
  selector: 'app-secreto-emitido',
  imports: [TranslocoDirective, LucideCopy, LucideTriangleAlert],
  templateUrl: './secreto-emitido.component.html',
  styleUrl: './secreto-emitido.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecretoEmitidoComponent {
  /** El analista confirmó que guardó el secreto. */
  readonly cerrado = output<void>();

  private readonly dialogo = viewChild<ElementRef<HTMLDialogElement>>('dialogo');
  private readonly portapapeles: Clipboard | undefined = inject(ElementRef).nativeElement.ownerDocument?.defaultView?.navigator
    ?.clipboard;

  protected readonly secreto = signal<SecretoEmitido | null>(null);
  protected readonly copiado = signal<Copiado>(null);

  /** Muestra el secreto. Lo llama la página con la respuesta `201` de la aprobación o de la rotación. */
  mostrar(secreto: SecretoEmitido): void {
    this.copiado.set(null);
    this.secreto.set(secreto);
    this.dialogo()?.nativeElement.showModal();
  }

  /** `Escape` no cierra: el secreto solo se descarta con la confirmación explícita. */
  protected alCancelarNativo(evento: Event): void {
    evento.preventDefault();
  }

  protected async copiar(que: 'clientId' | 'secreto'): Promise<void> {
    const secreto = this.secreto();
    if (!secreto || !this.portapapeles) {
      this.copiado.set('error');
      return;
    }
    try {
      await this.portapapeles.writeText(que === 'clientId' ? secreto.clientId : secreto.clientSecret);
      this.copiado.set(que);
    } catch {
      this.copiado.set('error');
    }
  }

  /** «Ya guardé el secreto»: se borra de la memoria y se cierra. */
  protected confirmar(): void {
    this.secreto.set(null);
    this.copiado.set(null);
    this.dialogo()?.nativeElement.close();
    this.cerrado.emit();
  }
}
