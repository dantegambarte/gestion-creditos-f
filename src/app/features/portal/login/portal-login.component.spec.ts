import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { PortalAuthService } from '../auth/portal-auth.service';
import { PortalLoginComponent } from './portal-login.component';

describe('PortalLoginComponent — bloqueo y validación (#55)', () => {
  let fixture: ComponentFixture<PortalLoginComponent>;
  let component: PortalLoginComponent;
  let login: jasmine.Spy;

  beforeEach(() => {
    login = jasmine.createSpy('login');
    TestBed.configureTestingModule({
      imports: [PortalLoginComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: PortalAuthService, useValue: { login } },
      ],
    });
    fixture = TestBed.createComponent(PortalLoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  /**
   * Completa el formulario y lo envía.
   * @param dni - DNI a cargar
   */
  function submit(dni = '12345678'): void {
    component.form.setValue({ dni, password: 'secreta' });
    component.onSubmit();
    fixture.detectChanges();
  }

  it('acepta DNI de 7 u 8 dígitos y rechaza 9', () => {
    component.form.controls.dni.setValue('1234567');
    expect(component.form.controls.dni.valid).toBeTrue();
    component.form.controls.dni.setValue('12345678');
    expect(component.form.controls.dni.valid).toBeTrue();
    component.form.controls.dni.setValue('123456789');
    expect(component.form.controls.dni.valid).toBeFalse();
  });

  it('credenciales inválidas muestran error sin bloquear ni contar intentos locales', () => {
    login.and.returnValue(
      throwError(() => ({ status: 401, message: 'DNI o contraseña incorrectos.' })),
    );

    for (let i = 0; i < 6; i++) submit();

    expect(login).toHaveBeenCalledTimes(6);
    expect(component.isBlocked).toBeFalse();
    expect(component.errorMessage).toBe('Credenciales incorrectas.');
  });

  it('muestra el bloqueo cuando el backend devuelve ACCOUNT_LOCKED', () => {
    login.and.returnValue(
      throwError(() => ({
        status: 401,
        code: 'ACCOUNT_LOCKED',
        message: 'Tu cuenta fue bloqueada por seguridad.',
      })),
    );

    submit();

    expect(component.isBlocked).toBeTrue();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-cy="portal-login-locked"]')?.textContent).toContain(
      'Tu cuenta fue bloqueada por seguridad.',
    );
  });

  it('un corte de red no se presenta como credenciales inválidas', () => {
    login.and.returnValue(throwError(() => ({ status: 0, message: 'offline' })));

    submit();

    expect(component.isBlocked).toBeFalse();
    expect(component.errorMessage).toContain('No pudimos conectarnos');
  });

  it('login exitoso navega al dashboard', () => {
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));
    login.and.returnValue(of(undefined));

    submit();

    expect(router.navigate).toHaveBeenCalledWith(['/portal/dashboard']);
  });
});
