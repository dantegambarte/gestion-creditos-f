import { Credit } from './credit';

export type DocumentCategory =
  | 'Identificación'
  | 'Documentos de Crédito'
  | 'Documentos Laborales';
export type DocumentStatus = 'ok' | 'pendiente';

export interface ClientDocument {
  id: string;
  name: string;
  type: string; // PDF, JPG, etc.
  sizeKb: number;
  date: string;
  category: DocumentCategory;
  status: DocumentStatus;
  required?: boolean;
  creditoId?: string;
}

export type HistoryEventType =
  | 'Pago recibido'
  | 'Mora aplicada'
  | 'Notificación enviada'
  | 'Crédito creado'
  | 'Condonación';

export type HistoryState =
  | 'Aplicado'
  | 'Pendiente'
  | 'Enviada'
  | 'Activo'
  | 'Condonado';

export interface HistorialEvent {
  fecha: string;
  hora: string;
  evento: HistoryEventType;
  creditoId: string;
  monto: number | null;
  usuario: string;
  estado: HistoryState;
}

export interface Client {
  id: string;
  dni: string;
  initials: string;
  avatarColor: string;
  name: string;
  phone: string;
  credits: number;
  risk: string;
  email?: string;
  address?: string;
  collectorId?: string;
  /** Portal habilitado: si se edita el DNI, cambia el usuario de acceso. */
  portalEnabled?: boolean;
}

export interface ClientOperation {
  id: string;
  name: string;
  dni: string;
  phone: string;
  email: string;
  status: 'ACTIVE' | 'INACTIVE';
  previousCredits: number;
  delinquency: string;
  paymentCapacity: number;
  address?: string;
  collectorName?: string;
  createdAt?: string;
  paidInstallments?: number;
  pendingInstallments?: number;
  overdueInstallments?: number;
  creditsSummary?: {
    id: string;
    type: 'SALE' | 'LOAN';
    creditName: string | null;
    totalAmount: number;
    installmentsCount: number;
    status: 'ACTIVE' | 'SETTLED';
    referenceDate: string;
  }[];
}

export type ContactChannel = 'WhatsApp' | 'Correo' | 'Llamada';
export type ContactHistoryStatus = 'Entregado' | 'Sin respuesta' | 'Fallido';

export interface ContactHistoryItem {
  channel: ContactChannel;
  descripcion: string;
  fecha: string;
  hora: string;
  usuario: string;
  estado: ContactHistoryStatus;
}

export interface DocumentGroup {
  category: DocumentCategory;
  icon: string;
  iconColor: string;
  docs: ClientDocument[];
}

export interface ClientDetail {
  id: string;
  dni: string;
  initials: string;
  avatarColor: string;
  name: string;
  phone: string;
  email: string;
  direccion: string;
  ciudad: string;
  risk: string;
  credits: Credit[];
  historial: HistorialEvent[];
  documents: ClientDocument[];
  contactHistory: ContactHistoryItem[];
}
