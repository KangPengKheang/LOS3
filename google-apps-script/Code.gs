// Google Apps Script API for LOS Dashboard
// Paste this file into Google Sheet → Extensions → Apps Script → Code.gs
// Then deploy as Web App: Execute as Me, Who has access Anyone.

// Optional but recommended: paste your Google Sheet ID here.
// If this is left blank, the script will try to use the spreadsheet attached to this Apps Script project.
const SPREADSHEET_ID = "";
const SHEET_NAME = "LOS_Data";
const DRAWDOWN_SHEET_NAME = "DD";

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

    if (payload.action === "saveRemark") {
      return handleSaveRemark_(payload);
    }

    if (payload.action === "syncRows") {
      return handleSyncRows_(payload);
    }

    return jsonOutput({
      success: false,
      message: "Invalid action. Expected saveRemark or syncRows."
    });
  } catch (err) {
    return jsonOutput({
      success: false,
      message: String(err)
    });
  }
}

function handleSaveRemark_(payload) {
  try {
    if (!payload.applicationId) {
      return jsonOutput({
        success: false,
        message: "Missing applicationId."
      });
    }

    const sheet = getLosSheet_();
    const headers = ensureColumns_(sheet, REMARK_COLUMNS);
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

function handleSyncRows_(payload) {
  try {
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    const keyField = payload.keyField || "APPLICATION_NUMBER_ID";
    const columnsToUpdate = Array.isArray(payload.columnsToUpdate) ? payload.columnsToUpdate : [];

    if (!rows.length) {
      return jsonOutput({
        success: false,
        message: "No rows supplied."
      });
    }

    if (!columnsToUpdate.length) {
      return jsonOutput({
        success: false,
        message: "No columnsToUpdate supplied."
      });
    }

    const ss = getSpreadsheet_();
    const drawdownIds = getApplicationIdsFromSheet_(ss, DRAWDOWN_SHEET_NAME, keyField);
    const sheet = getLosSheet_();
    const headers = ensureColumns_(sheet, [keyField].concat(columnsToUpdate));
    const applicationIdColumn = headers.indexOf(keyField) + 1;

    if (applicationIdColumn <= 0) {
      throw new Error(keyField + " column not found.");
    }

    const idToRowNumber = {};
    let removedDrawdown = 0;

    for (let rowNumber = sheet.getLastRow(); rowNumber >= 2; rowNumber -= 1) {
      const applicationId = String(sheet.getRange(rowNumber, applicationIdColumn).getDisplayValue()).trim();

      if (drawdownIds[applicationId]) {
        sheet.deleteRow(rowNumber);
        removedDrawdown += 1;
      }
    }

    const lastRow = sheet.getLastRow();

    if (lastRow >= 2) {
      const applicationIds = sheet
        .getRange(2, applicationIdColumn, lastRow - 1, 1)
        .getDisplayValues()
        .flat()
        .map(value => String(value).trim());

      applicationIds.forEach((id, index) => {
        if (id && id !== keyField && !(id in idToRowNumber)) {
          idToRowNumber[id] = index + 2;
        }
      });
    }

    let updated = 0;
    let appended = 0;
    let skipped = 0;
    let skippedDrawdown = 0;

    rows.forEach(row => {
      const applicationId = String(row[keyField] || "").trim();

      if (!applicationId || applicationId === keyField) {
        skipped += 1;
        return;
      }

      if (drawdownIds[applicationId]) {
        skippedDrawdown += 1;
        return;
      }

      let targetRow = idToRowNumber[applicationId];

      if (!targetRow) {
        targetRow = sheet.getLastRow() + 1;
        idToRowNumber[applicationId] = targetRow;
        appended += 1;
      } else {
        updated += 1;
      }

      setCellByHeader_(sheet, headers, targetRow, keyField, applicationId);

      columnsToUpdate.forEach(columnName => {
        if (columnName !== keyField) {
          const value = Object.prototype.hasOwnProperty.call(row, columnName)
            ? row[columnName]
            : "";

          setCellByHeader_(sheet, headers, targetRow, columnName, value);
        }
      });
    });

    return jsonOutput({
      success: true,
      message: "Rows synced successfully",
      updated: updated,
      appended: appended,
      skipped: skipped,
      skippedDrawdown: skippedDrawdown,
      removedDrawdown: removedDrawdown
    });
  } catch (err) {
    return jsonOutput({
      success: false,
      message: String(err)
    });
  }
}

function getLosSheet_() {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    throw new Error("Sheet tab not found: " + SHEET_NAME);
  }

  return sheet;
}

function getSpreadsheet_() {
  const ss = SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();

  if (!ss) {
    throw new Error("Spreadsheet not found. Set SPREADSHEET_ID in Code.gs.");
  }

  return ss;
}

function getApplicationIdsFromSheet_(ss, sheetName, keyField) {
  const sheet = ss.getSheetByName(sheetName);
  const applicationIds = {};

  if (!sheet || sheet.getLastRow() < 2) {
    return applicationIds;
  }

  const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1))
    .getDisplayValues()[0]
    .map(header => String(header).trim());
  const applicationIdColumn = headers.indexOf(keyField) + 1;

  if (applicationIdColumn <= 0) {
    throw new Error(keyField + " column not found in " + sheetName + " sheet.");
  }

  sheet
    .getRange(2, applicationIdColumn, sheet.getLastRow() - 1, 1)
    .getDisplayValues()
    .flat()
    .map(value => String(value).trim())
    .forEach(id => {
      if (id && id !== keyField) {
        applicationIds[id] = true;
      }
    });

  return applicationIds;
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
  return ensureColumns_(sheet, REMARK_COLUMNS);
}

function ensureColumns_(sheet, requiredColumns) {
  let headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1))
    .getDisplayValues()[0]
    .map(header => String(header).trim());

  requiredColumns.forEach(columnName => {
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
