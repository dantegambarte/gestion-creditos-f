import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject } from 'rxjs';
import { SidebarComponent } from './sidebar.component';
import { NAV_CONFIG } from '../../utils/nav-config';
import { NavItem } from '../../models/interface/nav-item';
import { MockAuthService } from '../../../core/auth/mock-auth.service';
import { AuthServiceBase } from '../../../core/auth/auth-service.base';
import { AuthUser } from '../../../core/models/interface/auth-user';

// ── Helper: crea un usuario mock con roles específicos ────────────────────────
function makeUser(roles: ('ADMIN' | 'SELLER' | 'COLLECTOR' | 'SELLER_COLLECTOR')[]): AuthUser {
  return {
    id: 'x',
    full_name: 'Test User',
    name: 'Test User',
    dni: '12345678',
    email: 'test@x.com',
    avatar: 'TU',
    roles,
    is_temp_password: false,
    force_relogin_at: null,
    token: 'mock',
  };
}

// ── Mock del servicio de autenticación ────────────────────────────────────────
const userSubject = new BehaviorSubject<AuthUser | null>(null);
const mockAuthService = {
  currentUser$: userSubject.asObservable(),
  logout: jasmine.createSpy('logout'),
};

describe('SidebarComponent', () => {
  let component: SidebarComponent;
  let fixture: ComponentFixture<SidebarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SidebarComponent, RouterTestingModule],
      providers: [
        { provide: MockAuthService, useValue: mockAuthService },
        { provide: AuthServiceBase, useValue: mockAuthService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SidebarComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => userSubject.next(null));

  // ── Sin usuario autenticado ───────────────────────────────────────────────
  it('debería mostrar 0 items de navegación si no hay usuario', () => {
    userSubject.next(null);
    fixture.detectChanges();
    expect(component.visibleItems.length).toBe(0);
  });

  // ── Rol ADMIN: debe ver todos sus ítems ───────────────────────────────────
  it('debería mostrar todos los ítems de ADMIN cuando el rol es ADMIN', () => {
    userSubject.next(makeUser(['ADMIN']));
    fixture.detectChanges();

    const adminItems = NAV_CONFIG.filter((i: NavItem) =>
      i.requiredRoles.includes('ADMIN'),
    );
    expect(component.visibleItems.length).toBe(adminItems.length);
  });

  it('debería mostrar "Aprobaciones" en el sidebar para ADMIN', () => {
    userSubject.next(makeUser(['ADMIN']));
    fixture.detectChanges();

    const labels = component.visibleItems.map((i) => i.label);
    expect(labels).toContain('Aprobaciones');
  });

  it('debería mostrar "Mora y Canc." para ADMIN', () => {
    userSubject.next(makeUser(['ADMIN']));
    fixture.detectChanges();
    expect(component.visibleItems.map((i) => i.label)).toContain(
      'Mora y Canc.',
    );
  });

  // ── Rol SELLER: NO debe ver ítems de admin ────────────────────────────────
  it('debería NO mostrar "Aprobaciones" para SELLER', () => {
    userSubject.next(makeUser(['SELLER']));
    fixture.detectChanges();
    expect(component.visibleItems.map((i) => i.label)).not.toContain(
      'Aprobaciones',
    );
  });

  it('debería NO mostrar "Mora y Canc." para SELLER', () => {
    userSubject.next(makeUser(['SELLER']));
    fixture.detectChanges();
    expect(component.visibleItems.map((i) => i.label)).not.toContain(
      'Mora y Canc.',
    );
  });

  it('debería mostrar "Operaciones" y "Clientes" para SELLER', () => {
    userSubject.next(makeUser(['SELLER']));
    fixture.detectChanges();
    const labels = component.visibleItems.map((i) => i.label);
    expect(labels).toContain('Operaciones');
    expect(labels).toContain('Clientes');
  });

  // ── Rol COLLECTOR ─────────────────────────────────────────────────────────
  it('debería mostrar SOLO "Mi Ruta" para COLLECTOR (más grupo label)', () => {
    userSubject.next(makeUser(['COLLECTOR']));
    fixture.detectChanges();
    // COLLECTOR: Mi Ruta, Mis cobros, Mis comisiones, Simulador
    const routeItems = component.visibleItems.filter((i: NavItem) => !i.isGroupLabel);
    expect(routeItems.length).toBe(4);
    expect(routeItems[0].label).toBe('Mi Ruta');
  });

  // ── Cambio dinámico de rol en la misma sesión ─────────────────────────────
  it('debería actualizar visibleItems dinámicamente al cambiar el usuario', () => {
    userSubject.next(makeUser(['SELLER']));
    fixture.detectChanges();
    const sellerCount = component.visibleItems.length;

    userSubject.next(makeUser(['ADMIN']));
    fixture.detectChanges();
    const adminCount = component.visibleItems.length;

    expect(adminCount).toBeGreaterThan(sellerCount);
  });

  // ── DOM: data-testid ──────────────────────────────────────────────────────
  it('debería renderizar los ítems con data-testid en el DOM', () => {
    userSubject.next(makeUser(['ADMIN']));
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="nav-aprobaciones"]')).toBeTruthy();
  });

  // ── Logout ────────────────────────────────────────────────────────────────
  it('debería llamar auth.logout() al hacer clic en "Salir"', () => {
    userSubject.next(makeUser(['ADMIN']));
    fixture.detectChanges();
    const btn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[data-testid="logout-btn"]',
    );
    btn.click();
    expect(mockAuthService.logout).toHaveBeenCalled();
  });

  // ── Estado mobile con Signals ─────────────────────────────────────────────
  it('debería abrir y cerrar el menú mobile con signals', () => {
    userSubject.next(makeUser(['ADMIN']));
    fixture.detectChanges();

    component.toggleMobileMenu();
    expect(component.mobileMenuOpen()).toBeTrue();

    component.closeMobileMenu();
    expect(component.mobileMenuOpen()).toBeFalse();
  });
});
