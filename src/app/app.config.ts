import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import { ApplicationConfig } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { routes } from './app.routes';
import { provideAuth } from './core/auth/auth.provider';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { jwtInterceptor } from './core/interceptors/jwt.interceptor';
import { loadingInterceptor } from './core/interceptors/loading.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAnimations(),
    MessageService,
    // Orden: jwt (adjunta token) → loading (spinner) → error (maneja 401/403)
    provideHttpClient(
      withFetch(),
      withInterceptors([jwtInterceptor, loadingInterceptor, errorInterceptor]),
    ),
    provideAuth(),
  ],
};
