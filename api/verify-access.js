
import { getGoogleSheetClient, findCodeRow, markCodeAsUsed } from './_utils/google-sheet.js';
import { signSession } from './_utils/auth.js';
import { serialize } from 'cookie';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { code, deviceId, name } = req.body;

    if (!code) return res.status(400).json({ error: 'Code required' });
    if (!deviceId) return res.status(400).json({ error: 'Device ID required' });
    // Name is optional for returning users, but required for new binds. 
    // We enforce it at frontend.

    const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
    if (!GOOGLE_SHEET_ID) {
        console.error('Missing GOOGLE_SHEET_ID');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
        // 1. Check Sheet
        const sheets = await getGoogleSheetClient();
        const row = await findCodeRow(sheets, GOOGLE_SHEET_ID, code);

        if (!row) {
            return res.status(401).json({ error: 'Invalid access code' });
        }

        // 2. Logic: Check Status & Binding
        // row.spotifyId checks Column C (we reuse this column for DeviceID now)
        const storedDeviceId = row.spotifyId;

        if (row.status === 'USED') {
            // Already Used: Check if it belongs to THIS device
            if (storedDeviceId === deviceId) {
                // MATCH: Grant Access (Returning Device)
            } else {
                // MISMATCH: Code stolen or shared
                return res.status(403).json({
                    error: 'This code is linked to a different device/browser.'
                });
            }
        } else {
            // New Code: Bind it to THIS device AND Name
            if (!name) return res.status(400).json({ error: 'Name is required for first-time login.' });
            await markCodeAsUsed(sheets, GOOGLE_SHEET_ID, row.index, deviceId, name);
        }

        // 3. Issue Lifetime Session
        const token = await signSession({
            code: row.code,
            deviceId: deviceId
        });

        const cookie = serialize('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 24 * 365 * 10, // 10 Years
            path: '/',
        });

        res.setHeader('Set-Cookie', cookie);
        return res.status(200).json({ success: true, message: 'Device authorized.' });

    } catch (error) {
        console.error('Auth Error:', error);
        return res.status(500).json({ error: 'Internal Authentication Error' });
    }
}
