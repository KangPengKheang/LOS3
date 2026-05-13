# LOS Workflow Case Monitoring Dashboard

React + Vite dashboard using Google Sheet as database through Google Apps Script Web App.

## Main changes

- No left sidebar.
- Workflow `STATUS` is treated as a process stage: RM Submission, BM Review, Credit Assessment, Credit Operation, Approval Committee, Legal & Documentation, Disbursement Preparation, Drawdown, Returned to RM, Rejected, Cancelled.
- Table includes two day columns:
  - `Process Days`: days in the current process/stage. The app checks `CURRENT_STEP_START_DATE`, `PROCESS_START_DATE`, or `STATUS_START_DATE`. If none exists, it falls back to overall LOS days.
  - `LOS Days`: total days from `APPLICATION_DATE` to `APPROVED_DATE` for Drawdown/completed cases, otherwise from `APPLICATION_DATE` to `REPORT_DATE` or today.

## Local run

```bash
npm run setup
npm run dev
```

Open:

```text
http://localhost:5173
```

## Google Sheet API

Create `frontend/.env` from `frontend/.env.example` and paste your Apps Script Web App URL:

```env
VITE_SHEET_API_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

If this is blank, the app uses built-in sample workflow data.

## Vercel deployment

Add the environment variable in Vercel:

```env
VITE_SHEET_API_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

This ZIP already includes root `vercel.json`.

## Google Sheet tab

Main tab name must be:

```text
LOS_Data
```

Header row should use your LOS column names. Optional columns for better process day calculation:

```text
CURRENT_STEP_START_DATE
PROCESS_START_DATE
STATUS_START_DATE
```
