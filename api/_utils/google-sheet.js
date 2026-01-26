
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

    // Clean data before returning
    const cleanId = rows[rowIndex][2] ? String(rows[rowIndex][2]).replace(/^'/, '').trim() : null;

    return {
        index: rowIndex + 1, // 1-based index
        code: rows[rowIndex][0],
        status: rows[rowIndex][1], // "USED" or undefined/empty
        spotifyId: cleanId, // Linked Spotify ID
        name: rows[rowIndex][3] // Stored Name
    };
}

export async function findUserRow(sheets, spreadsheetId, userId) {
    const range = 'Sheet1!A:D';
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
        return null;
    }

    // Find row where Column C (Index 2) matches userId
    const rowIndex = rows.findIndex(row => {
        if (!row[2]) return false;
        // Clean potential ' prefix and convert to string
        const storedId = String(row[2]).replace(/^'/, '').trim();
        return storedId === String(userId);
    });

    if (rowIndex === -1) {
        return null;
    }

    // Clean data before returning
    const cleanId = rows[rowIndex][2] ? String(rows[rowIndex][2]).replace(/^'/, '').trim() : null;

    return {
        index: rowIndex + 1,
        code: rows[rowIndex][0],
        status: rows[rowIndex][1],
        spotifyId: cleanId,
        name: rows[rowIndex][3]
    };
}

export async function markCodeAsUsed(sheets, spreadsheetId, rowIndex, deviceId, name) {
    // const sheetName = await getFirstSheetName(sheets, spreadsheetId);
    const range = `Sheet1!B${rowIndex}:D${rowIndex}`; // Hardcoded for stability

    // Force string format for ID by prepending apostrophe
    const secureId = `'${deviceId}`;

    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED', // Changed to USER_ENTERED to parsing the apostrophe as formatting
        requestBody: {
            values: [['USED', secureId, name]]
        }
    });
}
