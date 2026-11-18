'use client';

import React from 'react';
import {
  Document,
  Image as PdfImage,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from '@react-pdf/renderer';
import {
  DEFAULT_PAYMENT_ACCOUNTS,
  formatTimestampDate,
  getPaymentMethodMeta,
  type Invoice,
  type PaymentAccountsSetting,
} from './types';

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#FFFFFF',
    paddingTop: 36,
    paddingBottom: 40,
    paddingHorizontal: 38,
    fontFamily: 'Helvetica',
    color: '#0F172A',
    fontSize: 10,
  },
  topAccentBar: {
    height: 6,
    backgroundColor: '#0B2447',
    marginBottom: 4,
    borderRadius: 3,
  },
  goldAccentBar: {
    height: 2,
    backgroundColor: '#D4941F',
    marginBottom: 22,
    borderRadius: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 22,
  },
  brandBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: '62%',
  },
  logoBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 4,
    backgroundColor: '#FFFFFF',
  },
  logoImg: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  companyName: {
    fontSize: 15,
    fontFamily: 'Helvetica-Bold',
    color: '#0B2447',
    letterSpacing: 0.2,
  },
  companyTagline: {
    fontSize: 8.5,
    color: '#1D6E8C',
    marginTop: 2,
  },
  invoiceTitleBlock: {
    alignItems: 'flex-end',
  },
  statementLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#1D6E8C',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  invoiceNumberText: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#0B2447',
    marginTop: 3,
  },
  paidBadge: {
    marginTop: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  paidBadgeText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#047857',
    letterSpacing: 0.8,
  },
  metaCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  metaCell: {
    width: '47%',
  },
  metaLabel: {
    fontSize: 8,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  metaValue: {
    fontSize: 10.5,
    fontFamily: 'Helvetica-Bold',
    color: '#0B2447',
  },
  tableContainer: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0B2447',
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  tableHeaderText: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 13,
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  colService: {
    width: '44%',
    paddingRight: 8,
  },
  colMethod: {
    width: '18%',
  },
  colTrx: {
    width: '20%',
  },
  colAmount: {
    width: '18%',
    textAlign: 'right',
  },
  serviceTitle: {
    fontSize: 10.5,
    fontFamily: 'Helvetica-Bold',
    color: '#0B2447',
  },
  serviceSub: {
    fontSize: 8.5,
    color: '#64748B',
    marginTop: 2,
  },
  cellText: {
    fontSize: 9.5,
    color: '#334155',
  },
  cellMono: {
    fontSize: 9,
    fontFamily: 'Courier-Bold',
    color: '#0F172A',
  },
  amountText: {
    fontSize: 10.5,
    fontFamily: 'Helvetica-Bold',
    color: '#0B2447',
    textAlign: 'right',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 26,
  },
  summaryLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#047857',
  },
  summarySub: {
    fontSize: 8,
    color: '#64748B',
    marginTop: 2,
  },
  summaryTotal: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#0B2447',
  },
  verificationSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 18,
    marginTop: 'auto',
  },
  verificationTextBlock: {
    maxWidth: '72%',
  },
  verificationTitle: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    color: '#0B2447',
  },
  verificationBody: {
    fontSize: 8.5,
    color: '#64748B',
    marginTop: 3,
    lineHeight: 1.4,
  },
  contactLine: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: '#1D6E8C',
    marginTop: 6,
  },
  sealBox: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 1,
    borderColor: '#D4941F',
    padding: 3,
    backgroundColor: '#FFFFFF',
  },
  sealImg: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
});

function formatPdfCurrency(amount: number): string {
  return `BDT ${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(amount)}`;
}

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(typeof reader.result === 'string' ? reader.result : null);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

interface InvoicePdfDocumentProps {
  invoice: Invoice;
  paymentAccounts: PaymentAccountsSetting;
  emblemDataUrl: string | null;
  sealDataUrl: string | null;
}

