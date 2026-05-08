import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MessageService } from 'primeng/api';

import { ClientsComponent } from './clients.component';
import { MockAuthService } from '../../core/auth/mock-auth.service';
import { CustomersService } from '../../features/seller/clients/customers.service';
import { FormatService } from '../../core/services/format.service';

const MOCK_CUSTOMER_DETAIL = {
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
  portalIsTempPassword: false,
  portalFailedAttempts: 0,
  portalLockedAt: null,
  updatedAt: '2025-01-01T00:00:00Z',
};

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

  beforeEach(async () => {
    routerSpy = jasmine.createSpyObj('Router', ['navigate'], { url: '/admin/clients' });
    customersServiceSpy = jasmine.createSpyObj('CustomersService', ['list', 'create', 'update']);
    authSpy = jasmine.createSpyObj('MockAuthService', ['hasRole']);
    customersServiceSpy.list.and.returnValue(of(MOCK_CUSTOMERS));
    authSpy.hasRole.and.returnValue(true);

    await TestBed.configureTestingModule({
      imports: [ClientsComponent],
      providers: [
        { provide: Router, useValue: routerSpy },
        { provide: MockAuthService, useValue: authSpy },
        { provide: CustomersService, useValue: customersServiceSpy },
        { provide: FormatService, useValue: { currency: (n: number) => `$${n}` } },
        MessageService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ClientsComponent);
    component = fixture.componentInstance;
    spyOn((component as any).messageService, 'add');
    fixture.detectChanges();
  });

  it('debería crear el componente', () => {
    expect(component).toBeTruthy();
  });

  describe('openView', () => {
    it('debería navegar usando el ID del cliente (UUID), no el DNI', () => {
      const client = component.filteredClients[0];

      // Verificamos que el client tiene id y que es el UUID esperado
      expect(client.id).toBe('uuid-001');

      component.openView(client);

      const navegacion = routerSpy.navigate.calls.mostRecent().args[0];
      expect(navegacion).toEqual(['/admin', 'clients', 'uuid-001']);
      // El último segmento debe ser el UUID, no el DNI
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

  describe('saveEdit()', () => {
    beforeEach(() => {
      const client = component.clients[0];
      component.openEdit(client);
      component.editForm.setValue({
        nombre: 'Juan',
        apellido: 'Pérez',
        phone: '1123456789',
      });
    });

    it('T1 - debería llamar a customersService.update con el UUID y el payload correcto', () => {
      customersServiceSpy.update.and.returnValue(of(MOCK_CUSTOMER_DETAIL as any));
      component.editForm.setValue({
        nombre: 'Juan',
        apellido: 'Pérez',
        phone: '1123456789',
      });

      component.saveEdit();

      expect(customersServiceSpy.update).toHaveBeenCalledWith('uuid-001', {
        fullName: 'Juan Pérez',
        phone: '1123456789',
      });
    });

    it('T2 - en caso de éxito debería recargar la lista y cerrar el modal', () => {
      customersServiceSpy.update.and.returnValue(of(MOCK_CUSTOMER_DETAIL as any));
      spyOn<any>(component, 'loadClients').and.callThrough();

      component.saveEdit();

      expect(component.showEditModal).toBeFalse();
      expect((component as any).loadClients).toHaveBeenCalled();
    });

    it('T3 - error de API debería mostrar mensaje, mantener modal abierto y NO llamar a loadClients', () => {
      customersServiceSpy.update.and.returnValue(throwError(() => ({ status: 500 })));
      spyOn<any>(component, 'loadClients').and.callThrough();

      component.saveEdit();

      expect(component.showEditModal).toBeTrue();
      expect(component.editError).toBeTruthy();
      expect((component as any).loadClients).not.toHaveBeenCalled();
    });

    it('T4 - error 403 debería mostrar mensaje "sin permisos"', () => {
      customersServiceSpy.update.and.returnValue(throwError(() => ({ status: 403 })));

      component.saveEdit();

      expect(component.editError).toContain('permisos');
    });
  });

  describe('loadClients()', () => {
    it('T5 - debería cargar clientes con id y dni correctos desde el servicio', () => {
      const twoCustomers = [
        { ...MOCK_CUSTOMERS[0], id: 'uuid-aaa', dni: '11111111', fullName: 'Ana Lopez' },
        { ...MOCK_CUSTOMERS[0], id: 'uuid-bbb', dni: '22222222', fullName: 'Carlos Ruiz' },
      ];
      customersServiceSpy.list.and.returnValue(of(twoCustomers));

      (component as any).loadClients();

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

    it('no debería abrir el modal ni llamar a update si el usuario no tiene permisos', () => {
      authSpy.hasRole.and.returnValue(false);
      const client = component.clients[0];

      component.openEdit(client);
      component.saveEdit();

      expect(component.showEditModal).toBeFalse();
      expect(component.editError).toContain('permisos');
      expect(customersServiceSpy.update).not.toHaveBeenCalled();
    });
  });

  describe('createClient()', () => {
    it('muestra toast de éxito al crear cliente correctamente', () => {
      customersServiceSpy.create.and.returnValue(of(MOCK_CUSTOMER_DETAIL as any));
      spyOn<any>(component, 'loadClients').and.callThrough();
      component.showCreateModal = true;
      component.form.setValue({
        nombres: 'Laura',
        apellidos: 'Gómez',
        dni: '99887766',
        telefonoPrincipal: '3101112222',
        telefonoAlterno: '',
        email: 'laura@test.com',
        direccion: 'Calle 10',
        ingresos: '5000000',
      });

      component.createClient();

      expect(customersServiceSpy.create).toHaveBeenCalled();
      expect(component.showCreateModal).toBeFalse();
      expect((component as any).loadClients).toHaveBeenCalled();
      expect((component as any).messageService.add).toHaveBeenCalledWith({
        severity: 'success',
        summary: 'Éxito',
        detail: 'Cliente guardado correctamente.',
        life: 4500,
      });
    });

    it('muestra toast de error si la API responde conflicto por DNI duplicado', () => {
      customersServiceSpy.create.and.returnValue(
        throwError(() => ({ status: 409 })),
      );
      component.showCreateModal = true;
      component.form.setValue({
        nombres: 'Laura',
        apellidos: 'Gómez',
        dni: '99887766',
        telefonoPrincipal: '3101112222',
        telefonoAlterno: '',
        email: 'laura@test.com',
        direccion: 'Calle 10',
        ingresos: '5000000',
      });

      component.createClient();

      expect(component.creatingClient).toBeFalse();
      expect(component.showCreateModal).toBeTrue();
      expect((component as any).messageService.add).toHaveBeenCalledWith({
        severity: 'error',
        summary: 'No se pudo crear el cliente',
        detail: 'Ya existe un cliente con ese DNI.',
        life: 5000,
      });
    });
  });
});
