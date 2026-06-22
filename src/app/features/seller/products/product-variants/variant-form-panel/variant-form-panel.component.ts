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
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { AppError } from '../../../../../core/models/app-error';
import { CurrencyAmountInputDirective } from '../../../../../shared/directives/currency-amount-input.directive';
import { ProductVariant } from '../../../models/product-variant.model';
import { ProductVariantsService } from '../../product-variants.service';
import { BulkVariantEntryComponent } from '../bulk-variant-entry/bulk-variant-entry.component';

@Component({
  selector: 'app-variant-form-panel',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    CurrencyAmountInputDirective,
    BulkVariantEntryComponent,
  ],
  templateUrl: './variant-form-panel.component.html',
})
export class VariantFormPanelComponent implements OnChanges {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  /** null = modo alta, no-null = modo edición */
  @Input() variant: ProductVariant | null = null;
  @Input() productId!: string;
  /**
   * Emite cuando se crea o actualiza una variante para que el padre recargue la lista.
   */
  @Output() variantSaved = new EventEmitter<void>();
  /**
   * Emite el modo de ingreso actual (true = bulk) para que el padre ajuste
   * los anchos de columna de la grilla.
   */
  @Output() bulkModeChange = new EventEmitter<boolean>();

  private readonly fb = inject(FormBuilder);
  private readonly variantsService = inject(ProductVariantsService);
  private readonly messageService = inject(MessageService);

  form!: FormGroup;
  entryMode: 'individual' | 'bulk' = 'individual';
  submitting = false;
  errorMessage: string | null = null;

  get isEditMode(): boolean {
    return this.variant !== null;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue === true) {
      this.entryMode = 'individual';
      this.errorMessage = null;
      this.buildForm();
      if (this.variant) {
        this.form.patchValue({
          color: this.variant.color ?? '',
          size: this.variant.size ?? '',
          capacity: this.variant.capacity ?? '',
          currentPrice: this.variant.currentPrice,
          initialUnits: 0,
        });
      }
    }
  }

  /**
   * Cambia entre ingreso individual y múltiple, limpia errores y notifica al padre.
   * @param mode - Modo seleccionado por el usuario.
   */
  setEntryMode(mode: 'individual' | 'bulk'): void {
    this.entryMode = mode;
    this.errorMessage = null;
    this.bulkModeChange.emit(mode === 'bulk');
  }

  /**
   * Indica si un campo del formulario individual tiene errores visibles.
   * @param field - Nombre del control del FormGroup.
   */
  isInvalid(field: string): boolean {
    const c = this.form?.get(field);
    return !!(c && c.invalid && (c.dirty || c.touched));
  }

  /** Cierra el panel lateral y notifica al padre. */
  close(): void {
    this.visible = false;
    this.visibleChange.emit(false);
    this.bulkModeChange.emit(false);
  }

  /**
   * Valida y envía el formulario individual en modo alta o edición.
   * Mantiene el panel abierto tras el éxito para permitir nuevas entradas.
   */
  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.submitting = true;
    this.errorMessage = null;

    if (this.variant) {
      this.variantsService
        .update(this.variant.id, {
          color: v.color || undefined,
          size: v.size || undefined,
          capacity: v.capacity || undefined,
          currentPrice: v.currentPrice,
        })
        .subscribe({
          next: () => {
            this.submitting = false;
            this.messageService.add({
              severity: 'success',
              summary: 'Variante actualizada',
            });
            this.variantSaved.emit();
            this.buildForm();
            this.errorMessage = null;
          },
          error: (err: AppError) => {
            this.submitting = false;
            this.errorMessage = err.message;
          },
        });
    } else {
      this.variantsService
        .create({
          productId: this.productId,
          color: v.color || undefined,
          size: v.size || undefined,
          capacity: v.capacity || undefined,
          currentPrice: v.currentPrice,
          initialUnits: v.initialUnits ?? 1,
        })
        .subscribe({
          next: () => {
            this.submitting = false;
            this.messageService.add({
              severity: 'success',
              summary: 'Variante creada',
            });
            this.variantSaved.emit();
            this.buildForm();
            this.errorMessage = null;
          },
          error: (err: AppError) => {
            this.submitting = false;
            this.errorMessage = err.message;
            if (err.status === 409) {
              this.messageService.add({
                severity: 'warn',
                summary: 'Variante duplicada',
                detail: err.message,
                life: 5000,
              });
            }
          },
        });
    }
  }

  /** Construye el formulario reactivo de alta/edición de variante individual. */
  private buildForm(): void {
    this.form = this.fb.group({
      color: [''],
      size: [''],
      capacity: [''],
      currentPrice: [null, [Validators.required, Validators.min(0.01)]],
      initialUnits: [1, [Validators.required, Validators.min(0)]],
    });
  }
}
