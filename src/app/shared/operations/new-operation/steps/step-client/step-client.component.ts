import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { CustomerCreatePayload } from '../../../../../features/seller/models/customer.model';
import { ClientOperation } from '../../../../models/interface/client';

@Component({
  selector: 'app-step-client',
  standalone: true,
  imports: [FormsModule, InputTextModule, DecimalPipe],
  templateUrl: './step-client.component.html',
})
export class StepClientComponent implements OnChanges {
  @Input() clients: ClientOperation[] = [];
  @Input() selectedClientId: string | null = null;
  @Input() selectedClientSummary: ClientOperation | null = null;
  @Input() loadingSummary = false;
  @Input() showQuickRegister = false;
  @Input() creatingQuickRegister = false;
  @Output() clientSelected = new EventEmitter<ClientOperation>();
  @Output() continueRequested = new EventEmitter<void>();
  @Output() registerClientRequested = new EventEmitter<void>();
  @Output() quickRegisterSubmitted = new EventEmitter<CustomerCreatePayload>();
  @Output() quickRegisterCancelled = new EventEmitter<void>();

  searchText = '';
  quickRegisterTouched = false;
  quickRegisterDraft = {
    fullName: '',
    dni: '',
    phone: '',
    email: '',
  };

  /**
   * Limpia el formulario rápido cuando el panel se cierra desde el contenedor.
   * @param {SimpleChanges} changes - Cambios de inputs recibidos por Angular.
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['showQuickRegister'] && !this.showQuickRegister) {
      this.resetQuickRegisterDraft();
    }
  }

  /**
   * Devuelve los clientes filtrados por nombre o DNI según el texto de búsqueda local.
   * La comparación ignora mayúsculas, minúsculas y tildes para evitar falsos negativos.
   */
  get filteredClients(): ClientOperation[] {
    const term = this.normalizeText(this.searchText);
    if (!term) return this.clients;
    return this.clients.filter(
      (c) =>
        this.normalizeText(c.name).includes(term) ||
        this.normalizeText(c.dni).includes(term),
    );
  }

  /**
   * Indica si el cliente seleccionado está activo para validar el avance del paso.
   */
  get isSelectedClientInactive(): boolean {
    if (!this.selectedClientId) return false;
    const client = this.clients.find((c) => c.id === this.selectedClientId);
    return client?.status !== 'ACTIVE';
  }

  /**
   * Retorna el objeto completo del cliente seleccionado, o null si no hay selección.
   */
  get selectedClient(): ClientOperation | null {
    return this.selectedClientSummary;
  }

  /**
   * Indica si el cliente seleccionado tiene mora registrada.
   */
  get selectedClientHasMora(): boolean {
    const d = this.selectedClient?.delinquency ?? '';
    return d !== '' && d !== 'sin mora';
  }

  /**
   * Construye iniciales para el avatar circular del cliente seleccionado.
   */
  get selectedClientInitials(): string {
    const name = this.selectedClient?.name?.trim() ?? '';
    if (!name) return 'CL';
    const parts = name.split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  }

