# Privacy Policy

**Last Updated:** 2026-01-25

## 1. Introduction
This Privacy Policy explains how **Music Playback** ("we," "our," or "the App") handles your information. We are committed to protecting your privacy. **We do not collect, store, or share your personal data on our servers.**

## 2. Data Collection & Storage

### 2.1. Local Storage (On Your Device)
We use your browser's **Local Storage** to verify settings and preferences. This data **never leaves your device**.
- **Spotify Authentication**: Tokens (`access_token`, `refresh_token`) are stored locally to keep you logged in.
- **YouTube API Key**: If you provide a custom API Key, it is stored locally (`yt_api_key`) and used directly by your browser to communicate with YouTube.

### 2.2. Third-Party Services
This App acts as a client to various third-party services. When you use the App, you interact directly with these platforms:
- **Spotify**: Authentication and metadata. [Spotify Privacy Policy](https://www.spotify.com/us/legal/privacy-policy/)
- **Apple Music**: Search and playback. [Apple Privacy Policy](https://www.apple.com/legal/privacy/)
- **YouTube**: Video playback. [Google Privacy Policy](https://policies.google.com/privacy)
- **Wikidata**: Artist images.
- **LRCLIB**: Lyrics retrieval.

## 3. How We Use Information
- **Search Queries**: Sent directly to Spotify or Apple Music APIs to fetch results.
- **Playback**: Handled via secure IFrame embeds provided by the respective platforms.
- **Lyrics**: Song title and artist name are sent to LRCLIB to retrieve lyrics.

## 4. Cookies and Tracking
We do not use tracking cookies or analytics software. Third-party embeds (Spotify, Apple Music, YouTube) may use their own cookies to maintain user sessions and preferences, subject to their respective policies.

## 5. Security
- **No Server Storage**: We do not have a database. We cannot lose or leak your data because we do not have it.
- **Client-Side Requests**: API requests are primarily made from your browser to the service provider.
- **Data Hardening**: We employ strict **Anti-Theft** and **Anti-Caching** protocols.
    - All API responses are sent with `Cache-Control: no-store` headers, ensuring your data is not saved by browsers or intermediate proxies.
    - Requests are validated to ensure they originate only from our authentic website.

## 6. Your Rights
Since we do not store your data, there is nothing for us to delete or export. You can clear your data at any time by:
1. Logging out (clears Spotify tokens).
2. Deleting your YouTube API Key in settings.
3. Clearing your browser's cache/local storage.

## 7. Changes to This Policy
We may update this policy to reflect changes in our features or legal requirements. Updates will be posted here.