function InvoicePdfDocument({
  invoice,
  paymentAccounts,
  emblemDataUrl,
  sealDataUrl,
}: InvoicePdfDocumentProps) {
  const methodMeta = getPaymentMethodMeta(invoice.method);
  const issuedDate = formatTimestampDate(invoice.issuedAt);
  const formattedAmount = formatPdfCurrency(invoice.amount);

  return (
    <Document
      title={`${invoice.invoiceNumber} - Hasanah Tech Solutions`}
      author="Hasanah Tech Solutions"
      subject={`Billing Statement for ${invoice.serviceName}`}
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.topAccentBar} />
        <View style={styles.goldAccentBar} />

        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.brandBlock}>
            {emblemDataUrl && (
              <View style={styles.logoBox}>
                <PdfImage src={emblemDataUrl} style={styles.logoImg} />
              </View>
            )}
            <View>
              <Text style={styles.companyName}>Hasanah Tech Solutions</Text>
              <Text style={styles.companyTagline}>Innovate · Empower · Transform</Text>
            </View>
          </View>

          <View style={styles.invoiceTitleBlock}>
            <Text style={styles.statementLabel}>Billing Statement</Text>
            <Text style={styles.invoiceNumberText}>{invoice.invoiceNumber}</Text>
            <View style={styles.paidBadge}>
              <Text style={styles.paidBadgeText}>PAID · VERIFIED</Text>
            </View>
          </View>
        </View>

        {/* Client & Invoice Metadata */}
        <View style={styles.metaCard}>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Billed To</Text>
            <Text style={styles.metaValue}>{invoice.clientName}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Issued Date</Text>
            <Text style={styles.metaValue}>{issuedDate}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Payment Channel</Text>
            <Text style={styles.metaValue}>{methodMeta.name}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Transaction Reference</Text>
            <Text style={styles.metaValue}>{invoice.trxId}</Text>
          </View>
        </View>

        {/* Line Item Table */}
        <View style={styles.tableContainer}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.colService]}>Service Description</Text>
            <Text style={[styles.tableHeaderText, styles.colMethod]}>Method</Text>
            <Text style={[styles.tableHeaderText, styles.colTrx]}>TrxID</Text>
            <Text style={[styles.tableHeaderText, styles.colAmount]}>Amount</Text>
          </View>
          <View style={styles.tableRow}>
            <View style={styles.colService}>
              <Text style={styles.serviceTitle}>{invoice.serviceName}</Text>
              <Text style={styles.serviceSub}>Subscription &amp; Managed Service Billing</Text>
            </View>
            <Text style={[styles.cellText, styles.colMethod]}>{methodMeta.name}</Text>
            <Text style={[styles.cellMono, styles.colTrx]}>{invoice.trxId}</Text>
            <Text style={[styles.amountText, styles.colAmount]}>{formattedAmount}</Text>
          </View>
        </View>

        {/* Total Summary */}
        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.summaryLabel}>Total Amount Settled</Text>
            <Text style={styles.summarySub}>
              Cleared via {methodMeta.name} · Reference {invoice.trxId}
            </Text>
          </View>
          <Text style={styles.summaryTotal}>{formattedAmount}</Text>
        </View>

        {/* Verification & Official Seal */}
        <View style={styles.verificationSection}>
          <View style={styles.verificationTextBlock}>
            <Text style={styles.verificationTitle}>
              Verified Electronically by Hasanah Tech Solutions
            </Text>
            <Text style={styles.verificationBody}>
              This computer-generated billing statement confirms receipt of your payment. Keep a
              copy for your accounting and tax records.
            </Text>
            <Text style={styles.contactLine}>
              {paymentAccounts.supportPhone} · {paymentAccounts.supportEmail} ·{' '}
              {paymentAccounts.website}
            </Text>
          </View>

          {sealDataUrl && (
            <View style={styles.sealBox}>
              <PdfImage src={sealDataUrl} style={styles.sealImg} />
            </View>
          )}
        </View>
      </Page>
    </Document>
  );
}

export async function downloadInvoicePdf(
  invoice: Invoice,
  paymentAccounts: PaymentAccountsSetting = DEFAULT_PAYMENT_ACCOUNTS
): Promise<void> {
  const [emblemDataUrl, sealDataUrl] = await Promise.all([
    fetchImageAsDataUrl('/assets/aistudio/hasanah_logo_main_694d71ec.png'),
    fetchImageAsDataUrl('/assets/aistudio/hasanah-logo_2c1c7ceb.png'),
  ]);

  const blob = await pdf(
    <InvoicePdfDocument
      invoice={invoice}
      paymentAccounts={paymentAccounts}
      emblemDataUrl={emblemDataUrl}
      sealDataUrl={sealDataUrl}
    />
  ).toBlob();

  const safeClient = invoice.clientName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  const fileName = safeClient
    ? `${invoice.invoiceNumber}-${safeClient}.pdf`
    : `${invoice.invoiceNumber}.pdf`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1500);
}
