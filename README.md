# LOS Case Monitoring Dashboard

React + Vite dashboard using Google Sheet as the database through Google Apps Script Web App.

This version includes the follow-up remark workflow:

- Click customer name to open case details
- Add follow-up remark for unremarked cases
- Edit follow-up remark for already remarked cases
- Green `Remarked` indicator in the case table
- Save remarks back to Google Sheet through Apps Script `doPost`

## Local run

```bash
npm run setup
npm run dev
```

Open:

```text
http://localhost:5173
```

For Google Sheet data, create `frontend/.env` and add:

```env
VITE_SHEET_API_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

If the variable is blank, the dashboard uses built-in sample data.

## Vercel deployment

The project is configured to deploy from the root folder.

Recommended Vercel settings:

```text
Root Directory: ./
Install Command: cd frontend && npm install --no-audit --no-fund
Build Command: cd frontend && npm run build
Output Directory: frontend/dist
```

Also add this Vercel Environment Variable:

```env
VITE_SHEET_API_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

Then redeploy.

## Google Sheet

The main sheet tab must be named:

```text
LOS_Data
```

Add another sheet tab named:

```text
DD
```

The `DD` tab must include an `APPLICATION_NUMBER` column. During sync, any `LOS_Data.APPLICATION_NUMBER_ID` found in `DD.APPLICATION_NUMBER` is skipped and removed from `LOS_Data`, so the dashboard only shows cases that are not yet drawdown.

Paste `google-apps-script/Code.gs` into:

```text
Google Sheet → Extensions → Apps Script → Code.gs
```

Deploy as Web App:

```text
Execute as: Me
Who has access: Anyone
```

After changing Apps Script code, deploy a new version.
