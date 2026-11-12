import { Invoice, Branch } from '@/types';
import { formatDate, formatDateTime } from './formatters';

export function generateReceiptHTML(
  invoice: Invoice,
  branch?: Branch | null,
  cashierName: string = 'Cashier'
): string {
  const storeName = branch?.name || 'FOAM SHOP POS';
  const branchAddress = branch?.address || 'Main Market, Karachi';
  const branchPhone = branch?.phone || '0300-1234567';
  const formattedDate = formatDateTime(invoice.date || invoice.createdAt || invoice.issueDate);
  const formattedDueDate = invoice.dueDate ? formatDate(invoice.dueDate) : '';

  const totalQty = (invoice.items || []).reduce((sum, item) => sum + (item.quantity || 1), 0);

  const itemsRows = (invoice.items || [])
    .map((item, idx) => {
      const lineTotal = item.lineTotal ?? item.total ?? ((item.unitPrice || 0) * (item.quantity || 1));
      const sizeInfo = item.sizeLabel ? ` [${item.sizeLabel}${item.thicknessLabel ? ` • ${item.thicknessLabel}` : ''}]` : '';
      const isLast = idx === (invoice.items || []).length - 1;
      return `
        <div style="margin-bottom: 3px;">
          <div style="font-weight: bold; font-size: 11.5px; color: #000;">
            <span>${idx + 1}.   ${item.productName}${sizeInfo}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11.5px; color: #000; margin-top: 1px; font-weight: bold;">
            <span style="padding-left: 18px;">${item.quantity} × Rs. ${(item.unitPrice || 0).toLocaleString()}</span>
            <span style="font-weight: bold;">Rs. ${lineTotal.toLocaleString()}</span>
          </div>
        </div>
        ${!isLast ? '<div style="border-top: 1px dotted #000; margin: 3px 0 4px 0;"></div>' : ''}
      `;
    })
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt - ${invoice.invoiceNumber}</title>
  <style>
    @page {
      size: 72mm auto;
      margin: 0mm !important;
      margin-top: 0mm !important;
      margin-bottom: 0mm !important;
    }
    @page :first {
      margin-top: 0mm !important;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      color: #000000 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html {
      margin: 0 !important;
      padding: 0 !important;
      background: #fff;
    }
    body {
      width: 72mm;
      max-width: 72mm;
      margin: 0 auto !important; 
      padding: 0 1mm 2mm 1mm !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #000;
      background: #fff;
      font-size: 12px;
      font-weight: 700;
      line-height: 1.35;
      -webkit-font-smoothing: antialiased;
      text-rendering: geometricPrecision;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-bold { font-weight: 600; }
    .divider {
      border-top: 1.5px dashed #000;
      margin: 5px 0;
    }
    .flex-between {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .flex-center {
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .urdu-text {
      font-family: 'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', 'Urdu Typesetting', Tahoma, sans-serif;
      direction: rtl;
      font-size: 11px;
      font-weight: bold;
      line-height: 1.5;
      text-align: center;
      margin-top: 2px;
      color: #000;
    }
  </style>
</head>
<body>
  <!-- Top Store Logo -->
  <!-- <div class="text-center" style="margin: 0 auto 3px auto; padding-top: 0;">
    <img 
      src="/assets/brands/brand-logo.png" 
      alt="Store Logo" 
      style="max-height: 55px; max-width: 140px; display: inline-block; object-fit: contain; filter: grayscale(100%) contrast(250%) brightness(85%); margin: 0 auto;"
    />
  </div> -->

  <!-- Header / Store Info -->
  <div class="text-center" style="padding-bottom: 2px;">
    <div style="font-size: 15px; font-weight: bold; letter-spacing: 0.5px; text-transform: uppercase;">
      ${storeName}
    </div>
    <div style="font-size: 11px; margin-top: 1px; font-weight: 600;">${branchAddress}</div>
    <div style="font-size: 11px; font-weight: 600;">Ph: ${branchPhone}</div>
  </div>

  <div class="divider"></div>

  <!-- Receipt Metadata -->
  <div class="text-center font-bold" style="font-size: 12px; letter-spacing: 1px; margin: 1px 0;">
    SALE RECEIPT
  </div>
  <div style="font-size: 11px; margin-top: 2px; font-weight: 600;">
    <div class="flex-center">
      <span>Invoice No: ${invoice.invoiceNumber}</span>
    </div>
    <div class="flex-center">
      <span>${formattedDate}</span>
    </div>
    <div class="flex-center">
      <span>Billed By: ${cashierName}</span>
    </div>
    <div class="flex-center">
      <span style="font-weight: bold;">${invoice.customerName || 'Walk-in'}</span>
    </div>
  </div>

  <div class="divider"></div>

  <!-- Table Header -->
  <div class="flex-between font-bold" style="font-size: 11px; padding: 1px 0;">
    <span>S#   Items</span>
    <span class="text-right">Amount</span>
  </div>

  <div class="divider"></div>

  <!-- Items List -->
  ${itemsRows}

  <div class="divider"></div>

  <!-- Total Items Count -->
  <div class="flex-between font-bold" style="font-size: 11px;">
    <span>Total Items:</span>
    <span style="font-weight: bold;">${totalQty}</span>
  </div>

  <div class="divider"></div>

  <!-- Financial Totals -->
  <div style="font-size: 11px; font-weight: 700;">
    <div class="flex-between">
      <span>Subtotal</span>
      <span style="font-weight: bold;">Rs. ${(invoice.grossAmount ?? invoice.subtotal ?? 0).toLocaleString()}</span>
    </div>

    ${(invoice.discountAmount || 0) > 0 ? `
    <div class="flex-between">
      <span>Discount</span>
      <span style="font-weight: bold;">- Rs. ${(invoice.discountAmount || 0).toLocaleString()}</span>
    </div>` : ''}

    ${(invoice.taxAmount || 0) > 0 ? `
    <div class="flex-between">
      <span>Tax</span>
      <span style="font-weight: bold;">Rs. ${(invoice.taxAmount || 0).toLocaleString()}</span>
    </div>` : ''}
  </div>

  <div class="divider"></div>

  <div class="flex-between font-bold" style="font-size: 11.5px;">
    <span>Grand Total</span>
    <span style="font-weight: 900;">Rs. ${(invoice.netAmount ?? invoice.grandTotal ?? 0).toLocaleString()}</span>
  </div>

  <div class="divider"></div>

  <!-- Payment Details -->
  <div style="font-size: 11px; font-weight: 700;">
    <!-- <div class="flex-between">
      <span>Receiving Amount</span>
      <span style="font-weight: bold;">Rs. ${(invoice.amountReceived ?? invoice.amountPaid ?? 0).toLocaleString()}</span>
    </div> -->
    <div class="flex-between">
      <span>Payment</span>
      <span style="font-weight: bold;">${invoice.paymentMethod || 'CASH'}</span>
    </div>

    ${(invoice.amountDue || 0) > 0 ? `
    <div class="flex-between font-bold" style="margin-top: 3px; padding-top: 2px; border-top: 1.5px dashed #000;">
      <span>Remaining Khata:</span>
      <span style="font-weight: bold;">Rs. ${(invoice.amountDue || 0).toLocaleString()}</span>
    </div>
    ${formattedDueDate ? `
    <div class="flex-between" style="font-size: 11px;">
      <span>Due Date:</span>
      <span>${formattedDueDate}</span>
    </div>` : ''}
    ` : ''}
  </div>

  <div class="divider"></div>

  <!-- Terms & Urdu Greeting -->
  <div class="text-center" style="margin-top: 3px;">
    <div class="font-bold" style="font-size: 11.5px;">Thank you for your business!</div>
    <div class="urdu-text">
      خریدے ہوئے سامان کی واپسی کی مدت 7 دن ہے۔
    </div>
  </div>

  <div class="divider"></div>

  <!-- Software Credit Branding (Matching Image 2) -->
  <div class="text-center" style="font-size: 11px; color: #000; margin-top: 3px; font-weight: 700;">
    <div style="font-weight: 600;">Software by Synoxify Solutions</div>
    <div>www.synoxify.com | 0311-8449006</div>
  </div>
</body>
</html>
`;
}

export function printThermalReceipt(
  invoice: Invoice,
  branch?: Branch | null,
  cashierName: string = 'Cashier'
): void {
  if (typeof window === 'undefined') return;

  // Use a dedicated invisible print iframe so the main UI is completely unpolluted
  let iframe = document.getElementById('thermal-print-iframe') as HTMLIFrameElement | null;
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'thermal-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);
  }

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    window.print();
    return;
  }

  const html = generateReceiptHTML(invoice, branch, cashierName);
  doc.open();
  doc.write(html);
  doc.close();

  const triggerPrint = () => {
    try {
      iframe?.contentWindow?.focus();
      iframe?.contentWindow?.print();
    } catch (e) {
      console.warn('Iframe print failed, falling back to window.print:', e);
      window.print();
    }
  };

  // Wait for logo image to load completely before invoking print
  const images = doc.images ? Array.from(doc.images) : [];
  if (images.length === 0) {
    setTimeout(triggerPrint, 50);
  } else {
    let completedCount = 0;
    const checkAllComplete = () => {
      completedCount++;
      if (completedCount >= images.length) {
        setTimeout(triggerPrint, 50);
      }
    };

    images.forEach((img) => {
      if (img.complete) {
        checkAllComplete();
      } else {
        img.onload = checkAllComplete;
        img.onerror = checkAllComplete;
      }
    });

    // Fallback timer to prevent getting stuck if image fails to fire event
    setTimeout(triggerPrint, 400);
  }
}
