# Deploying the Clash 4 mobile beta

## Easiest: Netlify Drop
1. Open `https://app.netlify.com/drop` in a desktop browser.
2. Drag the **Clash4-Mobile-Beta-0.13.0** folder onto the page.
3. Wait for deployment.
4. Open the generated HTTPS URL on your own phone once.
5. Send that URL to testers.

No build command, Node installation, or package manager is required for this Arcade beta.

## Cloudflare Pages / GitHub Pages / Vercel
Upload this folder as a static site and use `index.html` as the root page. No build step is required.

## Updating the beta
Prefer deploying a newly versioned folder/build instead of silently replacing the same file. This makes tester screenshots and bug reports traceable to a specific version.

The included `_headers` file asks compatible hosts not to cache `index.html` aggressively and adds basic browser security headers.
