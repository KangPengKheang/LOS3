# Google Apps Script Setup

1. Open the Google Sheet that contains the LOS data.
2. Make sure the sheet tab name is `LOS_Data`.
3. Go to Extensions > Apps Script.
4. Replace Code.gs with the provided Code.gs.
5. Save.
6. Deploy > New deployment > Web app.
7. Set:
   - Execute as: Me
   - Who has access: Anyone
8. Copy the Web App URL and paste it into `frontend/.env` as `VITE_SHEET_API_URL`.
