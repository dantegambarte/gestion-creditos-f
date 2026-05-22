export interface KpiCard {
  label: string;
  value: string;
  subtitle?: string;
  trend: string;
  trendUp: boolean;
  icon: string;
  iconBg: string;
  monthlyTotal?: string;
}
