
import { getGoogleSheetClient, findCodeRow, markCodeAsUsed } from './_utils/google-sheet.js';
import { signSession } from './_utils/auth.js';
import { serialize } from 'cookie';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { code, spotifyAccessToken } = req.body;

    if (!code) return res.status(400).json({ error: 'Code required' });
    if (!spotifyAccessToken) return res.status(400).json({ error: 'Spotify Login required to use this code' });

    const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
    if (!GOOGLE_SHEET_ID) {
        console.error('Missing GOOGLE_SHEET_ID');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    try {
        // 1. Verify Spotify Token & Get User ID
        const spotifyRes = await fetch('https://api.spotify.com/v1/me', {
            headers: { 'Authorization': `Bearer ${spotifyAccessToken}` }
        });

        if (!spotifyRes.ok) {
            return res.status(401).json({ error: 'Invalid Spotify Session. Please login again.' });
        }

        const spotifyProfile = await spotifyRes.json();
        const spotifyUserId = spotifyProfile.id; // Unique Immutable ID

        // 2. Check Sheet
        const sheets = await getGoogleSheetClient();
        const row = await findCodeRow(sheets, GOOGLE_SHEET_ID, code);

        if (!row) {
            return res.status(401).json({ error: 'Invalid access code' });
        }

        // 3. Logic: Check Status & Binding
        if (row.status === 'USED') {
            // Already Used: Check if it belongs to THIS user
            if (row.spotifyId === spotifyUserId) {
                // MATCH: Grant Access (Returning User)
            } else {
                // MISMATCH: Code stolen or shared
                return res.status(403).json({
                    error: 'This code is linked to a different Spotify account.'
                });
            }
        } else {
            // New Code: Bind it to THIS user
            await markCodeAsUsed(sheets, GOOGLE_SHEET_ID, row.index, spotifyUserId);
        }

        // 4. Issue Lifetime Session
        const token = await signSession({
            code: row.code,
            spotifyId: spotifyUserId
        });

        const cookie = serialize('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 24 * 365 * 10, // 10 Years
            path: '/',
        });

        res.setHeader('Set-Cookie', cookie);
        return res.status(200).json({ success: true, message: 'Code linked to account.' });

    } catch (error) {
        console.error('Auth Error:', error);
        return res.status(500).json({ error: 'Internal Authentication Error' });
    }
}
