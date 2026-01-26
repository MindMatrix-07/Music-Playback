
import { getGoogleSheetClient, findCodeRow, markCodeAsUsed } from './_utils/google-sheet.js';
import { signSession } from './_utils/auth.js';
import { serialize } from 'cookie';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { code } = req.body;
    if (!code) {
        return res.status(400).json({ error: 'Code required' });
    }

    const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
    if (!GOOGLE_SHEET_ID) {
        console.error('Missing GOOGLE_SHEET_ID');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
        const sheets = await getGoogleSheetClient();

        // 1. Find the code in the sheet
        const row = await findCodeRow(sheets, GOOGLE_SHEET_ID, code);

        // 2. Validate
        if (!row) {
            return res.status(401).json({ error: 'Invalid code' });
        }

        if (row.status === 'USED') {
            return res.status(403).json({ error: 'This code has already been used' });
        }

        // 3. Mark as USED
        await markCodeAsUsed(sheets, GOOGLE_SHEET_ID, row.index);

        // 4. Issue Session
        const token = await signSession({ code: row.code });

        // 5. Set Cookie
        const cookie = serialize('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 24 * 365 * 10, // 10 Years (Lifetime)
            path: '/',
        });

        res.setHeader('Set-Cookie', cookie);
        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('Auth Error:', error);
        // Don't leak details to user, but log for debug
        return res.status(500).json({ error: 'Internal Authentication Error' });
    }
}
