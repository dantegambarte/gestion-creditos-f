export interface ProductOperation {
  id: string;
  productId?: string;
  name: string;
  price: number;
  stock: number;
  unitCode?: string;
  historicalPrice?: number;
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
