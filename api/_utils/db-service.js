
import { connectToDatabase, AccessCode } from './mongodb.js';
import { getGoogleSheetClient, findCodeRow, findUserRow, markCodeAsUsed } from './google-sheet.js';

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

export async function createCodeCommon(code) {
    const cleanCode = code.trim().toLowerCase();

    // 1. Check if exists
    const existing = await findCodeCommon(cleanCode);
    if (existing && !existing.error) {
        throw new Error('Code already exists');
    }

    try {
        await connectToDatabase();
        // 2. Create in MongoDB
        const newCode = await AccessCode.create({
            code: cleanCode,
            status: '', // Unused
            spotifyId: null,
            name: null
        });
        console.log(`[DB] Created in Mongo: ${cleanCode}`);

        // 3. Append to Google Sheets (if configured)
        if (GOOGLE_SHEET_ID) {
            try {
                const sheets = await getGoogleSheetClient();
                await sheets.spreadsheets.values.append({
                    spreadsheetId: GOOGLE_SHEET_ID,
                    range: 'Sheet1!A:A',
                    valueInputOption: 'USER_ENTERED',
                    requestBody: {
                        values: [[cleanCode]]
                    }
                });
                console.log(`[DB] Appended to Sheets: ${cleanCode}`);
            } catch (e) {
                console.error('[DB] Sheets Append Failed:', e);
                // We don't throw here because Mongo creation succeeded.
                // It's better to have it in Mongo than nowhere.
            }
        }

        return { success: true, code: cleanCode };
    } catch (e) {
        console.error('[DB] Create Code Failed:', e);
        throw e;
    }
}

export async function findCodeCommon(code) {
    try {
        await connectToDatabase();

        // 1. Try MongoDB First
        const cleanCode = code.trim().toLowerCase();
        let mongoRecord = await AccessCode.findOne({ code: cleanCode });

        if (mongoRecord) {
            console.log(`[DB] Cache Hit (Mongo): ${cleanCode}`);
            return {
                code: mongoRecord.code,
                status: mongoRecord.status,
                spotifyId: mongoRecord.spotifyId,
                name: mongoRecord.name,
                // Add index if we have it, mostly for backward compatibility logic
                index: mongoRecord.rowIndex
            };
        }

        // 2. Fallback to Google Sheets
        console.log(`[DB] Cache Miss (Mongo): ${cleanCode}. Checking Sheets...`);
        const sheets = await getGoogleSheetClient();
        const sheetRow = await findCodeRow(sheets, GOOGLE_SHEET_ID, cleanCode);

        if (sheetRow && !sheetRow.error) {
            // 3. Read-Through: Sync to MongoDB
            console.log(`[DB] Syncing Code to Mongo: ${cleanCode}`);
            try {
                await AccessCode.create({
                    code: sheetRow.code.toLowerCase(), // Ensure lowercase storage
                    status: sheetRow.status,
                    spotifyId: sheetRow.spotifyId,
                    name: sheetRow.name,
                    rowIndex: sheetRow.index
                });
            } catch (createError) {
                // If it was created in race condition, ignore
                if (createError.code !== 11000) {
                    console.error('[DB] Sync Create Error:', createError);
                }
            }
            return sheetRow;
        }

        return sheetRow; // Return the error/empty result from sheets
    } catch (error) {
        console.error('[DB] findCodeService Error:', error);
        // Fallback completely to sheets if Mongo fails hard
        try {
            const sheets = await getGoogleSheetClient();
            return await findCodeRow(sheets, GOOGLE_SHEET_ID, code);
        } catch (sheetError) {
            return { error: true, msg: 'Database Unavailable' };
        }
    }
}

export async function findUserCommon(userId) {
    try {
        await connectToDatabase();

        // 1. Try MongoDB First
        // Note: We search by spotifyId (which stores our userId/deviceId)
        const mongoRecord = await AccessCode.findOne({ spotifyId: userId });

        if (mongoRecord) {
            console.log(`[DB] User Hit (Mongo): ${userId}`);
            return {
                code: mongoRecord.code,
                status: mongoRecord.status,
                spotifyId: mongoRecord.spotifyId,
                name: mongoRecord.name,
                index: mongoRecord.rowIndex
            };
        }

        // 2. Fallback to Google Sheets
        console.log(`[DB] User Miss (Mongo): ${userId}. Checking Sheets...`);
        if (!GOOGLE_SHEET_ID) return null;

        const sheets = await getGoogleSheetClient();
        const sheetRow = await findUserRow(sheets, GOOGLE_SHEET_ID, userId);

        if (sheetRow) {
            // 3. Read-Through: Sync to MongoDB
            console.log(`[DB] Syncing User to Mongo: ${userId}`);
            try {
                const cleanCode = sheetRow.code.toLowerCase();
                // Check if code exists first to avoid duplicate key error
                // (It might exist but not have the user ID bound yet in Mongo, or completely missing)
                await AccessCode.findOneAndUpdate(
                    { code: cleanCode },
                    {
                        code: cleanCode,
                        status: sheetRow.status,
                        spotifyId: sheetRow.spotifyId,
                        name: sheetRow.name,
                        rowIndex: sheetRow.index
                    },
                    { upsert: true, new: true }
                );
            } catch (syncError) {
                console.error('[DB] User Sync Error:', syncError);
            }
            return sheetRow;
        }

        return null;
    } catch (error) {
        console.error('[DB] findUserService Error:', error);
        return null;
    }
}

export async function markCodeAsUsedCommon(codeInfo, userId, name) {
    // codeInfo is the object returned from findCodeService (containing index, code, etc)
    const { code, index } = codeInfo;
    const cleanCode = code.toLowerCase();

    // 1. Update MongoDB
    try {
        await connectToDatabase();
        await AccessCode.findOneAndUpdate(
            { code: cleanCode },
            {
                status: 'USED',
                spotifyId: userId,
                name: name,
                rowIndex: index // Ensure index is saved if available
            },
            { upsert: true } // Create if somehow missing
        );
        console.log(`[DB] Updated Mongo: ${cleanCode} -> USED`);
    } catch (e) {
        console.error('[DB] Mongo Update Failed:', e);
        // Continue to Sheets, don't block
    }

    // 2. Update Google Sheets (Write-Back)
    if (GOOGLE_SHEET_ID && index) {
        try {
            const sheets = await getGoogleSheetClient();
            await markCodeAsUsed(sheets, GOOGLE_SHEET_ID, index, userId, name);
            console.log(`[DB] Updated Sheets: Row ${index}`);
        } catch (e) {
            console.error('[DB] Sheets Update Failed:', e);
            throw e; // If Sheets fails, we might want to alert the user, but Mongo is already saved.
            // Strategically: If Sheets is our "Primary backup", maybe we should throw.
            // But for reliability, if Mongo saved, we are good.
        }
    }
}
