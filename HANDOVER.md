# Handover Instructions

**Date:** 2026-01-25
**Current Status:** "One-Time Access Code" feature is partially implemented using Vercel KV, but the user has requested to **migrate it to AWS DynamoDB** (Free Tier).

## Completed Work
1.  **Privacy & Security**:
    - `PRIVACY.md` and `privacy.html` are live.
    - API endpoints are hardened (Origin checks, No-Store headers).
    - Images are protected from downloading (CSS/JS).
2.  **Analytics**: Vercel Analytics script is verified in `index.html`.
3.  **Spam Protection**: "Circuit Breaker" overlay is active in `index.html`.

## Next Steps (For the next Agent)
The user has approved the **DynamoDB Migration Plan**. You need to:

1.  **Install Dependencies**:
    - Add `"@aws-sdk/client-dynamodb": "^3.0.0"` and `"@aws-sdk/lib-dynamodb": "^3.0.0"` to `package.json`.
2.  **Rewrite APIs**:
    - Modify `api/verify-access.js` to use AWS SDK instead of `fetch` to Vercel KV.
    - Modify `api/generate-code.js` to use AWS SDK.
3.  **Schema Reference**:
    - Table Name: `AccessCodes`
    - Partition Key: `code` (String)
    - See `implementation_plan.md` for full AWS setup details (which the user is responsible for creating in their console).

## Reference Files
- `implementation_plan.md`: Contains the detailed AWS setup guide.
- `api/verify-access.js`: Currently contains the Vercel KV logic (needs replacing).
