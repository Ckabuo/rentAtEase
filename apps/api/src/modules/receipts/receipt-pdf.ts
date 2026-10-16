import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatNaira } from "@rae/domain";

export async function renderReceiptPdf(input: {
  number: string;
  tenantName: string;
  propertyName: string;
  unitLabel: string;
  amountKobo: number;
  paidOn: string;
  method: string;
  category: string;
  summary: string;
  confirmUrl: string;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.102, 0.094, 0.086);
  const teal = rgb(0.102, 0.42, 0.353);
  let y = 780;
  const line = (text: string, size = 12, useBold = false) => {
    page.drawText(pdfSafeText(text), { x: 48, y, size, font: useBold ? bold : font, color: useBold ? teal : ink });
    y -= size + 10;
  };
  line("Rent@Ease", 22, true);
  line("Payment receipt", 14, true);
  y -= 8;
  line(`Receipt ${input.number}`, 12, true);
  line(`Tenant: ${input.tenantName}`);
  line(`Property: ${input.propertyName}`);
  line(`Unit: ${input.unitLabel}`);
  line(`Amount: ${formatNaira(input.amountKobo)}`, 14, true);
  line(`Paid on: ${input.paidOn}`);
  line(`Method: ${label(input.method)}`);
  line(`Category: ${label(input.category)}`);
  y -= 6;
  for (const part of wrap(input.summary, 80)) line(part);
  y -= 12;
  line("This receipt is immutable. Corrections are issued as a replacement.", 10);
  y -= 8;
  for (const part of wrap(`Confirm or dispute: ${input.confirmUrl}`, 80)) line(part, 10);
  return pdf.save();
}

function label(value: string): string {
  return value.toLowerCase().replaceAll("_", " ");
}

/** Standard PDF fonts (WinAnsi) cannot render the naira sign. */
function pdfSafeText(text: string): string {
  return text.replaceAll("₦", "NGN ");
}

function wrap(value: string, width: number): string[] {
  const words = value.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width) {
      if (current) lines.push(current);
      current = word;
    } else current = next;
  }
  if (current) lines.push(current);
  return lines;
}
