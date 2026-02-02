# RetireOnSol - Android Build Instructions

## ✅ Capacitor Native Android Setup Complete!

RetireOnSol now supports **native Android notifications** via Capacitor. Your app can:

- ✅ Schedule DCA reminders that work even when the app is closed
- ✅ Send missed DCA alerts
- ✅ Use Android system notifications (appears in notification tray)
- ✅ Work offline and sync when online

---

## 📋 Prerequisites

You'll need:

1. **Android Studio** (latest version)
   - Download: https://developer.android.com/studio
   - Includes Android SDK and build tools

2. **Java Development Kit (JDK) 17+**
   - Check: `java --version`
   - If missing: Install via Android Studio or download separately

3. **Node.js & npm** (already installed)

---

## 🏗️ Build Process

### Step 1: Open in Android Studio

```bash
cd RetireOnSol
npx cap open android
```

This opens the Android project in Android Studio.

### Step 2: Build in Android Studio

1. Wait for Gradle sync to complete (first time takes 5-10 minutes)
2. In Android Studio menu: **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
3. APK will be created at: `android/app/build/outputs/apk/debug/app-debug.apk`

### Step 3: Install on Your Phone

**Option A: Via USB**
```bash
# Enable USB debugging on your Android phone first!
# Settings → About Phone → Tap "Build Number" 7 times
# Settings → Developer Options → Enable USB Debugging

# Install APK
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

**Option B: Transfer APK**
1. Copy `app-debug.apk` to your phone
2. Open the file on your phone
3. Allow installation from unknown sources when prompted
4. Install

---

## 🔔 Testing Notifications

1. **Open the app** on your Android device
2. **Enable Demo Mode**: Click the RetireOnSol logo 5 times quickly
   - Or navigate to: `?demo=true` in URL
3. **Grant notification permission** when prompted
4. **Tap "🔔 Test Notification"** button in the Demo Panel
5. Wait 2 seconds - you should see a notification!

### What the notification service does:

- **DCA Reminders**: Schedule notifications for upcoming DCAs
- **Missed DCA Alerts**: Alert when you miss a scheduled DCA
- **System Integration**: Notifications appear in Android notification tray
- **Background Support**: Works even when app is closed

---

## 🚀 Quick Build Script (Alternative)

If you prefer command-line:

```bash
# Build the web app
npm run build

# Sync to Capacitor
npx cap sync android

# Build APK via Gradle
cd android
./gradlew assembleDebug
cd ..

# APK location
ls -lh android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 📱 Release Build (For Production)

To create a signed release APK:

1. **Generate a signing key**:
```bash
keytool -genkey -v -keystore retireonsol-release.keystore -alias retireonsol -keyalg RSA -keysize 2048 -validity 10000
```

2. **Configure signing** in `android/app/build.gradle`:
```gradle
android {
    ...
    signingConfigs {
        release {
            storeFile file("../../retireonsol-release.keystore")
            storePassword "YOUR_PASSWORD"
            keyAlias "retireonsol"
            keyPassword "YOUR_PASSWORD"
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            ...
        }
    }
}
```

3. **Build release APK**:
```bash
cd android
./gradlew assembleRelease
cd ..

# APK location
ls -lh android/app/build/outputs/apk/release/app-release.apk
```

---

## 🎯 Testing the Full Flow

1. **Create a plan** with demo balances
2. **Click "Execute Plan"**
3. **Go to Monitor tab**
4. **Advance time** using demo controls (+1 Day/Week/Month)
5. When time passes a DCA deadline, the app should:
   - Show "Missed DCA" in the UI
   - **Send a notification** (if you're on Android native app)
   - Allow you to mark it as done

---

## 🐛 Troubleshooting

### Gradle Sync Fails
- **Solution**: Open Android Studio, let it download SDK/build tools automatically
- Check: **File** → **Project Structure** → SDK Location is set

### Notification Permission Denied
- **Solution**: Go to Android Settings → Apps → RetireOnSol → Permissions → Enable Notifications

### APK Won't Install
- **Solution**: Enable "Install from Unknown Sources" in Android Settings
- Check: Settings → Security → Unknown Sources

### Test Notification Button Disabled
- **Solution**: Notification button only appears on native Android (not web)
- Check: Build and install the APK, don't just run in browser

---

## 📦 What's Included

### New Files:
- `capacitor.config.ts` - Capacitor configuration
- `src/services/notificationService.ts` - Notification logic
- `src/hooks/useNotifications.ts` - React hook for notifications
- `android/` - Complete Capacitor Android project

### Modified Files:
- `src/components/DemoPanel.tsx` - Added test notification button
- `android/app/src/main/AndroidManifest.xml` - Notification permissions added

### Permissions Added:
- `POST_NOTIFICATIONS` - Android 13+ notification permission
- `SCHEDULE_EXACT_ALARM` - Precise DCA reminder timing
- `WAKE_LOCK` - Keep device awake for notifications

---

## 🎓 Next Steps

1. **Build the APK** using instructions above
2. **Test notifications** on your Android phone
3. **Integrate with Monitor tab** - schedule real DCA reminders when plan is executed
4. **Add notification actions** - "Mark as Done" button in notification itself
5. **Background sync** - Update portfolio when notification is tapped

---

## 📞 Need Help?

- **Capacitor Docs**: https://capacitorjs.com/docs/android
- **Local Notifications**: https://capacitorjs.com/docs/apis/local-notifications
- **Android Studio**: https://developer.android.com/studio/intro

Commit: cd0d463
