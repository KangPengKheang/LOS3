import React, { useEffect, useMemo, useState } from 'react';
import { Clock, MessageCircle, UserRound, X } from 'lucide-react';
import StatusBadge from './StatusBadge.jsx';
import { formatCurrency } from '../utils/format.js';
import { formatDateTime, getLosDays } from '../utils/dateUtils.js';
import { getRemarkText, hasRemark } from '../utils/remarks.js';

const MAX_REMARK_LENGTH = 2000;

function DetailItem({ label, children }) {
  return (
    <div className="modal-detail-item">
      <span>{label}</span>
      <strong>{children || '-'}</strong>
    </div>
  );
}

export default function RemarkModal({ row, saving, onClose, onSave }) {
  const existingRemark = useMemo(() => getRemarkText(row), [row]);
  const alreadyRemarked = hasRemark(row);
  const [remark, setRemark] = useState(existingRemark);

  useEffect(() => {
    setRemark(existingRemark);
  }, [existingRemark, row?.APPLICATION_NUMBER_ID]);

  if (!row) return null;

  const title = alreadyRemarked
    ? 'Case Details & Edit Follow-up Remark'
    : 'Case Details & Add Follow-up Remark';

  const saveLabel = alreadyRemarked ? 'Save Changes' : 'Save Remark';

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="remark-modal-title">
      <div className="remark-modal">
        <div className="modal-title-row">
          <div className="modal-title-wrap">
            <h3 id="remark-modal-title">{title}</h3>
            {alreadyRemarked ? (
              <span className="modal-remarked-chip">
                <MessageCircle size={15} /> Remarked
              </span>
            ) : null}
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close modal">
            <X size={22} />
          </button>
        </div>

        <div className="case-info-block">
          <h4>Case Information</h4>
          <div className="modal-detail-grid">
            <DetailItem label="Application ID">{row.APPLICATION_NUMBER_ID}</DetailItem>
            <DetailItem label="Customer"><span className="modal-link-text">{row.CUSTOMER_NAME}</span></DetailItem>
            <DetailItem label="Branch">{row.BRANCH_NAME}</DetailItem>
            <DetailItem label="RM">{row.RM_NAME}</DetailItem>
            <DetailItem label="Product">{row.PRODUCTS}</DetailItem>
            <DetailItem label="Request Amount">{formatCurrency(row.TOTAL_NEW_REQUEST_AMOUNT)}</DetailItem>
            <DetailItem label="Status"><StatusBadge status={row.STATUS} /></DetailItem>
            <DetailItem label="Current Step">{row.COMMENT_FROM_APPROVER || row.STATUS}</DetailItem>
            <DetailItem label="LOS Days">{getLosDays(row)} days</DetailItem>
          </div>
        </div>

        <div className="followup-header">
          <h4>Follow-up Remark</h4>
          {!alreadyRemarked ? (
            <span className="empty-remark-note">No remark added yet.</span>
          ) : null}
        </div>

        <textarea
          className="remark-textarea"
          value={remark}
          maxLength={MAX_REMARK_LENGTH}
          placeholder="Enter follow-up result, discussion summary, next action, owner, or due date..."
          onChange={(e) => setRemark(e.target.value)}
          autoFocus
        />

        <div className="remark-meta-row">
          <span>{remark.length} / {MAX_REMARK_LENGTH}</span>
          {alreadyRemarked ? (
            <div className="remark-metadata">
              <span><UserRound size={15} /> Last updated by: {row.REMARK_UPDATED_BY || row.LAST_REMARK_BY || '-'}</span>
              <span><Clock size={15} /> Last updated: {formatDateTime(row.REMARK_UPDATED_AT || row.LAST_REMARK_AT)}</span>
            </div>
          ) : null}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => onSave(row, remark.trim())}
            disabled={saving}
          >
            {saving ? 'Saving...' : saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
