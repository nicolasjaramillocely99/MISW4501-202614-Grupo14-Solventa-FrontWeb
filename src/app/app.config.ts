import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { CognitoProveedorIdentidadService } from '@core/auth/cognito-proveedor-identidad.service';
import { ProveedorIdentidad } from '@core/auth/proveedor-identidad';
import { proveerI18n } from '@core/i18n/transloco.config';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    proveerI18n(),
    { provide: ProveedorIdentidad, useExisting: CognitoProveedorIdentidadService },
  ],
};
