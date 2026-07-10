import React, { useEffect, useState } from 'react';
import { formatPrice } from '@/services/sharePriceService';
import { getSystemSettings } from '@/services/settingsService';
import { generateQRCode, generateBarcode } from '@/services/pdfGenerationService';
import {
  getAgreementVerifyUrl,
  normalizeBrandingSettings,
} from '@/utils/pdfLetterhead';
import './AgreementDocument.css';

const AgreementDocument = ({
  shareholder,
  brandingSettings: brandingProp,
  showVerificationCodes = true,
  isSignedView = false,
  elementId = 'agreement-document',
}) => {
  const [branding, setBranding] = useState(brandingProp || null);
  const [qrCodeUrl, setQrCodeUrl] = useState(null);
  const [barcodeUrl, setBarcodeUrl] = useState(null);

  useEffect(() => {
    if (brandingProp) {
      setBranding(normalizeBrandingSettings(brandingProp));
      return;
    }
    getSystemSettings()
      .then((data) => setBranding(normalizeBrandingSettings(data || {})))
      .catch(() => setBranding(normalizeBrandingSettings({})));
  }, [brandingProp]);

  useEffect(() => {
    if (!shareholder?.id || !showVerificationCodes) return;
    const hasSigned = isSignedView || shareholder.agreement_signed_at
      || shareholder.signature || shareholder.signature_image_url;
    if (!hasSigned) return;

    const verifyUrl = getAgreementVerifyUrl(shareholder.id);
    generateQRCode(verifyUrl).then(setQrCodeUrl);

    const ref = shareholder.reference_number || shareholder.id?.slice(0, 8)?.toUpperCase();
    if (ref) setBarcodeUrl(generateBarcode(ref));
  }, [shareholder?.id, shareholder?.reference_number, shareholder?.agreement_signed_at, shareholder?.signature, shareholder?.signature_image_url, showVerificationCodes, isSignedView]);

  if (!shareholder) {
    return <div className="agreement-document">No shareholder data provided</div>;
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return 'N/A';
    }
  };

  const approvedShares = shareholder.shares_assigned || 0;
  const totalInvestment = shareholder.investment_amount || 0;
  const pricePerShare = approvedShares > 0 ? totalInvestment / approvedShares : 0;
  const b = branding || normalizeBrandingSettings({});
  const hasSignedAgreement = Boolean(
    isSignedView
    || shareholder.agreement_signed_at
    || shareholder.signature
    || shareholder.signature_image_url
  );
  const signatureSrc = shareholder.signature || shareholder.signature_image_url;

  return (
    <div className="agreement-document pdf-letterhead-document" id={elementId}>
      <div className="pdf-watermark" aria-hidden="true">
        <img src={b.logo_url} alt="" crossOrigin="anonymous" />
      </div>

      <div className="pdf-letterhead-content">
        <div className="pdf-letterhead-header">
          {b.pdf_header_url ? (
            <img
              src={b.pdf_header_url}
              alt="Document header"
              crossOrigin="anonymous"
              className="pdf-header-image"
            />
          ) : (
            <div className="pdf-header-fallback">
              <img src={b.logo_url} alt="Company logo" crossOrigin="anonymous" className="pdf-header-logo" />
              <div className="pdf-header-primary">{b.application_name}</div>
            </div>
          )}
        </div>

        <h2 className="agreement-title">SHAREHOLDER AGREEMENT</h2>

        <div className="agreement-section">
          <h3>Investor Details</h3>
          <div className="details-grid">
            <div className="detail-item">
              <span className="detail-label">Full Name:</span>
              <span className="detail-value">{shareholder.full_name || 'N/A'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Email Address:</span>
              <span className="detail-value">{shareholder.email || 'N/A'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Phone Number:</span>
              <span className="detail-value">{shareholder.full_phone_number || 'N/A'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Country:</span>
              <span className="detail-value">{shareholder.country_code || 'N/A'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Address:</span>
              <span className="detail-value">{shareholder.address || 'N/A'}</span>
            </div>
            {shareholder.reference_number ? (
              <div className="detail-item">
                <span className="detail-label">Reference:</span>
                <span className="detail-value">{shareholder.reference_number}</span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="agreement-section">
          <h3>Investment Details</h3>
          <div className="investment-grid">
            <div className="investment-item">
              <span className="investment-label">Approved Shares</span>
              <span className="investment-value">{approvedShares}</span>
            </div>
            <div className="investment-item">
              <span className="investment-label">Share Price</span>
              <span className="investment-value">{formatPrice(pricePerShare)}</span>
            </div>
            <div className="investment-item">
              <span className="investment-label">Total Investment</span>
              <span className="investment-value">{formatPrice(totalInvestment)}</span>
            </div>
            <div className="investment-item">
              <span className="investment-label">Payment Status</span>
              <span className="investment-value status-badge">
                {shareholder.payment_status || 'pending'}
              </span>
            </div>
          </div>
        </div>

        <div className="agreement-section">
          <h3>Terms &amp; Conditions</h3>
          <div className="terms-list">
            {[
              ['About Alpha Bridge:', 'The Company is a technology solutions provider incorporated under the laws of Cameroon, specializing in software development, IT consulting, and digital transformation services.'],
              ['Share Price & Value:', 'The share price stated in this agreement represents the current valuation at the time of approval. The shareholder acknowledges that share values may fluctuate based on company performance and market conditions.'],
              ['Shareholder Rights:', 'The shareholder is entitled to voting rights proportional to their shareholding, access to annual financial statements, participation in shareholder meetings, and distribution of dividends as declared by the Board of Directors.'],
              ['Dividends:', 'Dividends will be distributed at the discretion of the Board of Directors based on company profitability and cash flow requirements. No guaranteed dividend schedule is implied.'],
              ['Share Transfers:', 'Shares may be transferred subject to approval by the Board of Directors and compliance with applicable securities laws. Existing shareholders maintain a right of first refusal on any proposed transfers.'],
              ['Confidentiality:', 'The shareholder agrees to maintain confidentiality regarding proprietary company information, trade secrets, and non-public financial data obtained through their shareholding position.'],
              ['Dispute Resolution:', 'Any disputes arising from this agreement shall be resolved through arbitration under the laws of Cameroon. Both parties agree to good faith negotiation before pursuing formal legal action.'],
              ['Agreement Termination:', 'This agreement remains in effect until shares are sold, transferred, or the company is dissolved. Termination does not relieve parties of obligations incurred during the agreement period.'],
            ].map(([title, body], index) => (
              <div className="term-item" key={title}>
                <span className="term-number">{index + 1}.</span>
                <div className="term-content">
                  <strong>{title}</strong> {body}
                </div>
              </div>
            ))}
          </div>
        </div>

        {(signatureSrc) && (
          <div className="agreement-section">
            <h3>Digital Signature</h3>
            <div className="signature-box">
              <p className="signature-label">Investor&apos;s Signature</p>
              <img
                src={signatureSrc}
                alt="Shareholder signature"
                className="signature-image"
                crossOrigin="anonymous"
              />
              <p className="signature-name">{shareholder.full_name}</p>
              <p className="signature-date">
                Signed on: {formatDate(shareholder.agreement_signed_at || shareholder.approved_at)}
              </p>
            </div>
          </div>
        )}

        <div className="agreement-section">
          <h3>Approval Information</h3>
          <div className="approval-grid">
            <div className="approval-item">
              <span className="approval-label">Approval Date</span>
              <span className="approval-value">{formatDate(shareholder.approved_at)}</span>
            </div>
            <div className="approval-item">
              <span className="approval-label">Status</span>
              <span className="approval-value status-approved">
                {shareholder.status === 'approved' ? '✓ APPROVED' : shareholder.status}
              </span>
            </div>
            <div className="approval-item">
              <span className="approval-label">Agreement Accepted</span>
              <span className="approval-value status-approved">
                {hasSignedAgreement ? '✓ Yes' : '✗ No'}
              </span>
            </div>
          </div>
        </div>

        {showVerificationCodes && hasSignedAgreement && (qrCodeUrl || barcodeUrl) && (
          <div className="pdf-verification-block pdf-before-footer">
            {barcodeUrl ? (
              <img src={barcodeUrl} alt="Reference barcode" className="pdf-barcode" />
            ) : null}
            {qrCodeUrl ? (
              <div className="pdf-qr-wrap">
                <img src={qrCodeUrl} alt="Verification QR Code" className="pdf-qr-code" />
                <p>Scan to view signed agreement</p>
              </div>
            ) : null}
          </div>
        )}

        <div className="pdf-letterhead-footer">
          {b.pdf_footer_url ? (
            <img
              src={b.pdf_footer_url}
              alt="Document footer"
              crossOrigin="anonymous"
              className="pdf-footer-image"
            />
          ) : (
            <div className="pdf-footer-fallback">{b.application_name}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgreementDocument;
