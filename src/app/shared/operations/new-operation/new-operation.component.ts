import { Component, EventEmitter, OnInit, Output, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MenuItem, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { OperationFormService } from './operation-form.service';
import { StepClientComponent } from './steps/step-client/step-client.component';
import { StepConditionsComponent } from './steps/step-conditions/step-conditions.component';
import { StepConfirmComponent } from './steps/step-confirm/step-confirm.component';
import { StepProductsComponent } from './steps/step-products/step-products.component';

@Component({
  selector: 'app-new-operation',
  standalone: true,
  imports: [
    RouterLink,
    ButtonModule,
    ToastModule,
    StepClientComponent,
    StepProductsComponent,
    StepConditionsComponent,
    StepConfirmComponent,
  ],
  providers: [OperationFormService, MessageService],
  templateUrl: './new-operation.component.html',
  styleUrl: './new-operation.component.scss',
})
export class NewOperationComponent implements OnInit {
  @Output() onComplete = new EventEmitter<void>();

  protected readonly state = inject(OperationFormService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);

  activeIndex = 0;
  readonly steps: MenuItem[] = [
    { label: 'Cliente' },
    { label: 'Tipo y Producto' },
    { label: 'Condiciones' },
    { label: 'Confirmación' },
  ];

  ngOnInit(): void {
    const clientDni =
      this.route.snapshot.queryParamMap.get('clientDni') ?? undefined;
    this.state.initialize(clientDni).subscribe((preselected) => {
      if (preselected) this.activeIndex = 1;
    });
  }

  nextStep(): void {
    if (this.activeIndex < 3) this.activeIndex++;
  }
  prevStep(): void {
    if (this.activeIndex > 0) this.activeIndex--;
  }

  /**
   * Envía la operación para aprobación y maneja navegación posterior al resultado.
   */
  submitOperation(): void {
    this.state.submit().subscribe({
      next: () => {
        this.state.submitting = false;
        this.messageService.add({
          severity: 'success',
          summary: 'Operación enviada',
          detail: 'La operación fue enviada para aprobación correctamente.',
          life: 3000,
        });
        this.onComplete.emit();
        const base = this.router.url.split('/operations')[0];
        setTimeout(() => this.router.navigate([base, 'operations']), 1500);
      },
      error: (err: unknown) => {
        this.state.submitting = false;
        const detail =
          typeof err === 'object' &&
          err !== null &&
          'message' in err &&
          typeof (err as { message?: unknown }).message === 'string'
            ? (err as { message: string }).message
            : 'No se pudo registrar la operación.';
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail,
          life: 5000,
        });
      },
    });
  }
}
