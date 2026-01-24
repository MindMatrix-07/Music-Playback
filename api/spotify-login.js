      // Spotify OAuth Login - Redirects user to Spotify authorization
      const CLIENT_ID = '1cc98da5d08742df809c8b0724725d0b';
      
      export default function handler(req, res) {
          const redirectUri = process.env.SPOTIFY_REDIRECT_URI;
          
          const scope = 'user-read-private user-read-email streaming user-read-playback-state user-modify-playback-state';
          
          const authUrl = 'https://accounts.spotify.com/authorize?' + new URLSearchParams({
              response_type: 'code',
              client_id: CLIENT_ID,
              scope: scope,
              redirect_uri: redirectUri,
              show_dialog: true
          }).toString();
      
          res.redirect(authUrl);
      }