import { Component, computed, signal } from '@angular/core';
import { FfBackTopFabComponent } from './../../../../shared/components/back-top-fab/ff-back-top-fab.component';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { InputSwitchModule } from 'primeng/inputswitch';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { Roles } from '../../../../shared/models/enums/roles.enum';
import {
  UserForm,
  UserFormModalComponent,
  UserRecord,
} from './user-form-modal/user-form-modal.component';

interface SystemUser {
  id: string;
  name: string;
  email: string;
  dni: string;
  role: Roles;
  active: boolean;
  lastLogin: string;
}

@Component({
  selector: 'app-users-config',
  standalone: true,
  imports: [
    FfBackTopFabComponent,
    ButtonModule,
    TagModule,
    DropdownModule,
    InputTextModule,
    InputSwitchModule,
    FormsModule,
    UserFormModalComponent,
  ],
  templateUrl: './users-config.component.html',
})
export class UsersConfigComponent {
  searchQuery = signal('');
  selectedRole = signal<string | null>(null);
  modalVisible = false;
  editingUser: UserRecord | null = null;

  roleOptions = [
    { label: 'Todos los roles', value: null },
    { label: 'Administrador', value: 'ADMIN' },
    { label: 'Vendedor', value: 'SELLER' },
    { label: 'Cobrador', value: 'COLLECTOR' },
    { label: 'Cajero', value: 'CASHIER' },
  ];

  allUsers: SystemUser[] = [
    {
      id: 'U001',
      name: 'Carlos Andrade',
      email: 'c.andrade@siscreditos.com',
      dni: '30123456',
      role: Roles.ADMIN,
      active: true,
      lastLogin: 'Hoy, 09:42 am',
    },
    {
      id: 'U002',
      name: 'María López',
      email: 'm.lopez@siscreditos.com',
      dni: '32456789',
      role: Roles.SELLER,
      active: true,
      lastLogin: 'Ayer, 03:15 pm',
    },
    {
      id: 'U003',
      name: 'Roberto García',
      email: 'r.garcia@siscreditos.com',
      dni: '28987654',
      role: Roles.CASHIER,
      active: true,
      lastLogin: 'Hoy, 08:00 am',
    },
    {
      id: 'U004',
      name: 'Jorge Peñafiel',
      email: 'j.peñafiel@siscreditos.com',
      dni: '35112233',
      role: Roles.COLLECTOR,
      active: true,
      lastLogin: '18/04/2025',
    },
    {
      id: 'U005',
      name: 'Ana Torres',
      email: 'a.torres@siscreditos.com',
      dni: '29334455',
      role: Roles.SELLER,
      active: false,
      lastLogin: '05/03/2025',
    },
  ];

  filteredUsers = computed(() => {
    const q = this.searchQuery().toLowerCase();
    const role = this.selectedRole();
    return this.allUsers.filter((u) => {
      const matchSearch =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.dni.includes(q);
      const matchRole = !role || u.role === role;
      return matchSearch && matchRole;
    });
  });

  openNew(): void {
    this.editingUser = null;
    this.modalVisible = true;
  }

  openEdit(user: SystemUser): void {
    this.editingUser = { ...user };
    this.modalVisible = true;
  }

  onSaved(form: UserForm): void {
    if (this.editingUser) {
      const idx = this.allUsers.findIndex((u) => u.id === this.editingUser!.id);
      if (idx !== -1) {
        this.allUsers[idx] = {
          ...this.allUsers[idx],
          name: form.name,
          email: form.email,
          dni: form.dni,
          role: form.role as Roles,
          active: form.active,
        };
      }
    } else {
      this.allUsers.push({
        id: 'U' + (this.allUsers.length + 1).toString().padStart(3, '0'),
        name: form.name,
        email: form.email,
        dni: form.dni,
        role: form.role as Roles,
        active: form.active,
        lastLogin: '—',
      });
    }
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
    const map: Record<string, string> = {
      ADMIN: 'Administrador',
      SELLER: 'Vendedor',
      COLLECTOR: 'Cobrador',
      CASHIER: 'Cajero',
    };
    return map[role] ?? role;
  }

  roleSeverity(
    role: string,
  ): 'success' | 'info' | 'warning' | 'danger' | 'secondary' | 'contrast' {
    const map: Record<
      string,
      'success' | 'info' | 'warning' | 'danger' | 'secondary' | 'contrast'
    > = {
      ADMIN: 'danger',
      SELLER: 'info',
      COLLECTOR: 'warning',
      CASHIER: 'success',
    };
    return map[role] ?? 'secondary';
  }

  onSearch(value: string): void {
    this.searchQuery.set(value);
  }
  onRoleChange(value: string | null): void {
    this.selectedRole.set(value);
  }
}
