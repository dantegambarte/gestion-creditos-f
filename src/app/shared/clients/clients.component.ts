import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';

import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

import { CustomersService } from '../../features/seller/clients/customers.service';
import { Customer } from '../../features/seller/models/customer.model';
import { MockAuthService } from '../../core/auth/mock-auth.service';
import { UserRoleEnum } from '../../core/models/types/user-role';
import { FormatService } from '../../core/services/format.service';
import { Client } from '../models/interface/client';
import { AppRoutes } from '../models/enums/routes.enum';

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
    credits: 0,
    risk: 'Al dia',
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
export class ClientsComponent implements OnInit {
  private readonly customersService = inject(CustomersService);
  private readonly auth = inject(MockAuthService);
  private readonly messageService = inject(MessageService);

  clients: Client[] = [];
  loading = false;

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
    private fmt: FormatService,
  ) {
    this.form = this.buildForm();
    this.editForm = this.buildEditForm(null);
  }

  ngOnInit(): void {
    this.loadClients();
  }

  /**
   * Indica si el usuario actual puede editar clientes según el permiso real del backend.
   * Se usa para no ofrecer una acción que el endpoint rechaza con 403.
   */
  get canEditClients(): boolean {
    return this.auth.hasRole(UserRoleEnum.ADMIN);
  }

  /**
   * Carga la lista de clientes activos desde el servicio de clientes, transformando los datos recibidos al formato utilizado en la interfaz y manejando el estado de carga para mostrar indicadores visuales mientras se obtienen los datos.
   */
  loadClients(): void {
    this.loading = true;
    this.customersService.list({ status: 'ACTIVE' }).subscribe({
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
   * Calcula la capacidad de pago estimada del cliente basada en sus ingresos declarados.
   * Se asume que el cliente puede destinar hasta el 50% de sus ingresos mensuales al pago de créditos.
   * El valor se formatea como moneda local (ARS) para su presentación en la interfaz.
   */
  get abilityToPay(): string {
    const raw = (this.form.get('ingresos')?.value ?? '').replace(/[^0-9]/g, '');
    const num = parseInt(raw, 10);
    if (!num) return '';
    return `${this.fmt.currency(Math.round(num * 0.5))} / mes`;
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
  isInvalid(field: string): boolean {
    const control = this.form.get(field);
    return !!control && control.invalid && (control.touched || this.submitted);
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
    if (control.errors['pattern']) return 'Formato inválido';
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
    const { nombre, apellido, phone } = this.editForm.value;
    const id = this.selectedClient.id;
    const payload = {
      fullName: `${nombre} ${apellido}`.trim(),
      phone: phone as string,
    };
    this.customersService.update(id, payload).subscribe({
      next: () => {
        this.showEditModal = false;
        this.selectedClient = null;
        this.loadClients();
      },
      error: (err: { status?: number }) => {
        if (err?.status === 403) {
          this.editError = 'No tenés permisos para editar clientes';
        } else {
          this.editError = 'Ocurrió un error al guardar los cambios. Intentá de nuevo.';
        }
      },
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

    const { nombres, apellidos, dni, telefonoPrincipal, email, direccion } =
      this.form.value;
    const cleanDni = String(dni).replace(/[^0-9]/g, '');
    const cleanPhone = String(telefonoPrincipal).replace(/[^0-9]/g, '');

    this.customersService
      .create({
        fullName: `${nombres} ${apellidos}`.trim(),
        dni: cleanDni,
        phone: cleanPhone || undefined,
        email: email || undefined,
        address: direccion || undefined,
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
   *  Construye un formulario de edición alineado con los campos que hoy persisten y se reflejan al recargar.
   * @param client
   * @returns
   */
  private buildEditForm(client: Client | null): FormGroup {
    const parts = client?.name.split(' ') ?? ['', ''];
    const nombre = parts[0] ?? '';
    const apellido = parts.slice(1).join(' ') || '';
    return this.fb.group({
      nombre: [nombre, [Validators.required, Validators.minLength(2)]],
      apellido: [apellido, [Validators.required, Validators.minLength(2)]],
      phone: [
        client?.phone ?? '',
        [Validators.required, Validators.pattern(/^[\d\s\+\-]+$/)],
      ],
    });
  }

  /**
   *  Construye un formulario de creación para un nuevo cliente, con campos vacíos y reglas de validación definidas para cada campo.
   * @returns
   */
  private buildForm(): FormGroup {
    return this.fb.group({
      nombres: ['', [Validators.required, Validators.minLength(2)]],
      apellidos: ['', [Validators.required, Validators.minLength(2)]],
      dni: ['', [Validators.required, Validators.pattern(/^[\d.\-]+$/)]],
      telefonoPrincipal: [
        '',
        [Validators.required, Validators.pattern(/^[\d\s\+\-]+$/)],
      ],
      telefonoAlterno: ['', [Validators.pattern(/^[\d\s\+\-]*$/)]],
      email: ['', [Validators.email]],
      direccion: ['', [Validators.required]],
      ingresos: ['', [Validators.required, Validators.pattern(/^[\$\d\.,]+$/)]],
    });
  }
}
