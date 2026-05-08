export type ProductStatus = 'ACTIVE' | 'INACTIVE';

export interface ProductVariantSummary {
  id: string;
  color: string | null;
  size: string | null;
  capacity: string | null;
  currentPrice: number;
  status: string;
}

export interface Product {
  id: string;
  title: string;
  // La descripción es opcional: el backend devuelve null cuando no fue ingresada
  description: string | null;
  model: string | null;
  status: ProductStatus;
  createdAt: string;
  categoryId: string | null;
  categoryName: string | null;
  brandId: string | null;
  brandName: string | null;
  availableCount: number;
  reservedCount: number;
  soldCount: number;
  variants: ProductVariantSummary[];
}

export interface ProductDetail extends Product {
  updatedAt: string;
}

export interface ProductListFilters {
  status?: ProductStatus;
  search?: string;
  categoryId?: string;
}

export interface ProductCreatePayload {
  title: string;
  description?: string;
  model?: string;
  brandId?: string;
  categoryId?: string;
}

export interface ProductUpdatePayload {
  title?: string;
  description?: string;
  model?: string;
  brandId?: string;
  categoryId?: string;
}

export interface ProductVariantSummaryRaw {
  id: string;
  color: string | null;
  size: string | null;
  capacity: string | null;
  current_price: number;
  status: string;
}

export interface ProductRaw {
  id: string;
  title: string;
  // Puede ser null cuando el producto fue creado sin descripción
  description: string | null;
  model: string | null;
  status: ProductStatus;
  created_at: string;
  category_id: string | null;
  category_name: string | null;
  brand_id: string | null;
  brand_name: string | null;
  available_count: number;
  reserved_count: number;
  sold_count: number;
  variants: ProductVariantSummaryRaw[];
}

export interface ProductDetailRaw extends ProductRaw {
  updated_at: string;
}
