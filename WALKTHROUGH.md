# Google Sheets Auth Walkthrough

I have successfully replaced the Vercel KV system with a **Google Sheets-backed Authentication** system.
This allows you to generate access codes simply by typing them into a private Google Sheet.

## 1. Google Cloud Setup (One-Time)
You need to get credentials so the app can read your sheet.

1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Create a **New Project** (e.g., "Music App Auth").
3.  Search for **"Google Sheets API"** and click **Enable**.
4.  Go to **Credentials** > **Create Credentials** > **Service Account**.
    - Name: `auth-bot` (or similar).
    - Click **Done**.
5.  Click on the new Service Account email (e.g., `auth-bot@...iam.gserviceaccount.com`).
6.  Go to the **Keys** tab > **Add Key** > **Create new key** > **JSON**.
    - This will download a JSON file. **Keep it safe**.

## 2. Prepare the Google Sheet
1.  Create a new Google Sheet at [sheets.new](https://sheets.new).
2.  Name it "Access Codes".
3.  **Share** the sheet with the **Service Account Email** (found in the JSON file `client_email` field).
    - Give it **Editor** access.
4.  **Enter Data**: Make your sheet look exactly like this table:

    |   | A       | B      |
    |---|---------|--------|
    | **1** | Code    | Status |
    | **2** | USER-001|        |
    | **3** | FRIEND  |        |

    *   **IMPORTANT**: Do **NOT** paste any Javascript code into the Sheet.
    *   Type the word `Code` in cell **A1**.
    *   Type the word `Status` in cell **B1**.
    *   Type the word `DeviceID` in cell **C1** (Crucial for binding).
    *   Type the word `Name` in cell **D1** (Optional: Stores user name).
    *   List your actual access codes in Column A.
    *   Leave Columns B, C, and D empty.

    |   | A       | B      | C         | D    |
    |---|---------|--------|-----------|------|
    | **1** | Code    | Status | DeviceID  | Name |
    | **2** | USER-001|        |           |      |

## 4. Deploy to Vercel
Go to your Vercel Project Settings > **Environment Variables** and add these variables:

| Variable Name | Value |
| :--- | :--- |
| `GOOGLE_SHEET_ID` | `1Sj7XYJYP0f1BGQ1gyC5mg2eDIbS2XjAVJg3YDXuJsVI` |
| `GOOGLE_CLIENT_EMAIL` | **Open the JSON file with Notepad**. Look for `"client_email": "..."` |
| `GOOGLE_PRIVATE_KEY` | **Open the JSON file with Notepad**. Look for `"private_key": "..."`. <br> Copy everything `-----BEGIN` to `KEY-----\n`. |
| `DISCORD_CLIENT_ID` | Your Application ID from Discord Developer Portal. |
| `DISCORD_CLIENT_SECRET` | Your Client Secret from Discord Developer Portal. |
| `JWT_SECRET` | (Optional: Any random password) |

> **Note**: For Discord Redirects to work, remember to add `https://your-app.vercel.app/api/auth/callback/discord` to the **OAuth2 > Redirects** section in Discord Developer Portal.

## 5. How to Issue Codes
To give someone access:
1.  Open your Google Sheet.
2.  Type a new code in **Column A** (e.g., `FRIEND-TIM`).
3.  Send them the code.
4.  When they use it, the system will look for a **Discord Login**.
    - If they are new: It will bind their **Discord ID** to Column C.
    - If they return: It will verify they are logged into that same Discord account.

## 6. Troubleshooting
If a user reports issues:
1.  Ask for the **Diagnostic Log**:
    - On the Lock Screen (if error occurs): Click "Clipboard Icon".
    - Inside App: Go to **Settings > Troubleshooting > Copy Diagnostic Info**.
2.  This log will tell you if they are logged in, their browser info, and filtered API key status.
