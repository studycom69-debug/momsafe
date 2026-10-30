/// MomSafe Band BLE Command and Key Constants
/// Verified against vendor specification (2208协议文档.docx & blesdk2025_plugin)

class MomSafeGatt {
  /// Standard MomSafe Band primary BLE Service UUID
  static const String serviceUuid = "0000fff0-0000-1000-8000-00805f9b34fb";

  /// Characteristic for writing commands from App to Wearable
  static const String writeCharacteristicUuid = "0000fff6-0000-1000-8000-00805f9b34fb";

  /// Characteristic for receiving notification responses from Wearable to App
  static const String notifyCharacteristicUuid = "0000fff7-0000-1000-8000-00805f9b34fb";

  /// Standard Client Characteristic Configuration Descriptor (CCCD)
  static const String cccdDescriptorUuid = "00002902-0000-1000-8000-00805f9b34fb";
}

class MomSafeCmd {
  static const int setTime = 0x01;
  static const int getTime = 0x41;
  static const int getBatteryLevel = 0x13;
  static const int getMacAddress = 0x22;
  static const int getVersion = 0x27;
  
  // Health measurements & history queries
  static const int getOnceHeartData = 0x55;      // Spot / single heart rate reading
  static const int getDynamicHeartData = 0x54;   // Continuous dynamic heart rate array
  static const int getBloodOxygen = 0x60;        // Spot / manual SpO2 test
  static const int getAutoBloodOxygen = 0x66;    // Periodic auto SpO2 records
  static const int getHrvTestData = 0x56;        // Heart rate variability & stress test
  static const int getTempHistory = 0x62;        // Surface temperature history
  static const int getAxillaryTemp = 0x65;       // Axillary temperature records
  static const int getTotalActivity = 0x51;      // Daily summary (steps, calories, distance)
  static const int getDetailActivity = 0x52;     // Minute-by-minute activity breakdown
  static const int getSleepData = 0x53;          // Sleep duration and sleep stage blocks
  static const int enableActivity = 0x09;        // Real-time step & optical sensor stream (bytes[21] = live HR)
  static const int measurementWithType = 0x28;   // Real-time on-demand measurement trigger
}

enum MeasurementType {
  heartRate,
  spo2,
  hrv,
  stress,
  sleep,
  temperature,
  skinTemperature,
  battery,
  bloodPressure,
}

enum ReadingSource {
  /// Historical interval/spot record retrieved from band flash memory (e.g., 0x55, 0x60)
  historicalSync,
  /// Real-time continuous sensor stream from band (e.g., optical PPG 0x09, active exercise 0x18)
  liveSensor,
  /// Genuine on-demand measurement triggered via 0x28 and verified fresh via post-measurement query
  onDemandMeasurement,
  /// Direct device-reported hardware status without separate device clock timestamp (e.g., battery 0x13)
  deviceReported,
  /// Cached reading reloaded from memory on app resume
  cached,
}

