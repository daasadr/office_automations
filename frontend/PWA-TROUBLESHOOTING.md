# PWA Installation Troubleshooting Guide

## Current Status

The PWA is properly configured, but the `beforeinstallprompt` event wasn't firing. I've made the following fixes:

## Changes Made

### 1. Fixed `astro.config.mjs` PWA Configuration

**Key improvements:**
- Changed `display: 'minimal-ui'` → `display: 'standalone'` (required for install prompt in Chrome)
- Added `start_url` with proper base path
- Added `scope` and `id` to the manifest
- Updated all icon paths to include the base path (`/gFF1cnio0udVeqRarLTy`)
- **Enabled PWA in development mode** (`devOptions.enabled: true`) for easier testing

### 2. Added Debug Logging

Added comprehensive console logging to `/settings/install-app` page to help diagnose issues:
- Service worker registration status
- Display mode detection
- Browser capabilities
- Manifest loading status

## Why `beforeinstallprompt` Wasn't Firing

Chrome/Edge requires these conditions for the install prompt:

### ✅ Requirements (Now Met):
1. **HTTPS** - Your production site has it
2. **Valid manifest** - Fixed with proper `start_url`, `scope`, and `display: standalone`
3. **Service worker** - Vite PWA creates this automatically
4. **Icons** - All required sizes present (64x64, 192x192, 512x512)

### ⚠️ Additional Chrome Requirements:
1. **User engagement** - User must interact with page for ~30 seconds
2. **Not recently dismissed** - User hasn't dismissed install prompt in last ~3 months
3. **Not already installed** - App isn't already installed on device
4. **Fresh build** - Old cached service worker might cause issues

## Testing Steps

### Step 1: Rebuild the Application

The configuration changes need to be compiled into the build:

```bash
# In the frontend directory
npm run build
```

### Step 2: Deploy to Production

```bash
# From the root directory
docker compose -f docker-compose.prod.yml up -d --build frontend
```

### Step 3: Test in Production

1. Open Chrome/Edge in **Incognito mode** (to avoid cached data)
2. Navigate to: https://dejtoai.cz/gFF1cnio0udVeqRarLTy/settings/install-app
3. Open **DevTools** (F12) → **Console** tab
4. Look for log messages starting with `[PWA Install]`
5. Wait ~30 seconds while interacting with the page
6. The install button should appear

### Step 4: Check Manifest in DevTools

1. Open **DevTools** (F12) → **Application** tab
2. Click **Manifest** in the left sidebar
3. Verify:
   - ✅ Name: "Odpady Astro App"
   - ✅ Start URL: "/gFF1cnio0udVeqRarLTy/"
   - ✅ Display: "standalone"
   - ✅ Icons: All 4 icons loaded correctly

### Step 5: Check Service Worker

1. In **DevTools** → **Application** → **Service Workers**
2. Verify:
   - ✅ Service worker is registered
   - ✅ Status: "activated and running"
   - ✅ Scope: "/gFF1cnio0udVeqRarLTy/"

## Common Issues & Solutions

### Issue: "Waiting for installation option" (current state)

**Causes:**
- Old build without the fixes
- Service worker not properly registered
- Manifest missing required fields
- Browser cache issue

**Solution:**
1. Rebuild and redeploy
2. Clear browser cache (Ctrl+Shift+Delete)
3. Uninstall existing PWA if installed
4. Visit site in incognito mode

### Issue: Install prompt dismissed

If a user dismisses the install prompt, Chrome won't show it again for ~3 months.

**Workaround:**
- Users can manually install via Chrome menu: `⋮` → "Install Odpady"
- Or use the manual instructions on the install page

### Issue: PWA not working in development

**Solution:**
With the new config (`devOptions.enabled: true`), PWA now works in dev mode:

```bash
npm run dev
```

Then visit: http://localhost:4321/gFF1cnio0udVeqRarLTy/settings/install-app

⚠️ **Note:** In dev mode, you need to manually accept the service worker prompt.

## Testing Locally (Production Build)

To test the production build locally:

```bash
# Build
npm run build

# Preview
npm run preview
```

Then visit: http://localhost:4321/gFF1cnio0udVeqRarLTy/settings/install-app

## Verifying the Fix

After rebuilding, check the console logs on the install page. You should see:

```
[PWA Install] Initializing...
[PWA Install] User Agent: Mozilla/5.0...
[PWA Install] Display Mode: browser
[PWA Install] Service Worker support: true
[PWA Install] Service Worker registrations: 1
[PWA Install] SW 0: /gFF1cnio0udVeqRarLTy/ activated
[PWA Install] Browser supports installation, waiting for prompt...
[PWA Install] DOM ready, checking manifest...
[PWA Install] Manifest loaded: {name: "Odpady Astro App", ...}
```

And after ~30 seconds of interaction:

```
[PWA Install] beforeinstallprompt event fired!
[PWA Install] Showing install button
```

## Browser-Specific Notes

### Chrome/Edge (Desktop & Android)
- ✅ Full support for `beforeinstallprompt`
- Install button will appear automatically

### Safari (iOS/macOS)
- ❌ No `beforeinstallprompt` support
- Users must use manual installation (Share → Add to Home Screen)
- Page shows manual instructions automatically

### Firefox
- ⚠️ Limited PWA support
- Desktop: Can install via address bar icon
- Mobile: Can install via menu
- No `beforeinstallprompt` event

## Next Steps

1. **Rebuild and deploy** - Apply the configuration changes
2. **Test in production** - Use the steps above
3. **Monitor console logs** - Check for any errors
4. **Wait for engagement** - Give it 30+ seconds
5. **Report back** - Share the console logs if issues persist

## Alternative: Manual Installation Always Available

Even if the automatic install button doesn't appear, users can always install manually:

**Chrome/Edge:**
1. Click `⋮` (three dots) in browser
2. Select "Install Odpady" or "Add to desktop"

**Safari (iOS):**
1. Tap Share button
2. Select "Add to Home Screen"

**Safari (macOS):**
1. File menu → "Add to Dock"

The manual instructions are always shown on the install page as a fallback.

## Debug Command

If issues persist, share the output of this command from the browser console:

```javascript
console.log({
  serviceWorker: 'serviceWorker' in navigator,
  displayMode: window.matchMedia('(display-mode: standalone)').matches,
  beforeinstallprompt: 'onbeforeinstallprompt' in window,
  userAgent: navigator.userAgent
});
```






