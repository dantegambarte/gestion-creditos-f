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
 * Se registran dos tokens:
 *   - MockAuthService: token legacy usado por guards y componentes existentes.
 *   - AuthServiceBase: token semántico para interceptors y código nuevo;
 *     siempre apunta a la misma instancia que MockAuthService.
 *
 * APP_INITIALIZER garantiza que la sesión esté restaurada antes de que
 * Angular active cualquier ruta (necesario para que authGuard vea el usuario).
 */
export function provideAuth(): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: MockAuthService,
      useClass: environment.useMocks ? MockAuthService : AuthService,
    },
    {
      provide: AuthServiceBase,
      useExisting: MockAuthService,
    },
    {
      provide: APP_INITIALIZER,
      useFactory: (auth: MockAuthService) => () => firstValueFrom(auth.restoreSession()),
      deps: [MockAuthService],
      multi: true,
    },
  ]);
}
