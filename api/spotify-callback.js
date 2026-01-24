// Spotify OAuth Callback - Handles the authorization code exchange
const CLIENT_ID = '1cc98da5d08742df809c8b0724725d0b';

export default async function handler(req, res) {
    const { code, error } = req.query;

    if (error) {
        return res.redirect('/?error=' + encodeURIComponent(error));
    }

    if (!code) {
        return res.redirect('/?error=no_code');
    }

    try {
        const redirectUri = process.env.SPOTIFY_REDIRECT_URI;

        // Exchange code for tokens
        const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64')
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: redirectUri
            }).toString()
        });

        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.json();
            console.error('Token error:', errorData);
            return res.redirect('/?error=token_failed');
        }

        const tokenData = await tokenResponse.json();

        // Get user profile
        const profileResponse = await fetch('https://api.spotify.com/v1/me', {
            headers: {
                'Authorization': `Bearer ${tokenData.access_token}`
            }
        });

        let userName = 'User';
        let userImage = '';
        if (profileResponse.ok) {
            const profile = await profileResponse.json();
            userName = profile.display_name || profile.id;
            userImage = profile.images?.[0]?.url || '';
        }

        // Redirect back to app with tokens in URL fragment (client-side only)
        const params = new URLSearchParams({
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token || '',
            expires_in: tokenData.expires_in,
            user_name: userName,
            user_image: userImage
        });

        res.redirect('/#' + params.toString());

    } catch (error) {
        console.error('Callback error:', error);
        res.redirect('/?error=callback_failed');
    }
}
