import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { finalize } from 'rxjs/operators';
import { HeaderService } from '../../../core/services/header.service';
import { CustomersService } from '../../../features/seller/clients/customers.service';
import { Credit as ApiCredit } from '../../../features/seller/models/credit.model';
import { CustomerDetail as CustomerApiDetail } from '../../../features/seller/models/customer.model';
import { CreditsService } from '../../../features/seller/operations/credits.service';
import { AppRoutes } from '../../models/enums/routes.enum';
import { ClientDetail } from '../../models/interface/client';
import { Credit } from '../../models/interface/credit';
import { ErrorStateComponent } from '../../states/error-state/error-state.component';
import { LoadingStateComponent } from '../../states/loading-state/loading-state.component';
import { ClientContactarComponent } from './tabs/client-contactar/client-contactar.component';
import { ClientCreditsComponent } from './tabs/client-credits/client-credits.component';
import { ClientDocumentsComponent } from './tabs/client-documents/client-documents.component';
import { ClientHistorialComponent } from './tabs/client-historial/client-historial.component';

type TabId = 'creditos' | 'historial' | 'documentos' | 'contactar';

const AVATAR_COLORS = [
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
  '#F97316',
];

/**
 * Convierte el detalle real del cliente al contrato visual usado por la vista compartida.
 * Completa valores faltantes con placeholders seguros para evitar estados rotos cuando el backend no expone toda la información histórica.
 * @param customer
 * @returns
 */
