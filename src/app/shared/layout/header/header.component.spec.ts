import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { MockAuthService } from '../../../core/auth/mock-auth.service';
import { AuthServiceBase } from '../../../core/auth/auth-service.base';
import { NotificationsService } from '../../../core/services/notifications.service';
import { HeaderComponent } from './header.component';

describe('HeaderComponent', () => {
  let component: HeaderComponent;
  let fixture: ComponentFixture<HeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        MockAuthService,
        { provide: AuthServiceBase, useExisting: MockAuthService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('arranca el polling de unread-count al iniciar', () => {
    const notifSvc = TestBed.inject(NotificationsService);
    const startSpy = spyOn(notifSvc, 'startPolling');

    component.ngOnInit();

    expect(startSpy).toHaveBeenCalled();
  });

  it('corta el polling al destruirse (logout / navegación fuera del shell autenticado)', () => {
    const notifSvc = TestBed.inject(NotificationsService);
    const stopSpy = spyOn(notifSvc, 'stopPolling');

    component.ngOnDestroy();

    expect(stopSpy).toHaveBeenCalled();
  });

  describe('deep links de notificaciones por rol', () => {
    /** Devuelve la ruta calculada para una notificación con el rol indicado. */
    const routeFor = (roles: string[], entity_type: string) => {
      spyOnProperty(component.auth, 'snapshot', 'get').and.returnValue({ roles } as never);
      return (
        component as never as {
          getNotificationRoute: (i: unknown) => string[] | null;
        }
      ).getNotificationRoute({ id: 'n1', entity_type, entity_id: 'x1' });
    };

    it('ADMIN conserva los deep links de /admin', () => {
      expect(routeFor(['ADMIN'], 'credit')).toEqual(['/admin/operations', 'x1']);
    });

    it('ADMIN conserva links de clientes, aprobaciones y caja', () => {
      spyOnProperty(component.auth, 'snapshot', 'get').and.returnValue({
        roles: ['ADMIN'],
      } as never);
      const resolve = (entity_type: string) =>
        (
          component as never as {
            getNotificationRoute: (i: unknown) => string[] | null;
          }
        ).getNotificationRoute({ id: 'n1', entity_type, entity_id: 'x1' });
      expect(resolve('customer')).toEqual(['/admin/clients', 'x1']);
      expect(resolve('payment')).toEqual(['/admin/approvals']);
      expect(resolve('business_day')).toEqual(['/admin/cash-register']);
    });

    ['SELLER', 'COLLECTOR', 'SELLER_COLLECTOR'].forEach((role) => {
      it(`${role} recibe links a su área y nunca a /admin`, () => {
        spyOnProperty(component.auth, 'snapshot', 'get').and.returnValue({
          roles: [role],
        } as never);
        const resolve = (entity_type: string) =>
          (
            component as never as {
              getNotificationRoute: (i: unknown) => string[] | null;
            }
          ).getNotificationRoute({ id: 'n1', entity_type, entity_id: 'x1' });
        expect(resolve('credit')).toEqual(['/seller/operations', 'x1']);
        expect(resolve('customer')).toEqual(['/seller/clients', 'x1']);
        expect(resolve('payment')).toBeNull();
        expect(resolve('business_day')).toBeNull();
      });
    });

    it('CASHIER no recibe deep links a áreas sin acceso', () => {
      expect(routeFor(['CASHIER'], 'credit')).toBeNull();
    });
  });
});
