import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { finalize } from 'rxjs/operators';
import { HeaderService } from '../../../core/services/header.service';
import { CustomersService } from '../../../features/seller/clients/customers.service';
import { Credit as ApiCredit } from '../../../features/seller/models/credit.model';
import { CustomerDetail as CustomerApiDetail } from '../../../features/seller/models/customer.model';
import { CreditsService } from '../../../features/seller/operations/credits.service';
import { AppRoutes } from '../../models/enums/routes.enum';
import { ClientDetail } from '../../models/interface/client';
import { Credit } from '../../models/interface/credit';
import { FREQUENCY_LABELS } from '../../models/payment-frequency';
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
  const statusMap: Record<string, Credit['status'] | null> = {
    ACTIVE: 'ACTIVE',
    PENDING_APPROVAL: 'ACTIVE',
    SETTLED: 'PAID',
    REJECTED: null,
  };
  const status = statusMap[c.status] ?? 'ACTIVE';
  if (status === null) return null;
  return {
    id: c.id,
    type: c.type === 'SALE' ? 'Venta' : 'Préstamo',
    product: c.customerName,
    originalAmount: c.totalAmount,
    pendingBalance: c.totalAmount,
    currentInstallment: 1,
    totalInstallments: c.installmentsCount,
    // Las cuotas son uniformes: el valor por cuota es el plan contractual
    // dividido por la cantidad. 0 si el plan aún no existe (sin aprobar).
    installmentAmount:
      c.totalToReturn != null && c.installmentsCount > 0
        ? Math.round(c.totalToReturn / c.installmentsCount)
        : 0,
    installmentLabel: FREQUENCY_LABELS[c.paymentFrequency]
      ? `Cuota ${FREQUENCY_LABELS[c.paymentFrequency]}`
      : 'Cuota',
    nextDueDate: c.approvedAt ?? c.createdAt,
    rate:
      c.interestRate != null ? `${(c.interestRate * 100).toFixed(2)}%` : 'N/A',
    status,
    progress: status === 'PAID' ? 100 : 0,
  };
}

@Component({
  selector: 'app-client-detail',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    SkeletonModule,
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
  @ViewChild(ClientContactarComponent) private contactarTab?: ClientContactarComponent;
  @ViewChild(ClientHistorialComponent) private historialTab?: ClientHistorialComponent;

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
        (c) => c.status === 'ACTIVE' || c.status === 'OVERDUE',
      ).length ?? 0
    );
  }

  get totalPortfolio(): number {
    return (
      this.client?.credits.reduce((sum, c) => sum + c.originalAmount, 0) ?? 0
    );
  }

  get totalOutstandingBalance(): number {
    return (
      this.client?.credits
        .filter((c) => c.status !== 'PAID')
        .reduce((sum, c) => sum + c.pendingBalance, 0) ?? 0
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
          action: () => this.contactarTab?.openWhatsApp(),
        },
      ]);
    } else if (this._activeTab === 'historial') {
      this.headerService.actions.set([
        {
          label: 'Exportar Excel',
          icon: 'pi pi-download',
          severity: 'success',
          styleClass: '!bg-green-500 !border-green-500 hover:!bg-green-600',
          action: () => this.exportHistorial(),
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

  /**
   * Exporta el historial filtrado del cliente como archivo CSV descargable.
   */
  private exportHistorial(): void {
    const rows = this.historialTab?.filteredHistorial ?? this.client?.historial ?? [];
    const headers = ['Fecha', 'Hora', 'Evento', 'Crédito', 'Monto', 'Estado', 'Usuario'];
    const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [
      headers.join(','),
      ...rows.map((e) =>
        [e.fecha, e.hora, e.evento, e.creditoId, e.monto ?? '', e.estado, e.usuario]
          .map(escape)
          .join(','),
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historial-${this.client?.dni ?? 'cliente'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  goBack(): void {
    this.router.navigate(['../'], { relativeTo: this.route });
  }
}
