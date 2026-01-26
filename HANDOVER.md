# Handover Instructions

**Date:** 2026-01-26
**Current Status:** The system has been upgraded to **Device Binding** (removing the Spotify Login requirement) and security has been hardened.

## 🚀 Key Changes & Features

### 1. Device Binding (Replaces Spotify Binding)
- **Goal**: Allow public access without Spotify API limits/quotas.
- **Mechanism**: 
    - The browser generates a unique **Device ID** (UUID).
    - This ID is bound to the Access Code in the Google Sheet.
    - **Row Structure**: `Col A: Code` | `Col B: Status` | `Col C: DeviceID` | `Col D: Name`.
- **Benefit**: Users don't need a Spotify account to unlock. Codes are still secure (cannot be shared once used).

### 2. Name Collection
- Added a "Name" input field to the Lock Screen.
- This name is saved to **Column D** of the Google Sheet for your records.

### 3. Security Hardening
- **Content Hiding**: The main specific app content (`#appContent`) is `display: none` by default.
- **Verification**: JavaScript only reveals the content *after* the server confirms the code is valid.
- **Anti-Bypass**: Deleting the overlay via DevTools will now show a blank screen, not the app.

### 4. Stability Fixes
- **Login Loop**: Fixed a race condition where the Spotify Token was consumed too early.
- **Legacy Code**: Removed old "Protected Site" overlays that were blocking the UI.
- **CSS**: Fixed "Unlock Access" button size.

## 🛠️ Setup Requirements (Updated)
1.  **Google Sheet**: Ensure headers are: `Code`, `Status`, `DeviceID`, `Name`.
2.  **Environment Variables**: 
    - `GOOGLE_SHEET_ID`
    - `GOOGLE_CLIENT_EMAIL`
    - `GOOGLE_PRIVATE_KEY`
    - `JWT_SECRET`
    - *(Removed: `SPOTIFY_CLIENT_SECRET` is no longer critical for the lock screen)*.

## 📂 Key Files
- `api/verify-access.js`: Logic for checking Code + DeviceID + Name.
- `index.html`: Lock Screen UI + Security Hiding Logic + DeviceID Generation.
- `api/_utils/google-sheet.js`: Handles writing to Columns B:D.
