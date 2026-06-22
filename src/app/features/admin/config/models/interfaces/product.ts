export interface ProductBrand {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  productCount: number;
}

export interface ProductBrandRaw {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
  product_count?: number | string | null;
}

export type PaymentFrequency = 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

export interface ProductRate {
  id: string;
  productId: string;
  productName: string;
  paymentFrequency: PaymentFrequency;
  installmentsCount: number;
  rate: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductRateListFilters {
  productId?: string;
}

export interface ProductRateCreatePayload {
  productId: string;
  paymentFrequency: PaymentFrequency;
  installmentsCount: number;
  rate: number;
}

export interface ProductRateUpdatePayload {
  rate?: number;
  active?: boolean;
}

export interface ProductRateRaw {
  id: string;
  product_id: string;
  product_name: string;
  payment_frequency: string;
  installments_count: number;
  rate: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductRateGroup {
  productId: string;
  productName: string;
  rates: ProductRate[];
}

export interface CreateForm {
  productId: string | null;
  paymentFrequency: PaymentFrequency | null;
  installmentsCount: number | null;
  ratePercent: number | null;
}

export interface ProductCategory {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  productCount: number;
}

export interface ProductCategoryRaw {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
  product_count?: number | string | null;
}
