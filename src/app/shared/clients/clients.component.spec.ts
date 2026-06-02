import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';

import { AuthServiceBase } from '../../core/auth/auth-service.base';
import { MockAuthService } from '../../core/auth/mock-auth.service';
import { HeaderService } from '../../core/services/header.service';
import { UsersService } from '../../features/admin/users/users.service';
import { CustomersService } from '../../features/seller/clients/customers.service';
import { ClientsComponent } from './clients.component';

const MOCK_CUSTOMERS = [
  {
    id: 'uuid-001',
    fullName: 'Juan Pérez',
    dni: '27123456',
    phone: null,
    email: null,
    address: null,
    status: 'ACTIVE' as const,
    portalEnabled: false,
    createdAt: '2025-01-01T00:00:00Z',
    collectorId: null,
    collectorName: null,
  },
];

describe('ClientsComponent', () => {
  let component: ClientsComponent;
  let fixture: ComponentFixture<ClientsComponent>;
  let routerSpy: jasmine.SpyObj<Router>;
  let customersServiceSpy: jasmine.SpyObj<CustomersService>;
  let authSpy: jasmine.SpyObj<MockAuthService>;
  let headerSpy: jasmine.SpyObj<HeaderService>;

  beforeEach(async () => {
    routerSpy = jasmine.createSpyObj('Router', ['navigate'], {
      url: '/admin/clients',
    });
    customersServiceSpy = jasmine.createSpyObj('CustomersService', [
      'list',
      'create',
      'update',
    ]);
    authSpy = jasmine.createSpyObj('MockAuthService', ['hasRole']);
    headerSpy = jasmine.createSpyObj('HeaderService', ['set', 'reset']);
    customersServiceSpy.list.and.returnValue(of(MOCK_CUSTOMERS));
    authSpy.hasRole.and.returnValue(true);
    const usersServiceSpy = jasmine.createSpyObj('UsersService', [
      'listCollectors',
    ]);
    usersServiceSpy.listCollectors.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [ClientsComponent],
      providers: [
        { provide: Router, useValue: routerSpy },
        { provide: AuthServiceBase, useValue: authSpy },
        { provide: CustomersService, useValue: customersServiceSpy },
        { provide: UsersService, useValue: usersServiceSpy },
        { provide: HeaderService, useValue: headerSpy },
        MessageService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ClientsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debería crear el componente', () => {
    expect(component).toBeTruthy();
  });

  describe('openView', () => {
    it('debería navegar usando el ID del cliente (UUID), no el DNI', () => {
      const client = component.filteredClients[0];

      expect(client.id).toBe('uuid-001');

      component.openView(client);

      const navegacion = routerSpy.navigate.calls.mostRecent().args[0];
      expect(navegacion).toEqual(['/admin', 'clients', 'uuid-001']);
      expect(navegacion[navegacion.length - 1]).toBe('uuid-001');
      expect(navegacion[navegacion.length - 1]).not.toBe('27123456');
    });
  });

  describe('openCredits', () => {
    it('debería navegar usando el ID del cliente (UUID), no el DNI', () => {
      const client = component.filteredClients[0];

      component.openCredits(client);

      const navegacion = routerSpy.navigate.calls.mostRecent().args[0];
      expect(navegacion[navegacion.length - 1]).toBe('uuid-001');
      expect(navegacion[navegacion.length - 1]).not.toBe('27123456');
    });
  });

  describe('loadClients()', () => {
    it('T5 - debería cargar clientes con id y dni correctos desde el servicio', () => {
      const twoCustomers = [
        {
          ...MOCK_CUSTOMERS[0],
          id: 'uuid-aaa',
          dni: '11111111',
          fullName: 'Ana Lopez',
        },
        {
          ...MOCK_CUSTOMERS[0],
          id: 'uuid-bbb',
          dni: '22222222',
          fullName: 'Carlos Ruiz',
        },
      ];
      customersServiceSpy.list.and.returnValue(of(twoCustomers));

      component.loadClients();

      expect(component.clients.length).toBe(2);
      expect(component.clients[0].id).toBe('uuid-aaa');
      expect(component.clients[0].dni).toBe('11111111');
      expect(component.clients[1].id).toBe('uuid-bbb');
      expect(component.clients[1].dni).toBe('22222222');
    });
  });

  describe('permisos de edición', () => {
    it('solo debería permitir editar cuando el usuario es ADMIN', () => {
      authSpy.hasRole.and.returnValue(false);

      expect(component.canEditClients).toBeFalse();
    });

    it('no debería abrir el modal si el usuario no tiene permisos', () => {
      authSpy.hasRole.and.returnValue(false);
      const client = component.clients[0];

      component.openEdit(client);

      expect(component.showEditModal).toBeFalse();
    });
  });

  describe('CL-10 — créditos del cliente usa activeCredits, no 0', () => {
    it('toClient mapea activeCredits del backend al campo credits', () => {
      const twoCustomers = [
        {
          ...MOCK_CUSTOMERS[0],
          id: 'cl-1',
          fullName: 'Ana García',
          activeCredits: 3,
        },
        {
          ...MOCK_CUSTOMERS[0],
          id: 'cl-2',
          fullName: 'Carlos Ruiz',
          activeCredits: 0,
        },
      ];
      customersServiceSpy.list.and.returnValue(of(twoCustomers));
      component.loadClients();

      expect(component.clients[0].credits).toBe(3);
      expect(component.clients[1].credits).toBe(0);
    });

    it('cuando activeCredits es undefined, usa 0 como fallback', () => {
      const customer = {
        ...MOCK_CUSTOMERS[0],
        id: 'cl-3',
        activeCredits: undefined,
      };
      customersServiceSpy.list.and.returnValue(of([customer]));
      component.loadClients();

      expect(component.clients[0].credits).toBe(0);
    });
  });

  describe('paginación (CL-08)', () => {
    it('la tabla tiene paginator=true con 10 filas por página', () => {
      const table = fixture.nativeElement.querySelector('p-table');
      expect(table.getAttribute('ng-reflect-paginator')).toBe('true');
      expect(table.getAttribute('ng-reflect-rows')).toBe('10');
    });
  });

  describe('CL-14 — Risk mapping usa delinquency del cliente', () => {
    it('client con delinquency "Mora alta" tiene risk "Mora alta"', () => {
      const customerWithMora = {
        ...MOCK_CUSTOMERS[0],
        delinquency: 'Mora alta',
      };
      customersServiceSpy.list.and.returnValue(of([customerWithMora]));
      component.loadClients();
      expect(component.clients[0].risk).toBe('Mora alta');
    });

    it('client sin delinquency usa "Al dia" como fallback', () => {
      const customerNoDelin = { ...MOCK_CUSTOMERS[0], delinquency: undefined };
      customersServiceSpy.list.and.returnValue(of([customerNoDelin]));
      component.loadClients();
      expect(component.clients[0].risk).toBe('Al dia');
    });
  });
});
