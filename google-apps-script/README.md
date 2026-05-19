# Google Apps Script Setup

1. Open the Google Sheet that contains the LOS data.
2. Make sure the main sheet tab name is `LOS_Data`.
3. Add a second sheet tab named `DD` with an `APPLICATION_NUMBER` column for cases that already drawdown.
4. Go to Extensions > Apps Script.
5. Replace Code.gs with the provided Code.gs.
6. Save.
7. Deploy > New deployment > Web app.
8. Set:
   - Execute as: Me
   - Who has access: Anyone
9. Copy the Web App URL and paste it into `frontend/.env` as `VITE_SHEET_API_URL`.
