export interface ProductOperation {
  id: string;
  productId?: string;
  variantId?: string;
  name: string;
  price: number;
  stock: number;
  unitCode?: string;
  historicalPrice?: number;
  color?: string | null;
  size?: string | null;
  capacity?: string | null;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  icon: string;
  iconColor: string;
}
