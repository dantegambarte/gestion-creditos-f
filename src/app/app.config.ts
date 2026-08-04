import { registerLocaleData } from '@angular/common';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import localeEsAr from '@angular/common/locales/es-AR';
import { ApplicationConfig, isDevMode, LOCALE_ID } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter, withPreloading } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { MessageService } from 'primeng/api';
import { routes } from './app.routes';
import { provideAuth } from './core/auth/auth.provider';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { loadingInterceptor } from './core/interceptors/loading.interceptor';
import { RoleBasedPreloadingStrategy } from './core/routing/role-based-preloading.strategy';
import { DedupMessageService } from './core/services/dedup-message.service';

// Datos del locale es-AR para los pipes date/number/percent (nombres de día y
// mes en español, miles con "." y decimales con ","). Sin esto Angular usa el
// default en-US y las fechas con EEEE/MMMM salen en inglés.
registerLocaleData(localeEsAr);

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: LOCALE_ID, useValue: 'es-AR' },
    provideRouter(routes, withPreloading(RoleBasedPreloadingStrategy)),
    provideAnimations(),
    { provide: MessageService, useClass: DedupMessageService },
    provideHttpClient(
      withFetch(),
      withInterceptors([loadingInterceptor, authInterceptor, errorInterceptor]),
    ),
    provideAuth(),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
