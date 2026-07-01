import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import { ApplicationConfig, isDevMode } from '@angular/core';
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

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withPreloading(RoleBasedPreloadingStrategy)),
    provideAnimations(),
    MessageService,
    // Orden: loading (spinner global) → auth (JWT) → error (toasts/redirects)
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
