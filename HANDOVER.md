# Handover Instructions

**Date:** 2026-01-26
**Current Status:** The "One-Time Access Code" system is **fully implemented** using **Google Sheets** as the database, with **Spotify Account Binding** for security.

## System Architecture

### 1. Authentication (Google Sheets + Spotify)
- **Database**: A private Google Sheet stores the access codes.
    - **Row Structure**: `Col A: Code` | `Col B: Status` | `Col C: SpotifyID`.
- **Binding Logic**:
    - Users must log in with Spotify first (to get their immutable `Spotify User ID`).
    - When they enter a Code:
        - If new: The code is marked `USED` in Col B, and their `SpotifyID` is saved to Col C.
        - If used: The system checks if the `SpotifyID` in Col C matches the user.
- **Session**: A secure, HTTPOnly cookie (`auth_token`) is issued for **10 Years**.

### 2. Frontend
- **Lock Screen**: `index.html` features a "Private Access" overlay.
    - Forces "Continue with Spotify" -> Then "Enter Code".
- **Privacy**: `privacy.html` has been updated to disclose this binding and storage mechanism.

### 3. Key Files
- `api/_utils/google-sheet.js`: Handles reading/writing to the Sheet.
- `api/verify-access.js`: The core logic for validating codes and binding accounts.
- `api/auth/status.js`: Checks if the user is logged in.
- `walkthrough.md`: Detailed guide on setting up the Google Cloud credentials.

## Setup Requirements
- **Vercel Env Vars**: `GOOGLE_SHEET_ID`, `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `JWT_SECRET`.
- **Google Sheet**: Must be shared with the Service Account email as Editor.

## Future Steps
- Monitor Google Sheets API quota (free tier is generous but has limits).
- Consider adding a "Logout" button if users want to switch accounts (currently they are locked in for 10 years unless they clear cookies).
