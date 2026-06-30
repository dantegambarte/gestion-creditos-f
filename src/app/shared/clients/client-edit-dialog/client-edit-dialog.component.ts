import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
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
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { CustomersService } from '../../../features/seller/clients/customers.service';
import { Client } from '../../models/interface/client';

@Component({
  selector: 'app-client-edit-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    DropdownModule,
    InputTextModule,
  ],
  templateUrl: './client-edit-dialog.component.html',
})
export class ClientEditDialogComponent implements OnChanges {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  /** Cliente a editar. Se usa para pre-poblar el formulario al abrir. */
  @Input() client: Client | null = null;
  /** Opciones de cobrador para el select. */
  @Input() collectorOptions: { label: string; value: string }[] = [];
  @Input() collectorsLoading = false;
  /** Emite tras guardar con éxito. El padre recarga la lista. */
  @Output() saved = new EventEmitter<void>();

  editForm: FormGroup;
  editError = '';

  private readonly customersService = inject(CustomersService);
  private readonly msg = inject(MessageService);
  private readonly fb = inject(FormBuilder);

  constructor() {
    this.editForm = this.buildEditForm(null);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true) {
      this.editError = '';
      this.editForm = this.buildEditForm(this.client);
    }

    if (changes['collectorsLoading']) {
      this.syncCollectorControlState();
    }
  }

  isEditInvalid(field: string): boolean {
    const control = this.editForm.get(field);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  getEditError(field: string): string {
    const control = this.editForm.get(field);
    if (!control || !control.errors) return '';
    if (control.errors['serverError']) return control.errors['serverError'];
    if (control.errors['email']) return 'Ingresá un email válido.';
    if (control.errors['required']) return 'Este campo es requerido.';
    if (control.errors['minlength'])
      return `Mínimo ${control.errors['minlength'].requiredLength} caracteres.`;
    if (control.errors['maxlength'])
      return `Máximo ${control.errors['maxlength'].requiredLength} caracteres.`;
    if (control.errors['pattern']) return 'El DNI solo puede contener números.';
    return '';
  }

  /** True si el DNI del formulario difiere del actual del cliente. */
  get dniChanged(): boolean {
    const c = this.editForm.get('dni');
    return !!c && !!this.client && c.value !== this.client.dni;
  }

  /**
   * Aviso: el cliente tiene portal habilitado y se está cambiando el DNI, que
   * es el usuario de acceso al portal.
   */
  get showPortalDniWarning(): boolean {
    return !!this.client?.portalEnabled && this.dniChanged;
  }

  /**
   * Guarda los cambios del formulario de edición.
   * En éxito cierra el dialog y notifica al padre. En error muestra el mensaje inline.
   */
  saveEdit(): void {
    if (this.editForm.invalid || !this.client) return;
    this.editError = '';
    const {
      nombre,
      apellido,
      dni,
      phone,
      email,
      direccion,
      assignedCollectorId,
    } = this.editForm.value;
    const payload = {
      fullName: `${nombre} ${apellido}`.trim(),
      phone: (phone as string) || undefined,
      email: (email as string) || undefined,
      address: (direccion as string) || undefined,
      assignedCollectorId: (assignedCollectorId as string) || undefined,
      // Solo se envía el DNI si cambió.
      ...(dni !== this.client.dni ? { dni: dni as string } : {}),
    };

    this.customersService.update(this.client.id, payload).subscribe({
      next: () => {
        this.msg.add({
          severity: 'success',
          summary: 'Éxito',
          detail: 'Modificación Exitosa.',
          life: 4500,
        });
        this.visibleChange.emit(false);
        this.saved.emit();
      },
      error: (err: { status?: number; message?: string }) => {
        if (err?.status === 409) {
          // DNI duplicado: marcamos el campo y mostramos el detalle.
          this.editForm
            .get('dni')!
            .setErrors({ serverError: err.message ?? 'DNI duplicado.' });
          this.editForm.get('dni')!.markAsDirty();
          this.editError = err.message ?? 'Ya existe un cliente con ese DNI.';
        } else {
          this.editError =
            err?.status === 403
              ? 'No tenés permisos para editar clientes'
              : 'Ocurrió un error al guardar los cambios. Intentá de nuevo.';
        }
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

  private buildEditForm(client: Client | null): FormGroup {
    const parts = client?.name.split(' ') ?? ['', ''];
    const nombre = parts[0] ?? '';
    const apellido = parts.slice(1).join(' ') || '';
    const form = this.fb.group({
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
      // DNI editable solo por Admin (este modal vive en la lista de clientes,
      // edición admin-only). Mismas reglas que el alta: 7-9 dígitos numéricos.
      dni: [
        client?.dni ?? '',
        [
          Validators.required,
          Validators.minLength(7),
          Validators.maxLength(9),
          Validators.pattern(/^[0-9]+$/),
        ],
      ],
      phone: [client?.phone ?? '', [Validators.pattern(/^[\d\s\+\-]*$/)]],
      email: [client?.email ?? '', [Validators.email]],
      direccion: [client?.address ?? '', [Validators.maxLength(255)]],
      assignedCollectorId: [{ value: client?.collectorId ?? '', disabled: this.collectorsLoading }],
    });

    return form;
  }
}
