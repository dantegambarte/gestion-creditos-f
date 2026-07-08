import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { SkeletonModule } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { AppError } from '../../../../core/models/app-error';
import { UserRole } from '../../../../core/models/types/user-role';
import { HeaderService } from '../../../../core/services/header.service';
import { AppRoutes } from '../../../../shared/models/enums/routes.enum';
import { EmptyStateComponent } from '../../../../shared/states/empty-state/empty-state.component';
import { ErrorStateComponent } from '../../../../shared/states/error-state/error-state.component';
import { LoadingStateComponent } from '../../../../shared/states/loading-state/loading-state.component';
import { UserCreateComponent } from '../user-create/user-create.component';
import { User, UserListFilters, UserStatus } from '../user.model';
import { UsersService } from '../users.service';
import { FfBackTopFabComponent } from '../../../../shared/components/back-top-fab/ff-back-top-fab.component';

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Administrador',
  SELLER: 'Vendedor',
  COLLECTOR: 'Cobrador',
  SELLER_COLLECTOR: 'Vendedor/Cobrador',
};

const ROLE_SEVERITY: Record<string, string> = {
  ADMIN: 'danger',
  SELLER: 'info',
  COLLECTOR: 'success',
  SELLER_COLLECTOR: 'warning',
};

@Component({
  selector: 'app-users-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    TagModule,
    ButtonModule,
    DialogModule,
    DropdownModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    SkeletonModule,
    TooltipModule,
    LoadingStateComponent,
    ErrorStateComponent,
    EmptyStateComponent,
    UserCreateComponent,
    FfBackTopFabComponent,
  ],
  templateUrl: './users-list.component.html',
})
export class UsersListComponent implements OnInit, OnDestroy {
  private readonly usersService = inject(UsersService);
  private readonly router = inject(Router);
  private readonly header = inject(HeaderService);

  users: User[] = [];
  loading = false;
  error: AppError | null = null;
  displayCreateModal = false;

  searchTerm = '';
  selectedRole: UserRole | null = null;
  selectedStatus: UserStatus | null = null;

  readonly roleOptions = [
    { label: 'Administrador', value: 'ADMIN' },
    { label: 'Vendedor', value: 'SELLER' },
    { label: 'Cobrador', value: 'COLLECTOR' },
    { label: 'Vendedor/Cobrador', value: 'SELLER_COLLECTOR' },
  ];

  readonly statusOptions = [
    { label: 'Activo', value: 'ACTIVE' },
    { label: 'Inactivo', value: 'INACTIVE' },
  ];

  roleLabel(role: string): string {
    return ROLE_LABEL[role] ?? role;
  }
  roleSeverity(
    role: string,
  ): 'success' | 'info' | 'warning' | 'danger' | 'secondary' {
    return (ROLE_SEVERITY[role] ?? 'secondary') as
      | 'success'
      | 'info'
      | 'warning'
      | 'danger'
      | 'secondary';
  }

  private readonly searchSubject = new Subject<string>();
  private sub?: Subscription;

  ngOnInit(): void {
    this.header.set([{ label: 'Usuarios' }]);
    this.loadUsers();
    this.sub = this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(() => this.loadUsers());
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  /**
   * Maneja el cambio en el término de búsqueda. Actualiza el valor del término de búsqueda y emite el nuevo valor a través del sujeto de búsqueda para que se apliquen los filtros con debounce.
   * @param value
   */
  onSearchChange(value: string): void {
    this.searchSubject.next(value);
  }

  /**
   * Aplica los filtros seleccionados (rol, estado y término de búsqueda) y recarga la lista de usuarios. Los filtros se aplican al construir un objeto de filtros que se pasa al servicio de usuarios para obtener la lista filtrada.
   */
  applyFilters(): void {
    this.loadUsers();
  }

  /**
   * Navega a la página de detalle del usuario con el ID proporcionado.
   * @param id
   */
  navigateToDetail(id: string): void {
    this.router.navigate(['/', AppRoutes.ADMIN, AppRoutes.USERS, id]);
  }

  /**
   * Abre el modal de creación de usuario.
   */
  openNew(): void {
    this.displayCreateModal = true;
  }

  /**
   * Cierra el modal y recarga la lista tras una creación exitosa.
   */
  onUserCreated(): void {
    this.displayCreateModal = false;
    this.loadUsers();
  }

  /**
   * Navega a la página de creación de nuevo usuario.
   */
  navigateToCreate(): void {
    this.router.navigate([AppRoutes.USERS_NEW]);
  }

  /**
   * Carga la lista de usuarios aplicando los filtros seleccionados (rol, estado y término de búsqueda). Muestra un estado de carga mientras se obtiene la información, y maneja los errores que puedan ocurrir durante la carga mostrando un mensaje de error específico.
   */
  private loadUsers(): void {
    const filters: UserListFilters = {};
    if (this.selectedRole) filters.role = this.selectedRole;
    if (this.selectedStatus) filters.status = this.selectedStatus;
    if (this.searchTerm.trim()) filters.search = this.searchTerm.trim();

    this.loading = true;
    this.error = null;
    this.usersService.list(filters).subscribe({
      next: (data) => {
        this.users = data;
        this.loading = false;
      },
      error: (err: AppError) => {
        this.error = err;
        this.loading = false;
      },
    });
  }
}
