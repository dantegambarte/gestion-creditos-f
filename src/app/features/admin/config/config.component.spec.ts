import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthServiceBase } from '../../../core/auth/auth-service.base';
import { provideAuthTesting } from '../../../core/auth/testing/auth-testing';
import { ConfigComponent } from './config.component';

describe('ConfigComponent', () => {
  let component: ConfigComponent;
  let fixture: ComponentFixture<ConfigComponent>;

  beforeEach(async () => {
    // No hace requests HTTP: no necesita HttpClient.
    await TestBed.configureTestingModule({
      imports: [ConfigComponent],
      providers: [provideRouter([]), ...provideAuthTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfigComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('expone las secciones de configuración en orden', () => {
    expect(component.navItems.map((i) => i.path)).toEqual([
      'rates',
      'product-rates',
      'system-params',
      'holidays',
      'notifications',
    ]);
  });

  it('cerrar sesión delega en el servicio de autenticación', () => {
    const logout = spyOn(TestBed.inject(AuthServiceBase), 'logout');

    component.logout();

    expect(logout).toHaveBeenCalledTimes(1);
  });
});
