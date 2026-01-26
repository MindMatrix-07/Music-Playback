
import { google } from 'googleapis';

export async function getGoogleSheetClient() {
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

    if (!clientEmail || !privateKey) {
        throw new Error('Google Sheets credentials missing');
    }

    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: clientEmail,
            private_key: privateKey,
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    return google.sheets({ version: 'v4', auth });
}

export async function getFirstSheetName(sheets, spreadsheetId) {
    const output = await sheets.spreadsheets.get({
        spreadsheetId
    });
    return output.data.sheets[0].properties.title;
}

export async function findCodeRow(sheets, spreadsheetId, code) {
    // Revert to simple hardcoded sheet for stability
    const sheetName = 'Sheet1';
    const range = 'Sheet1!A:D';

    const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
        return { error: true, msg: 'Sheet is empty' };
    }

    // Find index
    const cleanCode = code.trim().toLowerCase();
    const rowIndex = rows.findIndex(row => row[0] && row[0].trim().toLowerCase() === cleanCode);

    if (rowIndex === -1) {
        // DEBUG: Return info about what we saw
        return {
            error: true,
            debugRows: rows.length,
            debugFirst: rows[0],
            debugCodeSeen: cleanCode
        };
    }

    return {
        index: rowIndex + 1, // 1-based index
        code: rows[rowIndex][0],
        status: rows[rowIndex][1], // "USED" or undefined/empty
        spotifyId: rows[rowIndex][2] // Linked Spotify ID
    };
}

export async function markCodeAsUsed(sheets, spreadsheetId, rowIndex, deviceId, name) {
    // const sheetName = await getFirstSheetName(sheets, spreadsheetId);
    const range = `Sheet1!B${rowIndex}:D${rowIndex}`; // Hardcoded for stability
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        requestBody: {
            values: [['USED', deviceId, name]]
        }
    });
}
