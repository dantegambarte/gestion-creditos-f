import { HttpRequest } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { authInterceptor } from './auth.interceptor';

import { jwtInterceptor } from './jwt.interceptor';

describe('authInterceptor', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
    localStorage.clear();
  });

  it('should be created', () => {
    expect(jwtInterceptor).toBe(authInterceptor);
  });

  it('adjunta Authorization y credentials en requests a la API interna', () => {
    localStorage.setItem(environment.tokenKey, 'token-interno');
    const req = new HttpRequest('GET', `${environment.apiBaseUrl}/users`);

    TestBed.runInInjectionContext(() => {
      authInterceptor(req, (nextReq) => {
        expect(nextReq.headers.get('Authorization')).toBe(
          'Bearer token-interno',
        );
        expect(nextReq.withCredentials).toBeTrue();
        return {} as never;
      });
    });
  });

  it('usa token del portal para endpoints /portal/', () => {
    localStorage.setItem(environment.portalTokenKey, 'token-portal');
    const req = new HttpRequest(
      'GET',
      `${environment.apiBaseUrl}/portal/customer`,
    );

    TestBed.runInInjectionContext(() => {
      authInterceptor(req, (nextReq) => {
        expect(nextReq.headers.get('Authorization')).toBe(
          'Bearer token-portal',
        );
        return {} as never;
      });
    });
  });

  it('no modifica requests externas a la API', () => {
    localStorage.setItem(environment.tokenKey, 'token-interno');
    const req = new HttpRequest('GET', 'https://example.com/assets.json');

    TestBed.runInInjectionContext(() => {
      authInterceptor(req, (nextReq) => {
        expect(nextReq.headers.has('Authorization')).toBeFalse();
        expect(nextReq.withCredentials).toBeFalse();
        return {} as never;
      });
    });
  });
});
