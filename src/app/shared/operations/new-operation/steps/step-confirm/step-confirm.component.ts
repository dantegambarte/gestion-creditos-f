import { Component, Input } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageModule } from 'primeng/message';
import { CurrencyArsPipe } from '../../../../../core/pipes/currency-ars.pipe';
import { ClientOperation } from '../../../../models/interface/client';
import { CartLine } from '../../operation-form.service';

@Component({
  selector: 'app-step-confirm',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CheckboxModule,
    MessageModule,
    CurrencyArsPipe,
  ],
  templateUrl: './step-confirm.component.html',
})
export class StepConfirmComponent {
  @Input() form!: FormGroup;
  @Input() selectedClient: ClientOperation | null = null;
  @Input() cartLines: CartLine[] = [];
  @Input() capitalAFinanciar = 0;
  @Input() valorCuota = 0;
  @Input() totalADevolver = 0;
  @Input() validatedDownPayment = 0;
  @Input() installmentsCount: number | null = null;
}
