import { Injectable, inject } from '@angular/core';
import { jsPDF } from 'jspdf';
import {
  additionalDebtText,
  COLLECTION_FILTER_LABELS,
  CollectionSheetDetail,
} from '../../collector/models/collection.model';
import { DateService } from '../../../core/services/date.service';
import { FormatService } from '../../../core/services/format.service';
import {
  GeneratedPlanillaResult,
  PlanillaEntry,
} from '../models/interface/sheet';

/**
 * Genera y descarga la planilla de cobranza en formato PDF A4.
 */
@Injectable({ providedIn: 'root' })
export class CollectionPdfService {
  private readonly fmt = inject(FormatService);
  private readonly dateSvc = inject(DateService);

  /**
   * Genera el PDF de la planilla y lo descarga en el navegador.
   * @param detail Detalle completo de la planilla seleccionada
   */
  generate(detail: CollectionSheetDetail): void {
    const result = this.mapDetailToResult(detail);
    const doc = new jsPDF('p', 'mm', 'a4');

    // ── Layout constants (mm) ───────────────────────────────────────────────
    const PAGE_W = doc.internal.pageSize.getWidth();
    const PAGE_H = doc.internal.pageSize.getHeight();
    const MARGIN_X = 14;
    const MARGIN_TOP = 18;
    const MARGIN_BOTTOM = 18;
    const CONTENT_W = PAGE_W - MARGIN_X * 2;
    const FOOTER_H = 8;
    const ROW_H_BASE = 14;
    const ROW_H_WRAPPED = 18;
    const TABLE_HEADER_H = 6;
    const HEADER_H = 26;

    const COLS = {
      cli: { x: MARGIN_X, w: 84 },
      ven: { x: MARGIN_X + 84, w: 18 },
      esp: { x: MARGIN_X + 102, w: 24 },
      ges: { x: MARGIN_X + 126, w: 56 },
    };

    const COLOR_TEXT = [33, 37, 41] as const;
    const COLOR_MUTED = [108, 117, 125] as const;
    const COLOR_BORDER = [220, 220, 224] as const;
    const COLOR_BORDER_STRONG = [120, 120, 130] as const;
    const COLOR_HEADER_BG = [245, 247, 250] as const;

    const folio = (result.sheetId ?? '').slice(0, 8) || '—';
    const issuedAt = (() => {
      const d = new Date();
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    })();
    const filterLabel = COLLECTION_FILTER_LABELS[detail.filterUsed] ?? '—';

    // ── Helpers ─────────────────────────────────────────────────────────────
    const setFont = (size: number, weight: 'normal' | 'bold' = 'normal') => {
      doc.setFont('helvetica', weight);
      doc.setFontSize(size);
    };
    const setColor = (rgb: readonly [number, number, number]) => {
      doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    };
    const setStroke = (
      rgb: readonly [number, number, number],
      width: number,
    ) => {
      doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
      doc.setLineWidth(width);
    };

    const calcHeaderH = (_phone: string, _address: string): number => 7;

    const drawPdfHeader = (): void => {
      setStroke(COLOR_BORDER, 0.3);
      doc.rect(MARGIN_X, MARGIN_TOP, CONTENT_W, HEADER_H);
      setFont(13, 'bold');
      setColor(COLOR_TEXT);
      doc.text('PLANILLA DE COBRANZA', MARGIN_X + 3, MARGIN_TOP + 6);
      setFont(8, 'normal');
      setColor(COLOR_MUTED);
      doc.text(`Folio  ${folio}`, MARGIN_X + CONTENT_W - 3, MARGIN_TOP + 6, {
        align: 'right',
      });
      setFont(8, 'normal');
      doc.text(
        'Documento operativo de cobranza',
        MARGIN_X + 3,
        MARGIN_TOP + 11,
      );
      setStroke(COLOR_BORDER, 0.2);
      doc.line(
        MARGIN_X + 3,
        MARGIN_TOP + 13.5,
        MARGIN_X + CONTENT_W - 3,
        MARGIN_TOP + 13.5,
      );
      setFont(9, 'normal');
      setColor(COLOR_TEXT);
      doc.text(
        `Cobrador: ${result.collectorName}     Fecha: ${this.formatDate(result.fecha)}     Filtro: ${filterLabel}`,
        MARGIN_X + 3,
        MARGIN_TOP + 18,
      );
      doc.text(
        `Cuotas: ${result.clientCount}     Total esperado: ${this.fmt.currency(result.totalAmount)}`,
        MARGIN_X + 3,
        MARGIN_TOP + 23,
      );
    };

    const drawTableHeader = (yTop: number): void => {
      doc.setFillColor(
        COLOR_HEADER_BG[0],
        COLOR_HEADER_BG[1],
        COLOR_HEADER_BG[2],
      );
      doc.rect(MARGIN_X, yTop, CONTENT_W, TABLE_HEADER_H, 'F');
      setStroke(COLOR_BORDER_STRONG, 0.4);
      doc.line(MARGIN_X, yTop, MARGIN_X + CONTENT_W, yTop);
      doc.line(
        MARGIN_X,
        yTop + TABLE_HEADER_H,
        MARGIN_X + CONTENT_W,
        yTop + TABLE_HEADER_H,
      );
      setFont(8, 'bold');
      setColor([55, 65, 81]);
      const textY = yTop + 4.2;
      doc.text('CLIENTE', COLS.cli.x + 1.5, textY);
      doc.text('VENCE', COLS.ven.x + COLS.ven.w / 2, textY, {
        align: 'center',
      });
      doc.text('ESPERADO', COLS.esp.x + COLS.esp.w / 2, textY, {
        align: 'center',
      });
      doc.text('GESTIÓN', COLS.ges.x + 1.5, textY);
    };

    const measureRow = (
      entry: PlanillaEntry,
    ): { height: number; refLines: string[] } => {
      setFont(7.5, 'normal');
      const ref =
        entry.collectionReference || `Cuota ${entry.installmentNumber} · —`;
      let refLines = (
        doc.splitTextToSize(ref, COLS.cli.w - 3) as string[]
      ).slice(0, 2);
      // "Además adeuda N más" ocupa la 2ª línea (info clave del crédito) para
      // que el PDF muestre lo mismo que la planilla del cobrador y del admin.
      const extra = additionalDebtText(entry.additionalInstallmentsCount);
      if (extra) refLines = [refLines[0], extra];
      return {
        height: refLines.length >= 2 ? ROW_H_WRAPPED : ROW_H_BASE,
        refLines,
      };
    };

    const drawCustomerHeader = (
      yTop: number,
      customerName: string,
      cuotasCount: number,
      phone: string,
      address: string,
    ): void => {
      const hdrH = 7;
      const textY = yTop + 4.8;
      doc.setFillColor(
        COLOR_HEADER_BG[0],
        COLOR_HEADER_BG[1],
        COLOR_HEADER_BG[2],
      );
      doc.rect(MARGIN_X, yTop, CONTENT_W, hdrH, 'F');
      setStroke(COLOR_BORDER_STRONG, 0.5);
      doc.line(MARGIN_X, yTop + hdrH, MARGIN_X + CONTENT_W, yTop + hdrH);
      setFont(7.5, 'normal');
      setColor(COLOR_MUTED);
      const countLabel = `${cuotasCount} ${cuotasCount === 1 ? 'cuota' : 'cuotas'}`;
      doc.text(countLabel, MARGIN_X + CONTENT_W - 2, textY, { align: 'right' });
      const countW = doc.getTextWidth(countLabel) + 4;
      setFont(8.5, 'bold');
      setColor(COLOR_TEXT);
      const nameText = (customerName ?? '').toUpperCase();
      doc.text(nameText, MARGIN_X + 2, textY);
      const nameW = doc.getTextWidth(nameText);
      const contactParts: string[] = [];
      if (phone) contactParts.push(`Tel: ${phone}`);
      if (address) contactParts.push(address);
      if (contactParts.length > 0) {
        setFont(7.5, 'normal');
        setColor(COLOR_MUTED);
        const contactRaw = `  ·  ${contactParts.join('  ·  ')}`;
        const maxW = CONTENT_W - nameW - countW - 4;
        const contactFit =
          (doc.splitTextToSize(contactRaw, maxW) as string[])[0] ?? contactRaw;
        doc.text(contactFit, MARGIN_X + 2 + nameW, textY);
      }
    };

    const drawRow = (
      entry: PlanillaEntry,
      yTop: number,
      refLines: string[],
      height: number,
    ): void => {
      const innerTop = yTop + 4;
      const innerSecond = yTop + 7.7;

      setStroke(COLOR_BORDER, 0.15);
      doc.line(MARGIN_X, yTop, MARGIN_X + CONTENT_W, yTop);

      setFont(7.5, 'normal');
      setColor(COLOR_TEXT);
      refLines.forEach((line, i) => {
        doc.text(line, COLS.cli.x + 1.5, innerTop + i * 3.7);
      });

      setFont(8.5, 'normal');
      setColor(COLOR_TEXT);
      doc.text(
        this.formatDate(entry.dueDate),
        COLS.ven.x + COLS.ven.w / 2,
        innerTop,
        { align: 'center' },
      );
      setFont(7.5, 'bold');
      setColor(statusColor(entry.paymentStatus));
      doc.text(
        entry.paymentStatus.toUpperCase(),
        COLS.ven.x + COLS.ven.w / 2,
        innerSecond,
        { align: 'center' },
      );

      setFont(10.5, 'bold');
      setColor(COLOR_TEXT);
      doc.text(
        this.fmt.currency(entry.amount),
        COLS.esp.x + COLS.esp.w / 2,
        yTop + height / 2 + 1.5,
        { align: 'center' },
      );

      setFont(7.5, 'normal');
      setColor(COLOR_MUTED);
      const gesX = COLS.ges.x + 1.5;
      const gesLineEnd = COLS.ges.x + COLS.ges.w - 1.5;
      doc.text('Cobrado:', gesX, innerTop);
      setStroke(COLOR_BORDER_STRONG, 0.25);
      doc.line(gesX + 13, innerTop + 0.5, gesLineEnd, innerTop + 0.5);
      doc.text('Obs/Visita:', gesX, innerSecond);
      doc.line(gesX + 16, innerSecond + 0.5, gesLineEnd, innerSecond + 0.5);
    };

    function statusColor(status: string): readonly [number, number, number] {
      switch (status) {
        case 'EN_MORA':
          return [185, 28, 28];
        case 'PARCIAL':
          return [180, 83, 9];
        case 'COBRADO':
          return [21, 128, 61];
        case 'PENDIENTE':
        default:
          return [55, 65, 81];
      }
    }

    const drawFooter = (pageNum: number, totalPages: number): void => {
      setFont(7, 'normal');
      setColor(COLOR_MUTED);
      const text = `Página ${pageNum} de ${totalPages}  ·  Emitido ${issuedAt}  ·  ${result.collectorName}  ·  ${this.formatDate(result.fecha)}`;
      doc.text(text, PAGE_W / 2, PAGE_H - MARGIN_BOTTOM / 2 - 2, {
        align: 'center',
      });
    };

    // ── Pre-cálculo de cuotas por cliente ────────────────────────────────────
    const cuotasByCustomer = new Map<string, number>();
    result.entries.forEach((e) => {
      const name = e.clientName ?? '';
      cuotasByCustomer.set(name, (cuotasByCustomer.get(name) ?? 0) + 1);
    });

    // ── Construcción de bloques para paginación ──────────────────────────────
    type RowMeasure = { height: number; refLines: string[] };
    type Block =
      | {
          kind: 'header';
          height: number;
          customerName: string;
          cuotasCount: number;
          pairedRowHeight: number;
          phone: string;
          address: string;
        }
      | {
          kind: 'row';
          height: number;
          entry: PlanillaEntry;
          measure: RowMeasure;
          globalIdx: number;
        };

    const blocks: Block[] = [];
    const rowMeasures = result.entries.map((e) => measureRow(e));
    let lastCustomer: string | null = null;
    result.entries.forEach((entry, i) => {
      const m = rowMeasures[i];
      if (entry.clientName !== lastCustomer) {
        const phone = entry.clientPhone ?? '';
        const address = entry.clientAddress ?? '';
        blocks.push({
          kind: 'header',
          height: calcHeaderH(phone, address),
          customerName: entry.clientName,
          cuotasCount: cuotasByCustomer.get(entry.clientName) ?? 0,
          pairedRowHeight: m.height,
          phone,
          address,
        });
        lastCustomer = entry.clientName;
      }
      blocks.push({
        kind: 'row',
        height: m.height,
        entry,
        measure: m,
        globalIdx: i,
      });
    });

    const TABLE_HEADER_GAP = 2;
    const pageRowsBudget =
      PAGE_H -
      MARGIN_TOP -
      HEADER_H -
      TABLE_HEADER_H -
      TABLE_HEADER_GAP -
      MARGIN_BOTTOM -
      FOOTER_H;
    const pageBuckets: Block[][] = [];
    let bucket: Block[] = [];
    let used = 0;
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      const requiredSpace =
        b.kind === 'header' ? b.height + b.pairedRowHeight : b.height;
      if (used + requiredSpace > pageRowsBudget && bucket.length > 0) {
        pageBuckets.push(bucket);
        bucket = [];
        used = 0;
      }
      bucket.push(b);
      used += b.height;
    }
    if (bucket.length > 0) pageBuckets.push(bucket);
    const totalPages = Math.max(pageBuckets.length, 1);

