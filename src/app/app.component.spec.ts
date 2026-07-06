import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MessageService } from 'primeng/api';
import { MockAuthService } from './core/auth/mock-auth.service';
import { AuthServiceBase } from './core/auth/auth-service.base';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        // NotificationsService (vía el árbol de inyección del layout) necesita
        // HttpClient; proveerlo hace este spec autosuficiente e independiente
        // del orden aleatorio de ejecución de Jasmine.
        provideHttpClient(),
        provideHttpClientTesting(),
        MessageService,
        MockAuthService,
        { provide: AuthServiceBase, useExisting: MockAuthService },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should have the 'gestion-creditos-f' title`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('gestion-creditos-f');
  });

  it('should render the app layout container', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('div')).toBeTruthy();
  });
});
