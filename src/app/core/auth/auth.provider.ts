import { APP_INITIALIZER, EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { concat, firstValueFrom, last } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MockAuthService } from './mock-auth.service';
import { AuthService } from './auth.service';
import { AuthServiceBase } from './auth-service.base';
import { PortalAuthService } from '../../features/portal/auth/portal-auth.service';

/**
 * Registra el servicio de autenticación en el contenedor DI.
 *
 * Estrategia de toggle:
 *   - useMocks = true  → MockAuthService (datos locales, sin HTTP)
 *   - useMocks = false → AuthService (llama al backend real)
 *
 * Se registra un único token, AuthServiceBase, que usan guards, interceptors
 * y componentes. El token legacy MockAuthService ya no se expone en runtime.
 *
 * APP_INITIALIZER garantiza que la sesión esté restaurada antes de que
 * Angular active cualquier ruta (necesario para que authGuard vea el usuario).
 * Las sesiones interna y del portal se restauran en serie porque comparten
 * la cookie del refresh token y su rotación no admite refresh simultáneos.
 */
export function provideAuth(): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: AuthServiceBase,
      useClass: environment.useMocks ? MockAuthService : AuthService,
    },
    {
      provide: APP_INITIALIZER,
      useFactory: (auth: AuthServiceBase, portal: PortalAuthService) => () =>
        firstValueFrom(
          concat(auth.restoreSession(), environment.useMocks ? [] : portal.restoreSession()).pipe(
            last(null, undefined),
          ),
        ),
      deps: [AuthServiceBase, PortalAuthService],
      multi: true,
    },
  ]);
}
