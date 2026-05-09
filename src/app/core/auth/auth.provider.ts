import { APP_INITIALIZER, EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MockAuthService } from './mock-auth.service';
import { AuthService } from './auth.service';
import { AuthServiceBase } from './auth-service.base';

/**
 * Registra el servicio de autenticación en el contenedor DI.
 *
 * Estrategia de toggle:
 *   - useMocks = true  → MockAuthService (datos locales, sin HTTP)
 *   - useMocks = false → AuthService (llama al backend real)
 *
 * El token de inyección es `AuthServiceBase` — toda la app depende de la
 * abstracción. Para cambiar la implementación basta modificar este archivo.
 *
 * APP_INITIALIZER garantiza que la sesión esté restaurada antes de que
 * Angular active cualquier ruta (necesario para que authGuard vea el usuario).
 */
export function provideAuth(): EnvironmentProviders {
  const impl = environment.useMocks ? MockAuthService : AuthService;

  return makeEnvironmentProviders([
    {
      provide: AuthServiceBase,
      useClass: impl,
    },
    {
      provide: APP_INITIALIZER,
      useFactory: (auth: AuthServiceBase) => () => firstValueFrom(auth.restoreSession()),
      deps: [AuthServiceBase],
      multi: true,
    },
  ]);
}
