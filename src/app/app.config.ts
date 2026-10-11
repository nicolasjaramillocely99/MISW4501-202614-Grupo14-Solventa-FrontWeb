import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { CognitoProveedorIdentidadService } from '@core/auth/cognito-proveedor-identidad.service';
import { autenticacionInterceptor } from '@core/auth/interceptores/autenticacion.interceptor';
import { ProveedorIdentidad } from '@core/auth/proveedor-identidad';
import { proveerI18n } from '@core/i18n/transloco.config';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([autenticacionInterceptor])),
    proveerI18n(),
    { provide: ProveedorIdentidad, useExisting: CognitoProveedorIdentidadService },
  ],
};
