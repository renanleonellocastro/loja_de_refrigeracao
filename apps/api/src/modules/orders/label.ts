import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';
import { formatDateTime, formatMoney } from '../../shared/format.js';

const MM = 72 / 25.4;
const BLUE = rgb(0x18 / 255, 0x4e / 255, 0x86 / 255);
const WHITE = rgb(1, 1, 1);
const GRAY = rgb(0.35, 0.39, 0.44);

const PAGE_WIDTH = 100 * MM;
const PAGE_HEIGHT = 150 * MM;
const MARGIN = 6 * MM;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;
const BANNER_HEIGHT = 16 * MM;
const BANNER_TEXT_FROM_TOP = 10 * MM;
/** Space between the top margin and the order number, below the banner. */
const NUMBER_OFFSET = 22 * MM;
/** Item lines stop below this height so they never run into the total. */
const ITEMS_FLOOR = 20 * MM;
const TOTAL_Y = 10 * MM;
const STORE_NAME = 'REFRIGERAÇÃO CASTRO';

export interface LabelData {
  number: string;
  customerName: string;
  customerPhone: string | null;
  createdAt: Date;
  totalCents: number;
  items: Array<{ productName: string; quantity: number }>;
}

type FontWeight = 'bold' | 'regular';

interface TextStyle {
  size: number;
  weight: FontWeight;
  color?: RGB;
}

/** A text style for the flowing part of the label, with how far the cursor moves after each line. */
interface LineStyle extends TextStyle {
  lineHeight: number;
}

const BANNER_STYLE: TextStyle = { size: 12, weight: 'bold', color: WHITE };
const TOTAL_STYLE: TextStyle = { size: 10, weight: 'bold' };
const NUMBER_STYLE: LineStyle = { size: 26, weight: 'bold', color: BLUE, lineHeight: 9 * MM };
const NAME_STYLE: LineStyle = { size: 13, weight: 'bold', lineHeight: 6 * MM };
const PHONE_STYLE: LineStyle = { size: 11, weight: 'regular', lineHeight: 6 * MM };
const DATE_STYLE: LineStyle = { size: 9, weight: 'regular', color: GRAY, lineHeight: 9 * MM };
const ITEM_STYLE: LineStyle = { size: 11, weight: 'regular', lineHeight: 5.5 * MM };

/** The page being drawn and a cursor that walks down from the top. */
interface LabelCanvas {
  page: PDFPage;
  fonts: Record<FontWeight, PDFFont>;
  y: number;
}

/** Wraps text to the width, with Helvetica metrics. */
function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const fits = (candidate: string) => font.widthOfTextAtSize(candidate, size) <= width;
  return text.split(/\s+/).reduce<string[]>((lines, word) => appendWord(lines, word, fits), ['']);
}

/** The first word of a line always stays on it, even when it alone is wider than the line. */
function appendWord(lines: string[], word: string, fits: (candidate: string) => boolean): string[] {
  const current = lines.at(-1)!;
  const candidate = current ? `${current} ${word}` : word;
  if (current && !fits(candidate)) return [...lines, word];
  return [...lines.slice(0, -1), candidate];
}

function drawText(canvas: LabelCanvas, text: string, y: number, style: TextStyle): void {
  const font = canvas.fonts[style.weight];
  const color = style.color ? { color: style.color } : {};
  canvas.page.drawText(text, { x: MARGIN, y, size: style.size, font, ...color });
}

/** Draws a line at the cursor and moves the cursor down. */
function writeLine(canvas: LabelCanvas, text: string, style: LineStyle): void {
  drawText(canvas, text, canvas.y, style);
  canvas.y -= style.lineHeight;
}

/** Draws the lines while the cursor stays at or above the floor. */
function writeLines(canvas: LabelCanvas, lines: string[], style: LineStyle, floor = -Infinity): void {
  for (const line of lines) {
    if (canvas.y < floor) return;
    writeLine(canvas, line, style);
  }
}

function wrapped(canvas: LabelCanvas, text: string, style: TextStyle): string[] {
  return wrap(text, canvas.fonts[style.weight], style.size, CONTENT_WIDTH);
}

function drawBanner(canvas: LabelCanvas): void {
  canvas.page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - BANNER_HEIGHT,
    width: PAGE_WIDTH,
    height: BANNER_HEIGHT,
    color: BLUE,
  });
  drawText(canvas, STORE_NAME, PAGE_HEIGHT - BANNER_TEXT_FROM_TOP, BANNER_STYLE);
}

function writeCustomer(canvas: LabelCanvas, data: LabelData): void {
  writeLines(canvas, wrapped(canvas, data.customerName, NAME_STYLE), NAME_STYLE);
  if (data.customerPhone) writeLine(canvas, data.customerPhone, PHONE_STYLE);
  writeLine(canvas, formatDateTime(data.createdAt), DATE_STYLE);
}

function writeItems(canvas: LabelCanvas, items: LabelData['items']): void {
  const lines = items.flatMap((item) =>
    wrapped(canvas, `${item.quantity} × ${item.productName}`, ITEM_STYLE),
  );
  writeLines(canvas, lines, ITEM_STYLE, ITEMS_FLOOR);
}

async function openCanvas(pdf: PDFDocument): Promise<LabelCanvas> {
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  return { page, fonts: { bold, regular }, y: PAGE_HEIGHT - MARGIN - NUMBER_OFFSET };
}

/** 100 x 150 mm separation label to stick on the package (UC Comprar Produto, step 10). */
export async function orderLabelPdf(data: LabelData): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Etiqueta ${data.number}`);
  const canvas = await openCanvas(pdf);
  drawBanner(canvas);
  writeLine(canvas, data.number, NUMBER_STYLE);
  writeCustomer(canvas, data);
  writeItems(canvas, data.items);
  drawText(canvas, `Total ${formatMoney(data.totalCents)} · pagamento na retirada`, TOTAL_Y, TOTAL_STYLE);
  return Buffer.from(await pdf.save());
}
