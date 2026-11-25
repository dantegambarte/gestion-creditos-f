import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { LoginComponent } from './login.component';
import { AuthServiceBase } from '../../../core/auth/auth-service.base';

const mockAuth = {
  currentUser$: new BehaviorSubject(null).asObservable(),
  login: jasmine.createSpy('login').and.returnValue(new BehaviorSubject(null)),
  hasRole: jasmine.createSpy('hasRole').and.returnValue(false),
};

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [{ provide: AuthServiceBase, useValue: mockAuth }, provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('muestra error visible cuando la contraseña no alcanza el mínimo requerido', () => {
    component.form.setValue({ dni: '11111111', password: '1234' });

    component.onSubmit();
    fixture.detectChanges();

    const error = fixture.nativeElement.querySelector('[data-testid="password-minlength-error"]');
    expect(error).not.toBeNull();
    expect(error.textContent).toContain('al menos 6 caracteres');
  });

  const landingCases: Array<[string, string]> = [
    ['ADMIN', '/admin/dashboard'],
    ['SELLER', '/seller/operations'],
    ['COLLECTOR', '/collector/route'],
    ['SELLER_COLLECTOR', '/collector/route'],
    ['CASHIER', '/login'],
  ];
  landingCases.forEach(([role, expected]) => {
    it(`login con ${role} aterriza en ${expected}`, () => {
      const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
      (component as never as { redirectByRole: (u: unknown) => void }).redirectByRole({
        roles: [role],
        is_temp_password: false,
      });
      expect(navigate).toHaveBeenCalledWith([expected]);
    });
  });
});
