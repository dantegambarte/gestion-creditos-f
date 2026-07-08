import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { AppError } from '../../../../../core/models/app-error';
import { UsersService } from '../../../../admin/users/users.service';
import {
  CustomerDetail,
  CustomerUpdatePayload,
} from '../../../models/customer.model';
import { CustomersService } from '../../customers.service';

@Component({
  selector: 'app-client-edit-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    DropdownModule,
    InputTextModule,
    TooltipModule,
  ],
  templateUrl: './client-edit-form.component.html',
})
export class ClientEditFormComponent implements OnInit {
  @Input() customer!: CustomerDetail;
  /** Emite el cliente actualizado para que el padre sincronice su estado. */
  @Output() updated = new EventEmitter<CustomerDetail>();
  /** Emite cuando el usuario cancela sin guardar. */
  @Output() cancelled = new EventEmitter<void>();

  editForm!: FormGroup;
  saving = false;
  collectorOptions: { label: string; value: string }[] = [];
  collectorsLoading = false;

  private readonly customersService = inject(CustomersService);
  private readonly usersService = inject(UsersService);
  private readonly msg = inject(MessageService);
  private readonly fb = inject(FormBuilder);

  ngOnInit(): void {
    this.buildForm();
    this.loadCollectors();
  }

  /** Verifica si un campo del formulario tiene errores visibles. */
  isInvalid(field: string): boolean {
    const c = this.editForm.get(field);
    return !!(c && c.invalid && (c.dirty || c.touched));
  }

  /** True si el DNI del formulario difiere del actual del cliente. */
  get dniChanged(): boolean {
    const c = this.editForm?.get('dni');
    return !!c && c.value !== this.customer.dni;
  }

  /**
   * True si hay que avisar que el cambio de DNI afecta el acceso al portal:
   * el cliente tiene portal habilitado y el DNI se está modificando.
   */
  get showPortalDniWarning(): boolean {
    return this.customer.portalEnabled && this.dniChanged;
  }

  /**
   * Devuelve el mensaje de error para un campo del formulario.
   * @param field Nombre del control.
   */
  getError(field: string): string {
    const c = this.editForm.get(field);
    if (!c?.errors) return '';
    if (c.errors['serverError']) return c.errors['serverError'];
    if (c.errors['required']) return 'Este campo es requerido.';
    if (c.errors['minlength'])
      return `Mínimo ${c.errors['minlength'].requiredLength} caracteres.`;
    if (c.errors['maxlength'])
      return `Máximo ${c.errors['maxlength'].requiredLength} caracteres.`;
    if (c.errors['email']) return 'Formato de email inválido.';
    if (c.errors['pattern']) return 'El DNI solo puede contener números.';
    return 'Campo inválido.';
  }

  /**
   * Envía el formulario y emite el cliente actualizado al padre.
   */
  onSubmit(): void {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    this.saving = true;
    const raw = this.editForm.getRawValue();
    const payload: CustomerUpdatePayload = {
      fullName: raw.fullName,
      address: raw.address || undefined,
      phone: raw.phone || undefined,
      email: raw.email || undefined,
      assignedCollectorId: raw.assignedCollectorId || undefined,
      // Solo se envía el DNI si cambió (evita writes y validaciones innecesarias).
      ...(raw.dni !== this.customer.dni ? { dni: raw.dni } : {}),
    };

    this.customersService.update(this.customer.id, payload).subscribe({
      next: (result) => {
        this.saving = false;
        this.msg.add({
          severity: 'success',
          summary: 'Éxito',
          detail: 'Cliente actualizado correctamente.',
        });
        this.updated.emit(result);
      },
      error: (err: AppError) => {
        this.saving = false;
        if (err.status === 404) {
          this.editForm
            .get('assignedCollectorId')!
            .setErrors({ serverError: err.message });
          this.editForm.get('assignedCollectorId')!.markAsDirty();
        } else if (err.status === 409) {
          // En el update, el 409 es DNI duplicado: lo marcamos en el campo.
          this.editForm.get('dni')!.setErrors({ serverError: err.message });
          this.editForm.get('dni')!.markAsDirty();
          this.msg.add({
            severity: 'warn',
            summary: 'Conflicto',
            detail: err.message,
          });
        } else {
          this.msg.add({
            severity: 'error',
            summary: 'Error',
            detail: err.message,
          });
        }
      },
    });
  }

  private buildForm(): void {
    this.editForm = this.fb.group({
      fullName: [
        this.customer.fullName,
        [
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(150),
        ],
      ],
      // DNI editable solo por Admin (esta pantalla ya es admin). Mismas reglas
      // que el alta: 7-9 dígitos numéricos.
      dni: [
        this.customer.dni,
        [
          Validators.required,
          Validators.minLength(7),
          Validators.maxLength(9),
          Validators.pattern(/^[0-9]+$/),
        ],
      ],
      address: [this.customer.address ?? '', [Validators.maxLength(255)]],
      phone: [this.customer.phone ?? ''],
      email: [this.customer.email ?? '', [Validators.email]],
      assignedCollectorId: [
        { value: this.customer.collectorId ?? '', disabled: this.collectorsLoading },
      ],
    });
  }

  private loadCollectors(): void {
    this.collectorsLoading = true;
    this.syncCollectorControlState();
    this.usersService.listCollectors().subscribe({
      next: (collectors) => {
        this.collectorOptions = collectors.map((c) => ({
          label: c.fullName,
          value: c.id,
        }));
        this.collectorsLoading = false;
        this.syncCollectorControlState();
      },
      error: () => {
        this.collectorsLoading = false;
        this.syncCollectorControlState();
      },
    });
  }

  /**
   * Sincroniza el estado habilitado del selector de cobrador con la carga de opciones.
   */
  private syncCollectorControlState(): void {
    const control = this.editForm.get('assignedCollectorId');

    if (!control) {
      return;
    }

    if (this.collectorsLoading) {
      control.disable({ emitEvent: false });
      return;
    }

    control.enable({ emitEvent: false });
  }
}
