export interface ProductVariant {
  id: string;
  color: string | null;
  size: string | null;
  capacity: string | null;
  currentPrice: number;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
  productId: string;
  productName: string;
  title: string;
  model: string | null;
  productStatus: string;
  brandId: string | null;
  brandName: string | null;
  availableCount: number;
  reservedCount: number;
  soldCount: number;
}

// ProductVariantDetail no agrega campos extra; se mantiene como alias tipado
// para distinguir respuestas de getById (con contadores garantizados) de getAll.
export type ProductVariantDetail = ProductVariant;

export interface ProductVariantCreatePayload {
  productId: string;
  color?: string;
  size?: string;
  capacity?: string;
  currentPrice: number;
}

export interface ProductVariantUpdatePayload {
  color?: string;
  size?: string;
  capacity?: string;
  currentPrice?: number;
}

export interface ProductVariantRaw {
  id: string;
  color: string | null;
  size: string | null;
  capacity: string | null;
  current_price: number;
  status: 'ACTIVE' | 'INACTIVE';
  created_at: string;
  updated_at: string;
  product_id: string;
  product_name: string;
  title: string;
  model: string | null;
  product_status: string;
  brand_id: string | null;
  brand_name: string | null;
  available_count: number;
  reserved_count: number;
  sold_count: number;
}

// ProductVariantDetailRaw se mantiene como alias para compatibilidad con getById
export type ProductVariantDetailRaw = ProductVariantRaw;

export interface ProductVariantFilters {
  productId?: string;
  status?: 'ACTIVE' | 'INACTIVE';
}
