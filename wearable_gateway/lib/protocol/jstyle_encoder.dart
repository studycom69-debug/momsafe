import 'dart:typed_data';
import 'jstyle_constants.dart';

/// Formats 16-byte fixed-length command packets with additive CRC-8 checksum
/// according to the J-Style 2208A vendor protocol.
class JStyleEncoder {
  static const int packetLength = 16;

  /// Creates a zero-initialized 16-byte buffer
  static List<int> _createBuffer() {
    return List<int>.filled(packetLength, 0);
  }

  /// Calculates CRC-8 as the lower 8 bits of the sum of bytes 0 through 14
  static void _applyCrc(List<int> packet) {
    int sum = 0;
    for (int i = 0; i < packet.length - 1; i++) {
      sum += packet[i];
    }
    packet[packet.length - 1] = sum & 0xFF;
  }

  /// Command 0x55: Request spot/single heart rate reading
  /// [mode]: 0 = read latest, 2 = continue next, 0x99 = delete/ack
  static Uint8List buildGetSpotHeartRate({int mode = 0}) {
    final packet = _createBuffer();
    packet[0] = JStyleCmd.getOnceHeartData;
    packet[1] = mode;
    _applyCrc(packet);
    return Uint8List.fromList(packet);
  }

  /// Command 0x60: Request spot blood oxygen (SpO2) reading
  /// [mode]: 0 = read latest, 2 = continue next, 0x99 = delete/ack
  static Uint8List buildGetBloodOxygen({int mode = 0}) {
    final packet = _createBuffer();
    packet[0] = JStyleCmd.getBloodOxygen;
    packet[1] = mode;
    _applyCrc(packet);
    return Uint8List.fromList(packet);
  }

  /// Command 0x56: Request spot HRV (Heart Rate Variability / stress) reading
  /// [mode]: 0 = read latest, 2 = continue next, 0x99 = delete/ack
  static Uint8List buildGetHrvData({int mode = 0}) {
    final packet = _createBuffer();
    packet[0] = JStyleCmd.getHrvTestData; // 0x56
    packet[1] = mode;
    _applyCrc(packet);
    return Uint8List.fromList(packet);
  }

  /// Command 0x62: Request stored temperature history records
  /// [mode]: 0 = read latest, 2 = continue next, 0x99 = delete/ack
  static Uint8List buildGetTemperatureData({int mode = 0}) {
    final packet = _createBuffer();
    packet[0] = JStyleCmd.getTempHistory; // 0x62
    packet[1] = mode;
    _applyCrc(packet);
    return Uint8List.fromList(packet);
  }

  /// Command 0x65: Request stored axillary / spot temperature records
  /// [mode]: 0 = read latest, 2 = continue next, 0x99 = delete/ack
  static Uint8List buildGetAxillaryTemperatureData({int mode = 0}) {
    final packet = _createBuffer();
    packet[0] = JStyleCmd.getAxillaryTemp; // 0x65
    packet[1] = mode;
    _applyCrc(packet);
    return Uint8List.fromList(packet);
  }

  /// Command 0x53: Request stored sleep history records
  /// [mode]: 0 = read latest, 2 = continue next, 0x99 = delete/ack
  static Uint8List buildGetSleepData({int mode = 0}) {
    final packet = _createBuffer();
    packet[0] = JStyleCmd.getSleepData; // 0x53
    packet[1] = mode;
    _applyCrc(packet);
    return Uint8List.fromList(packet);
  }

  /// Command 0x13: Query device battery percentage
  static Uint8List buildGetBatteryLevel() {
    final packet = _createBuffer();
    packet[0] = JStyleCmd.getBatteryLevel;
    _applyCrc(packet);
    return Uint8List.fromList(packet);
  }

  /// Command 0x28: Start or stop real-time measurement on the band
  /// [dataType]: 1 = HRV, 2 = Heart Rate, 3 = SpO2
  /// [open]: true = start live test, false = stop live test
  /// [openPpg]: optional flag for raw PPG stream (HRV mode)
  /// [openPpi]: optional flag for RR/PPI interval stream (HRV mode)
  static Uint8List buildLiveMeasurementTrigger({
    required int dataType,
    required bool open,
    bool openPpg = false,
    bool openPpi = false,
  }) {
    final packet = _createBuffer();
    packet[0] = JStyleCmd.measurementWithType;
    packet[1] = dataType;
    packet[2] = open ? 0x01 : 0x00;
    if (dataType == 1) {
      packet[3] = openPpg ? 0x01 : 0x00;
      packet[4] = openPpi ? 0x01 : 0x00;
    }
    _applyCrc(packet);
    return Uint8List.fromList(packet);
  }

  /// Command 0x09: Start or stop real-time optical sensor & activity stream
  /// [enable]: true = start stream, false = stop stream
  /// [tempEnable]: true = include temperature, false = exclude
  static Uint8List buildRealTimeActivity({required bool enable, bool tempEnable = true}) {
    final packet = _createBuffer();
    packet[0] = JStyleCmd.enableActivity; // 0x09
    packet[1] = enable ? 0x01 : 0x00;
    packet[2] = tempEnable ? 0x01 : 0x00;
    _applyCrc(packet);
    return Uint8List.fromList(packet);
  }
}

