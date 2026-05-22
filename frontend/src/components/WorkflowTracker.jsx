import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { getLosDays } from '../utils/dateUtils.js';
import { statusMatches } from '../utils/statusUtils.js';

const FLOW_STEPS = [
  {
    id: 'draft',
    label: 'Draft',
    fullName: 'Draft',
    description: 'Application created and submitted by the Relationship Manager. Awaiting first-level review before entering the approval pipeline.',
    color: '#6366f1',
    softColor: '#eef2ff',
    statuses: ['Draft', 'RM Submission'],
  },
  {
    id: 'dbm',
    label: 'DBM Review',
    fullName: 'Under Review From DBM',
    description: 'Deputy Branch Manager is conducting initial review of the application documents and supporting evidence.',
    color: '#0ea5e9',
    softColor: '#e0f2fe',
    statuses: ['DBM Review', 'Under Review From DBM'],
  },
  {
    id: 'bm',
    label: 'BM Review',
    fullName: 'Under Review From BM',
    description: 'Branch Manager reviewing application viability, completeness, and branch-level risk assessment.',
    color: '#1463d8',
    softColor: '#eaf2ff',
    statuses: ['BM Review', 'Under Review From BM'],
  },
  {
    id: 'rbm',
    label: 'RBM Review',
    fullName: 'Under Review From RBM',
    description: 'Regional Branch Manager conducting higher-level review for regional compliance and risk alignment.',
    color: '#7c3aed',
    softColor: '#f3e8ff',
    statuses: ['RBM Review', 'Under Review From RBM'],
  },
  {
    id: 'cmt',
    label: 'Credit Mgmt Team',
    fullName: 'Waiting Credit Management Team',
    description: 'Credit Management Team performing comprehensive credit assessment, scoring evaluation, and risk profiling.',
    color: '#0891b2',
    softColor: '#ecfeff',
    statuses: ['Credit Management Team', 'Waiting Credit Management Team', 'Credit Assessment', 'Credit Operation'],
  },
  {
    id: 'hcm',
    label: 'Head of Credit',
    fullName: 'Head of Credit Management Approval',
    description: 'Awaiting formal approval from Head of Credit Management following thorough credit committee review.',
    color: '#d97706',
    softColor: '#fffbeb',
    statuses: ['Head of Credit Management', 'Waiting Approve from Head of Credit Management', 'Approval Committee'],
  },
  {
    id: 'rd',
    label: 'Risk Director',
    fullName: 'Waiting Acknowledge from Risk Director',
    description: 'Pending risk acknowledgement from the Risk Director for enterprise-level risk sign-off.',
    color: '#dc2626',
    softColor: '#fff1f2',
    statuses: ['Risk Director', 'Waiting Acknowledge from Risk Director'],
  },
  {
    id: 'bd',
    label: 'Board Director',
    fullName: 'Waiting Approve from Board Director',
    description: 'Application pending formal approval from the Board Director prior to final executive endorsement.',
    color: '#9333ea',
    softColor: '#fdf4ff',
    statuses: ['Board Director', 'Waiting Approve from Board Director', 'Legal & Documentation'],
  },
  {
    id: 'gp',
    label: 'Group President',
    fullName: 'Waiting Approve from Group President',
    description: 'Final executive endorsement pending from the Group President. Disbursement preparation underway.',
    color: '#be185d',
    softColor: '#fdf2f8',
    statuses: ['Group President', 'Waiting Approve from Group President', 'Disbursement Preparation'],
  },
  {
    id: 'approved',
    label: 'Approved',
    fullName: 'Approved',
    description: 'Application fully approved across all authority levels. Drawdown completed and funds disbursed.',
    color: '#128143',
    softColor: '#e9f8ef',
    statuses: ['Approved', 'Drawdown'],
  },
];

