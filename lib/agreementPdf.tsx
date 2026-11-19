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
  type PaymentAccountsSetting,
  type Subscription,
  type UserProfile,
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
    marginBottom: 20,
    borderRadius: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  brandBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: '64%',
  },
  logoBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  logoImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  companyName: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#0B2447',
  },
  companySub: {
    fontSize: 8.5,
    color: '#475569',
    marginTop: 2,
  },
  docBadgeBlock: {
    alignItems: 'flex-end',
  },
  docTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#0B2447',
    letterSpacing: 0.6,
  },
  docMeta: {
    fontSize: 8.5,
    color: '#64748B',
    marginTop: 3,
  },
  metaBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  metaCol: {
    width: '48%',
  },
  metaLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  metaValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#0B2447',
  },
  metaSub: {
    fontSize: 8.5,
    color: '#475569',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    color: '#1D6E8C',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 8,
  },
  contentBox: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#FFFFFF',
    marginBottom: 14,
  },
  bodyText: {
    fontSize: 9.5,
    lineHeight: 1.55,
    color: '#1E293B',
  },
  footer: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  footerNote: {
    fontSize: 8,
    color: '#64748B',
    maxWidth: '62%',
    lineHeight: 1.4,
  },
  sigBlock: {
    alignItems: 'flex-end',
  },
  sigLine: {
    width: 130,
    borderTopWidth: 1,
    borderTopColor: '#0B2447',
    marginBottom: 4,
  },
  sigLabel: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: '#0B2447',
  },
});

function formatPdfBdt(amount: number): string {
  return `BDT ${Number(amount || 0).toLocaleString('en-US')}`;
}

export async function downloadAgreementPdf(
  sub: Subscription,
  userProfile: UserProfile,
  paymentAccounts: PaymentAccountsSetting = DEFAULT_PAYMENT_ACCOUNTS
): Promise<void> {
  const logoUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/hasanah%20logo%20with%20back.png`
      : '';

  const detailsBody = sub.details?.trim()
    ? sub.details.trim()
    : 'Service delivered and maintained by Hasanah Tech Solutions according to the active subscription plan.';

  const agreementBody = sub.agreementText?.trim()
    ? sub.agreementText.trim()
    : [
        `1. Service Scope: Hasanah Tech Solutions agrees to provide and maintain "${sub.serviceName}" for ${userProfile.companyName || userProfile.name}.`,
        `2. Billing & Renewal: The agreed fee is ${formatPdfBdt(sub.amount)} per ${sub.billingCycle} cycle, payable on or before the due date (${formatTimestampDate(sub.nextDueDate)}).`,
        '3. Payment Verification: All MFS and bank payments are verified against the submitted Transaction ID (TrxID), and an official digital invoice is issued upon approval.',
        `4. Support & Communication: Official technical and billing support is provided via ${paymentAccounts.supportPhone} and ${paymentAccounts.supportEmail}.`,
      ].join('\n\n');

  const docElement = (
    <Document title={`Service Agreement - ${sub.serviceName}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.topAccentBar} />
        <View style={styles.goldAccentBar} />

        <View style={styles.headerRow}>
          <View style={styles.brandBlock}>
            {logoUrl ? (
              <View style={styles.logoBox}>
                <PdfImage src={logoUrl} style={styles.logoImg} />
              </View>
            ) : null}
            <View>
              <Text style={styles.companyName}>Hasanah Tech Solutions</Text>
              <Text style={styles.companySub}>
                {paymentAccounts.website} · {paymentAccounts.supportPhone}
              </Text>
              <Text style={styles.companySub}>{paymentAccounts.supportEmail}</Text>
            </View>
          </View>

          <View style={styles.docBadgeBlock}>
            <Text style={styles.docTitle}>SERVICE AGREEMENT</Text>
            <Text style={styles.docMeta}>Ref: {sub.id}</Text>
            <Text style={styles.docMeta}>Status: {sub.status.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.metaBox}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Client Information</Text>
            <Text style={styles.metaValue}>{userProfile.name}</Text>
            <Text style={styles.metaSub}>{userProfile.companyName}</Text>
            {userProfile.clientCode ? (
              <Text style={styles.metaSub}>Client ID: {userProfile.clientCode}</Text>
            ) : null}
            <Text style={styles.metaSub}>
              {userProfile.phone} · {userProfile.email}
            </Text>
          </View>

          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Subscription Plan</Text>
            <Text style={styles.metaValue}>{sub.serviceName}</Text>
            <Text style={styles.metaSub}>
              Fee: {formatPdfBdt(sub.amount)} ({sub.billingCycle})
            </Text>
            <Text style={styles.metaSub}>
              Next Due Date: {formatTimestampDate(sub.nextDueDate)}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>1. Service Details & Deliverables</Text>
        <View style={styles.contentBox}>
          <Text style={styles.bodyText}>{detailsBody}</Text>
        </View>

        <Text style={styles.sectionTitle}>2. Terms & Service Agreement</Text>
        <View style={styles.contentBox}>
          <Text style={styles.bodyText}>{agreementBody}</Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerNote}>
            This is an electronically generated service agreement from HasanahPay Client Portal.
            For questions, contact {paymentAccounts.supportEmail}.
          </Text>
          <View style={styles.sigBlock}>
            <View style={styles.sigLine} />
            <Text style={styles.sigLabel}>Hasanah Tech Solutions</Text>
          </View>
        </View>
      </Page>
    </Document>
  );

  const blob = await pdf(docElement).toBlob();
  const url = URL.createObjectURL(blob);
  const safeName = sub.serviceName.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 40);
  const a = document.createElement('a');
  a.href = url;
  a.download = `HasanahPay_Agreement_${safeName}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
