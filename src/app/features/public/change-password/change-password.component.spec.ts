import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ChangePasswordComponent } from './change-password.component';
import { MockAuthService } from '../../../core/auth/mock-auth.service';
import { AuthServiceBase } from '../../../core/auth/auth-service.base';
import { AppError } from '../../../core/models/app-error';
import { AppRoutes } from '../../../shared/models/enums/routes.enum';
import { ReactiveFormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

const MOCK_USER = {
  id: 'usr-001',
  full_name: 'Test Admin',
  name: 'Test Admin',
  dni: '12345678',
  avatar: 'TA',
  roles: ['ADMIN' as const],
  is_temp_password: true,
  force_relogin_at: null,
  token: 'mock-token',
};

describe('ChangePasswordComponent', () => {
  let fixture: ComponentFixture<ChangePasswordComponent>;
  let component: ChangePasswordComponent;
  let authSpy: jasmine.SpyObj<MockAuthService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    authSpy = jasmine.createSpyObj('MockAuthService', ['changePassword'], {
      snapshot: { ...MOCK_USER },
    });
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [
        ChangePasswordComponent,
        ReactiveFormsModule,
        NoopAnimationsModule,
      ],
      providers: [
        { provide: MockAuthService, useValue: authSpy },
        { provide: AuthServiceBase, useExisting: MockAuthService },
        { provide: Router, useValue: routerSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChangePasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows temp-password banner when is_temp_password is true', () => {
    expect(component.isTempPassword).toBeTrue();
  });

  it('hides cancel button when is_temp_password is true', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const cancelBtn = compiled.querySelector('[data-testid="btn-cancel"]');
    expect(cancelBtn).toBeNull();
  });

  it('changePassword success: calls service and clears loading', () => {
    authSpy.changePassword.and.returnValue(of(undefined));
    component.form.setValue({
      current_password: 'OldPass1!',
      new_password: 'NewPass1!',
      confirm_password: 'NewPass1!',
    });
    component.onSubmit();
    expect(authSpy.changePassword).toHaveBeenCalledWith(
      'OldPass1!',
      'NewPass1!',
    );
    expect(component.loading).toBeFalse();
  });

  it('changePassword 401: shows error under current_password field', () => {
    const err: AppError = {
      status: 401,
      message: 'La contraseña actual es incorrecta.',
    };
    authSpy.changePassword.and.returnValue(throwError(() => err));
    component.form.setValue({
      current_password: 'wrong',
      new_password: 'NewPass1!',
      confirm_password: 'NewPass1!',
    });
    component.onSubmit();
    expect(component.currentPasswordError).toBe(
      'La contraseña actual es incorrecta.',
    );
    expect(component.newPasswordError).toBe('');
  });

  it('changePassword 400: shows error under new_password field', () => {
    const err: AppError = {
      status: 400,
      message: 'La nueva contraseña no puede ser igual a la actual.',
    };
    authSpy.changePassword.and.returnValue(throwError(() => err));
    component.form.setValue({
      current_password: 'SamePass1!',
      new_password: 'SamePass1!',
      confirm_password: 'SamePass1!',
    });
    component.onSubmit();
    expect(component.newPasswordError).toBe(
      'La nueva contraseña no puede ser igual a la actual.',
    );
    expect(component.currentPasswordError).toBe('');
  });
});

describe('MockAuthService.changePassword', () => {
  let service: MockAuthService;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(() => {
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    service = new MockAuthService(routerSpy);
    (service as any).persist({ ...MOCK_USER });
  });

  it('updates is_temp_password to false and navigates to dashboard', (done) => {
    service.changePassword('old', 'new').subscribe(() => {
      expect(service.snapshot?.is_temp_password).toBeFalse();
      expect(routerSpy.navigate).toHaveBeenCalledWith([
        AppRoutes.DASHBOARD,
      ]);
      done();
    });
  });
});
