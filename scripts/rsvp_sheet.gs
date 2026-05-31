/**
 * Amaziah & Santana Wedding — RSVP Google Apps Script
 *
 * SETUP (one-time):
 *  1. Go to script.google.com → New project → paste this code.
 *  2. Create a new Google Sheet. Copy its ID from the URL:
 *     https://docs.google.com/spreadsheets/d/  >>>SHEET_ID<<<  /edit
 *  3. Paste that ID into SHEET_ID below.
 *  4. Click Deploy → New deployment → Web app.
 *     Execute as: Me   |   Who has access: Anyone
 *  5. Authorize when prompted.
 *  6. Copy the Web App URL and paste it into app.js → CONFIG.GSHEET_ENDPOINT
 *
 * Each RSVP submission:
 *  • Upserts the guest row in the "RSVPs" sheet (one row per guest name).
 *  • Emails the full formatted guest list to EMAIL_TO.
 */

const SHEET_ID = 'YOUR_GOOGLE_SHEET_ID_HERE';
const EMAIL_TO = 'ayandsh2026@gmail.com';

const COLUMNS = [
  'guest_name','first_name','last_name','email',
  'dinner','dietary_restrictions',
  'emergency_name','emergency_phone',
  'arrival_datetime','arrival_flight','arrival_airline',
  'departure_datetime','departure_flight','departure_airline',
  'submitted_at'
];

const HEADERS = [
  'Guest','First Name','Last Name','Email',
  'Dinner','Dietary Restrictions',
  'Emergency Name','Emergency Phone',
  'Arrival Date/Time','Arrival Flight #','Arrival Airline',
  'Departure Date/Time','Departure Flight #','Departure Airline',
  'Submitted At'
];

function doPost(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  try {
    const data = JSON.parse(e.postData.contents);
    const ss    = SpreadsheetApp.openById(SHEET_ID);
    let sheet   = ss.getSheetByName('RSVPs');

    if (!sheet) {
      sheet = ss.insertSheet('RSVPs');
      const hdr = sheet.getRange(1, 1, 1, HEADERS.length);
      sheet.appendRow(HEADERS);
      hdr.setFontWeight('bold').setBackground('#c4a45c').setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    }

    // Upsert — find existing row for this guest
    const all = sheet.getDataRange().getValues();
    let rowIndex = -1;
    for (let i = 1; i < all.length; i++) {
      if ((all[i][0] || '').toString().toLowerCase() === (data.guest_name || '').toLowerCase()) {
        rowIndex = i + 1;
        break;
      }
    }

    const now = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
    const row = COLUMNS.map(col => col === 'submitted_at' ? now : (data[col] || ''));

    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }

    sendFullListEmail(sheet);
    output.setContent(JSON.stringify({ ok: true }));
  } catch (err) {
    output.setContent(JSON.stringify({ ok: false, error: err.toString() }));
  }

  return output;
}

function sendFullListEmail(sheet) {
  const all  = sheet.getDataRange().getValues();
  if (all.length <= 1) return;

  const headers    = all[0];
  const rows       = all.slice(1);
  const guestCount = rows.length;

  // Dinner breakdown
  const dinnerCounts = {};
  rows.forEach(r => {
    const d = (r[4] || 'Not selected');
    dinnerCounts[d] = (dinnerCounts[d] || 0) + 1;
  });

  const dinnerSummary = Object.entries(dinnerCounts)
    .map(([k, v]) => `<li><strong>${k}:</strong> ${v}</li>`).join('');

  const tableRows = rows.map((row, i) => {
    const bg = i % 2 === 0 ? '#ffffff' : '#f5f0e8';
    const cells = row.map(cell => `<td style="padding:5px 8px;border-bottom:1px solid #ddd;">${cell || '—'}</td>`).join('');
    return `<tr style="background:${bg};"><td style="padding:5px 8px;color:#999;font-size:11px;">${i + 1}</td>${cells}</tr>`;
  }).join('');

  const headerCells = headers.map(h =>
    `<th style="padding:6px 8px;color:#fff;text-align:left;white-space:nowrap;background:#c4a45c;">${h}</th>`
  ).join('');

  const html = `
<div style="font-family:Georgia,serif;max-width:960px;margin:0 auto;color:#1a1a1a;">
  <div style="background:#08080a;padding:28px;text-align:center;">
    <h1 style="color:#c4a45c;font-family:Georgia,serif;margin:0;font-size:24px;letter-spacing:4px;">AMAZIAH &amp; SANTANA</h1>
    <p style="color:#ecd396;margin:8px 0 0;font-size:13px;letter-spacing:3px;">WEDDING RSVP REPORT · OCTOBER 2, 2026 · VILLA ARVEDI, VERONA</p>
  </div>
  <div style="padding:24px;background:#fdfaf2;">
    <h2 style="color:#08080a;font-size:17px;border-bottom:2px solid #c4a45c;padding-bottom:6px;">Summary</h2>
    <p><strong>Total RSVPs received:</strong> ${guestCount} / 54</p>
    <p><strong>Dinner selections:</strong></p>
    <ul style="margin:4px 0 16px 20px;">${dinnerSummary}</ul>

    <h2 style="color:#08080a;font-size:17px;border-bottom:2px solid #c4a45c;padding-bottom:6px;margin-top:28px;">Full Guest List</h2>
    <div style="overflow-x:auto;">
      <table style="border-collapse:collapse;width:100%;font-size:12px;margin-top:10px;">
        <thead><tr><th style="padding:6px 8px;color:#fff;background:#c4a45c;">#</th>${headerCells}</tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  </div>
  <div style="background:#08080a;padding:14px;text-align:center;">
    <p style="color:#666;font-size:11px;margin:0;">Generated ${new Date().toLocaleString('en-US', {timeZone:'America/New_York'})} ET</p>
  </div>
</div>`;

  GmailApp.sendEmail(
    EMAIL_TO,
    `Wedding RSVP Update — ${guestCount}/54 guests · ${new Date().toLocaleDateString('en-US')}`,
    'Please view this email in HTML format.',
    { htmlBody: html }
  );
}
