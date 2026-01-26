
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

export async function findCodeRow(sheets, spreadsheetId, code) {
    const range = 'Sheet1!A:C'; // Col A: Code, Col B: Status, Col C: SpotifyID
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return null;

    // Find index (1-based for Sheets API range updates)
    const rowIndex = rows.findIndex(row => row[0] === code);

    if (rowIndex === -1) return null;

    return {
        index: rowIndex + 1, // 1-based index
        code: rows[rowIndex][0],
        status: rows[rowIndex][1], // "USED" or undefined/empty
        spotifyId: rows[rowIndex][2] // Linked Spotify ID
    };
}

export async function markCodeAsUsed(sheets, spreadsheetId, rowIndex, spotifyId) {
    const range = `Sheet1!B${rowIndex}:C${rowIndex}`;
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        requestBody: {
            values: [['USED', spotifyId]]
        }
    });
}