const SPECIAL_STEPS = [
  {
    id: 'returned',
    label: 'Returned',
    fullName: 'Returned to RM',
    description: 'Application has been returned to the Relationship Manager for corrections, additional documents, or clarification before re-submission.',
    color: '#d97706',
    softColor: '#fffbeb',
    statuses: ['Returned', 'Returned to RM'],
  },
  {
    id: 'cancelled',
    label: 'Cancelled',
    fullName: 'Cancelled',
    description: 'Application was withdrawn or cancelled by the applicant or the bank before reaching final approval.',
    color: '#6b7280',
    softColor: '#f3f4f6',
    statuses: ['Cancelled', 'Cancel'],
  },
  {
    id: 'rejected',
    label: 'Rejected',
    fullName: 'Rejected',
    description: 'Application was formally declined after review. No further action is required unless resubmission is initiated.',
    color: '#dc2626',
    softColor: '#fff1f2',
    statuses: ['Rejected', 'Reject'],
  },
];

export default function WorkflowTracker({ cases, branches = [], globalBranch = 'All' }) {
  const [activeStepId, setActiveStepId] = useState(null);
  const [showSpecial, setShowSpecial] = useState(false);
  const [wfBranch, setWfBranch] = useState('All');

  // Global filter is strongest — force section filter to match it when set
  useEffect(() => {
    if (globalBranch !== 'All') {
      setWfBranch(globalBranch);
    } else if (wfBranch !== 'All' && !branches.includes(wfBranch)) {
      setWfBranch('All');
    }
  }, [globalBranch, branches]);

  const workflowCases = useMemo(() =>
    wfBranch === 'All' ? cases : cases.filter(r => r.BRANCH_NAME === wfBranch),
  [cases, wfBranch]);

  const stepData = useMemo(() => FLOW_STEPS.map(step => {
    const matchingCases = workflowCases.filter(row => {
      return statusMatches(row.STATUS, step.statuses);
    });
    return { ...step, cases: matchingCases, count: matchingCases.length };
  }), [workflowCases]);

  const totalActive = stepData.reduce((sum, s) => sum + s.count, 0);
  const stagesWithCases = stepData.filter(s => s.count > 0).length;

  const specialData = useMemo(() => SPECIAL_STEPS.map(step => {
    const matchingCases = workflowCases.filter(row => {
      return statusMatches(row.STATUS, step.statuses);
    });
    return { ...step, cases: matchingCases, count: matchingCases.length };
  }), [workflowCases]);

  const allSteps = useMemo(() => [...stepData, ...specialData], [stepData, specialData]);
  const activeStep = allSteps.find(step => step.id === activeStepId) || null;

  function handleStepClick(step) {
    setActiveStepId(prev => prev === step.id ? null : step.id);
  }

  return (
    <>
      <div className="workflow-panel">
        <div className="workflow-header">
          <div>
            <h3>LOS Approval Workflow</h3>
            <p>Live pipeline — click any stage to inspect cases in progress.</p>
          </div>
          <div className="workflow-meta">
            <div className="workflow-meta-chip">
              <span className="wf-dot-active" />
              <strong>{totalActive}</strong> active cases across <strong>{stagesWithCases}</strong> stages
            </div>
            <select
              className="select-input wf-branch-select"
              value={wfBranch}
              onChange={e => setWfBranch(e.target.value)}
              disabled={globalBranch !== 'All'}
              aria-label="Filter workflow by branch"
            >
              <option value="All">Branch: All</option>
              {branches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <div className="workflow-legend">
              <span className="wf-legend-item"><span className="wf-dot-active" /> Active</span>
              <span className="wf-legend-item"><span className="wf-dot-idle" /> No cases</span>
            </div>
          </div>
        </div>

        <div className="workflow-track">
          {stepData.map((step, index) => (
            <React.Fragment key={step.id}>
              <div
                className={`wf-step${step.count > 0 ? ' wf-has-cases' : ''}${activeStepId === step.id ? ' wf-hovered' : ''}`}
                style={{ '--sc': step.color, '--ss': step.softColor }}
                onClick={() => handleStepClick(step)}
                role="button"
                tabIndex={0}
                aria-label={`${step.label}: ${step.count} cases`}
                onKeyDown={e => e.key === 'Enter' && handleStepClick(step)}
              >
                <div className="wf-step-num">{index + 1}</div>
                <div className="wf-step-label">{step.label}</div>
                {step.count > 0 && <div className="wf-step-count">{step.count}</div>}
              </div>

              {index < stepData.length - 1 && (
                <div className="wf-connector">
                  <svg width="28" height="12" viewBox="0 0 28 12" fill="none" aria-hidden="true">
                    <path
                      d="M0 6H22M18 1.5L25.5 6L18 10.5"
                      stroke={stepData[index].count > 0 && stepData[index + 1].count > 0 ? '#1463d8' : '#c5d3e8'}
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Special cases toggle */}
        <div className="wf-special-toggle" onClick={() => setShowSpecial(prev => !prev)} role="button" tabIndex={0} aria-expanded={showSpecial} onKeyDown={e => e.key === 'Enter' && setShowSpecial(prev => !prev)}>
          <span>Special Cases</span>
          <svg className={`wf-chevron${showSpecial ? ' wf-chevron-open' : ''}`} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>

        {showSpecial && (
          <div className="wf-special-track">
            {specialData.map(step => (
              <div
                key={step.id}
                className={`wf-step wf-special-step${step.count > 0 ? ' wf-has-cases' : ''}${activeStepId === step.id ? ' wf-hovered' : ''}`}
                style={{ '--sc': step.color, '--ss': step.softColor }}
                onClick={() => handleStepClick(step)}
                role="button"
                tabIndex={0}
                aria-label={`${step.label}: ${step.count} cases`}
                onKeyDown={e => e.key === 'Enter' && handleStepClick(step)}
              >
                <div className="wf-step-label">{step.label}</div>
                {step.count > 0 && <div className="wf-step-count">{step.count}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {activeStep && (
        <>
          <div className="wf-overlay" onClick={() => setActiveStepId(null)} />
          <div
            className="wf-popup"
            role="dialog"
            aria-modal="true"
            aria-label={`${activeStep.label} details`}
          >
            <div className="wf-popup-head" style={{ background: activeStep.softColor }}>
              <div className="wf-popup-title-row">
                <div className="wf-popup-icon" style={{ background: activeStep.color }}>
                  <span>{activeStep.count}</span>
                </div>
                <div>
                  <h4 style={{ color: activeStep.color }}>{activeStep.label}</h4>
                  <p>{activeStep.fullName}</p>
                </div>
              </div>
              <button className="wf-close-btn" onClick={() => setActiveStepId(null)} aria-label="Close">
                <X size={17} />
              </button>
            </div>

            <div className="wf-popup-body">
              <p className="wf-popup-desc">{activeStep.description}</p>

              {activeStep.cases.length > 0 ? (
                <div className="wf-case-list">
                  <div className="wf-case-list-head">
                    {activeStep.cases.length} case{activeStep.cases.length !== 1 ? 's' : ''} at this stage
                  </div>
                  {activeStep.cases.map(row => (
                    <div key={row.APPLICATION_NUMBER_ID} className="wf-case-row">
                      <div className="wf-case-left">
                        <strong>{row.CUSTOMER_NAME || '-'}</strong>
                        <span className="wf-case-id">{row.APPLICATION_NUMBER_ID}</span>
                      </div>
                      <div className="wf-case-right">
                        <span className="wf-case-meta-tag">{row.BRANCH_NAME || '-'}</span>
                        <span className="wf-case-meta-tag">{row.PRODUCTS || '-'}</span>
                        <span
                          className="wf-los-pill"
                          style={{ background: activeStep.softColor, color: activeStep.color }}
                        >
                          {getLosDays(row)}d LOS
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="wf-popup-empty">No cases currently at this stage.</div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
