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
});
