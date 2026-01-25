# Security & Protection Guide

## 1. Protecting Your Code ("Stealing")
Since this is a web application (HTML/JS), your code is sent to the user's browser. It is **impossible** to fully hide client-side code. However, you can make it harder to copy:

### **Minification & Obfuscation**
- **Minification**: Removes whitespace and comments (e.g., specific build tools like Vite/Webpack do this automatically).
- **Obfuscation**: Renames variables to `a`, `b`, `x`, making logic hard to reverse-engineer.
  - *Recommendation*: If you move to a build step (Vite/Next.js), this happens automatically. For plain HTML/JS, it's usually not worth the effort unless you have proprietary algorithms.

### **Licensing**
- The best protection is legal. Add a `LICENSE` file (e.g., MIT, Apache 2.0, or Proprietary).
- MIT allows copying.
- **Proprietary/All Rights Reserved** forbids it.

## 2. Preventing "Bad Things" (Attacks)

### **Cross-Site Scripting (XSS)**
*We have patched this for you in the latest update.*
- **Risk**: If an attacker manages to get a malicious song title into your search results (e.g., `<script>alert('Hacked')</script>`), it could run code on your users' browsers.
- **Fix**: Always "escape" text before putting it into HTML. Use `textContent` instead of `innerHTML` where possible.

### **API Key Theft**
- **YouTube Key**: You are using "Bring Your Own Key" (BYOK). This is excellent. It means if someone steals a key, they steal the *user's* key, not *yours*. You are safe.
- **Spotify/Apple**: You are using standard public client IDs. Secrets are hidden in your server-side functions (`api/`). This is secure.

### **Rate Limiting & Cost**
- **Vercel**: Vercel has built-in DDoS protection.
- **YouTube Quota**: Since typically users use their own keys, you won't hit a central quota limit.

## 3. Best Practices Checklist
- [x] Use `https://` (Vercel does this mostly automatically).
- [x] Don't commit `.env` files to GitHub (checked `.gitignore`, you are good).
- [x] Don't store user passwords (you rely on third-party OAuth, which is perfect).
