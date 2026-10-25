import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

/**
 * Traduce un código del contrato con la clave `<prefijo>.<código>` y, si el diccionario no la tiene, devuelve el código
 * crudo: un código nuevo del backend (un canal, un motivo, un estado del historial) no rompe la pantalla (F5, HU-W4.2-02).
 */
@Pipe({ name: 'traducirCodigo', pure: false })
export class TraducirCodigoPipe implements PipeTransform {
  private readonly transloco = inject(TranslocoService);

  transform(codigo: string | null | undefined, prefijo: string): string {
    if (!codigo) {
      return '';
    }
    const clave = `${prefijo}.${codigo}`;
    const texto = this.transloco.translate(clave);
    return texto && texto !== clave ? texto : codigo;
  }
}
