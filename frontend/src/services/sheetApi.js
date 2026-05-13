import { sampleCases } from '../data/sampleData.js';

const API_URL = import.meta.env.VITE_SHEET_API_URL || '';

function getSheetApiUrl() {
  const url = API_URL.trim();

  if (url.includes('script.googleusercontent.com/macros/echo')) {
    throw new Error(
      'VITE_SHEET_API_URL must be the Apps Script Web App URL ending in /exec, not the redirected googleusercontent.com/macros/echo URL.'
    );
  }

  return url;
}

export async function fetchLosCases() {
  const apiUrl = getSheetApiUrl();

  if (!apiUrl) {
    return { data: sampleCases, source: 'sample' };
  }

  const response = await fetch(apiUrl, {
    method: 'GET',
    redirect: 'follow',
  });

  if (!response.ok) throw new Error(`Google Sheet API error: ${response.status}`);

  const result = await response.json();
  if (result.success === false) throw new Error(result.message || 'Google Sheet API returned an error');

  const data = Array.isArray(result) ? result : result.data;
  if (!Array.isArray(data)) throw new Error('Invalid API response. Expected an array or { success, data }.');

  return { data, source: 'sheet' };
}

export async function saveCaseRemark({ applicationId, remark, updatedBy, updatedAt }) {
  const apiUrl = getSheetApiUrl();

  if (!apiUrl) {
    return { success: true, source: 'sample' };
  }

  const payload = {
    action: 'saveRemark',
    applicationId,
    remark,
    updatedBy,
    updatedAt,
  };

  const response = await fetch(apiUrl, {
    method: 'POST',
    redirect: 'follow',
    // Keep as text/plain to avoid browser preflight issues with Apps Script.
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw new Error(`Google Sheet save error: ${response.status}`);

  const result = await response.json();
  if (result.success === false) throw new Error(result.message || 'Could not save remark to Google Sheet');

  return result;
}
