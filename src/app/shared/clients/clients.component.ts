import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';

import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';

import { AuthServiceBase } from '../../core/auth/auth-service.base';
import { UserRoleEnum } from '../../core/models/types/user-role';
import { HeaderService } from '../../core/services/header.service';
import { UsersService } from '../../features/admin/users/users.service';
import { CustomersService } from '../../features/seller/clients/customers.service';
import { Customer } from '../../features/seller/models/customer.model';
import { AppRoutes } from '../models/enums/routes.enum';
import { Client } from '../models/interface/client';

const AVATAR_COLORS = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
  '#F97316',
];

function toClient(c: Customer): Client {
  const parts = c.fullName.trim().split(/\s+/);
  const initials = (
    (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
  ).toUpperCase();
  const colorIdx = c.fullName.charCodeAt(0) % AVATAR_COLORS.length;
  return {
    id: c.id,
    dni: c.dni,
    initials,
    avatarColor: AVATAR_COLORS[colorIdx],
    name: c.fullName,
    phone: c.phone ?? '',
    credits: c.activeCredits ?? 0,
    risk: c.delinquency ?? 'Al dia',
    email: c.email ?? undefined,
    address: c.address ?? undefined,
    collectorId: c.collectorId ?? undefined,
  };
}

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TableModule,
    ButtonModule,
    InputTextModule,
    DropdownModule,
    IconFieldModule,
    InputIconModule,
    TagModule,
    DialogModule,
    ToastModule,
  ],
  providers: [MessageService],
  templateUrl: './clients.component.html',
  styleUrl: './clients.component.scss',
})
export class ClientsComponent implements OnInit, OnDestroy {
  private readonly customersService = inject(CustomersService);
  private readonly usersService = inject(UsersService);
  private readonly auth = inject(AuthServiceBase);
  private readonly messageService = inject(MessageService);
  private readonly header = inject(HeaderService);

  clients: Client[] = [];
  loading = false;
  collectorOptions: { label: string; value: string }[] = [];
  collectorsLoading = false;

  filterOptions = [
    { label: 'Todos', value: null },
    { label: 'Al día', value: 'Al dia' },
    { label: 'Mora leve', value: 'Mora leve' },
    { label: 'Mora alta', value: 'Mora alta' },
  ];

  selectedFilter: any = null;
  searchTerm: string = '';
  showCreateModal: boolean = false;
  showEditModal: boolean = false;
  showViewModal: boolean = false;
  submitted: boolean = false;
  creatingClient: boolean = false;
  selectedClient: Client | null = null;
  editError: string = '';

