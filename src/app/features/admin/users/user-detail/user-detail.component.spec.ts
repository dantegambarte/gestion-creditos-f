import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Confirmation, ConfirmationService, MessageService } from 'primeng/api';
import { HeaderService } from '../../../../core/services/header.service';
import { UsersService } from '../users.service';
import { UserDetailComponent } from './user-detail.component';

describe('UserDetailComponent (mensajes de confirmación)', () => {
  let component: UserDetailComponent;
  let confirm: jasmine.Spy;

  beforeEach(() => {
    const confirmationService = new ConfirmationService();
    confirm = spyOn(confirmationService, 'confirm').and.returnValue(confirmationService);
    TestBed.configureTestingModule({
      providers: [
        { provide: ActivatedRoute, useValue: {} },
        { provide: UsersService, useValue: {} },
        { provide: Router, useValue: {} },
        { provide: HeaderService, useValue: {} },
        { provide: MessageService, useValue: {} },
        { provide: ConfirmationService, useValue: confirmationService },
      ],
    });
    component = TestBed.runInInjectionContext(() => new UserDetailComponent());
    component.user = { fullName: '<b>x</b>' } as never;
  });

  /** Renderiza el último mensaje confirmado como lo hace el diálogo (innerHTML). */
  const renderedMessage = (): HTMLElement => {
    const { message } = confirm.calls.mostRecent().args[0] as Confirmation;
    const el = document.createElement('span');
    el.innerHTML = message ?? '';
    return el;
  };

  (
    ['confirmDeactivate', 'confirmActivate', 'confirmResetPassword', 'confirmUnlock'] as const
  ).forEach((method) => {
    it(`${method} muestra el fullName "<b>x</b>" como texto literal`, () => {
      (component as never as Record<string, () => void>)[method]();
      const el = renderedMessage();
      expect(el.querySelector('b')).toBeNull();
      expect(el.querySelector('strong')?.textContent).toBe('<b>x</b>');
    });
  });
});
