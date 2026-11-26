import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ForgotPasswordComponent } from './forgot-password.component';

describe('ForgotPasswordComponent', () => {
  let fixture: ComponentFixture<ForgotPasswordComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(ForgotPasswordComponent);
    fixture.detectChanges();
  });

  it('no simula envío exitoso: informa que la recuperación no está disponible', () => {
    const c = fixture.componentInstance;
    c.form.setValue({ email: 'juan@mail.com' });
    c.onSubmit();
    fixture.detectChanges();
    expect(c.sent).toBeFalse();
    expect(c.unavailable).toBeTrue();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-cy="forgot-password-unavailable"]')).not.toBeNull();
    expect(el.textContent).not.toContain('Email enviado');
  });

  it('con email inválido no muestra el aviso', () => {
    fixture.componentInstance.onSubmit();
    expect(fixture.componentInstance.unavailable).toBeFalse();
  });
});
