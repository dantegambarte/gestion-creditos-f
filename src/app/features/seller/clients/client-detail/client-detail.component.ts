import { CommonModule, DOCUMENT, Location } from '@angular/common';
import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { AuthServiceBase } from '../../../../core/auth/auth-service.base';
import { AppError } from '../../../../core/models/app-error';
import { UserRoleEnum } from '../../../../core/models/types/user-role';
import { HeaderService } from '../../../../core/services/header.service';
import { BackButtonComponent } from '../../../../shared/components/back-button/back-button.component';
import { ErrorStateComponent } from '../../../../shared/states/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../shared/states/loading-state/loading-state.component';
import { Credit } from '../../models/credit.model';
import { CustomerDetail } from '../../models/customer.model';
import { CreditsService } from '../../operations/credits.service';
import { CustomersService } from '../customers.service';
import { ClientCreditsHistoryPanelComponent } from './client-credits-history-panel/client-credits-history-panel.component';
import { ClientEditFormComponent } from './client-edit-form/client-edit-form.component';
import { ClientPortalPanelComponent } from './client-portal-panel/client-portal-panel.component';

@Component({
  selector: 'app-client-detail',
  standalone: true,
  providers: [MessageService, ConfirmationService],
  imports: [
    CommonModule,
    ButtonModule,
    TagModule,
    ToastModule,
    ConfirmDialogModule,
    LoadingStateComponent,
    ErrorStateComponent,
    ClientEditFormComponent,
    ClientCreditsHistoryPanelComponent,
    ClientPortalPanelComponent,
    BackButtonComponent,
  ],
  templateUrl: './client-detail.component.html',
})
export class ClientDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly customersService = inject(CustomersService);
  private readonly creditsService = inject(CreditsService);
  private readonly auth = inject(AuthServiceBase);
  private readonly location = inject(Location);
  private readonly document = inject(DOCUMENT);
  private readonly header = inject(HeaderService);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);

  customer: CustomerDetail | null = null;
  credits: Credit[] = [];
  loading = false;
  loadingCredits = false;
  error: AppError | null = null;

  showEditForm = false;
  showScrollTop = false;
  private topSummaryObserver: IntersectionObserver | null = null;

  /**
   * Registra el bloque superior cuando Angular lo renderiza después de cargar el cliente.
   */
  @ViewChild('topSummary')
  set topSummary(element: ElementRef<HTMLElement> | undefined) {
    if (!element) return;
    this.observeTopSummary(element.nativeElement);
  }

  /**
   * Indica si el usuario actual tiene rol de ADMIN, lo que habilita ciertas acciones en la interfaz.
   */
  get isAdmin(): boolean {
    return this.auth.hasRole(UserRoleEnum.ADMIN);
  }

  /**
   * Obtiene el ID del cliente desde la ruta activa.
   */
  private get customerId(): string {
    return this.route.snapshot.paramMap.get('id')!;
  }

  /**
   * Calcula la ruta base de clientes según el módulo actual (admin/seller).
   */
  private get clientsBaseRoute(): string {
    const root = this.router.url.startsWith('/admin') ? '/admin' : '/seller';
    return `${root}/clients`;
  }

  ngOnInit(): void {
    this.header.set([
      { label: 'Clientes', route: this.clientsBaseRoute },
      { label: 'Detalle' },
    ]);
    this.load();
  }

  /**
   * Libera el observer de visibilidad al salir del detalle.
   */
  ngOnDestroy(): void {
    this.topSummaryObserver?.disconnect();
  }

  /**
   * Navega de vuelta a la lista de clientes.
   */
  goBack(): void {
    this.location.back();
  }

  /**
   * Devuelve la vista al inicio del detalle sin cambiar de ruta.
   */
  scrollToTop(): void {
    const scrollContainer = this.getScrollContainer();
    scrollContainer?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /**
   * Obtiene el contenedor real de scroll del shell autenticado.
   * Mantiene fallback al selector anterior para convivir con layouts viejos.
   */
  private getScrollContainer(): HTMLElement | null {
    return this.document.querySelector<HTMLElement>(
      'main.ff-shell__main, main.overflow-y-auto',
    );
  }

  /**
   * Observa el bloque superior para mostrar el acceso rápido solo cuando deja de verse.
   */
  private observeTopSummary(element: HTMLElement): void {
    this.topSummaryObserver?.disconnect();

    const scrollContainer = this.getScrollContainer();
    this.topSummaryObserver = new IntersectionObserver(
      ([entry]) => {
        this.showScrollTop = !entry.isIntersecting;
      },
      { root: scrollContainer, threshold: 0.01 },
    );
    this.topSummaryObserver.observe(element);
  }

  /**
   * Carga los detalles del cliente y actualiza el encabezado con su nombre.
   */
  private load(): void {
    this.loading = true;
    this.error = null;
    this.customersService.getById(this.customerId).subscribe({
      next: (data) => {
        this.customer = data;
        this.header.set([
          { label: 'Clientes', route: this.clientsBaseRoute },
          { label: data.fullName },
        ]);
        this.loadCredits(data.id);
        this.loading = false;
      },
      error: (err: AppError) => {
        this.error = err;
        this.loading = false;
      },
    });
  }

  /**
   * Refresca los datos del cliente tras acciones que modifican su estado.
   */
  refresh(): void {
    this.customersService.getById(this.customerId).subscribe({
      next: (data) => {
        this.customer = data;
        this.header.set([
          { label: 'Clientes', route: this.clientsBaseRoute },
          { label: data.fullName },
        ]);
        this.loadCredits(data.id);
      },
      error: () => {},
    });
  }

  /**
   * Carga el historial de créditos del cliente para el panel derecho.
   * @param customerId ID interno del cliente.
   */
  private loadCredits(customerId: string): void {
    this.loadingCredits = true;
    this.creditsService.list({ customerId }).subscribe({
      next: (credits) => {
        this.credits = credits;
        this.loadingCredits = false;
      },
      error: () => {
        this.credits = [];
        this.loadingCredits = false;
      },
    });
  }

  /**
   * Activa el formulario de edición del cliente.
   */
  enterEditMode(): void {
    if (!this.customer) return;
    this.showEditForm = true;
  }

  /**
   * Sincroniza el cliente actualizado y oculta el formulario.
   * @param updated Cliente con los datos guardados devuelto por el hijo.
   */
  onEditUpdated(updated: CustomerDetail): void {
    this.customer = updated;
    this.showEditForm = false;
    this.header.set([
      { label: 'Clientes', route: this.clientsBaseRoute },
      { label: updated.fullName },
    ]);
  }

  /**
   * Oculta el formulario de edición sin guardar cambios.
   */
  onEditCancelled(): void {
    this.showEditForm = false;
  }

  /**
   * Navega al detalle de operación/crédito desde la tabla de historial.
   * @param creditId ID del crédito a visualizar.
   */
  openCreditDetail(creditId: string): void {
    this.router.navigate([
      this.clientsBaseRoute.replace('/clients', '/operations'),
      creditId,
    ]);
  }

  /**
   * Confirma la desactivación del cliente mediante diálogo.
   */
  confirmDeactivate(): void {
    this.confirmationService.confirm({
      header: 'Desactivar cliente',
      message: `¿Desactivar a <strong>${this.customer?.fullName}</strong>? El cliente no puede tener créditos activos o pendientes de aprobación.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Desactivar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger h-11 px-5 rounded-xl',
      rejectButtonStyleClass:
        'p-button-outlined p-button-secondary h-11 px-5 rounded-xl',
      accept: () =>
        this.customersService.deactivate(this.customerId).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Cliente desactivado',
              detail: '',
            });
            this.refresh();
          },
          error: (err: AppError) => this.handleActionError(err),
        }),
    });
  }

  /**
   * Confirma la activación del cliente mediante diálogo.
   */
  confirmActivate(): void {
    this.confirmationService.confirm({
      header: 'Activar cliente',
      message: `¿Activar a <strong>${this.customer?.fullName}</strong>?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Activar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-primary h-11 px-5 rounded-xl',
      rejectButtonStyleClass:
        'p-button-outlined p-button-secondary h-11 px-5 rounded-xl',
      accept: () =>
        this.customersService.activate(this.customerId).subscribe({
          next: () => {
            this.messageService.add({
              severity: 'success',
              summary: 'Cliente activado',
              detail: '',
            });
            this.refresh();
          },
          error: (err: AppError) => this.handleActionError(err),
        }),
    });
  }

  /**
   * Maneja errores de acciones mostrando toast con severidad según el status HTTP.
   * @param err Error de la aplicación.
   */
  private handleActionError(err: AppError): void {
    this.messageService.add({
      severity: err.status === 409 ? 'warn' : 'error',
      summary: err.status === 409 ? 'Conflicto' : 'Error',
      detail: err.message,
    });
  }
}
