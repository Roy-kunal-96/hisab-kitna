import jsPDF from 'jspdf';
import { StatementData, Transaction } from '../types';

export function generateCustomerStatementPDF(statementData: StatementData): {
  doc: jsPDF;
  blobUrl: string;
  filename: string;
} {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const { shopName, tagline, person, period, balance, transactions } = statementData;

  const pageWidth = doc.internal.pageSize.getWidth();

  // Header Banner
  doc.setFillColor(15, 81, 50); // Deep Bahi-Khata Forest Green
  doc.rect(0, 0, pageWidth, 32, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('HISAB KITAB', 14, 14);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(tagline || 'Bolkar hisaab rakho - Digital Bahi-Khata', 14, 20);
  doc.text(shopName || 'Sharma Kirana Store', 14, 26);

  // Statement Meta Box
  doc.setTextColor(33, 37, 41);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('CUSTOMER STATEMENT / GRAHAK HISAB', 14, 42);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Customer Name: ${person.name}`, 14, 49);
  if (person.phone) {
    doc.text(`Phone: +91 ${person.phone}`, 14, 55);
  }
  doc.text(`Period: ${period === 'all' ? 'All Transactions (Sampurna Hisaab)' : period}`, 120, 49);
  doc.text(`Date of Issue: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`, 120, 55);

  // Horizontal divider
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(14, 60, pageWidth - 14, 60);

  // Table Header
  let startY = 68;
  doc.setFillColor(243, 244, 246);
  doc.rect(14, startY - 5, pageWidth - 28, 8, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(55, 65, 81);
  doc.text('Date (Tarikh)', 16, startY);
  doc.text('Description (Vivaran)', 48, startY);
  doc.text('Type', 110, startY);
  doc.text('Amount (Rupaye)', pageWidth - 16, startY, { align: 'right' });

  startY += 7;

  // Render transactions
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  let currentY = startY;

  transactions.forEach((tx, index) => {
    if (currentY > 260) {
      doc.addPage();
      currentY = 20;
    }

    // Row zebra background
    if (index % 2 === 1) {
      doc.setFillColor(250, 250, 250);
      doc.rect(14, currentY - 4, pageWidth - 28, 7, 'F');
    }

    const d = new Date(tx.transaction_date);
    const dateFormatted = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const isReceived = tx.type === 'PAYMENT_RECEIVED' || tx.type === 'PAYMENT_MADE';
    const isReversed = tx.status === 'REVERSED';

    doc.setTextColor(isReversed ? 156 : 55, isReversed ? 163 : 65, isReversed ? 175 : 81);
    doc.text(dateFormatted, 16, currentY);

    const descText = tx.description ? (tx.description.length > 32 ? tx.description.slice(0, 32) + '...' : tx.description) : '-';
    doc.text(isReversed ? `[CANCELLED] ${descText}` : descText, 48, currentY);

    // Type label
    let typeLabel = 'Given (Diye)';
    if (tx.type === 'PAYMENT_RECEIVED') typeLabel = 'Payment (Jama)';
    else if (tx.type === 'PAYABLE') typeLabel = 'Payable (Dena)';
    else if (tx.type === 'PAYMENT_MADE') typeLabel = 'Paid (Diye)';
    else if (tx.type === 'REVERSAL') typeLabel = 'Reversal Entry';

    doc.text(typeLabel, 110, currentY);

    // Amount formatted
    const prefix = isReceived ? '- ₹' : '+ ₹';
    const amtStr = `${prefix}${tx.amount.toLocaleString('en-IN')}`;

    if (isReceived) {
      doc.setTextColor(22, 101, 52); // Green for receipt
    } else if (tx.type === 'RECEIVABLE') {
      doc.setTextColor(185, 28, 28); // Red for receivable
    } else {
      doc.setTextColor(30, 41, 59);
    }

    doc.text(amtStr, pageWidth - 16, currentY, { align: 'right' });

    currentY += 7;
  });

  // Summary box
  currentY += 6;
  if (currentY > 240) {
    doc.addPage();
    currentY = 20;
  }

  doc.setDrawColor(200, 200, 200);
  doc.line(14, currentY, pageWidth - 14, currentY);
  currentY += 6;

  doc.setFillColor(249, 250, 251);
  doc.rect(14, currentY, pageWidth - 28, 30, 'F');
  doc.rect(14, currentY, pageWidth - 28, 30, 'S');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(55, 65, 81);

  doc.text(`Total Given (Kul Diya):`, 18, currentY + 8);
  doc.setFont('helvetica', 'bold');
  doc.text(`Rs ${balance.totalGiven.toLocaleString('en-IN')}`, 80, currentY + 8);

  doc.setFont('helvetica', 'normal');
  doc.text(`Total Received (Kul Prapt):`, 18, currentY + 16);
  doc.setFont('helvetica', 'bold');
  doc.text(`Rs ${balance.totalReceived.toLocaleString('en-IN')}`, 80, currentY + 16);

  // Big Balance highlight
  doc.setFillColor(balance.balanceType === 'LENA_HAI' ? 254 : 240, balance.balanceType === 'LENA_HAI' ? 242 : 253, balance.balanceType === 'LENA_HAI' ? 242 : 244);
  doc.rect(120, currentY + 4, pageWidth - 138, 22, 'F');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('FINAL BALANCE (BAQI)', 124, currentY + 10);

  doc.setFontSize(13);
  if (balance.balanceType === 'LENA_HAI') {
    doc.setTextColor(185, 28, 28);
    doc.text(`Rs ${balance.netBalance.toLocaleString('en-IN')} LENA HAI`, 124, currentY + 18);
  } else if (balance.balanceType === 'DENA_HAI') {
    doc.setTextColor(217, 119, 6);
    doc.text(`Rs ${balance.netBalance.toLocaleString('en-IN')} DENA HAI`, 124, currentY + 18);
  } else {
    doc.setTextColor(22, 101, 52);
    doc.text(`Rs 0 (NILL / HISAAB CHUKTA)`, 124, currentY + 18);
  }

  // Footer note
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(156, 163, 175);
  doc.text(
    'Yani Digital Bahi-Khata "Hisab Kitab" dwara janchit aur pramanit. Bolkar hisaab rakho.',
    pageWidth / 2,
    285,
    { align: 'center' }
  );

  const pdfBlob = doc.output('blob');
  const blobUrl = URL.createObjectURL(pdfBlob);
  const safeName = person.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const filename = `Hisab_Kitab_${safeName}_Statement.pdf`;

  return { doc, blobUrl, filename };
}
