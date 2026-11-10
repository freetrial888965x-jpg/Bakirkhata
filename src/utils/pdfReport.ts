import { jsPDF } from 'jspdf';
import { Customer, LedgerTransaction } from '../types/ledger';
import {
  computeBalance,
  formatDateTimeBn,
  formatNumberBn,
  formatTaka,
} from './format';

export interface CustomerReportParams {
  shopName: string;
  shopPhone?: string;
  customer: Customer;
  transactions: LedgerTransaction[];
  totalDue: number;
  totalPayment: number;
}

const PAGE_W = 1240;
const PAGE_H = 1754;
const MARGIN_X = 72;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const FONT_FAMILY = "'Hind Siliguri', 'Noto Sans Bengali', system-ui, sans-serif";

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  if (!text) return ['—'];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      if (ctx.measureText(word).width <= maxWidth) {
        current = word;
      } else {
        // Hard break very long unbroken word
        let chunk = '';
        for (const ch of word) {
          if (ctx.measureText(chunk + ch).width > maxWidth && chunk) {
            lines.push(chunk);
            chunk = ch;
          } else {
            chunk += ch;
          }
        }
        current = chunk;
      }
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : ['—'];
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill?: string,
  stroke?: string
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function createPageCanvas(): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement('canvas');
  canvas.width = PAGE_W;
  canvas.height = PAGE_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('ক্যানভাস তৈরি করা যায়নি।');
  }
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  return { canvas, ctx };
}

function drawTableHeader(ctx: CanvasRenderingContext2D, y: number): number {
  const headerH = 54;
  drawRoundedRect(ctx, MARGIN_X, y, CONTENT_W, headerH, 8, '#DC2626');

  ctx.fillStyle = '#FFFFFF';
  ctx.font = `600 22px ${FONT_FAMILY}`;
  ctx.textBaseline = 'middle';

  const midY = y + headerH / 2;
  ctx.textAlign = 'left';
  ctx.fillText('ক্রম', MARGIN_X + 18, midY);
  ctx.fillText('তারিখ ও সময়', MARGIN_X + 90, midY);
  ctx.fillText('নোট / বিবরণ', MARGIN_X + 410, midY);
  ctx.fillText('ধরন', MARGIN_X + 810, midY);
  ctx.textAlign = 'right';
  ctx.fillText('টাকার পরিমাণ', MARGIN_X + CONTENT_W - 20, midY);

  return y + headerH;
}

