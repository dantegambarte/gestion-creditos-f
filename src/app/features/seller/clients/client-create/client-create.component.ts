import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { AppError } from '../../../../core/models/app-error';
import { HeaderService } from '../../../../core/services/header.service';
import { UsersService } from '../../../../features/admin/users/users.service';
import { CustomersService } from '../customers.service';
import { AppRoutes } from '../../../../shared/models/enums/routes.enum';

@Component({
  selector: 'app-client-create',
  standalone: true,
  providers: [MessageService],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    DropdownModule,
    ToastModule,
  ],
  templateUrl: './client-create.component.html',
})
export class ClientCreateComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly customersService = inject(CustomersService);
  private readonly usersService = inject(UsersService);
  private readonly router = inject(Router);
  private readonly header = inject(HeaderService);
  private readonly messageService = inject(MessageService);

  form!: FormGroup;
  submitting = false;
  collectorOptions: { label: string; value: string }[] = [];
  collectorsLoading = false;
  collectorsLoadFailed = false;

  ngOnInit(): void {
    this.header.set([
      { label: 'Clientes', route: '/seller/clients' },
      { label: 'Nuevo cliente' },
    ]);

    this.form = this.fb.group({
      fullName: [
        '',
        [
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(150),
          Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s'-]+$/),
        ],
      ],
      dni: ['', [Validators.required, Validators.pattern(/^\d{7,8}$/)]],
      address: ['', [Validators.maxLength(255)]],
      phone: [''],
      email: ['', [Validators.email]],
      assignedCollectorId: [
        {
          value: '',
          disabled: this.collectorsLoading || this.collectorOptions.length === 0,
        },
      ],
    });

    this.loadCollectors();
  }

  /**
   * Carga la lista de cobradores para asignar al cliente. Si falla, muestra un error genérico y permite reintentar cargando nuevamente al hacer click en el dropdown.
   */
  private loadCollectors(): void {
    this.collectorsLoading = true;
    this.collectorsLoadFailed = false;
    this.syncCollectorControlState();
    this.usersService.listCollectors().subscribe({
      next: (collectors) => {
        this.collectorOptions = collectors.map((c) => ({
          label: c.fullName,
          value: c.id,
        }));
        this.collectorsLoadFailed = false;
        this.collectorsLoading = false;
        this.syncCollectorControlState();
      },
      error: () => {
        this.collectorOptions = [];
        this.collectorsLoadFailed = true;
        this.collectorsLoading = false;
        this.syncCollectorControlState();
      },
    });
  }

  /**
   * Sincroniza el estado habilitado del selector de cobrador según la carga y disponibilidad.
   */
  private syncCollectorControlState(): void {
    const control = this.form.get('assignedCollectorId');

    if (!control) {
      return;
    }

    if (this.collectorsLoading || this.collectorOptions.length === 0) {
      control.disable({ emitEvent: false });
      return;
    }

    control.enable({ emitEvent: false });
  }

  /**
   * Verifica si un campo del formulario es inválido.
   * @param field
   * @returns
   */
  isInvalid(field: string): boolean {
    const camp = this.form.get(field);
    return !!(camp && camp.invalid && (camp.dirty || camp.touched));
  }

  /**
   * Obtiene el mensaje de error para un campo del formulario.
   * @param field
   * @returns
   */
  getError(field: string): string {
    const camp = this.form.get(field);
    if (!camp?.errors) return '';
    if (camp.errors['serverError']) return camp.errors['serverError'];
    if (camp.errors['required']) return 'Este campo es requerido.';
    if (camp.errors['minlength'])
      return `Mínimo ${camp.errors['minlength'].requiredLength} caracteres.`;
    if (camp.errors['maxlength'])
      return `Máximo ${camp.errors['maxlength'].requiredLength} caracteres.`;
    if (camp.errors['email']) return 'Formato de email inválido.';
    if (camp.errors['pattern']) {
      if (field === 'dni') return 'El DNI debe contener entre 7 y 8 dígitos.';
      return 'Solo se permiten letras y espacios.';
    }
    return 'Campo inválido.';
  }

  /**
   * Envía el formulario para crear un nuevo cliente. Si el backend responde con un error de validación (409 o 404), asigna el mensaje de error al campo correspondiente. Para otros errores, muestra un mensaje genérico.
   * @returns
   */
  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting = true;
    const raw = this.form.getRawValue();

    this.customersService
      .create({
        fullName: raw.fullName,
        dni: raw.dni,
        address: raw.address || undefined,
        phone: raw.phone || undefined,
        email: raw.email || undefined,
        assignedCollectorId: raw.assignedCollectorId || undefined,
      })
      .subscribe({
        next: (customer) => {
          this.submitting = false;
          this.messageService.add({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Cliente registrado correctamente.',
          });
          setTimeout(
            () =>
              this.router.navigate(['/seller', AppRoutes.CLIENTS, customer.id]),
            2000,
          );
        },
        error: (err: AppError) => {
          this.submitting = false;
          if (err.status === 409) {
            this.form.get('dni')!.setErrors({ serverError: err.message });
            this.form.get('dni')!.markAsDirty();
          } else if (err.status === 404) {
            this.form
              .get('assignedCollectorId')!
              .setErrors({ serverError: err.message });
            this.form.get('assignedCollectorId')!.markAsDirty();
          } else {
            this.messageService.add({
              severity: 'error',
              summary: 'Error',
              detail: err.message || 'Error al registrar el cliente.',
            });
          }
        },
      });
  }

  /**
   * Navega de vuelta a la lista de clientes sin guardar los cambios.
   */
  cancel(): void {
    this.router.navigate(['/seller', AppRoutes.CLIENTS]);
  }
}
