import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Encapsula el estado de refresh de token para serializar requests concurrentes.
 * Al ser providedIn: 'root', Angular crea una instancia por injector de request
 * en SSR, evitando que el estado se comparta entre usuarios en el servidor.
 */
@Injectable({ providedIn: 'root' })
export class TokenRefreshStateService {
  isRefreshing = false;
  readonly tokenSubject = new BehaviorSubject<string | null>(null);
}
