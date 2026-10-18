import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';

import { environment } from '../../../../environments/environment';

import {
  ErrorPasarela,
  TarjetaSinTokenizar,
  TarjetaTokenizada,
  TarjetaTokenizadaDto,
} from './pasarela.modelos';

/**
 * Tokeniza una tarjeta contra la pasarela de pagos (HU-W1.3-02).
 *
 * Es la única salida HTTP que no va al API Gateway, y lo es por diseño: si el
 * número de tarjeta pasara por nuestro backend, Solventa entraría en alcance
 * PCI-DSS. Aquí el número solo existe durante la llamada; lo que se guarda y
 * lo que se envía a originación es el token.
 *
 * **Nada de lo que entra a este servicio se registra ni se propaga.** Un error
 * de la pasarela se traduce a un código y el cuerpo original se descarta, para
 * que un número de tarjeta no termine en un registro por accidente.
 */
@Injectable({ providedIn: 'root' })
export class PasarelaPagosService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.pasarelaPagosUrl.replace(/\/+$/, '');

  tokenizar(tarjeta: TarjetaSinTokenizar): Observable<TarjetaTokenizada> {
    return this.http
      .post<TarjetaTokenizadaDto>(`${this.base}/tokens`, {
        number: tarjeta.numero.replace(/\s+/g, ''),
        holder: tarjeta.titular,
      })
      .pipe(
        map((dto) => ({ token: dto.token, marca: dto.brand, ultimosCuatro: dto.last4 })),
        catchError((error: unknown) => throwError(() => traducir(error))),
      );
  }
}

function traducir(error: unknown): ErrorPasarela {
  if (error instanceof HttpErrorResponse && error.status === 400) {
    return new ErrorPasarela('tarjeta_invalida');
  }
  return new ErrorPasarela('pasarela_no_disponible');
}
