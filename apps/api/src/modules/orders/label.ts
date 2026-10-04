import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { formatDateTime, formatMoney } from '../../shared/format.js';

const MM = 72 / 25.4;
const BLUE = rgb(0x18 / 255, 0x4e / 255, 0x86 / 255);

export interface LabelData {
  number: string;
  customerName: string;
  customerPhone: string | null;
  createdAt: Date;
  totalCents: number;
  items: Array<{ productName: string; quantity: number }>;
}

/** Wraps text to the width, with Helvetica metrics. */
function wrap(
  text: string,
  font: { widthOfTextAtSize(text: string, size: number): number },
  size: number,
  width: number,
) {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  lines.push(line);
  return lines;
}

/** 100 x 150 mm separation label to stick on the package (UC Comprar Produto, step 10). */
export async function orderLabelPdf(data: LabelData): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Etiqueta ${data.number}`);
  const page = pdf.addPage([100 * MM, 150 * MM]);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const margin = 6 * MM;
  const width = page.getWidth() - 2 * margin;
  let y = page.getHeight() - margin;

  page.drawRectangle({
    x: 0,
    y: page.getHeight() - 16 * MM,
    width: page.getWidth(),
    height: 16 * MM,
    color: BLUE,
  });
  page.drawText('REFRIGERAÇÃO CASTRO', {
    x: margin,
    y: page.getHeight() - 10 * MM,
    size: 12,
    font: bold,
    color: rgb(1, 1, 1),
  });
  y -= 22 * MM;
  page.drawText(data.number, { x: margin, y, size: 26, font: bold, color: BLUE });
  y -= 9 * MM;
  for (const line of wrap(data.customerName, bold, 13, width)) {
    page.drawText(line, { x: margin, y, size: 13, font: bold });
    y -= 6 * MM;
  }
  if (data.customerPhone) {
    page.drawText(data.customerPhone, { x: margin, y, size: 11, font: regular });
    y -= 6 * MM;
  }
  page.drawText(formatDateTime(data.createdAt), {
    x: margin,
    y,
    size: 9,
    font: regular,
    color: rgb(0.35, 0.39, 0.44),
  });
  y -= 9 * MM;
  for (const item of data.items) {
    for (const line of wrap(`${item.quantity} × ${item.productName}`, regular, 11, width)) {
      if (y < 20 * MM) break;
      page.drawText(line, { x: margin, y, size: 11, font: regular });
      y -= 5.5 * MM;
    }
  }
  page.drawText(`Total ${formatMoney(data.totalCents)} · pagamento na retirada`, {
    x: margin,
    y: 10 * MM,
    size: 10,
    font: bold,
  });
  return Buffer.from(await pdf.save());
}