  form: FormGroup;
  editForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private router: Router,
  ) {
    this.form = this.buildForm();
    this.editForm = this.buildEditForm(null);
  }

  /**
   * Inicializa catálogos, carga de datos y el estado visual del header para esta pantalla.
   */
  ngOnInit(): void {
    this.header.set([{ label: 'Clientes' }]);
    this.loadCollectors();
    this.loadClients();
  }

  /**
   * Restaura el header al salir de la pantalla para evitar arrastre de estado entre rutas.
   */
  ngOnDestroy(): void {
    this.header.reset();
  }

  /**
   * Indica si el usuario actual puede editar clientes según el permiso real del backend.
   * Se usa para no ofrecer una acción que el endpoint rechaza con 403.
   */
  get canEditClients(): boolean {
    return this.auth.hasRole(UserRoleEnum.ADMIN);
  }

  /**
   * Carga los cobradores activos para asignarlos al cliente.
   */
  private loadCollectors(): void {
    this.collectorsLoading = true;
    this.usersService.listCollectors().subscribe({
      next: (collectors) => {
        this.collectorOptions = collectors.map((c) => ({
          label: c.fullName,
          value: c.id,
        }));
        this.collectorsLoading = false;
      },
      error: () => {
        this.collectorsLoading = false;
      },
    });
  }

  /**
   * Carga la lista de clientes activos desde el servicio de clientes, transformando los datos recibidos al formato utilizado en la interfaz y manejando el estado de carga para mostrar indicadores visuales mientras se obtienen los datos.
   */
  loadClients(): void {
    this.loading = true;
    this.customersService
      .list({ status: 'ACTIVE', includeSummary: true })
      .subscribe({
        next: (customers) => {
          this.clients = customers.map(toClient);
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        },
      });
  }

  /**
   * Devuelve la lista de clientes filtrada según el término de búsqueda y el filtro de riesgo seleccionado.
   */
  get filteredClients(): Client[] {
    return this.clients.filter((c) => {
      const matchesSearch =
        !this.searchTerm ||
        c.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        c.dni.includes(this.searchTerm);
      const matchesFilter =
        !this.selectedFilter || c.risk === this.selectedFilter;
      return matchesSearch && matchesFilter;
    });
  }

  /**
   *  Determina si un campo del formulario es inválido para mostrar mensajes de error y estilos de validación.
   * @param field
   * @returns
   */
  /**
   * Permite solo dígitos numéricos en campos de teclado.
   * @param event
   */
  isInvalid(field: string): boolean {
    const control = this.form.get(field);
    return !!control && control.invalid && (control.touched || this.submitted);
  }

  /** DNI muestra error inmediatamente al tipear (dirty) para guiar al usuario. */
  isDniInvalid(): boolean {
    const control = this.form.get('dni');
    return (
      !!control &&
      control.invalid &&
      (control.dirty || control.touched || this.submitted)
    );
  }

  /**
   * Determina si un campo del formulario de edición es inválido para mostrar errores.
   * @param field
   */
  isEditInvalid(field: string): boolean {
    const control = this.editForm.get(field);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  /**
   * Genera un mensaje de error para un campo del formulario de edición.
   * @param field
   */
  getEditError(field: string): string {
    const control = this.editForm.get(field);
    if (!control || !control.errors) return '';
    if (control.errors['email']) return 'Ingresá un email válido.';
    if (control.errors['maxlength'])
      return `Máximo ${control.errors['maxlength'].requiredLength} caracteres.`;
    return '';
  }

  /**
   *  Genera un mensaje de error específico para un campo del formulario basado en las reglas de validación que no se cumplen.
   * @param field
   * @returns
   */
  getError(field: string): string {
    const control = this.form.get(field);
    if (!control || !control.errors) return '';
    if (control.errors['required']) return 'Campo obligatorio';
    if (control.errors['minlength'])
      return `Mínimo ${control.errors['minlength'].requiredLength} caracteres`;
    if (control.errors['pattern']) {
      if (field === 'dni') return 'El DNI debe contener entre 7 y 8 dígitos.';
      return 'Solo se permiten letras y espacios.';
    }
    return '';
  }

  /**
   *  Asigna una severidad a cada nivel de riesgo para su representación visual en la interfaz.
   * @param risk
   * @returns
   */
  getRiskSeverity(
    risk: string,
  ): 'success' | 'warning' | 'danger' | 'secondary' {
    switch (risk) {
      case 'Al dia':
        return 'success';
      case 'Mora leve':
        return 'warning';
      case 'Mora alta':
        return 'danger';
      default:
        return 'secondary';
    }
  }

  /**
   *  Devuelve una etiqueta legible para el nivel de riesgo del cliente, formateando el texto para mejorar su presentación en la interfaz.
   * @param risk
   * @returns
   */
  getRiskLabel(risk: string): string {
    return risk === 'Al dia' ? 'Al día' : risk;
  }

  /**
   * Navega a la vista de detalle del cliente seleccionado utilizando su ID como identificador en la URL.
   * @param client
   */
  openView(client: Client): void {
    const base = this.router.url.split(`/${AppRoutes.CLIENTS}`)[0];
    this.router.navigate([base, AppRoutes.CLIENTS, client.id]);
  }

  /**
   *  Abre el modal de edición solo para administradores, limitando los campos a los que hoy persiste el backend desde este flujo.
   * @param client
   */
  openEdit(client: Client): void {
    if (!this.canEditClients) return;
    this.selectedClient = client;
    this.editForm = this.buildEditForm(client);
    this.editError = '';
    this.showEditModal = true;
  }

  /**
   * Navega a la vista de créditos del cliente seleccionado utilizando su ID como identificador en la URL.
   * @param client
   */
  openCredits(client: Client): void {
    const base = this.router.url.split(`/${AppRoutes.CLIENTS}`)[0];
    this.router.navigate([base, AppRoutes.CLIENTS, client.id]);
  }

  /**
   * Guarda los cambios del formulario de edición llamando a la API.
   * En caso de éxito cierra el modal y recarga la lista. En caso de error
   * muestra un mensaje sin cerrar el modal.
   */
  saveEdit(): void {
    if (!this.canEditClients) {
      this.editError = 'No tenés permisos para editar clientes';
      return;
    }
    if (this.editForm.invalid || !this.selectedClient) return;
    this.editError = '';
    const { nombre, apellido, phone, email, direccion, assignedCollectorId } =
      this.editForm.value;
    const id = this.selectedClient.id;
    const payload = {
      fullName: `${nombre} ${apellido}`.trim(),
      phone: (phone as string) || undefined,
      email: (email as string) || undefined,
      address: (direccion as string) || undefined,
      assignedCollectorId: (assignedCollectorId as string) || undefined,
    };
    this.customersService.update(id, payload).subscribe({
      next: () => {
        this.handleEditSuccess();
        this.showEditModal = false;
        this.selectedClient = null;
        this.loadClients();
      },
      error: (err: { status?: number }) => {
        if (err?.status === 403) {
          this.editError = 'No tenés permisos para editar clientes';
        } else {
          this.editError =
            'Ocurrió un error al guardar los cambios. Intentá de nuevo.';
        }
      },
    });
  }

  /**
   * Muestra feedback visible cuando la edición del cliente se guardó correctamente.
   */
  private handleEditSuccess(): void {
    this.messageService.add({
      severity: 'success',
      summary: 'Éxito',
      detail: 'Modificación Exitosa.',
      life: 4500,
    });
  }

  /**
   *  Cancela la creación de un nuevo cliente, cerrando el modal de creación y restableciendo el formulario a su estado inicial.
   */
  cancelCreate(): void {
    this.showCreateModal = false;
    this.submitted = false;
    this.form = this.buildForm();
  }

  /**
   *  Crea un nuevo cliente utilizando los datos ingresados en el formulario de creación.
   * @returns
   */
  createClient(): void {
    this.submitted = true;
    if (this.form.invalid || this.creatingClient) return;

    this.creatingClient = true;

    const {
      nombres,
      apellidos,
      dni,
      telefonoPrincipal,
      email,
      direccion,
      assignedCollectorId,
    } = this.form.value;
    const cleanPhone = String(telefonoPrincipal).replace(/[^0-9]/g, '');

    this.customersService
      .create({
        fullName: `${nombres} ${apellidos}`.trim(),
        dni: String(dni),
        phone: cleanPhone || undefined,
        email: email || undefined,
        address: direccion || undefined,
        assignedCollectorId: assignedCollectorId || undefined,
      })
      .subscribe({
        next: () => {
          this.handleCreateSuccess();
        },
        error: (err) => {
          this.handleCreateError(err);
        },
      });
  }

  /**
   * Aplica el flujo de post-alta cuando la API confirma la creación del cliente.
   * Primero dispara feedback visible de éxito y luego refresca la grilla.
   */
  private handleCreateSuccess(): void {
    this.messageService.add({
      severity: 'success',
      summary: 'Éxito',
      detail: 'Cliente guardado correctamente.',
      life: 4500,
    });
    this.showCreateModal = false;
    this.submitted = false;
    this.creatingClient = false;
    this.form = this.buildForm();
    this.loadClients();
  }

  /**
   * Resuelve errores de alta mostrando feedback visible y liberando el estado de carga.
   * @param err Error devuelto por la API.
   */
  private handleCreateError(err: { status?: number; message?: string }): void {
    this.creatingClient = false;
    const detail =
      err?.status === 409
        ? 'Ya existe un cliente con ese DNI.'
        : err?.message || 'No se pudo guardar el cliente. Intentá nuevamente.';
    this.messageService.add({
      severity: 'error',
      summary: 'No se pudo crear el cliente',
      detail,
      life: 5000,
    });
    console.error('Error al crear cliente', err);
  }

  /**
   * Construye el formulario de edición de cliente incluyendo todos los campos editables.
   * @param client
   */
  private buildEditForm(client: Client | null): FormGroup {
    const parts = client?.name.split(' ') ?? ['', ''];
    const nombre = parts[0] ?? '';
    const apellido = parts.slice(1).join(' ') || '';
    return this.fb.group({
      nombre: [
        nombre,
        [
          Validators.required,
          Validators.minLength(2),
          Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s'-]+$/),
        ],
      ],
      apellido: [
        apellido,
        [
          Validators.required,
          Validators.minLength(2),
          Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s'-]+$/),
        ],
      ],
      phone: [client?.phone ?? '', [Validators.pattern(/^[\d\s\+\-]*$/)]],
      email: [client?.email ?? '', [Validators.email]],
      direccion: [client?.address ?? '', [Validators.maxLength(255)]],
      assignedCollectorId: [client?.collectorId ?? ''],
    });
  }

  /**
   * Construye el formulario de creación de cliente con validaciones de formato estrictas.
   */
  private buildForm(): FormGroup {
    const form = this.fb.group({
      nombres: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s'-]+$/),
        ],
      ],
      apellidos: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s'-]+$/),
        ],
      ],
      dni: ['', [Validators.required, Validators.pattern(/^\d{7,8}$/)]],
      telefonoPrincipal: [
        '',
        [Validators.required, Validators.pattern(/^[\d\s\+\-]+$/)],
      ],
      telefonoAlterno: ['', [Validators.pattern(/^[\d\s\+\-]*$/)]],
      email: ['', [Validators.email]],
      direccion: ['', [Validators.required]],
      assignedCollectorId: [''],
    });
    return form;
  }
}