  /**
   * Construye iniciales para cualquier cliente del listado evitando lógica frágil en el template.
   * @param {string} name - Nombre completo del cliente.
   * @returns {string} Iniciales en mayúscula para el avatar.
   */
  getClientInitials(name: string): string {
    const normalized = name.trim();
    if (!normalized) return 'CL';
    const parts = normalized.split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[1][0] : '')).toUpperCase();
  }

  /**
   * Indica si el usuario ya escribió algo en la búsqueda para mostrar feedback contextual.
   */
  get hasSearchTerm(): boolean {
    return this.searchText.trim().length > 0;
  }

  /**
   * Valida el formulario rápido mínimo para poder crear y continuar.
   */
  get isQuickRegisterValid(): boolean {
    return this.quickRegisterFullNameIsValid && this.quickRegisterDniIsValid && this.quickRegisterEmailIsValid;
  }

  /**
   * Valida nombre completo con una longitud mínima razonable.
   */
  get quickRegisterFullNameIsValid(): boolean {
    return this.quickRegisterDraft.fullName.trim().length >= 3;
  }

  /**
   * Valida DNI admitiendo solo dígitos y un largo usual en Argentina.
   */
  get quickRegisterDniIsValid(): boolean {
    const dni = this.getNormalizedDni(this.quickRegisterDraft.dni);
    return dni.length >= 7 && dni.length <= 8;
  }

  /**
   * Permite email vacío o con formato básico correcto.
   */
  get quickRegisterEmailIsValid(): boolean {
    const email = this.quickRegisterDraft.email.trim();
    if (!email) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /**
   * Devuelve una etiqueta legible para el tipo de crédito del resumen.
   * @param {'SALE' | 'LOAN'} type - Tipo técnico del crédito.
   */
  getCreditTypeLabel(type: 'SALE' | 'LOAN'): string {
    return type === 'SALE' ? 'VENTA' : 'PRÉSTAMO';
  }

  /**
   * Traduce el estado del crédito a la variante visual del prototipo.
   * @param {'ACTIVE' | 'SETTLED'} status - Estado persistido del crédito.
   */
  getCreditStatusLabel(status: 'ACTIVE' | 'SETTLED'): string {
    return status === 'ACTIVE' ? 'ACTIVO' : 'LIQUIDADO';
  }

  /**
   * Formatea fechas ISO al patrón corto dd/MM/yy.
   * @param {string | undefined} value - Fecha a representar.
   */
  formatShortDate(value?: string): string {
    if (!value) return '—';
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    }).format(new Date(value));
  }

  /**
   * Emite la intención de avanzar cuando el cliente ya está listo para continuar.
   */
  continueWithSelectedClient(): void {
    if (!this.selectedClient || this.loadingSummary || this.isSelectedClientInactive) return;
    this.continueRequested.emit();
  }

  /**
   * Abre el registro rápido y precarga lo buscado si parece nombre o DNI.
   */
  registerNewClient(): void {
    const search = this.searchText.trim();
    if (search) {
      if (/^\d[\d\s.]*$/.test(search)) {
        this.quickRegisterDraft.dni = this.getNormalizedDni(search);
      } else if (!this.quickRegisterDraft.fullName.trim()) {
        this.quickRegisterDraft.fullName = search;
      }
    }
    this.registerClientRequested.emit();
  }

  /**
   * Cancela el panel de registro rápido y restablece su estado local.
   */
  cancelQuickRegister(): void {
    this.resetQuickRegisterDraft();
    this.quickRegisterCancelled.emit();
  }

  /**
   * Emite la creación rápida cuando los datos mínimos ya son válidos.
   */
  submitQuickRegister(): void {
    this.quickRegisterTouched = true;
    if (!this.isQuickRegisterValid || this.creatingQuickRegister) return;

    this.quickRegisterSubmitted.emit({
      fullName: this.quickRegisterDraft.fullName.trim(),
      dni: this.getNormalizedDni(this.quickRegisterDraft.dni),
      phone: this.quickRegisterDraft.phone.trim() || undefined,
      email: this.quickRegisterDraft.email.trim() || undefined,
    });
  }

  /**
   * Indica si un campo debe renderizar feedback visual de error.
   * @param {'fullName' | 'dni' | 'email'} field - Campo a validar en el panel rápido.
   */
  hasQuickRegisterError(field: 'fullName' | 'dni' | 'email'): boolean {
    if (!this.quickRegisterTouched) return false;
    if (field === 'fullName') return !this.quickRegisterFullNameIsValid;
    if (field === 'dni') return !this.quickRegisterDniIsValid;
    return !this.quickRegisterEmailIsValid;
  }

  /**
   * Devuelve el texto corto de ayuda para cada validación del panel rápido.
   * @param {'fullName' | 'dni' | 'email'} field - Campo consultado.
   */
  getQuickRegisterError(field: 'fullName' | 'dni' | 'email'): string {
    if (field === 'fullName') return 'Ingresá nombre y apellido.';
    if (field === 'dni') return 'Ingresá un DNI válido de 7 u 8 dígitos.';
    return 'Ingresá un email válido o dejalo vacío.';
  }

  /**
   * Normaliza texto para búsquedas tolerantes a tildes y diferencias de casing.
   * @param {string | null | undefined} value - Texto a normalizar.
   * @returns {string} Texto normalizado listo para comparar.
   */
  private normalizeText(value: string | null | undefined): string {
    return (value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  /**
   * Limpia el formulario rápido para evitar arrastrar datos viejos entre aperturas.
   */
  private resetQuickRegisterDraft(): void {
    this.quickRegisterTouched = false;
    this.quickRegisterDraft = {
      fullName: '',
      dni: '',
      phone: '',
      email: '',
    };
  }

  /**
   * Deja el DNI solo con dígitos para enviarlo en formato consistente.
   * @param {string} value - Texto crudo ingresado por el usuario.
   * @returns {string} DNI normalizado listo para persistir.
   */
  private getNormalizedDni(value: string): string {
    return value.replace(/\D/g, '');
  }
}