    // ── Render por página ────────────────────────────────────────────────────
    pageBuckets.forEach((page, pageIdx) => {
      if (pageIdx > 0) doc.addPage();
      drawPdfHeader();
      const tableY = MARGIN_TOP + HEADER_H + 2;
      drawTableHeader(tableY);
      let y = tableY + TABLE_HEADER_H + TABLE_HEADER_GAP;
      page.forEach((b) => {
        if (b.kind === 'header') {
          drawCustomerHeader(
            y,
            b.customerName,
            b.cuotasCount,
            b.phone,
            b.address,
          );
        } else {
          drawRow(b.entry, y, b.measure.refLines, b.measure.height);
        }
        y += b.height;
      });
      setStroke(COLOR_BORDER_STRONG, 0.4);
      doc.line(MARGIN_X, y, MARGIN_X + CONTENT_W, y);
      drawFooter(pageIdx + 1, totalPages);
    });

    const safeName = (result.collectorName ?? 'cobrador').replace(/\s+/g, '-');
    const safeDate = result.fecha ?? this.dateSvc.toLocalIso(new Date());
    doc.save(`planilla-${safeName}-${safeDate}.pdf`);
  }

  private mapDetailToResult(
    detail: CollectionSheetDetail,
  ): GeneratedPlanillaResult {
    const entries: PlanillaEntry[] = detail.items.map((item) => ({
      clientName: item.customerName,
      clientDni: 'N/D',
      clientPhone: item.customerPhone,
      clientAddress: item.customerAddress,
      creditId: item.creditId,
      creditType: item.creditType,
      installmentNumber: item.installmentNumber,
      amount: item.remainingAmount ?? item.amountDue,
      paidAmount: item.amountPaid,
      dueDate: item.dueDate,
      paymentStatus: this.mapInstallmentStatus(item.installmentStatus),
      collectionReference: item.collectionReference,
      additionalInstallmentsCount: item.additionalInstallmentsCount,
    }));
    return {
      collectorId: detail.collectorId,
      collectorName: detail.collectorName,
      fecha: detail.sheetDate,
      clientCount: detail.items.length,
      totalAmount: detail.items.reduce((sum, i) => sum + i.amountDue, 0),
      sheetId: detail.id,
      entries,
    };
  }

  private mapInstallmentStatus(status: string): string {
    const map: Record<string, string> = {
      PENDING: 'PENDIENTE',
      OVERDUE: 'EN_MORA',
      PARTIAL: 'PARCIAL',
      PAID: 'COBRADO',
    };
    return map[status] ?? status;
  }

  private formatDate(iso: string): string {
    if (!iso) return '—';
    const [y, m, d] = iso.split('T')[0].split('-');
    return `${d}/${m}/${y}`;
  }
}
