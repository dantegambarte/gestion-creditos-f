export type HolidayType = 'EXTRAORDINARY' | 'NATIONAL' | 'LOCAL' | 'BANKING';

export interface HolidayRaw {
  id: string;
  date: string;
  name: string;
  type: HolidayType;
  affects_due_dates: boolean;
  active: boolean;
  repeats_annually: boolean;
  created_at: string;
  updated_at: string;
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
  type: HolidayType;
  affectsDueDates: boolean;
  active: boolean;
  repeatsAnnually: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HolidaysListFilters {
  type?: HolidayType;
  active?: boolean;
  affectsDueDates?: boolean;
}

export interface HolidayCreatePayload {
  date: string;
  name: string;
  type: HolidayType;
  affectsDueDates: boolean;
  active: boolean;
  repeatsAnnually: boolean;
  recalculateFutureInstallments?: boolean;
}

export interface HolidayUpdatePayload {
  name?: string;
  type?: HolidayType;
  affectsDueDates?: boolean;
  active?: boolean;
  repeatsAnnually?: boolean;
  recalculateFutureInstallments?: boolean;
}

export interface HolidayCreateResult {
  holiday: Holiday;
  recalculatedInstallments: number;
}

export interface HolidayDuplicatePayload {
  sourceYear: number;
}

export interface HolidayDuplicateItem {
  sourceDate: string;
  targetDate: string | null;
  type: HolidayType;
  name?: string;
  reason?: string;
}

export interface HolidayDuplicateResult {
  sourceYear: number;
  targetYear: number;
  eligibleCount?: number;
  toCreateCount?: number;
  createdCount: number;
  skippedCount: number;
  conflictsCount: number;
  invalidDatesCount?: number;
  nonRecurringCount?: number;
  created: HolidayDuplicateItem[];
  skipped: HolidayDuplicateItem[];
}

export interface HolidayDuplicatePreviewResult {
  sourceYear: number;
  targetYear: number;
  eligibleCount: number;
  toCreateCount: number;
  skippedCount: number;
  conflictsCount: number;
  invalidDatesCount: number;
  nonRecurringCount: number;
  toCreate: HolidayDuplicateItem[];
  skipped: HolidayDuplicateItem[];
}
