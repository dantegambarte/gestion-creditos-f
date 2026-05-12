import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ClientDetailComponent } from './client-detail.component';
import { HeaderService } from '../../../core/services/header.service';
import { CustomersService } from '../../../features/seller/clients/customers.service';
import { provideAuthTesting } from '../../../core/auth/testing/auth-testing';

function buildActivatedRoute(params: Record<string, string>) {
  return {
    snapshot: {
      paramMap: convertToParamMap(params),
    },
  };
}

describe('ClientDetailComponent (shared/clients)', () => {
  let component: ClientDetailComponent;
  let fixture: ComponentFixture<ClientDetailComponent>;
  let customersServiceSpy: jasmine.SpyObj<CustomersService>;

  async function setup(
    routeParams: Record<string, string>,
    customerResponse = of({
      id: 'uuid-001',
      fullName: 'Juan Pérez García',
      dni: '27.123.456',
      phone: '+54 9 2865 123456',
      email: 'juan@email.com',
      address: 'Calle Principal 123',
      status: 'ACTIVE' as const,
      portalEnabled: false,
      createdAt: '2026-01-01T00:00:00Z',
      collectorId: null,
      collectorName: null,
      portalIsTempPassword: false,
      portalFailedAttempts: 0,
      portalLockedAt: null,
      updatedAt: '2026-01-01T00:00:00Z',
    }),
  ) {
    const headerServiceSpy = jasmine.createSpyObj('HeaderService', ['reset'], {
      breadcrumbs: { set: jasmine.createSpy() },
      actions: { set: jasmine.createSpy() },
    });
    const routerSpy = jasmine.createSpyObj('Router', ['navigate'], { url: '/admin/clients/uuid-001' });
    customersServiceSpy = jasmine.createSpyObj('CustomersService', ['getById']);
    customersServiceSpy.getById.and.returnValue(customerResponse);

    await TestBed.configureTestingModule({
      imports: [ClientDetailComponent],
      providers: [
        { provide: ActivatedRoute, useValue: buildActivatedRoute(routeParams) },
        { provide: Router, useValue: routerSpy },
        { provide: HeaderService, useValue: headerServiceSpy },
        { provide: CustomersService, useValue: customersServiceSpy },
        ...provideAuthTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ClientDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('debería cargar el cliente correcto desde CustomersService cuando el ID existe', async () => {
    await setup({ id: 'uuid-001' });

    expect(customersServiceSpy.getById).toHaveBeenCalledWith('uuid-001');
    expect(component.client).not.toBeNull();
    expect(component.client?.dni).toBe('27.123.456');
    expect(component.client?.name).toBe('Juan Pérez García');
  });

  it('debería mostrar fallback de no encontrado cuando la API responde 404', async () => {
    await setup(
      { id: 'id-inexistente' },
      throwError(() => ({ status: 404, message: 'Cliente no encontrado.' })),
    );

    expect(component.client).toBeNull();
    expect(component.notFound).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Cliente no encontrado.');
  });

  it('NO debería mostrar estado de no encontrado cuando falla por un error distinto de 404', async () => {
    await setup(
      { id: 'uuid-001' },
      throwError(() => ({ status: 500, message: 'Falló el servidor.' })),
    );

    expect(component.client).toBeNull();
    expect(component.notFound).toBeFalse();
    expect(component.errorMessage).toBe('Falló el servidor.');
    expect(fixture.nativeElement.textContent).not.toContain('Cliente no encontrado.');
  });

  it('NO debería leer el parámetro "dni" de la ruta — solo acepta "id"', async () => {
    await setup({ dni: '27.123.456' });

    expect(customersServiceSpy.getById).not.toHaveBeenCalled();
    expect(component.client).toBeNull();
    expect(component.notFound).toBeTrue();
  });
});
