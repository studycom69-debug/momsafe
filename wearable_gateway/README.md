# MomSafe Wearable Gateway (Phase 1 Prototype)

Minimal, functional Android Flutter prototype connecting to the **MomSafe Band** health band to retrieve real-time and spot physiological telemetry (Heart Rate, SpO₂, Battery Level) using the verified vendor BLE protocol.

---

## 1. Architecture Overview

```
[ MomSafe Band ]
         │
         │ BLE GATT (Service 0xFFF0)
         │  - Write: 0xFFF6 (16-byte frames + CRC-8)
         │  - Notify: 0xFFF7 (GATT notifications)
         ▼
[ MomSafe Wearable Gateway (Android / Flutter) ]
  ├── WearableBleManager (flutter_blue_plus transport)
  ├── MomSafeEncoder (0x55 Spot HR, 0x60 Spot SpO2, 0x13 Battery)
  ├── MomSafeDecoder (BCD timestamp + metric extraction)
  └── Dashboard UI (Live status, Hex diagnostics, Decoded metrics)
```

---

## 2. Prerequisites & Setup

### Requirements
- **Flutter SDK:** 3.19.0 or newer
- **Android Studio / Android SDK:** API Level 34 (compileSdk), minimum Android 5.0 (minSdk 21)
- **Physical Device:** Android smartphone with Bluetooth 5.0+ and Location enabled (BLE scanning requirement)
- **Wearable:** MomSafe Band charged and in range

### Setup & Run Commands

From the workspace root or `wearable_gateway/`:

```bash
cd wearable_gateway

# 1. Fetch dependencies
flutter pub get

# 2. Run protocol unit tests
flutter test test/momsafe_protocol_test.dart

# 3. Connect Android phone via USB (with USB Debugging enabled)
adb devices

# 4. Launch on connected Android device
flutter run
```

Or build an APK directly:
```bash
flutter build apk --debug
# Output will be located at: build/app/outputs/flutter-apk/app-debug.apk
```

---

## 3. Physical Hardware Test Procedure

1. **Band Preparation:**
   - Ensure the 2208A is powered on and charged (display lights up upon touch/wrist gesture).
   - If previously paired to another phone, disconnect or turn off Bluetooth on that phone.
2. **Launch Gateway App:**
   - Open the **MomSafe Gateway** app on your Android phone.
   - Grant Bluetooth and Nearby Devices / Location permissions when prompted.
3. **Scan & Discover:**
   - Tap **"Scan for MomSafe Band"**.
   - Watch the peripheral list populate. The 2208A typically advertises with the name `2208A`, `2208`, or `JStyle`.
4. **Connect:**
   - Tap **"Connect"** next to your band.
   - The status bar will transition: `CONNECTING...` ➔ `DISCOVERING GATT SERVICES...` ➔ `SUBSCRIBING 0xFFF7 NOTIFICATIONS...` ➔ `CONNECTED (GATT 0xFFF0 READY)`.
5. **Spot Heart Rate Reading:**
   - Wear the band snugly on your wrist.
   - Tap **"Spot Heart Rate (0x55)"**.
   - Observe the **HEX DUMP** in the bottom diagnostic terminal:
     - `TX (App->Band)`: `55 00 00 00 ... 55` (16 bytes)
     - `RX (Band->App)`: `55 01 00 [YY MM DD HH mm ss] [HR_BYTE] ... FF`
   - Observe the decoded Heart Rate card update with the real BPM value and measurement timestamp tagged `[LIVE HARDWARE TELEMETRY]`.
6. **Spot SpO₂ Reading:**
   - Tap **"Spot SpO₂ (0x60)"**.
   - Watch the incoming notification packet parse and display Blood Oxygen saturation percentage (e.g. `98%`).
7. **Query Battery Level:**
   - Tap **"Battery (0x13)"**.
   - The band responds immediately with its battery percentage.
8. **Disconnection Test:**
   - Tap **"Disconnect"**. The app closes the GATT channel cleanly and returns to the ready scanning state.
