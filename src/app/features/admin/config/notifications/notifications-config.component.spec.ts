import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { throwError } from 'rxjs';
import { NotificationsConfigComponent } from './notifications-config.component';
import { NotificationsService } from '../../../../core/services/notifications.service';

describe('NotificationsConfigComponent save', () => {
  it('si el guardado falla avisa y conserva los cambios pendientes', () => {
    const svc = jasmine.createSpyObj('NotificationsService', [
      'getPreferences',
      'list',
      'updatePreferences',
    ]);
    const msg = jasmine.createSpyObj('MessageService', ['add']);
    svc.updatePreferences.and.returnValue(throwError(() => ({ status: 500 })));
    TestBed.configureTestingModule({
      imports: [NotificationsConfigComponent],
      providers: [
        { provide: NotificationsService, useValue: svc },
        { provide: MessageService, useValue: msg },
      ],
    });
    const c = TestBed.createComponent(NotificationsConfigComponent).componentInstance;
    c.loading = false;
    c.settings = [{ id: 'PAYMENT_RECEIVED', enabled: true } as any];
    (c as any).originalEnabled = new Map([['PAYMENT_RECEIVED', false]]);
    c.hasChanges = true;
    c.save();
    expect(svc.updatePreferences).toHaveBeenCalled();
    expect(c.saving).toBeFalse();
    expect(c.hasChanges).toBeTrue();
    expect(msg.add).toHaveBeenCalledWith(jasmine.objectContaining({ severity: 'error' }));
  });
});
