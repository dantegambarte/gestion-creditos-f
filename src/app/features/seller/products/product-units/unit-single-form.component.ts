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
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { AppError } from '../../../../core/models/app-error';
import { ProductUnit } from '../../models/product-unit.model';
import { ProductUnitsService } from '../product-units.service';

@Component({
  selector: 'app-unit-single-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    InputTextareaModule,
  ],
  templateUrl: './unit-single-form.component.html',
})
export class UnitSingleFormComponent implements OnChanges {
  /** ID de la variante a la que pertenecen las unidades a crear. */
  @Input() variantId!: string;
  /** null = modo alta; non-null = modo edición. */
  @Input() unit: ProductUnit | null = null;
  /** Emite cuando se guarda con éxito para que el padre recargue la lista. */
  @Output() unitSaved = new EventEmitter<void>();
  /** Emite cuando el usuario cancela la edición en curso. */
  @Output() editCancelled = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly unitsService = inject(ProductUnitsService);
  private readonly messageService = inject(MessageService);

  form!: FormGroup;
  submitting = false;
  errorMessage: string | null = null;

  get isEditMode(): boolean {
    return this.unit !== null;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.form) {
      this.buildForm();
    }
    if (changes['unit']) {
      this.errorMessage = null;
      if (this.unit) {
        this.form.patchValue({
          unitCode: this.unit.unitCode,
          notes: this.unit.notes ?? '',
        });
      } else {
        this.form.reset({ unitCode: '', notes: '' });
      }
    }
  }

  /** Indica si un campo del formulario tiene errores visibles. */
  isInvalid(field: string): boolean {
    const c = this.form?.get(field);
    return !!(c && c.invalid && (c.dirty || c.touched));
  }

  /** Guarda o actualiza la unidad y notifica al padre para recargar. */
  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.submitting = true;
    this.errorMessage = null;

    if (this.unit) {
      this.unitsService
        .update(this.unit.id, {
          unitCode: v.unitCode,
          notes: v.notes || undefined,
        })
        .subscribe({
          next: () => {
            this.submitting = false;
            this.messageService.add({
              severity: 'success',
              summary: 'Unidad actualizada',
            });
            this.unitSaved.emit();
          },
          error: (err: AppError) => {
            this.submitting = false;
            this.errorMessage = err.message;
          },
        });
    } else {
      this.unitsService
        .create({
          variantId: this.variantId,
          unitCode: v.unitCode,
          notes: v.notes || undefined,
        })
        .subscribe({
          next: () => {
            this.submitting = false;
            this.form.reset({ unitCode: '', notes: '' });
            this.messageService.add({
              severity: 'success',
              summary: 'Unidad creada',
            });
            this.unitSaved.emit();
          },
          error: (err: AppError) => {
            this.submitting = false;
            this.errorMessage = err.message;
          },
        });
    }
  }

  /** Construye el formulario reactivo de alta/edición de unidad individual. */
  private buildForm(): void {
    this.form = this.fb.group({
      unitCode: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.maxLength(100),
          Validators.pattern(/^[A-Za-z0-9\-_]+$/),
        ],
      ],
      notes: ['', Validators.maxLength(500)],
    });
  }
}
