import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { AppError } from '../../../../core/models/app-error';
import { ProductUnitsService } from '../product-units.service';

@Component({
  selector: 'app-unit-bulk-form',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonModule, InputTextareaModule],
  templateUrl: './unit-bulk-form.component.html',
})
export class UnitBulkFormComponent {
  /** ID de la variante a la que pertenecen las unidades a crear en lote. */
  @Input() variantId!: string;
  /** Emite cuando se crean unidades con éxito para que el padre recargue la lista. */
  @Output() unitsSaved = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly unitsService = inject(ProductUnitsService);
  private readonly messageService = inject(MessageService);

  form: FormGroup = this.fb.group({ rawCodes: ['', Validators.required] });
  preview: string[] = [];
  submitting = false;
  errorMessage: string | null = null;

  /** Actualiza el preview de códigos parseando el textarea línea por línea. */
  onCodesChange(): void {
    const raw: string = this.form.get('rawCodes')?.value ?? '';
    this.preview = raw
      .split('\n')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
  }

  /** Envía los códigos del preview como un lote de unidades nuevas. */
  save(): void {
    if (this.preview.length === 0) return;
    this.submitting = true;
    this.errorMessage = null;
    this.unitsService
      .createBulk({
        variantId: this.variantId,
        units: this.preview.map((code) => ({ unitCode: code })),
      })
      .subscribe({
        next: (result) => {
          this.submitting = false;
          this.form.reset({ rawCodes: '' });
          this.preview = [];
          this.messageService.add({
            severity: 'success',
            summary: `${result.created} unidades creadas`,
          });
          this.unitsSaved.emit();
        },
        error: (err: AppError) => {
          this.submitting = false;
          this.errorMessage = err.message;
        },
      });
  }
}
