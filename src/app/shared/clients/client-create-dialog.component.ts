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
import { CustomersService } from '../../features/seller/clients/customers.service';

@Component({
  selector: 'app-client-create-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    DropdownModule,
    InputTextModule,
  ],
  templateUrl: './client-create-dialog.component.html',
})
export class ClientCreateDialogComponent implements OnChanges {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  /** Opciones de cobrador para el select. */
  @Input() collectorOptions: { label: string; value: string }[] = [];
  @Input() collectorsLoading = false;
  /** Emite tras crear el cliente con éxito. El padre recarga la lista. */
  @Output() created = new EventEmitter<void>();

  form: FormGroup;
  submitted = false;
  creatingClient = false;

  private readonly customersService = inject(CustomersService);
  private readonly msg = inject(MessageService);
  private readonly fb = inject(FormBuilder);

  constructor() {
    this.form = this.buildForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true) {
      this.submitted = false;
      this.creatingClient = false;
      this.form = this.buildForm();
    }
  }

  isInvalid(field: string): boolean {
    const control = this.form.get(field);
    return !!control && control.invalid && (control.touched || this.submitted);
  }

  isDniInvalid(): boolean {
    const control = this.form.get('dni');
    return (
      !!control &&
      control.invalid &&
      (control.dirty || control.touched || this.submitted)
    );
  }

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
   * Cancela la creación cerrando el dialog y reseteando el formulario.
   */
  cancelCreate(): void {
    this.visibleChange.emit(false);
    this.submitted = false;
    this.form = this.buildForm();
  }

  /**
   * Crea el cliente con los datos del formulario.
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
          this.msg.add({
            severity: 'success',
            summary: 'Éxito',
            detail: 'Cliente guardado correctamente.',
            life: 4500,
          });
          this.visibleChange.emit(false);
          this.submitted = false;
          this.creatingClient = false;
          this.form = this.buildForm();
          this.created.emit();
        },
        error: (err: { status?: number; message?: string }) => {
          this.creatingClient = false;
          const detail =
            err?.status === 409
              ? 'Ya existe un cliente con ese DNI.'
              : err?.message ||
                'No se pudo guardar el cliente. Intentá nuevamente.';
          this.msg.add({
            severity: 'error',
            summary: 'No se pudo crear el cliente',
            detail,
            life: 5000,
          });
        },
      });
  }

  private buildForm(): FormGroup {
    return this.fb.group({
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
  }
}
