// Google Apps Script API for LOS Dashboard
// Paste this file into Google Sheet → Extensions → Apps Script → Code.gs
// Then deploy as Web App: Execute as Me, Who has access Anyone.

// Optional but recommended: paste your Google Sheet ID here.
// If this is left blank, the script will try to use the spreadsheet attached to this Apps Script project.
const SPREADSHEET_ID = "1Aad1I6a6bO8F_4Fn3IYwDOutd1dvGRvmeEQNMFlVCG8";
const SHEET_NAME = "LOS_Data";
const DRAWDOWN_SHEET_NAME = "DD_Data";
const DRAWDOWN_KEY_FIELD = "APPLICATION_NUMBER";

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
    const drawdownIds = getApplicationIdsFromSheet_(ss, DRAWDOWN_SHEET_NAME, DRAWDOWN_KEY_FIELD);
    const drawdownIdCount = Object.keys(drawdownIds).length;
    const sheet = getLosSheet_();
    const headers = ensureColumns_(sheet, [keyField].concat(columnsToUpdate));
    const applicationIdColumn = headers.indexOf(keyField) + 1;

    if (applicationIdColumn <= 0) {
      throw new Error(keyField + " column not found.");
    }

    let lastRow = sheet.getLastRow();
    let removedDrawdown = 0;
    let losRowsChecked = Math.max(lastRow - 1, 0);
    const matchedDrawdownExamples = [];

    if (lastRow >= 2) {
      const existingApplicationIds = sheet
        .getRange(2, applicationIdColumn, lastRow - 1, 1)
        .getDisplayValues()
        .flat()
        .map(value => normalizeApplicationId_(value));
      const rowsToDelete = [];

      existingApplicationIds.forEach((applicationId, index) => {
        if (drawdownIds[applicationId]) {
          rowsToDelete.push(index + 2);

          if (matchedDrawdownExamples.length < 5) {
            matchedDrawdownExamples.push(applicationId);
          }
        }
      });

      removedDrawdown = deleteRowsByNumber_(sheet, rowsToDelete);
      lastRow = sheet.getLastRow();
    }

    const idToRowNumber = {};

    if (lastRow >= 2) {
      const applicationIds = sheet
        .getRange(2, applicationIdColumn, lastRow - 1, 1)
        .getDisplayValues()
        .flat()
        .map(value => normalizeApplicationId_(value));

      applicationIds.forEach((id, index) => {
        if (id && id !== normalizeApplicationId_(keyField) && !(id in idToRowNumber)) {
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
      const normalizedApplicationId = normalizeApplicationId_(applicationId);

      if (!normalizedApplicationId || normalizedApplicationId === normalizeApplicationId_(keyField)) {
        skipped += 1;
        return;
      }

      if (drawdownIds[normalizedApplicationId]) {
        skippedDrawdown += 1;
        return;
      }

      let targetRow = idToRowNumber[normalizedApplicationId];

      if (!targetRow) {
        targetRow = sheet.getLastRow() + 1;
        idToRowNumber[normalizedApplicationId] = targetRow;
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
      removedDrawdown: removedDrawdown,
      drawdownIdCount: drawdownIdCount,
      losRowsChecked: losRowsChecked,
      matchedDrawdownExamples: matchedDrawdownExamples
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

function getApplicationIdsFromSheet_(ss, sheetName, sheetKeyField) {
  const sheet = ss.getSheetByName(sheetName);
  const applicationIds = {};

  if (!sheet || sheet.getLastRow() < 2) {
    return applicationIds;
  }

  const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1))
    .getDisplayValues()[0]
    .map(header => String(header).trim());
  const applicationIdColumn = headers.indexOf(sheetKeyField) + 1;

  if (applicationIdColumn <= 0) {
    throw new Error(sheetKeyField + " column not found in " + sheetName + " sheet.");
  }

  sheet
    .getRange(2, applicationIdColumn, sheet.getLastRow() - 1, 1)
    .getDisplayValues()
    .flat()
    .map(value => normalizeApplicationId_(value))
    .forEach(id => {
      if (id && id !== normalizeApplicationId_(sheetKeyField)) {
        applicationIds[id] = true;
      }
    });

  return applicationIds;
}

function normalizeApplicationId_(value) {
  return String(value || "")
    .replace(/[\s\u00A0\u200B-\u200D\uFEFF]/g, "")
    .toUpperCase();
}

function deleteRowsByNumber_(sheet, rowNumbers) {
  if (!rowNumbers.length) {
    return 0;
  }

  const sortedRows = rowNumbers.slice().sort((a, b) => b - a);
  let deleted = 0;
  let rangeStart = sortedRows[0];
  let rangeLength = 1;

  for (let index = 1; index < sortedRows.length; index += 1) {
    const rowNumber = sortedRows[index];

    if (rowNumber === rangeStart - rangeLength) {
      rangeLength += 1;
    } else {
      sheet.deleteRows(rangeStart - rangeLength + 1, rangeLength);
      deleted += rangeLength;
      rangeStart = rowNumber;
      rangeLength = 1;
    }
  }

  sheet.deleteRows(rangeStart - rangeLength + 1, rangeLength);
  deleted += rangeLength;

  return deleted;
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
