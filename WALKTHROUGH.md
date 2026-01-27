# Admin Panel & Auth Walkthrough

I have implemented a secure **MongoDB Authentication** system with a robust **Admin Panel**.
Google Sheets is used as a **secondary backup** only.

## 1. Accessing the Admin Panel
1.  Navigate to `/admin.html`.
2.  Enter your **Admin Password** (set in Vercel environment variables as `ADMIN_PASSWORD`).
3.  **Features**:
    -   **Create Codes**: Generate new access tokens instantly.
    -   **Manage Users**: View connected Discord users, status (Active/Used), and **Block** users.
    -   **Maintenance Mode**: Toggle system-wide maintenance with a single click.

## 2. Issue Access Codes
1.  Go to the Admin Panel.
2.  Enter a custom code (e.g., `FRIEND-TIM`) or generate a random one.
3.  Click **Create**.
4.  Copy the code and send it to the user.
5.  **Behavior**:
    -   **First Use**: Binds strictly to their **Discord ID**.
    -   **Re-Entry**: They must log in with the *same* Discord account.
    -   **Strict One-Time Use**: The code cannot be claimed by anyone else.

## 3. Security & Privacy Features
-   **Blocking**: If a user is abusive, click **Block** in the Admin Panel. They are instantly banned (Real-Time Check).
-   **Maintenance**: Enable "Shutdown Mode" to lock the site for everyone except you.
-   **Data Deletion**: Users can deletetheir data (unbind their account) via the Settings menu (`Index.html`). This **permanently destroys** the access code document in the database.
-   **Privacy Policy**: Users must accept the policy (displayed on login) which discloses MongoDB and Vercel Analytics usage.

## 4. Setup (Environment Variables)
Ensure these variables are set in Vercel:
| Variable | Purpose |
| :--- | :--- |
| `MONGODB_URI` | Connection string for your MongoDB Atlas cluster. |
| `ADMIN_PASSWORD` | Password for the Admin Panel. |
| `DISCORD_CLIENT_ID` | Your Application ID from Discord Developer Portal. |
| `DISCORD_CLIENT_SECRET` | Your Client Secret from Discord Developer Portal. |
| `JWT_SECRET` | Secret key for signing session tokens. |
| `GOOGLE_SHEET_ID` | (Optional) Backup logging sheet ID. |
| `GOOGLE_CLIENT_EMAIL` | (Optional) Service account email. |
| `GOOGLE_PRIVATE_KEY` | (Optional) Service account private key. |

> **Note**: For Discord Redirects, add `https://your-app.vercel.app/api/auth/callback/discord` to the **OAuth2 > Redirects** section in Discord Developer Portal.

## 5. Troubleshooting
If a user reports issues:
1.  Ask for the **Diagnostic Log**:
    - On the Lock Screen (if error occurs): Click "Clipboard Icon".
    - Inside App: Go to **Settings > Troubleshooting > Copy Diagnostic Info**.
2.  **Security**: This log is **automatically scrubbed** of any API keys before copying.
