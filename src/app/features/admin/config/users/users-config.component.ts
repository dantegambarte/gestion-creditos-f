import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FfBackTopFabComponent } from './../../../../shared/components/back-top-fab/ff-back-top-fab.component';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { AppError } from '../../../../core/models/app-error';
import { UserRole } from '../../../../core/models/types/user-role';
import { AppRoutes } from '../../../../shared/models/enums/routes.enum';
import {
  ROLE_LABEL,
  ROLE_SEVERITY,
  User,
  UserListFilters,
} from '../../users/user.model';
import { UsersService } from '../../users/users.service';

/**
 * Listado de usuarios dentro de Configuración. Reutiliza el servicio y los
 * modelos de la sección Usuarios (features/admin/users): lista real desde la
 * API con filtros server-side, y las acciones navegan a las pantallas
 * completas ya existentes (alta con password temporal y detalle/edición).
 */
@Component({
  selector: 'app-users-config',
  standalone: true,
  imports: [
    DatePipe,
    FfBackTopFabComponent,
    ButtonModule,
    TagModule,
    DropdownModule,
    InputTextModule,
    FormsModule,
  ],
  templateUrl: './users-config.component.html',
})
export class UsersConfigComponent implements OnInit, OnDestroy {
  private readonly usersService = inject(UsersService);
  private readonly router = inject(Router);

  users: User[] = [];
  loading = true;
  error: AppError | null = null;

  searchTerm = '';
  selectedRole: UserRole | null = null;

  private readonly search$ = new Subject<string>();
  private searchSub?: Subscription;

  readonly roleOptions = [
    { label: 'Todos los roles', value: null },
    ...Object.entries(ROLE_LABEL).map(([value, label]) => ({ label, value })),
  ];

  ngOnInit(): void {
    this.searchSub = this.search$
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(() => this.loadUsers());
    this.loadUsers();
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
  }

  /**
   * Carga los usuarios reales desde la API aplicando búsqueda y rol.
   */
  private loadUsers(): void {
    const filters: UserListFilters = {};
    if (this.selectedRole) filters.role = this.selectedRole;
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

  onSearch(value: string): void {
    this.searchTerm = value;
    this.search$.next(value);
  }

  onRoleChange(value: UserRole | null): void {
    this.selectedRole = value;
    this.loadUsers();
  }

  /** Alta real: pantalla existente con diálogo de password temporal. */
  openNew(): void {
    this.router.navigate(['/', AppRoutes.ADMIN, AppRoutes.USERS, 'new']);
  }

  /** Edición real: detalle existente (editar, activar/desactivar, reset). */
  openEdit(user: User): void {
    this.router.navigate(['/', AppRoutes.ADMIN, AppRoutes.USERS, user.id]);
  }

  initials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }

  avatarColor(name: string): string {
    const colors = [
      'bg-blue-500',
      'bg-purple-500',
      'bg-green-500',
      'bg-orange-500',
      'bg-pink-500',
      'bg-teal-500',
    ];
    return colors[name.charCodeAt(0) % colors.length];
  }

  roleLabel(role: string): string {
    return ROLE_LABEL[role] ?? role;
  }

  roleSeverity(
    role: string,
  ): 'success' | 'info' | 'warning' | 'danger' | 'secondary' | 'contrast' {
    return (ROLE_SEVERITY[role] ?? 'secondary') as
      | 'success'
      | 'info'
      | 'warning'
      | 'danger'
      | 'secondary'
      | 'contrast';
  }
}
