# Google Sheet Student Data（Legacy Fallback）

> 2026-08-12：Google Sheet 已降为故障兜底。学员档案主存储是 Supabase
> `public.student_profiles`，正式上传命令是 `npm run students:upload-profiles`。
> 只有在 Supabase 读取失败时，网站才继续尝试本页的 Apps Script Web App。

This legacy setup keeps a fallback copy of student data in Google Sheet. The local upload script writes rows from `data/students/*.json`.

## Sheet

Create a Google Sheet with a tab named `students`.

Required columns:

```text
studentId | aliases | accessCode | studentName | studentJson
```

## Apps Script

Open the Sheet, then go to `Extensions` -> `Apps Script`. Paste this script:

```js
const TOKEN = 'CHANGE_THIS_TO_A_LONG_RANDOM_TOKEN';
const TAB_NAME = 'students';
const HEADERS = ['studentId', 'aliases', 'accessCode', 'studentName', 'studentJson'];

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    if (body.token !== TOKEN) {
      return json({ error: 'unauthorized' });
    }

    if (body.action === 'upsertStudents') {
      return upsertStudents(body.students || []);
    }

    const requestedId = String(body.studentId || '').trim().toLowerCase();
    if (!requestedId) {
      return json({ error: 'missing studentId' });
    }

    const sheet = SpreadsheetApp.getActive().getSheetByName(TAB_NAME);
    ensureHeaders(sheet);

    const values = sheet.getDataRange().getValues();
    const headers = values.shift().map(String);
    const rows = values.map((row) => Object.fromEntries(headers.map((key, index) => [key, row[index]])));

    const row = rows.find((item) => {
      const studentId = String(item.studentId || '').trim().toLowerCase();
      const aliases = String(item.aliases || '')
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);
      return studentId === requestedId || aliases.includes(requestedId);
    });

    if (!row) {
      return json({ error: 'not found' });
    }

    const student = JSON.parse(String(row.studentJson || '{}'));
    if (!student.accessCode && row.accessCode) {
      student.accessCode = String(row.accessCode).trim();
    }

    return json({ student });
  } catch (error) {
    return json({ error: String(error) });
  }
}

function upsertStudents(students) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(TAB_NAME);
  ensureHeaders(sheet);

  const values = sheet.getDataRange().getValues();
  const rows = values.slice(1);
  const idToRow = new Map();
  rows.forEach((row, index) => {
    const studentId = String(row[0] || '').trim().toLowerCase();
    if (studentId) idToRow.set(studentId, index + 2);
  });

  let updated = 0;
  let inserted = 0;

  students.forEach((student) => {
    const studentId = String(student.studentId || '').trim().toLowerCase();
    if (!studentId) return;

    const row = [
      studentId,
      String(student.aliases || ''),
      String(student.accessCode || ''),
      String(student.studentName || ''),
      String(student.studentJson || '{}'),
    ];

    const rowNumber = idToRow.get(studentId);
    if (rowNumber) {
      sheet.getRange(rowNumber, 1, 1, HEADERS.length).setValues([row]);
      updated += 1;
    } else {
      sheet.appendRow(row);
      inserted += 1;
    }
  });

  return json({ ok: true, updated, inserted });
}

function ensureHeaders(sheet) {
  const firstRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const hasHeaders = HEADERS.every((header, index) => String(firstRow[index] || '') === header);
  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }
}

function json(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
```

Deploy it as a Web App:

```text
Deploy -> New deployment -> Web app
Execute as: Me
Who has access: Anyone
```

Copy the Web App URL.

## Local Upload Script

Run this on your own computer after the Web App is deployed:

```powershell
$env:GOODMINTON_STUDENT_SHEET_ENDPOINT="PASTE_WEB_APP_URL_HERE"
$env:GOODMINTON_STUDENT_SHEET_TOKEN="PASTE_THE_TOKEN_HERE"
node scripts/upload-students-to-google-sheet.mjs
```

The script reads local files from `data/students/*.json` and writes them into the Sheet.

## Vercel

Add Production environment variables:

```text
GOODMINTON_STUDENT_SHEET_ENDPOINT = Apps Script Web App URL
GOODMINTON_STUDENT_SHEET_TOKEN = the same TOKEN from Apps Script
```

Redeploy the Vercel production deployment after saving variables.
