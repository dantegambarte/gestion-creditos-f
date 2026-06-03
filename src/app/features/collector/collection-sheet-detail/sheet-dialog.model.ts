export type CollectionDialogSuccess = {
  itemId: string;
  toast: { severity: 'success' | 'warn'; summary: string; detail: string };
};