function toClientDetail(customer: CustomerApiDetail): ClientDetail {
  const parts = customer.fullName.trim().split(/\s+/);
  const initials = (
    (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
  ).toUpperCase();
  const colorIdx = customer.fullName.charCodeAt(0) % AVATAR_COLORS.length;

  return {
    id: customer.id,
    dni: customer.dni,
    initials,
    avatarColor: AVATAR_COLORS[colorIdx],
    name: customer.fullName,
    phone: customer.phone ?? 'Sin teléfono',
    email: customer.email ?? 'Sin email',
    direccion: customer.address ?? 'Sin dirección',
    ciudad: '—',
    risk: 'Al dia',
    credits: [],
    historial: [],
    documents: [],
    contactHistory: [],
  };
}

/**
 * Convierte un crédito de la API al modelo visual simplificado para la pestaña de créditos del cliente.
 * @param c - Crédito de la API
 */
function toUiCredit(c: ApiCredit): Credit | null {
  const statusMap: Record<string, Credit['estado'] | null> = {
    ACTIVE: 'ACTIVO',
    PENDING_APPROVAL: 'ACTIVO',
    SETTLED: 'PAGADO',
    REJECTED: null,
  };
  const estado = statusMap[c.status] ?? 'ACTIVO';
  if (estado === null) return null;
  return {
    id: c.id,
    tipo: c.type === 'SALE' ? 'Venta' : 'Préstamo',
    producto: c.customerName,
    montoOriginal: c.totalAmount,
    saldoPendiente: c.totalAmount,
    cuotaActual: 1,
    totalCuotas: c.installmentsCount,
    cuotaMensual: 0,
    proximoVencimiento: c.approvedAt ?? c.createdAt,
    tasa:
      c.interestRate != null ? `${(c.interestRate * 100).toFixed(2)}%` : 'N/A',
    estado,
    progreso: estado === 'PAGADO' ? 100 : 0,
  };
}

@Component({
  selector: 'app-client-detail',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    LoadingStateComponent,
    ErrorStateComponent,
    ClientCreditsComponent,
    ClientHistorialComponent,
    ClientDocumentsComponent,
    ClientContactarComponent,
  ],
  templateUrl: './client-detail.component.html',
  styleUrl: './client-detail.component.scss',
})
export class ClientDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly headerService = inject(HeaderService);
  private readonly customersService = inject(CustomersService);
  private readonly creditsService = inject(CreditsService);

  client: ClientDetail | null = null;
  loading = false;
  notFound = false;
  errorMessage = '';
  private _activeTab: TabId = 'creditos';
  base = '';

  get activeTab(): TabId {
    return this._activeTab;
  }
  set activeTab(tab: TabId) {
    this._activeTab = tab;
    this.updateHeaderActions();
  }

  ngOnInit(): void {
    this.base = this.router.url.split('/clients')[0];
    this.updateBreadcrumbs();
    this.loadClient();
    this.updateHeaderActions();
  }

  ngOnDestroy(): void {
    this.headerService.reset();
  }

  get activeCredits(): number {
    return (
      this.client?.credits.filter(
        (c) => c.estado === 'ACTIVO' || c.estado === 'EN MORA',
      ).length ?? 0
    );
  }

  get totalPortfolio(): number {
    return (
      this.client?.credits.reduce((sum, c) => sum + c.montoOriginal, 0) ?? 0
    );
  }

  get totalOutstandingBalance(): number {
    return (
      this.client?.credits
        .filter((c) => c.estado !== 'PAGADO')
        .reduce((sum, c) => sum + c.saldoPendiente, 0) ?? 0
    );
  }

  /**
   * Carga el cliente real desde el backend usando el ID de la ruta.
   * Solo muestra estado de no encontrado cuando la API responde 404; el resto de errores se informa como falla de carga.
   */
  private loadClient(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.notFound = true;
      this.client = null;
      this.updateBreadcrumbs();
      return;
    }

    this.loading = true;
    this.notFound = false;
    this.errorMessage = '';

    this.customersService
      .getById(id)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (customer) => {
          this.client = toClientDetail(customer);
          this.updateBreadcrumbs();
          this.loadCredits(id);
        },
        error: (error: { status?: number; message?: string }) => {
          this.client = null;
          if (error?.status === 404) {
            this.notFound = true;
          } else {
            this.errorMessage =
              error?.message ?? 'Ocurrió un error al cargar el cliente.';
          }
          this.updateBreadcrumbs();
        },
      });
  }

  /**
   * Carga los créditos del cliente desde la API y los mapea al modelo visual de la pestaña.
   * @param customerId - ID del cliente
   */
  private loadCredits(customerId: string): void {
    this.creditsService.list({ customerId }).subscribe({
      next: (credits) => {
        if (this.client) {
          this.client = {
            ...this.client,
            credits: credits
              .map(toUiCredit)
              .filter((c): c is Credit => c !== null),
          };
        }
      },
      error: () => {},
    });
  }

  /**
   * Sincroniza el breadcrumb con el estado real de la vista para evitar títulos inconsistentes.
   */
  private updateBreadcrumbs(): void {
    this.headerService.breadcrumbs.set([
      { label: 'Clientes', route: `${this.base}/clients` },
      { label: this.client?.name ?? 'Cliente' },
      { label: 'Créditos' },
    ]);
  }

  private updateHeaderActions(): void {
    if (this._activeTab === 'documentos') {
      this.headerService.actions.set([
        {
          label: 'Subir Documento',
          icon: 'pi pi-upload',
          severity: 'primary',
          action: () => {
            /* TODO */
          },
        },
      ]);
    } else if (this._activeTab === 'contactar') {
      this.headerService.actions.set([
        {
          label: 'Enviar Mensaje',
          icon: 'pi pi-send',
          severity: 'primary',
          action: () => {
            /* TODO */
          },
        },
      ]);
    } else if (this._activeTab === 'historial') {
      this.headerService.actions.set([
        {
          label: 'Exportar Excel',
          icon: 'pi pi-download',
          severity: 'success',
          styleClass: '!bg-green-500 !border-green-500 hover:!bg-green-600',
          action: () => {
            /* TODO */
          },
        },
      ]);
    } else {
      this.headerService.actions.set([
        {
          label: 'Nuevo Crédito',
          icon: 'pi pi-plus',
          severity: 'primary',
          action: () => {
            this.router.navigate([`${this.base}/${AppRoutes.OPERATIONS_NEW}`], {
              queryParams: { clientDni: this.client?.dni },
            });
          },
        },
      ]);
    }
  }

  goBack(): void {
    this.router.navigate(['../'], { relativeTo: this.route });
  }
}
