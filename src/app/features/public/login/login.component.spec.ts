import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { LoginComponent } from './login.component';
import { AuthServiceBase } from '../../../core/auth/auth-service.base';
import { MockAuthService } from '../../../core/auth/mock-auth.service';

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
      providers: [
        { provide: AuthServiceBase, useValue: mockAuth },
        provideRouter([]),
      ],
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

    const error = fixture.nativeElement.querySelector(
      '[data-testid="password-minlength-error"]',
    );
    expect(error).not.toBeNull();
    expect(error.textContent).toContain('al menos 6 caracteres');
  });
});
