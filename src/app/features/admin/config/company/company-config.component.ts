import { Component, inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';

@Component({
  selector: 'app-company-config',
  standalone: true,
  imports: [FormsModule, InputTextModule, InputNumberModule, DropdownModule, ButtonModule],
  templateUrl: './company-config.component.html',
})
export class CompanyConfigComponent {
  private readonly msg = inject(MessageService);
  /** El backend aún no tiene endpoint para datos/tasas de empresa: el guardado queda bloqueado. */
  readonly persistenceAvailable = false;

  systemName = 'Sistema de Créditos';
  contactEmail = 'admin@creditos.com';
  phone = '+54 381 4123456';
  address = 'Calle Principal 123';

  saleRate = '2%';
  loanRate = '2.5%';
  moraRate = '0.1%';
  sellerCommission = '5%';
  gracePeriod = 30;

  rateOptions = ['0.5%', '1%', '1.5%', '2%', '2.5%', '3%', '3.5%', '4%', '4.5%', '5%'];
  moraOptions = ['0.05%', '0.1%', '0.15%', '0.2%', '0.25%', '0.3%'];
  commissionOptions = ['1%', '2%', '3%', '4%', '5%', '6%', '7%', '8%', '9%', '10%'];

  /**
   * Bloquea el guardado y avisa: no hay endpoint de backend para esta configuración,
   * así que nunca se descartan cambios en silencio.
   */
  save(): void {
    if (!this.persistenceAvailable) {
      this.msg.add({
        severity: 'warn',
        summary: 'Cambios no guardados',
        detail: 'La configuración de empresa todavía no se puede guardar en el servidor.',
        life: 5000,
      });
    }
  }
}
