import { bootstrapApplication } from '@angular/platform-browser';
import { cargarConfiguracion, mostrarAvisoConfiguracion } from '@core/configuracion/cargar-configuracion';
import { CONFIGURACION_EJECUCION, ErrorConfiguracion } from '@core/configuracion/configuracion';

import { appConfig } from './app/app.config';
import { App } from './app/app';

// La configuración del ambiente se lee antes de arrancar (T5, decisión D-5): sin ella el portal no llama a nada y
// muestra el aviso fijo de index.html.
cargarConfiguracion()
  .then((configuracion) =>
    bootstrapApplication(App, {
      ...appConfig,
      providers: [...appConfig.providers, { provide: CONFIGURACION_EJECUCION, useValue: configuracion }],
    }),
  )
  .catch((err: unknown) => {
    if (err instanceof ErrorConfiguracion) {
      mostrarAvisoConfiguracion();
    }
    console.error(err);
  });
