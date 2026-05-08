import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { MockAuthService, MOCK_USERS } from './mock-auth.service';
import { Roles } from '../../shared/models/enums/roles.enum';

describe('MockAuthService', () => {
  let service: MockAuthService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RouterTestingModule],
      providers: [MockAuthService],
    });
    service = TestBed.inject(MockAuthService);
    router = TestBed.inject(Router);
    localStorage.clear();
  });

  afterEach(() => localStorage.clear());

  it('deberÃ­a iniciar sin usuario autenticado', () => {
    expect(service.isAuthenticated()).toBeFalse();
    expect(service.snapshot).toBeNull();
  });

  it('deberÃ­a autenticar con DNI vÃ¡lido y persistir en localStorage', fakeAsync(() => {
    const admin = MOCK_USERS[0]!; // dni: '12345678'
    const adminDni = '12345678';
    let result: any;

    (service as any)['NETWORK_LATENCY_MS'] = 0;
    service
      .login({ dni: adminDni, password: 'cualquiera' })
      .subscribe((user) => (result = user));

    tick(0);

    expect(result).toEqual(admin);
    expect(service.isAuthenticated()).toBeTrue();
    expect(service.snapshot?.roles).toContain(Roles.ADMIN);
    expect(localStorage.getItem('sgcf_token')).toBe(admin.token);
  }));

  it('deberÃ­a emitir error 401 con DNI inexistente', fakeAsync(() => {
    let error: any;
    (service as any)['NETWORK_LATENCY_MS'] = 0;
    service
      .login({ dni: '00000000', password: '123' })
      .subscribe({ error: (e) => (error = e) });

    tick(0);

    expect(error.status).toBe(401);
    expect(service.isAuthenticated()).toBeFalse();
  }));

  it('deberÃ­a verificar roles correctamente con hasRole()', fakeAsync(() => {
    (service as any)['NETWORK_LATENCY_MS'] = 0;
    service.login({ dni: '87654321', password: 'x' }).subscribe(); // SELLER
    tick(0);

    expect(service.hasRole(Roles.SELLER)).toBeTrue();
    expect(service.hasRole(Roles.ADMIN)).toBeFalse();
    expect(service.hasRole(Roles.COLLECTOR)).toBeFalse();
  }));

  it('deberÃ­a verificar hasAnyRole() con mÃºltiples roles', fakeAsync(() => {
    (service as any)['NETWORK_LATENCY_MS'] = 0;
    service.login({ dni: '11223344', password: 'x' }).subscribe(); // COLLECTOR
    tick(0);

    expect(service.hasAnyRole([Roles.ADMIN, Roles.COLLECTOR])).toBeTrue();
    expect(service.hasAnyRole([Roles.ADMIN, Roles.SELLER])).toBeFalse();
  }));

  it('deberÃ­a limpiar localStorage y emitir null al hacer logout', fakeAsync(() => {
    (service as any)['NETWORK_LATENCY_MS'] = 0;
    const navigateSpy = spyOn(router, 'navigate');
    service.login({ dni: '12345678', password: 'x' }).subscribe();
    tick(0);

    service.logout();

    expect(service.isAuthenticated()).toBeFalse();
    expect(localStorage.getItem('sgcf_token')).toBeNull();
    expect(navigateSpy).toHaveBeenCalledWith(['login']);
  }));

  it('currentUser$ deberÃ­a emitir el usuario tras login exitoso', fakeAsync(() => {
    (service as any)['NETWORK_LATENCY_MS'] = 0;
    const emitted: any[] = [];
    service.currentUser$.subscribe((u) => emitted.push(u));

    service.login({ dni: '12345678', password: 'x' }).subscribe();
    tick(0);

    expect(emitted.length).toBe(2); // null inicial + usuario logueado
    expect(emitted[1]?.roles).toContain(Roles.ADMIN);
  }));
});

