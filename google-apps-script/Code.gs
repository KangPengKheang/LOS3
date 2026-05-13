// Google Apps Script API for LOS Dashboard
// Paste this file into Google Sheet → Extensions → Apps Script → Code.gs
// Then deploy as Web App: Execute as Me, Who has access Anyone.

// Optional but recommended: paste your Google Sheet ID here.
// If this is left blank, the script will try to use the spreadsheet attached to this Apps Script project.
const SPREADSHEET_ID = "";
const SHEET_NAME = "LOS_Data";

const REMARK_COLUMNS = [
  "FOLLOW_UP_REMARK",
  "REMARK_UPDATED_BY",
  "REMARK_UPDATED_AT"
];

function doGet(e) {
  try {
    const sheet = getLosSheet_();
    const data = getSheetData_(sheet);

    return jsonOutput({
      success: true,
      count: data.length,
      data: data
    });
  } catch (err) {
    return jsonOutput({
      success: false,
      message: String(err)
    });
  }
}

function doPost(e) {
  try {
    const payload = parsePayload_(e);

    if (payload.action !== "saveRemark") {
      return jsonOutput({
        success: false,
        message: "Invalid action. Expected saveRemark."
      });
    }

    if (!payload.applicationId) {
      return jsonOutput({
        success: false,
        message: "Missing applicationId."
      });
    }

    const sheet = getLosSheet_();
    const headers = ensureRemarkColumns_(sheet);
    const applicationIdColumn = headers.indexOf("APPLICATION_NUMBER_ID") + 1;

    if (applicationIdColumn <= 0) {
      throw new Error("APPLICATION_NUMBER_ID column not found.");
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      throw new Error("No LOS data rows found.");
    }

    const applicationIds = sheet
      .getRange(2, applicationIdColumn, lastRow - 1, 1)
      .getDisplayValues()
      .flat()
      .map(value => String(value).trim());

    const rowOffset = applicationIds.findIndex(id => id === String(payload.applicationId).trim());

    if (rowOffset === -1) {
      return jsonOutput({
        success: false,
        message: "Application ID not found: " + payload.applicationId
      });
    }

    const targetRow = rowOffset + 2;
    setCellByHeader_(sheet, headers, targetRow, "FOLLOW_UP_REMARK", payload.remark || "");
    setCellByHeader_(sheet, headers, targetRow, "REMARK_UPDATED_BY", payload.updatedBy || Session.getActiveUser().getEmail() || "User");
    setCellByHeader_(sheet, headers, targetRow, "REMARK_UPDATED_AT", payload.updatedAt || new Date());

    return jsonOutput({
      success: true,
      message: "Remark saved successfully",
      applicationId: payload.applicationId
    });
  } catch (err) {
    return jsonOutput({
      success: false,
      message: String(err)
    });
  }
}

function getLosSheet_() {
  const ss = SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();

  if (!ss) {
    throw new Error("Spreadsheet not found. Set SPREADSHEET_ID in Code.gs.");
  }

  const sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    throw new Error("Sheet tab not found: " + SHEET_NAME);
  }

  return sheet;
}

function getSheetData_(sheet) {
  const values = sheet.getDataRange().getDisplayValues();

  if (!values || values.length < 2) {
    return [];
  }

  const headers = values[0].map(header => String(header).trim());

  return values.slice(1).map(row => {
    const item = {};

    headers.forEach((header, index) => {
      item[header] = row[index] || "";
    });

    return item;
  });
}

function ensureRemarkColumns_(sheet) {
  let headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1))
    .getDisplayValues()[0]
    .map(header => String(header).trim());

  REMARK_COLUMNS.forEach(columnName => {
    if (!headers.includes(columnName)) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(columnName);
      headers.push(columnName);
    }
  });

  return headers;
}

function setCellByHeader_(sheet, headers, rowNumber, headerName, value) {
  const columnIndex = headers.indexOf(headerName) + 1;

  if (columnIndex <= 0) {
    throw new Error("Column not found: " + headerName);
  }

  sheet.getRange(rowNumber, columnIndex).setValue(value);
}

function parsePayload_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return {};
  }

  try {
    return JSON.parse(e.postData.contents);
  } catch (err) {
    throw new Error("Invalid JSON body: " + err);
  }
}

function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
