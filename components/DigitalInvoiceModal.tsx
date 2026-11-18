'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, Download, Loader2, Printer, X } from 'lucide-react';
import {
  DEFAULT_PAYMENT_ACCOUNTS,
  formatBDT,
  formatTimestampDate,
  getPaymentMethodMeta,
  type Invoice,
  type PaymentAccountsSetting,
} from '@/lib/types';
import { BrandMark } from './BrandMark';
import { useToast } from './ToastProvider';

interface DigitalInvoiceModalProps {
  invoice: Invoice | null;
  onClose: () => void;
  paymentAccounts?: PaymentAccountsSetting;
}

export function DigitalInvoiceModal({
  invoice,
  onClose,
  paymentAccounts = DEFAULT_PAYMENT_ACCOUNTS,
}: DigitalInvoiceModalProps) {
  const { showToast } = useToast();
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    if (!invoice || downloadingPdf) return;
    setDownloadingPdf(true);
    try {
      const { downloadInvoicePdf } = await import('@/lib/invoicePdf');
      await downloadInvoicePdf(invoice, paymentAccounts);
      showToast(`Saved ${invoice.invoiceNumber}.pdf`, 'success');
    } catch (err) {
      console.error('PDF generation failed:', err);
      showToast('Could not generate PDF. Try Print instead.', 'error');
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <AnimatePresence>
      {invoice && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="invoice-modal-title"
        >
          <div className="no-print absolute inset-0" onClick={onClose} />

          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 28 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-[#0B162B] sm:rounded-3xl"
          >
            {/* Mobile Sheet Handle */}
            <div className="no-print flex justify-center pt-3 sm:hidden">
              <div className="h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
            </div>

            {/* Modal Top Controls */}
            <div className="no-print flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
              <span className="text-xs font-semibold tracking-wide text-[#1D6E8C] dark:text-[#38BDF8]">
                Official Digital Receipt
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close invoice"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Printable Invoice Body */}
            <div id="printable-invoice" className="relative p-5 sm:p-6">
              {/* Official PAID Stamp + Subtle Circular Corporate Seal */}
              <div className="pointer-events-none absolute right-5 top-14 flex flex-col items-end gap-1.5">
                <div className="rotate-[-10deg] rounded-xl border-2 border-emerald-600/80 bg-emerald-50/90 px-3 py-1 text-xs font-extrabold tracking-widest text-emerald-700 dark:border-emerald-400/70 dark:bg-emerald-950/70 dark:text-emerald-300">
                  PAID
                </div>
                <div className="h-14 w-14 overflow-hidden rounded-full border border-[#D4941F]/30 bg-white/90 p-0.5 opacity-85 shadow-xs">
                  <Image
                    src="/assets/aistudio/hasanah-logo_2c1c7ceb.png"
                    alt="Hasanah Tech Solutions Seal"
                    width={56}
                    height={56}
                    referrerPolicy="no-referrer"
                    className="h-full w-full rounded-full object-contain"
                  />
                </div>
              </div>

              {/* Agency Header */}
              <div className="flex items-start justify-between gap-3 pr-16">
                <div className="flex items-center gap-2.5">
                  <BrandMark size="md" />
                  <div>
                    <h2
                      id="invoice-modal-title"
                      className="text-base font-bold text-[#0B2447] dark:text-white"
                    >
                      Hasanah Tech Solutions
                    </h2>
                    <p className="text-[11px] font-medium text-[#1D6E8C] dark:text-[#38BDF8]">
                      Innovate · Empower · Transform
                    </p>
                  </div>
                </div>
              </div>

              {/* Invoice Metadata */}
              <div className="mt-6 grid grid-cols-2 gap-4 border-y border-slate-100 py-4 text-xs dark:border-slate-800">
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Invoice Number</p>
                  <p className="mt-1 font-mono-tabular font-semibold text-[#0B2447] dark:text-slate-100">
                    {invoice.invoiceNumber}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-slate-500 dark:text-slate-400">Issued Date</p>
                  <p className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                    {formatTimestampDate(invoice.issuedAt)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Billed To</p>
                  <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                    {invoice.clientName}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-slate-500 dark:text-slate-400">Payment Method</p>
                  <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">
                    {getPaymentMethodMeta(invoice.method).name}
                  </p>
                </div>
              </div>

              {/* Line Item */}
              <div className="mt-5 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#0B2447] dark:text-slate-100">
                      {invoice.serviceName}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      TrxID Reference:{' '}
                      <span className="font-mono-tabular font-semibold text-slate-700 dark:text-slate-200">
                        {invoice.trxId}
                      </span>
                    </p>
                  </div>
                  <p className="font-mono-tabular text-base font-bold text-[#0B2447] dark:text-white whitespace-nowrap shrink-0">
                    {formatBDT(invoice.amount)}
                  </p>
                </div>
              </div>

              {/* Total Paid Box */}
              <div className="mt-6 flex items-center justify-between rounded-2xl border border-[#0B2447]/10 bg-slate-50 px-4 py-3.5 dark:border-slate-700/60 dark:bg-slate-900/70">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Total Paid (BDT)</span>
                </div>
                <span className="font-mono-tabular text-xl font-bold text-[#0B2447] dark:text-[#E5A93B]">
                  {formatBDT(invoice.amount)}
                </span>
              </div>

              {/* Official Agency Footer */}
              <div className="mt-5 space-y-1 border-t border-slate-100 pt-3.5 text-center text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <p>
                  Verified electronically by <strong>Hasanah Tech Solutions</strong>
                </p>
                <p className="font-mono-tabular">
                  {paymentAccounts.supportPhone} · {paymentAccounts.supportEmail} ·{' '}
                  {paymentAccounts.website}
                </p>
              </div>
            </div>

            {/* Download & Print Action Footer */}
            <div className="no-print flex items-center gap-2.5 border-t border-slate-100 px-5 py-4 pb-safe dark:border-slate-800">
              <button
                type="button"
                disabled={downloadingPdf}
                onClick={handleDownloadPdf}
                className="flex h-12 flex-[1.6] items-center justify-center gap-2 rounded-xl bg-[#0B2447] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#13386B] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#1D6E8C] dark:hover:bg-[#2583A6]"
              >
                {downloadingPdf ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-[#E5A93B] dark:text-white" />
                    <span>Generating PDF...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 text-[#E5A93B] dark:text-white" />
                    <span>Download as PDF</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={downloadingPdf}
                onClick={() => window.print()}
                aria-label="Print billing statement"
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-[#0B2447] transition hover:bg-slate-100 active:scale-[0.98] disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Printer className="h-4 w-4" />
                <span>Print</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