function drawPageFooter(
  ctx: CanvasRenderingContext2D,
  pageNumber: number,
  totalPages: number
) {
  const footerY = PAGE_H - 64;
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(MARGIN_X, footerY - 18);
  ctx.lineTo(MARGIN_X + CONTENT_W, footerY - 18);
  ctx.stroke();

  ctx.fillStyle = '#64748B';
  ctx.font = `400 18px ${FONT_FAMILY}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(
    'বাকির খাতা · কাস্টমার হিসাব বিবরণী',
    MARGIN_X,
    footerY + 6
  );

  ctx.textAlign = 'right';
  ctx.fillText(
    `পৃষ্ঠা ${formatNumberBn(pageNumber)} / ${formatNumberBn(totalPages)}`,
    MARGIN_X + CONTENT_W,
    footerY + 6
  );
}

export async function generateCustomerPdfReport(
  params: CustomerReportParams
): Promise<{ blob: Blob; fileName: string; summaryText: string }> {
  if (typeof document !== 'undefined' && document.fonts) {
    await document.fonts.ready;
  }

  const { shopName, shopPhone, customer, transactions, totalDue, totalPayment } = params;
  const balance = computeBalance(totalDue, totalPayment);
  const generatedAtStr = formatDateTimeBn(new Date());

  const pages: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }[] = [];
  const startNewPage = () => {
    const p = createPageCanvas();
    pages.push(p);
    return p;
  };

  let { ctx } = startNewPage();
  let y = 64;

  // Top Header Bar
  ctx.fillStyle = '#DC2626';
  ctx.fillRect(0, 0, PAGE_W, 14);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#DC2626';
  ctx.font = `700 38px ${FONT_FAMILY}`;
  ctx.fillText('বাকির খাতা', MARGIN_X, y);

  ctx.fillStyle = '#0F172A';
  ctx.font = `600 24px ${FONT_FAMILY}`;
  ctx.fillText(shopName, MARGIN_X, y + 52);

  if (shopPhone) {
    ctx.fillStyle = '#64748B';
    ctx.font = `400 20px ${FONT_FAMILY}`;
    ctx.fillText(`মোবাইল: ${shopPhone}`, MARGIN_X, y + 86);
  }

  ctx.textAlign = 'right';
  ctx.fillStyle = '#0F172A';
  ctx.font = `700 28px ${FONT_FAMILY}`;
  ctx.fillText('কাস্টমার হিসাব রিপোর্ট', MARGIN_X + CONTENT_W, y + 4);

  ctx.fillStyle = '#64748B';
  ctx.font = `400 20px ${FONT_FAMILY}`;
  ctx.fillText(`তারিখ: ${generatedAtStr}`, MARGIN_X + CONTENT_W, y + 46);

  y += 136;

  // Divider
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(MARGIN_X, y);
  ctx.lineTo(MARGIN_X + CONTENT_W, y);
  ctx.stroke();

  y += 28;

  // Customer & Summary Box
  const summaryBoxH = 190;
  drawRoundedRect(ctx, MARGIN_X, y, CONTENT_W, summaryBoxH, 16, '#F8FAFC', '#E2E8F0');

  // Left: Customer Details
  ctx.textAlign = 'left';
  ctx.fillStyle = '#64748B';
  ctx.font = `500 20px ${FONT_FAMILY}`;
  ctx.fillText('গ্রাহকের তথ্য', MARGIN_X + 28, y + 24);

  ctx.fillStyle = '#0F172A';
  ctx.font = `700 30px ${FONT_FAMILY}`;
  ctx.fillText(customer.name, MARGIN_X + 28, y + 58);

  ctx.fillStyle = '#475569';
  ctx.font = `400 22px ${FONT_FAMILY}`;
  ctx.fillText(
    `মোবাইল: ${customer.phone || 'দেওয়া নেই'}`,
    MARGIN_X + 28,
    y + 104
  );
  ctx.fillText(
    `মোট লেনদেন: ${formatNumberBn(transactions.length)} টি`,
    MARGIN_X + 28,
    y + 138
  );

  // Vertical Separator inside Summary Box
  const splitX = MARGIN_X + CONTENT_W * 0.52;
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(splitX, y + 24);
  ctx.lineTo(splitX, y + summaryBoxH - 24);
  ctx.stroke();

  // Right: Balance Breakdown
  const rightLabelX = splitX + 32;
  const rightValX = MARGIN_X + CONTENT_W - 28;

  ctx.textAlign = 'left';
  ctx.fillStyle = '#475569';
  ctx.font = `500 22px ${FONT_FAMILY}`;
  ctx.fillText('মোট বাকি:', rightLabelX, y + 28);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#DC2626';
  ctx.font = `700 24px ${FONT_FAMILY}`;
  ctx.fillText(formatTaka(totalDue), rightValX, y + 26);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#475569';
  ctx.font = `500 22px ${FONT_FAMILY}`;
  ctx.fillText('মোট জমা:', rightLabelX, y + 72);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#2563EB';
  ctx.font = `700 24px ${FONT_FAMILY}`;
  ctx.fillText(formatTaka(totalPayment), rightValX, y + 70);

  ctx.strokeStyle = '#CBD5E1';
  ctx.beginPath();
  ctx.moveTo(rightLabelX, y + 114);
  ctx.lineTo(rightValX, y + 114);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#0F172A';
  ctx.font = `700 24px ${FONT_FAMILY}`;
  const statusLabel =
    balance.status === 'due'
      ? 'বর্তমান বাকি:'
      : balance.status === 'advance'
      ? 'বর্তমান অগ্রিম:'
      : 'বর্তমান হিসাব:';
  ctx.fillText(statusLabel, rightLabelX, y + 132);

  ctx.textAlign = 'right';
  ctx.fillStyle =
    balance.status === 'due'
      ? '#DC2626'
      : balance.status === 'advance'
      ? '#16A34A'
      : '#475569';
  ctx.font = `700 28px ${FONT_FAMILY}`;
  ctx.fillText(
    balance.status === 'settled' ? '৳ ০ (পরিশোধিত)' : formatTaka(balance.absAmount),
    rightValX,
    y + 130
  );

  y += summaryBoxH + 38;

  // Section Title
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0F172A';
  ctx.font = `700 26px ${FONT_FAMILY}`;
  ctx.fillText('লেনদেনের ইতিহাস', MARGIN_X, y);
  y += 42;

  if (transactions.length === 0) {
    drawRoundedRect(ctx, MARGIN_X, y, CONTENT_W, 100, 12, '#F8FAFC', '#E2E8F0');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#64748B';
    ctx.font = `500 22px ${FONT_FAMILY}`;
    ctx.fillText('এখনো কোনো লেনদেন যোগ করা হয়নি।', MARGIN_X + CONTENT_W / 2, y + 50);
  } else {
    y = drawTableHeader(ctx, y);

    const maxContentBottom = PAGE_H - 110;
    const noteMaxW = 370;

    transactions.forEach((tx, idx) => {
      ctx.font = `400 21px ${FONT_FAMILY}`;
      const noteLines = wrapTextLines(ctx, tx.note || '—', noteMaxW);
      const rowH = Math.max(60, 26 + noteLines.length * 28);

      if (y + rowH > maxContentBottom) {
        const nextPage = startNewPage();
        ctx = nextPage.ctx;
        y = 64;
        ctx.fillStyle = '#DC2626';
        ctx.fillRect(0, 0, PAGE_W, 10);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#475569';
        ctx.font = `600 22px ${FONT_FAMILY}`;
        ctx.fillText(`${customer.name} — লেনদেনের ইতিহাস (চলমান)`, MARGIN_X, y);
        y += 42;
        y = drawTableHeader(ctx, y);
      }

      if (idx % 2 === 1) {
        ctx.fillStyle = '#F8FAFC';
        ctx.fillRect(MARGIN_X, y, CONTENT_W, rowH);
      }

      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(MARGIN_X, y + rowH);
      ctx.lineTo(MARGIN_X + CONTENT_W, y + rowH);
      ctx.stroke();

      const textY = y + 18;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';

      // Index
      ctx.fillStyle = '#64748B';
      ctx.font = `500 20px ${FONT_FAMILY}`;
      ctx.fillText(formatNumberBn(idx + 1), MARGIN_X + 18, textY);

      // Date & Time
      ctx.fillStyle = '#334155';
      ctx.font = `400 20px ${FONT_FAMILY}`;
      ctx.fillText(formatDateTimeBn(tx.transactionDate), MARGIN_X + 90, textY);

      // Note lines
      ctx.fillStyle = '#0F172A';
      ctx.font = `400 21px ${FONT_FAMILY}`;
      noteLines.forEach((line, lineIdx) => {
        ctx.fillText(line, MARGIN_X + 410, textY + lineIdx * 28);
      });

      // Type
      const isDue = tx.type === 'due';
      ctx.fillStyle = isDue ? '#DC2626' : '#2563EB';
      ctx.font = `700 21px ${FONT_FAMILY}`;
      ctx.fillText(isDue ? 'বাকি' : 'জমা', MARGIN_X + 810, textY);

      // Amount
      ctx.textAlign = 'right';
      ctx.fillText(formatTaka(tx.amount), MARGIN_X + CONTENT_W - 20, textY);

      y += rowH;
    });
  }

  // Draw Footers with total page numbers
  pages.forEach((p, idx) => {
    drawPageFooter(p.ctx, idx + 1, pages.length);
  });

  // Compile canvases into A4 jsPDF
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  pages.forEach((p, idx) => {
    if (idx > 0) pdf.addPage();
    const imgData = p.canvas.toDataURL('image/png');
    pdf.addImage(imgData, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
  });

  const safeName = customer.name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'customer';
  const fileName = `${safeName}_হিসাব_রিপোর্ট.pdf`;

  const balanceLine =
    balance.status === 'due'
      ? `বর্তমান বাকি: ${formatTaka(balance.absAmount)}`
      : balance.status === 'advance'
      ? `বর্তমান অগ্রিম: ${formatTaka(balance.absAmount)}`
      : 'বর্তমান হিসাব: পরিশোধিত (৳ ০)';

  const summaryText = [
    `📒 ${shopName} — বাকির খাতা`,
    `গ্রাহক: ${customer.name}${customer.phone ? ` (${customer.phone})` : ''}`,
    `মোট বাকি: ${formatTaka(totalDue)}`,
    `মোট জমা: ${formatTaka(totalPayment)}`,
    balanceLine,
  ].join('\n');

  return {
    blob: pdf.output('blob'),
    fileName,
    summaryText,
  };
}

export function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
