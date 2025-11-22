# Browser Notifications Guide

## Overview

Your Astro app now includes **browser notifications** that alert users when document processing is complete - **no backend or external services required!**

## ✨ What Was Added

### 1. **Notification Utilities** (`src/lib/notifications.ts`)

Complete notification system with:
- Permission management
- Success notifications for completed processing
- Error notifications for failed processing  
- User-friendly permission requests
- Automatic icon integration with PWA icons

### 2. **Permission Banner** (`src/components/NotificationPermissionBanner.tsx`)

Friendly UI component that:
- Appears on the upload page
- Requests permission with a clear explanation
- Can be dismissed (remembered for the session)
- Shows confirmation when enabled
- Automatically hides when not needed

### 3. **Integration Points**

Notifications trigger automatically when:
- ✅ **PDF Validation completes** - in `useValidationPolling` hook

## 🚀 How It Works

### User Flow

1. User visits `/upload` page
2. Sees banner: "🔔 Povolit notifikace?"
3. Clicks "Povolit" button
4. Browser asks for permission
5. User grants permission
6. Receives confirmation notification
7. Uploads and processes document
8. Works in another tab
9. Gets notification when complete! ✅

### Technical Flow

```typescript
// When processing completes
notifyProcessingComplete(documentName)
  ↓
// Check permission
getNotificationPermission() === 'granted'
  ↓
// Show browser notification
new Notification(title, options)
  ↓
// User clicks notification
window.focus() // Brings app to front
```

## 📋 API Reference

### `requestNotificationPermission()`
Request permission from user. Returns: `'granted'`, `'denied'`, or `'default'`

### `canShowNotifications()`
Check if notifications are supported and permitted. Returns: `boolean`

### `getNotificationPermission()`
Get current permission state without requesting.

### `showNotification(options)`
Show a custom notification:
```typescript
showNotification({
  title: 'Title',
  body: 'Message',
  icon: '/pwa-192x192.png', // optional
  tag: 'unique-tag',        // optional
  requireInteraction: false, // optional
  onClick: () => { }        // optional
});
```

### `notifyProcessingComplete(documentName?)`
Predefined success notification for completed processing.

### `notifyProcessingFailed(error?)`
Predefined error notification for failed processing.

### `requestNotificationPermissionWithFeedback()`
Request permission with confirmation notification.

## 🔧 Customization

### Change Notification Messages

Edit `src/lib/notifications.ts`:

```typescript
export async function notifyProcessingComplete(documentName?: string) {
  await showNotification({
    title: '✅ Your custom title',
    body: 'Your custom message',
    // ... other options
  });
}
```

### Change Banner Text

Edit `src/components/NotificationPermissionBanner.tsx`:

```tsx
<h3 className="text-sm font-semibold text-blue-900 mb-1">
  Your custom title
</h3>
<p className="text-sm text-blue-800">
  Your custom description
</p>
```

### Add Notifications to Other Events

```typescript
import { showNotification } from "@/lib/notifications";

// In your component/hook
await showNotification({
  title: 'Custom Event',
  body: 'Something happened!',
  tag: 'custom-event',
});
```

## 🧪 Testing

### Local Testing

1. Start dev server: `npm run dev`
2. Navigate to `http://localhost:4321/upload`
3. Enable notifications when prompted
4. Upload a document
5. Open DevTools Console to see notification logs
6. Switch tabs and wait for processing

### Production Testing

1. Build: `npm run build`
2. Preview: `npm run preview`
3. Test same flow as above

### Debug Mode

Open DevTools Console to see notification-related logs:
- Permission requests
- Notification triggers
- Errors and warnings

## 🌐 Browser Compatibility

| Browser | Desktop | Mobile | Notes |
|---------|---------|--------|-------|
| Chrome | ✅ | ✅ | Full support |
| Edge | ✅ | ✅ | Full support |
| Firefox | ✅ | ✅ | Full support |
| Safari | ✅ (16+) | ✅ (16.4+) | Requires recent version |
| Samsung Internet | ➖ | ✅ | Mobile only |

## 🐛 Troubleshooting

### Notifications Not Showing

**Check permission:**
```typescript
console.log(Notification.permission); // Should be 'granted'
```

**Reset permission:**
- Chrome: Address bar → Lock icon → Reset permissions
- Firefox: Lock icon → More Info → Permissions → Notifications
- Safari: Safari → Settings → Websites → Notifications

### Banner Not Appearing

Check these conditions:
1. Browser supports notifications? `'Notification' in window`
2. Permission not already granted/denied?
3. User hasn't dismissed it this session?
4. Check sessionStorage: `sessionStorage.getItem('notification-banner-dismissed')`

### Permission Request Doesn't Show

**Issue:** Must be called from user interaction (click event)

**Solution:** The banner's "Povolit" button triggers the request - don't auto-request on page load.

### Notifications Silent/No Sound

Browser notifications typically:
- Don't play sounds in "Do Not Disturb" mode
- Follow OS notification settings
- May be silent by default in some browsers

This is normal browser behavior and cannot be overridden.

## 🔒 Privacy & Security

### No Data Leaves the Browser

- Notifications are purely client-side
- No data sent to external servers
- No analytics or tracking
- Permission stored in browser only

### HTTPS Required (Production)

Browser notifications require HTTPS in production (or localhost for testing).

### User Control

Users can:
- Deny permission
- Revoke permission anytime
- Block site notifications in browser settings
- Dismiss the permission banner

## 📊 Session Storage

The app uses sessionStorage to remember:
- `notification-banner-dismissed`: User dismissed the banner (clears on tab close)

No cookies or localStorage used for notifications.

## 🎯 Best Practices

### ✅ Do's

- Request permission with clear explanation
- Show confirmation when permission granted
- Use notifications sparingly (only for important events)
- Respect user's decision if they deny
- Provide value (notify about completed work)

### ❌ Don'ts

- Don't auto-request on page load
- Don't spam notifications
- Don't require notifications to use the app
- Don't request again after denial (respect choice)
- Don't send marketing messages

## 💡 Examples

### Custom Success Notification

```typescript
import { showNotification } from "@/lib/notifications";

await showNotification({
  title: 'Export Complete',
  body: 'Your Excel file is ready!',
  icon: '/pwa-192x192.png',
  tag: 'export-complete',
  onClick: () => {
    // Navigate to downloads
    window.location.href = '/download';
  }
});
```

### Custom Warning Notification

```typescript
await showNotification({
  title: '⚠️ Warning',
  body: 'Some records were skipped',
  requireInteraction: true, // Stays until clicked
  tag: 'warning',
});
```

### Notification with Action

```typescript
await showNotification({
  title: 'Document Ready',
  body: 'Click to view results',
  onClick: () => {
    window.focus();
    // Scroll to results or show modal
    document.getElementById('results')?.scrollIntoView();
  }
});
```

## 🔗 Related Files

- `/src/lib/notifications.ts` - Core notification logic
- `/src/components/NotificationPermissionBanner.tsx` - Permission UI
- `/src/components/ValidationStatusPoller/hooks/useValidationPolling.ts` - Validation notifications
- `/src/pages/upload.astro` - Banner integration
- `/public/pwa-192x192.png` - Notification icon

## 📚 Resources

- [MDN: Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)
- [MDN: Using the Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API)
- [Can I Use: Notifications](https://caniuse.com/notifications)

---

**No backend required. No external services. Just modern browser APIs.** 🎉

