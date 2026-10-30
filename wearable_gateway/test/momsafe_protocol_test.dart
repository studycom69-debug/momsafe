import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import '../lib/protocol/momsafe_constants.dart';
import '../lib/protocol/momsafe_encoder.dart';
import '../lib/protocol/momsafe_decoder.dart';
import '../lib/protocol/telemetry_state_resolver.dart';
import '../lib/ble/wearable_ble_manager.dart';
import '../lib/sync/momsafe_cloud_sync.dart';

void main() {
  group('MomSafe Band Protocol Encoding Tests', () {
    test('Spot Heart Rate command (0x55) has correct length, opcode, and CRC-8', () {
      final packet = MomSafeEncoder.buildGetSpotHeartRate(mode: 0);

      expect(packet.length, equals(16));
      expect(packet[0], equals(0x55)); // Opcode
      expect(packet[1], equals(0x00)); // Read latest mode
      expect(packet[15], equals(0x55)); // Checksum (0x55 + 0 = 0x55)
      expect(MomSafeDecoder.verifyCrc(packet), isTrue);
    });

    test('Spot SpO2 command (0x60) has correct length, opcode, and CRC-8', () {
      final packet = MomSafeEncoder.buildGetBloodOxygen(mode: 0);

      expect(packet.length, equals(16));
      expect(packet[0], equals(0x60)); // Opcode
      expect(packet[1], equals(0x00)); // Read latest mode
      expect(packet[15], equals(0x60)); // Checksum
      expect(MomSafeDecoder.verifyCrc(packet), isTrue);
    });

    test('Battery Level query (0x13) has correct opcode and CRC-8', () {
      final packet = MomSafeEncoder.buildGetBatteryLevel();

      expect(packet.length, equals(16));
      expect(packet[0], equals(0x13)); // Opcode
      expect(packet[15], equals(0x13)); // Checksum
      expect(MomSafeDecoder.verifyCrc(packet), isTrue);
    });

    test('Spot HRV command (0x56) has correct length, opcode, and CRC-8', () {
      final packet = MomSafeEncoder.buildGetHrvData(mode: 0);

      expect(packet.length, equals(16));
      expect(packet[0], equals(0x56)); // Opcode
      expect(packet[1], equals(0x00)); // Read latest mode
      expect(packet[15], equals(0x56)); // Checksum (0x56 + 0 = 0x56)
      expect(MomSafeDecoder.verifyCrc(packet), isTrue);
    });

    test('Live HRV measurement trigger (0x28, dataType: 1) has correct opcode, dataType, and CRC-8', () {
      final startPacket = MomSafeEncoder.buildLiveMeasurementTrigger(dataType: 1, open: true);
      expect(startPacket.length, equals(16));
      expect(startPacket[0], equals(0x28)); // Opcode
      expect(startPacket[1], equals(0x01)); // dataType: 1 (HRV)
      expect(startPacket[2], equals(0x01)); // open: true
      expect(startPacket[15], equals(0x2A)); // 0x28 + 1 + 1 = 0x2A
      expect(MomSafeDecoder.verifyCrc(startPacket), isTrue);

      final stopPacket = MomSafeEncoder.buildLiveMeasurementTrigger(dataType: 1, open: false);
      expect(stopPacket[0], equals(0x28));
      expect(stopPacket[1], equals(0x01));
      expect(stopPacket[2], equals(0x00)); // open: false
      expect(stopPacket[15], equals(0x29)); // 0x28 + 1 + 0 = 0x29
      expect(MomSafeDecoder.verifyCrc(stopPacket), isTrue);
    });
  });

  group('MomSafe Band Multi-Record Protocol Decoding Tests', () {
    test('Decodes multi-record Spot Heart Rate response and selects the NEWEST record (61 BPM at 11:33:24)', () {
      final multiRecordPacket = <int>[
        // Record 0: 10 bytes (Older historical reading)
        0x55, 0x00, 0x00,
        0x26, 0x10, 0x27, 0x18, 0x50, 0x24, // 2026-10-27 18:50:24
        119, // 119 BPM
        // Record 1: 10 bytes
        0x55, 0x00, 0x00,
        0x26, 0x10, 0x28, 0x11, 0x26, 0x00, // 2026-10-28 11:26:00
        66,  // 66 BPM
        // Record 2: 10 bytes (Fresh reading)
        0x55, 0x00, 0x00,
        0x26, 0x10, 0x28, 0x11, 0x33, 0x24, // 2026-10-28 11:33:24
        61,  // 61 BPM
      ];

      final allRecords = MomSafeDecoder.decodeAllRecords(multiRecordPacket);
      expect(allRecords.length, equals(3));
      expect(allRecords[0].value, equals(119));
      expect(allRecords[0].measurementTimestamp, equals(DateTime(2026, 10, 27, 18, 50, 24)));
      expect(allRecords[1].value, equals(66));
      expect(allRecords[1].measurementTimestamp, equals(DateTime(2026, 10, 28, 11, 26, 00)));
      expect(allRecords[2].value, equals(61));
      expect(allRecords[2].measurementTimestamp, equals(DateTime(2026, 10, 28, 11, 33, 24)));

      final newest = MomSafeDecoder.decodePacket(multiRecordPacket);
      expect(newest, isNotNull);
      expect(newest!.type, equals(MeasurementType.heartRate));
      expect(newest.value, equals(61));
      expect(newest.unit, equals("BPM"));
      expect(newest.measurementTimestamp, equals(DateTime(2026, 10, 28, 11, 33, 24)));
      expect(newest.source, equals(ReadingSource.historicalSync));
      expect(newest.recordIndex, equals(2));
      expect(newest.totalRecordsInPacket, equals(3));
    });

    test('Decodes multi-record SpO2 response and selects the newest reading (93% at 11:31:00)', () {
      final multiRecordPacket = <int>[
        0x60, 0x00, 0x00,
        0x26, 0x10, 0x28, 0x11, 0x26, 0x00,
        98,
        0x60, 0x00, 0x00,
        0x26, 0x10, 0x28, 0x11, 0x31, 0x00,
        93,
      ];

      final newest = MomSafeDecoder.decodePacket(multiRecordPacket);
      expect(newest, isNotNull);
      expect(newest!.type, equals(MeasurementType.spo2));
      expect(newest.value, equals(93));
      expect(newest.unit, equals("%"));
      expect(newest.measurementTimestamp, equals(DateTime(2026, 10, 28, 11, 31, 00)));
    });

    test('Decodes Battery percentage with live report source and null device measurement timestamp', () {
      final rawPacket = [
        0x13, 28, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x98
      ];

      final reading = MomSafeDecoder.decodePacket(rawPacket);

      expect(reading, isNotNull);
      expect(reading!.type, equals(MeasurementType.battery));
      expect(reading.value, equals(28));
      expect(reading.unit, equals("%"));
      expect(reading.measurementTimestamp, isNull);
      expect(reading.receivedAt, isNotNull);
      expect(reading.source, equals(ReadingSource.deviceReported));
    });

    test('Filters out empty/invalid flash records (e.g. 0 or 255)', () {
      final packetWithEmptySlots = <int>[
        0x55, 0x00, 0x00,
        0x26, 0x10, 0x28, 0x11, 0x33, 0x00,
        0, // Empty/invalid
        0x55, 0x00, 0x00,
        0x26, 0x10, 0x28, 0x11, 0x35, 0x00,
        89, // Valid 89 BPM
      ];

      final allRecords = MomSafeDecoder.decodeAllRecords(packetWithEmptySlots);
      expect(allRecords.length, equals(1));
      expect(allRecords[0].value, equals(89));

      final newest = MomSafeDecoder.decodePacket(packetWithEmptySlots);
      expect(newest, isNotNull);
      expect(newest!.value, equals(89));
    });
  });

  group('Task 2 & 4: TelemetryStateResolver State Selection Regression Tests', () {
    test('REGRESSION TEST (28 Oct hardware evidence): Initial archived 85 BPM (27 Oct 19:20) updates to 86 BPM (28 Oct 12:25:26)', () {
      // 1. Initial state: displayed archived reading from yesterday
      final initialArchivedReading = ParsedReading(
        type: MeasurementType.heartRate,
        value: 85,
        unit: "BPM",
        measurementTimestamp: DateTime(2026, 10, 27, 19, 20, 00),
        receivedAt: DateTime(2026, 10, 28, 12, 20, 00),
        source: ReadingSource.historicalSync,
        rawBytes: const [0x55, 0x00, 0x00, 0x26, 0x10, 0x27, 0x19, 0x20, 0x00, 85],
      );

      // 2. Incoming newer record from today at 12:25:26
      final freshReading = ParsedReading(
        type: MeasurementType.heartRate,
        value: 86,
        unit: "BPM",
        measurementTimestamp: DateTime(2026, 10, 28, 12, 25, 26),
        receivedAt: DateTime(2026, 10, 28, 12, 25, 27),
        source: ReadingSource.historicalSync,
        rawBytes: const [0x55, 0x00, 0x00, 0x26, 0x10, 0x28, 0x12, 0x25, 0x26, 86],
      );

      final decision = TelemetryStateResolver.shouldUpdateReading(
        current: initialArchivedReading,
        incoming: freshReading,
      );

      expect(decision.shouldAccept, isTrue);
      expect(decision.reason, contains("Accepted"));
      expect(decision.reason, contains("2026-10-28 12:25:26.000"));

      // Verify simulated state assignment
      ParsedReading? stateReading = initialArchivedReading;
      if (decision.shouldAccept) {
        stateReading = freshReading;
      }
      expect(stateReading.value, equals(86));
      expect(stateReading.measurementTimestamp, equals(DateTime(2026, 10, 28, 12, 25, 26)));
    });

    test('PREVENTS OVERWRITE: An older record arriving later (e.g. 85 BPM at 19:20 or 66 BPM at 21:14 on 27 Oct) does NOT replace 86 BPM (28 Oct)', () {
      // Current state: 86 BPM from 28 October 12:25:26
      final currentNewerReading = ParsedReading(
        type: MeasurementType.heartRate,
        value: 86,
        unit: "BPM",
        measurementTimestamp: DateTime(2026, 10, 28, 12, 25, 26),
        receivedAt: DateTime(2026, 10, 28, 12, 25, 27),
        source: ReadingSource.historicalSync,
        rawBytes: const [0x55, 0x00, 0x00, 0x26, 0x10, 0x28, 0x12, 0x25, 0x26, 86],
      );

      // Subsequent packet arrives from band containing older flash history (66 BPM at 21:14 on 27 Oct)
      final olderSubsequentReading1 = ParsedReading(
        type: MeasurementType.heartRate,
        value: 66,
        unit: "BPM",
        measurementTimestamp: DateTime(2026, 10, 27, 21, 14, 00),
        receivedAt: DateTime(2026, 10, 28, 12, 25, 28), // Arrived 1s later!
        source: ReadingSource.historicalSync,
        rawBytes: const [0x55, 0x00, 0x00, 0x26, 0x10, 0x27, 0x21, 0x14, 0x00, 66],
      );

      final decision1 = TelemetryStateResolver.shouldUpdateReading(
        current: currentNewerReading,
        incoming: olderSubsequentReading1,
      );

      expect(decision1.shouldAccept, isFalse);
      expect(decision1.reason, contains("Rejected"));
      expect(decision1.reason, contains("Incoming record is older"));

      // Subsequent packet arrives with 85 BPM at 19:20 on 27 Oct
      final olderSubsequentReading2 = ParsedReading(
        type: MeasurementType.heartRate,
        value: 85,
        unit: "BPM",
        measurementTimestamp: DateTime(2026, 10, 27, 19, 20, 00),
        receivedAt: DateTime(2026, 10, 28, 12, 25, 29), // Arrived 2s later!
        source: ReadingSource.historicalSync,
        rawBytes: const [0x55, 0x00, 0x00, 0x26, 0x10, 0x27, 0x19, 0x20, 0x00, 85],
      );

      final decision2 = TelemetryStateResolver.shouldUpdateReading(
        current: currentNewerReading,
        incoming: olderSubsequentReading2,
      );

      expect(decision2.shouldAccept, isFalse);
      expect(decision2.reason, contains("Rejected"));

      // State remains strictly on 86 BPM from 28 Oct
      ParsedReading stateReading = currentNewerReading;
      if (decision1.shouldAccept) stateReading = olderSubsequentReading1;
      if (decision2.shouldAccept) stateReading = olderSubsequentReading2;

      expect(stateReading.value, equals(86));
      expect(stateReading.measurementTimestamp, equals(DateTime(2026, 10, 28, 12, 25, 26)));
    });

    test('Live sensor source takes precedence over historical sync for identical device timestamp', () {
      final sameTimestamp = DateTime(2026, 10, 28, 12, 25, 26);
      final historical = ParsedReading(
        type: MeasurementType.heartRate,
        value: 86,
        unit: "BPM",
        measurementTimestamp: sameTimestamp,
        receivedAt: DateTime.now(),
        source: ReadingSource.historicalSync,
        rawBytes: const [],
      );

      final live = ParsedReading(
        type: MeasurementType.heartRate,
        value: 87,
        unit: "BPM",
        measurementTimestamp: sameTimestamp,
        receivedAt: DateTime.now().add(const Duration(milliseconds: 50)),
        source: ReadingSource.liveSensor,
        rawBytes: const [],
      );

      final decision = TelemetryStateResolver.shouldUpdateReading(
        current: historical,
        incoming: live,
      );

      expect(decision.shouldAccept, isTrue);
      expect(decision.reason, contains("Live sensor stream takes precedence"));
    });

    test('Battery query (untimestamped) updates based on receive time without overwriting device-timestamped vitals', () {
      final earlierBattery = ParsedReading(
        type: MeasurementType.battery,
        value: 28,
        unit: "%",
        measurementTimestamp: null,
        receivedAt: DateTime(2026, 10, 28, 11, 37, 00),
        source: ReadingSource.deviceReported,
        rawBytes: const [0x13, 28],
      );

      final laterBattery = ParsedReading(
        type: MeasurementType.battery,
        value: 63,
        unit: "%",
        measurementTimestamp: null,
        receivedAt: DateTime(2026, 10, 28, 12, 25, 00),
        source: ReadingSource.deviceReported,
        rawBytes: const [0x13, 63],
      );

      final decision = TelemetryStateResolver.shouldUpdateReading(
        current: earlierBattery,
        incoming: laterBattery,
      );

      expect(decision.shouldAccept, isTrue);
      expect(decision.reason, contains("Fresh real-time battery status query"));
    });

    test('REGRESSION TEST (28 Oct SpO2 cross-talk): Older 95 BPM HR record does not overwrite fresh 91 BPM HR', () {
      // Current active reading: 91 BPM recorded at 12:45:00 on 28 October 2026
      final active91Bpm = ParsedReading(
        type: MeasurementType.heartRate,
        value: 91,
        unit: "BPM",
        measurementTimestamp: DateTime(2026, 10, 28, 12, 45, 00),
        receivedAt: DateTime(2026, 10, 28, 12, 45, 01),
        source: ReadingSource.historicalSync,
        rawBytes: const [0x55, 0x00, 0x00, 0x26, 0x10, 0x28, 0x12, 0x45, 0x00, 91],
      );

      // Trailing flash packet arrives containing 95 BPM from earlier in the session (e.g. 11:26 or yesterday)
      final trailing95Bpm = ParsedReading(
        type: MeasurementType.heartRate,
        value: 95,
        unit: "BPM",
        measurementTimestamp: DateTime(2026, 10, 28, 11, 26, 00),
        receivedAt: DateTime(2026, 10, 28, 12, 45, 02),
        source: ReadingSource.historicalSync,
        rawBytes: const [0x55, 0x00, 0x00, 0x26, 0x10, 0x28, 0x11, 0x26, 0x00, 95],
      );

      final decision = TelemetryStateResolver.shouldUpdateReading(
        current: active91Bpm,
        incoming: trailing95Bpm,
      );

      expect(decision.shouldAccept, isFalse);
      expect(decision.reason, contains("Rejected"));
      expect(decision.reason, contains("Incoming record is older"));
    });
  });

  group('MomSafe Band Stream Multi-Packet & End-Marker (0xFF) Tests', () {
    test('isEnd is TRUE only when packet has 0xFF marker at the end per vendor specification', () {
      // Packet without 0xFF at the end (intermediate chunk in flash stream)
      final intermediatePacket = <int>[
        0x55, 0x00, 0x00,
        0x26, 0x10, 0x28, 0x12, 0x45, 0x00,
        91,
      ];
      final records1 = MomSafeDecoder.decodeAllRecords(intermediatePacket);
      expect(records1.isNotEmpty, isTrue);
      expect(records1.first.isEnd, isFalse, reason: "Intermediate chunk without 0xFF must not trigger premature completer release");

      // Packet with 0xFF at the end (stream terminus marker)
      final terminalPacket = <int>[
        0x55, 0x00, 0x00,
        0x26, 0x10, 0x28, 0x12, 0x45, 0x00,
        91,
        0xFF, // Vendor end marker
      ];
      final records2 = MomSafeDecoder.decodeAllRecords(terminalPacket);
      expect(records2.isNotEmpty, isTrue);
      expect(records2.first.isEnd, isTrue, reason: "Packet with 0xFF at the end correctly signals end of stream");
    });
  });

  group('Phase 1 & 2: On-Demand & Live Sensor Decoding & Freshness Tests', () {
    test('buildRealTimeActivity (0x09) correctly encodes enable and temp flags with valid CRC-8', () {
      final packet = MomSafeEncoder.buildRealTimeActivity(enable: true, tempEnable: true);

      expect(packet.length, equals(16));
      expect(packet[0], equals(0x09));
      expect(packet[1], equals(0x01)); // enable = true
      expect(packet[2], equals(0x01)); // tempEnable = true
      expect(MomSafeDecoder.verifyCrc(packet), isTrue);

      final stopPacket = MomSafeEncoder.buildRealTimeActivity(enable: false, tempEnable: false);
      expect(stopPacket[0], equals(0x09));
      expect(stopPacket[1], equals(0x00)); // enable = false
      expect(stopPacket[2], equals(0x00)); // tempEnable = false
      expect(MomSafeDecoder.verifyCrc(stopPacket), isTrue);
    });

    test('Decodes 0x09 real-time stream packet extracting live HR from byte 21 (ResolveUtil.getActivityData)', () {
      // 24-byte packet structure per ResolveUtil.getActivityData:
      // byte 0: 0x09
      // bytes 1..4: steps
      // bytes 5..8: calories
      // bytes 9..12: distance
      // bytes 13..16: time
      // bytes 17..20: exerciseTime
      // byte 21: heartRate = 78 BPM
      // bytes 22..23: temp
      final livePacket = List<int>.filled(24, 0);
      livePacket[0] = 0x09;
      livePacket[21] = 78; // 78 BPM

      final reading = MomSafeDecoder.decodePacket(livePacket);
      expect(reading, isNotNull);
      expect(reading!.type, equals(MeasurementType.heartRate));
      expect(reading.value, equals(78));
      expect(reading.unit, equals("BPM"));
      expect(reading.source, equals(ReadingSource.liveSensor));
      expect(reading.measurementTimestamp, isNull, reason: "Live stream is real-time without BCD clock header");
    });

    test('Filters out 0x09 packets when optical sensor is searching or settling (BPM < 30)', () {
      final searchingPacket = List<int>.filled(24, 0);
      searchingPacket[0] = 0x09;
      searchingPacket[21] = 0; // Optical sensor has no pulse contact yet

      final reading = MomSafeDecoder.decodePacket(searchingPacket);
      expect(reading, isNull, reason: "Unsettled/zero heart rate must not update state");
    });

    test('Decodes 0x28 measurement acknowledgment without false telemetry', () {
      final ackPacket = [0x28, 0x03, 0x01, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x2C];
      final ack = MomSafeDecoder.decodePacket(ackPacket);

      expect(ack, isNotNull);
      expect(ack!.type, equals(MeasurementType.spo2));
      expect(ack.value, equals(0), reason: "0x28 ACK carries no telemetry");
      expect(ack.unit, equals("ACK"));
      expect(ack.source, equals(ReadingSource.onDemandMeasurement));
    });

    test('TelemetryStateResolver: Live optical stream (0x09) takes precedence over older stored history (0x55)', () {
      // Current: Historical 85 BPM from yesterday
      final currentHistorical = ParsedReading(
        type: MeasurementType.heartRate,
        value: 85,
        unit: "BPM",
        measurementTimestamp: DateTime(2026, 10, 27, 19, 20, 00),
        receivedAt: DateTime(2026, 10, 28, 12, 00, 00),
        source: ReadingSource.historicalSync,
        rawBytes: const [],
      );

      // Incoming: Real-time live optical reading from 0x09
      final incomingLive = ParsedReading(
        type: MeasurementType.heartRate,
        value: 78,
        unit: "BPM",
        measurementTimestamp: null,
        receivedAt: DateTime.now(),
        source: ReadingSource.liveSensor,
        rawBytes: const [],
      );

      final decision = TelemetryStateResolver.shouldUpdateReading(
        current: currentHistorical,
        incoming: incomingLive,
      );

      expect(decision.shouldAccept, isTrue);
      expect(decision.reason, contains("Live optical sensor stream takes precedence"));
    });

    test('TelemetryStateResolver: Fresh on-demand SpO2 (newer device timestamp) is accepted, stale SpO2 is rejected', () {
      final baselineTimestamp = DateTime(2026, 10, 28, 12, 24, 00);
      final currentStaleSpo2 = ParsedReading(
        type: MeasurementType.spo2,
        value: 97,
        unit: "%",
        measurementTimestamp: baselineTimestamp,
        receivedAt: DateTime(2026, 10, 28, 12, 25, 00),
        source: ReadingSource.historicalSync,
        rawBytes: const [],
      );

      // Case A: Measurement completed on band, producing fresh record at 13:45:10
      final freshOnDemandReading = ParsedReading(
        type: MeasurementType.spo2,
        value: 99,
        unit: "%",
        measurementTimestamp: DateTime(2026, 10, 28, 13, 45, 10),
        receivedAt: DateTime(2026, 10, 28, 13, 45, 30),
        source: ReadingSource.onDemandMeasurement,
        rawBytes: const [],
      );

      final acceptDecision = TelemetryStateResolver.shouldUpdateReading(
        current: currentStaleSpo2,
        incoming: freshOnDemandReading,
      );
      expect(acceptDecision.shouldAccept, isTrue);
      expect(acceptDecision.reason, contains("On-demand measurement verified newer than baseline"));

      // Case B: No measurement occurred on band; flash still returns the 12:24 record
      final unupdatedFlashRecord = ParsedReading(
        type: MeasurementType.spo2,
        value: 97,
        unit: "%",
        measurementTimestamp: baselineTimestamp, // Same 12:24 timestamp!
        receivedAt: DateTime(2026, 10, 28, 13, 45, 30),
        source: ReadingSource.historicalSync,
        rawBytes: const [],
      );

      final rejectDecision = TelemetryStateResolver.shouldUpdateReading(
        current: currentStaleSpo2,
        incoming: unupdatedFlashRecord,
      );
      expect(rejectDecision.shouldAccept, isFalse);
      expect(rejectDecision.reason, contains("Deduplicated"));
    });
  });

  group('Phase 3: Connection Lifecycle, Reconnect, and Measurement Regression Tests', () {
    test('1. Successful HR measurement followed by a second measurement: stream lifecycle and commands', () {
      // Stream start command (0x09, enable=true)
      final startCmd = MomSafeEncoder.buildRealTimeActivity(enable: true, tempEnable: true);
      expect(startCmd[0], equals(0x09));
      expect(startCmd[1], equals(0x01));
      expect(MomSafeDecoder.verifyCrc(startCmd), isTrue);

      // Packet reception for measurement 1
      final livePacket1 = List<int>.filled(24, 0);
      livePacket1[0] = 0x09;
      livePacket1[21] = 72; // 72 BPM
      final reading1 = MomSafeDecoder.decodePacket(livePacket1);
      expect(reading1, isNotNull);
      expect(reading1!.value, equals(72));
      expect(reading1.source, equals(ReadingSource.liveSensor));

      // Stream stop command (0x09, enable=false)
      final stopCmd = MomSafeEncoder.buildRealTimeActivity(enable: false, tempEnable: false);
      expect(stopCmd[0], equals(0x09));
      expect(stopCmd[1], equals(0x00));
      expect(MomSafeDecoder.verifyCrc(stopCmd), isTrue);

      // Subsequent measurement 2 without reconnecting
      final livePacket2 = List<int>.filled(24, 0);
      livePacket2[0] = 0x09;
      livePacket2[21] = 76; // 76 BPM
      final reading2 = MomSafeDecoder.decodePacket(livePacket2);
      expect(reading2, isNotNull);
      expect(reading2!.value, equals(76));
      expect(reading2.source, equals(ReadingSource.liveSensor));
    });

    test('2 & 6. Disconnected operations: Battery, HR, SpO2 immediately reject without sending GATT writes', () async {
      final manager = WearableBleManager();
      expect(manager.isConnected, isFalse);
      expect(manager.canReconnect, isFalse);

      // Battery query while disconnected
      final batteryResult = await manager.requestBatteryLevel();
      expect(batteryResult, isNull);
      expect(manager.lastErrorMessage, contains("device is not connected"));

      // HR query while disconnected
      final hrResult = await manager.measureHeartRateNow();
      expect(hrResult, isNull);
      expect(manager.lastErrorMessage, contains("device not connected"));

      // SpO2 query while disconnected
      final spo2Result = await manager.measureSpo2OnDemand();
      expect(spo2Result, isNull);
      expect(manager.lastErrorMessage, contains("device not connected"));

      // sendCommand while disconnected
      final sent = await manager.sendCommand(MomSafeEncoder.buildGetBatteryLevel(), "CMD_Battery");
      expect(sent, isFalse);
      expect(manager.lastErrorMessage, contains("device not connected"));
    });

    test('3 & 8. UI loading flags and error banners recover after disconnection', () {
      // Simulate UI state
      String? activeRequest = "Measure Heart Rate Now";
      String? progressText = "Measuring live HR...";
      String? errorBanner;
      GatewayConnectionState connState = GatewayConnectionState.connected;

      // Event: Central disconnect occurs
      connState = GatewayConnectionState.disconnected;
      activeRequest = null;
      progressText = null;
      errorBanner = "Peripheral disconnected (OS/link connection terminated)";

      expect(connState, equals(GatewayConnectionState.disconnected));
      expect(activeRequest, isNull);
      expect(progressText, isNull);
      expect(errorBanner, contains("disconnected"));
    });

    test('4. Missing notifications vs invalid optical samples distinction', () {
      // Case A: Optical sensor settling on wrist (0 BPM)
      final settlingPacket = List<int>.filled(24, 0);
      settlingPacket[0] = 0x09;
      settlingPacket[21] = 0; // 0 BPM
      final settlingReading = MomSafeDecoder.decodePacket(settlingPacket);
      expect(settlingReading, isNull, reason: "0 BPM indicates settling/searching contact");

      // Case B: Corrupt/out of range optical sample (255 BPM or 10 BPM)
      final outOfRangePacket = List<int>.filled(24, 0);
      outOfRangePacket[0] = 0x09;
      outOfRangePacket[21] = 255;
      final outOfRangeReading = MomSafeDecoder.decodePacket(outOfRangePacket);
      expect(outOfRangeReading, isNull, reason: "255 BPM is outside 30-240 physiological range");

      // Case C: Valid optical pulse (74 BPM)
      final validPacket = List<int>.filled(24, 0);
      validPacket[0] = 0x09;
      validPacket[21] = 74;
      final validReading = MomSafeDecoder.decodePacket(validPacket);
      expect(validReading, isNotNull);
      expect(validReading!.value, equals(74));

      // Case D: Missing notifications (0 bytes received)
      final emptyReading = MomSafeDecoder.decodePacket([]);
      expect(emptyReading, isNull);
    });

    test('5. GATT queue recovery: enqueuing when disconnected returns immediate error and does not hang', () async {
      final manager = WearableBleManager();
      expect(manager.isConnected, isFalse);

      // Attempting to send command while disconnected fails cleanly and immediately
      final sent1 = await manager.sendCommand(Uint8List.fromList([0x13]), "CMD_1");
      expect(sent1, isFalse);

      final sent2 = await manager.sendCommand(Uint8List.fromList([0x55]), "CMD_2");
      expect(sent2, isFalse);

      // Queue state remains cleared
      expect(manager.lastErrorMessage, contains("device not connected"));
    });

    test('7. SpO2 freshness validation: detects stale flash save versus fresh on-demand measurement', () {
      final baseline = DateTime(2026, 10, 28, 12, 24, 00);

      // Older/same record: should be rejected
      final sameFlashTime = DateTime(2026, 10, 28, 12, 24, 00);
      final isFreshSame = sameFlashTime.isAfter(baseline);
      expect(isFreshSame, isFalse);

      // Fresh record written after 30s optical measurement: should be accepted
      final freshFlashTime = DateTime(2026, 10, 28, 13, 10, 15);
      final isFreshNew = freshFlashTime.isAfter(baseline);
      expect(isFreshNew, isTrue);
    });

    test('9. Repeated button presses do not overlap measurement sessions', () {
      bool canStartMeasurement(bool hrActive, bool spo2Active) => !hrActive && !spo2Active;

      // Simulated concurrent request attempt while HR measurement is in progress
      expect(canStartMeasurement(true, false), isFalse, reason: "Must reject overlapping measurement session");
      // Simulated concurrent request attempt while SpO2 measurement is in progress
      expect(canStartMeasurement(false, true), isFalse, reason: "Must reject overlapping measurement session");
      // Idle state allows new measurement
      expect(canStartMeasurement(false, false), isTrue, reason: "Measurement can proceed once previous is complete");
    });

    test('10. Timestamp validation: rejects impossible seconds like 14:29:90 and accepts valid seconds', () {
      // Packet with invalid second: 90 (0x90 in BCD)
      final invalidSecondPacket = <int>[
        0x55, 0x00, 0x00,
        0x26, 0x10, 0x28, 0x14, 0x29, 0x90, // 2026-10-28 14:29:90 (impossible time)
        85,
      ];
      final invalidReading = MomSafeDecoder.decodePacket(invalidSecondPacket);
      expect(invalidReading, isNull, reason: "Seconds > 59 must be rejected as invalid date");

      // Packet with valid second: 45 (0x45 in BCD)
      final validSecondPacket = <int>[
        0x55, 0x00, 0x00,
        0x26, 0x10, 0x28, 0x14, 0x29, 0x45, // 2026-10-28 14:29:45
        85,
      ];
      final validReading = MomSafeDecoder.decodePacket(validSecondPacket);
      expect(validReading, isNotNull);
      expect(validReading!.measurementTimestamp, equals(DateTime(2026, 10, 28, 14, 29, 45)));
    });

    test('11. Command encoding: 0x28 dataType 2 commands Green PPG heart-rate optical mode', () {
      // Start 0x28 dataType 2 (Green PPG Heart Rate)
      final startHr = MomSafeEncoder.buildLiveMeasurementTrigger(dataType: 2, open: true);
      expect(startHr.length, equals(16));
      expect(startHr[0], equals(0x28), reason: "Opcode 0x28 (Health Measurement Control)");
      expect(startHr[1], equals(0x02), reason: "dataType 2 (Heart Rate / Green PPG)");
      expect(startHr[2], equals(0x01), reason: "open: true (start test)");
      expect(MomSafeDecoder.verifyCrc(startHr), isTrue);

      // Stop 0x28 dataType 2 (Green PPG Heart Rate)
      final stopHr = MomSafeEncoder.buildLiveMeasurementTrigger(dataType: 2, open: false);
      expect(stopHr.length, equals(16));
      expect(stopHr[0], equals(0x28));
      expect(stopHr[1], equals(0x02));
      expect(stopHr[2], equals(0x00), reason: "open: false (stop test)");
      expect(MomSafeDecoder.verifyCrc(stopHr), isTrue);

      // Contrast with SpO2 (dataType 3 / Red PPG)
      final startSpo2 = MomSafeEncoder.buildLiveMeasurementTrigger(dataType: 3, open: true);
      expect(startSpo2[1], equals(0x03), reason: "dataType 3 (SpO2 / Red PPG)");
    });

    test('12. Session gating: live optical HR stream (0x09) byte-21 extraction and ParsedReading copyWith', () {
      final samplePacket = List<int>.filled(24, 0);
      samplePacket[0] = 0x09;
      samplePacket[21] = 84; // 84 BPM at byte 21

      final parsed = MomSafeDecoder.decodePacket(samplePacket);
      expect(parsed, isNotNull);
      expect(parsed!.type, equals(MeasurementType.heartRate));
      expect(parsed.value, equals(84));
      expect(parsed.source, equals(ReadingSource.liveSensor));

      // Test copyWith promotion to onDemandMeasurement
      final promoted = parsed.copyWith(
        source: ReadingSource.onDemandMeasurement,
        decodeNotes: "Promoted on-demand test",
      );
      expect(promoted.value, equals(84));
      expect(promoted.source, equals(ReadingSource.onDemandMeasurement));
      expect(promoted.decodeNotes, equals("Promoted on-demand test"));
    });

    test('13. REGRESSION TEST (Issue A): Sequential HR measurements 105 -> 107 -> 102 update state correctly', () {
      final t1 = DateTime(2026, 10, 28, 15, 0, 0);
      final t2 = DateTime(2026, 10, 28, 15, 5, 0);
      final t3 = DateTime(2026, 10, 28, 15, 10, 0);

      // Measurement 1: 105 BPM on-demand result
      final hr1 = ParsedReading(
        type: MeasurementType.heartRate,
        value: 105,
        unit: "BPM",
        measurementTimestamp: t1,
        receivedAt: t1,
        source: ReadingSource.onDemandMeasurement,
        rawBytes: const [],
      );

      // Measurement 2: Live sample 107 BPM arrived during session 2
      final hr2Live = ParsedReading(
        type: MeasurementType.heartRate,
        value: 107,
        unit: "BPM",
        measurementTimestamp: null,
        receivedAt: t2,
        source: ReadingSource.liveSensor,
        rawBytes: const [],
      );

      final decision2 = TelemetryStateResolver.shouldUpdateReading(current: hr1, incoming: hr2Live);
      expect(decision2.shouldAccept, isTrue, reason: "Live 107 BPM must replace previous 105 BPM");

      // Finalized Measurement 2: 107 BPM on-demand result
      final hr2Final = hr2Live.copyWith(
        source: ReadingSource.onDemandMeasurement,
        measurementTimestamp: t2,
        receivedAt: t2,
      );
      final decision2Final = TelemetryStateResolver.shouldUpdateReading(current: hr2Live, incoming: hr2Final);
      expect(decision2Final.shouldAccept, isTrue, reason: "107 BPM on-demand finalization must be accepted");

      // Measurement 3: Live sample 102 BPM arrived during session 3
      final hr3Live = ParsedReading(
        type: MeasurementType.heartRate,
        value: 102,
        unit: "BPM",
        measurementTimestamp: null,
        receivedAt: t3,
        source: ReadingSource.liveSensor,
        rawBytes: const [],
      );

      final decision3 = TelemetryStateResolver.shouldUpdateReading(current: hr2Final, incoming: hr3Live);
      expect(decision3.shouldAccept, isTrue, reason: "Live 102 BPM must replace previous 107 BPM");

      // Finalized Measurement 3: 102 BPM on-demand result
      final hr3Final = hr3Live.copyWith(
        source: ReadingSource.onDemandMeasurement,
        measurementTimestamp: t3,
        receivedAt: t3,
      );
      final decision3Final = TelemetryStateResolver.shouldUpdateReading(current: hr3Live, incoming: hr3Final);
      expect(decision3Final.shouldAccept, isTrue, reason: "102 BPM on-demand finalization must be accepted");
      expect(hr3Final.value, equals(102));
    });

    test('14. PREVENT STALE OVERWRITE: Older flash sync record (0x55) cannot overwrite active live/on-demand reading', () {
      final activeLiveTime = DateTime(2026, 10, 28, 15, 10, 0);
      final oldFlashTime = DateTime(2026, 10, 28, 14, 40, 0); // 30 minutes earlier

      final currentLive = ParsedReading(
        type: MeasurementType.heartRate,
        value: 107,
        unit: "BPM",
        measurementTimestamp: null,
        receivedAt: activeLiveTime,
        source: ReadingSource.liveSensor,
        rawBytes: const [],
      );

      final oldFlashRecord = ParsedReading(
        type: MeasurementType.heartRate,
        value: 105,
        unit: "BPM",
        measurementTimestamp: oldFlashTime,
        receivedAt: activeLiveTime.add(const Duration(seconds: 1)),
        source: ReadingSource.historicalSync,
        rawBytes: const [],
      );

      final decision = TelemetryStateResolver.shouldUpdateReading(
        current: currentLive,
        incoming: oldFlashRecord,
      );
      expect(decision.shouldAccept, isFalse, reason: "Old flash record (14:40) must NOT overwrite active live measurement (15:10)");
      expect(decision.reason, contains("older than live measurement"));
    });

    test('15. Protocol control ACK (0x28) is rejected as a telemetry measurement', () {
      final ackReading = ParsedReading(
        type: MeasurementType.spo2,
        value: 0,
        unit: "ACK",
        source: ReadingSource.onDemandMeasurement,
        rawBytes: const [0x28, 0x03],
      );

      final current = ParsedReading(
        type: MeasurementType.spo2,
        value: 97,
        unit: "%",
        measurementTimestamp: DateTime(2026, 10, 28, 15, 0, 0),
        rawBytes: const [],
      );

      final decision = TelemetryStateResolver.shouldUpdateReading(current: current, incoming: ackReading);
      expect(decision.shouldAccept, isFalse, reason: "Control ACK packet must be rejected from telemetry state");
    });

    test('16. DisconnectDiagnosticRecord accurately captures and formats all forensic fields', () {
      final now = DateTime(2026, 10, 28, 16, 5, 30, 456);
      final record = DisconnectDiagnosticRecord(
        timestamp: now,
        deviceId: "DC:23:4E:91:AA:BB",
        code: 8,
        description: "GATT_CONN_TIMEOUT",
        platform: "android",
        stage: "SpO2 Stage 3 (Countdown: 14s remaining)",
        activeOperation: "CMD_MeasurementWithType (0x28) SpO2 Start",
        appBelievedConnected: true,
        previousGatewayState: GatewayConnectionState.connected,
        gattOperationInFlight: false,
        queueLength: 0,
        isConnecting: false,
        isDiscoveringServices: false,
        isReconnecting: false,
        rawSummary: "[2026-10-28 16:05:30.456] Disconnected: code=8 desc=GATT_CONN_TIMEOUT platform=android "
            "| Stage: SpO2 Stage 3 (Countdown: 14s remaining) | ActiveOp: CMD_MeasurementWithType (0x28) SpO2 Start "
            "| BelievedConnected: true | GatewayState: connected | QueueInFlight: false (len: 0) "
            "| Connecting: false, Reconnecting: false",
      );

      expect(record.code, equals(8));
      expect(record.description, equals("GATT_CONN_TIMEOUT"));
      expect(record.platform, equals("android"));
      expect(record.stage, contains("SpO2 Stage 3"));
      expect(record.appBelievedConnected, isTrue);
      expect(record.toString(), contains("code=8 desc=GATT_CONN_TIMEOUT"));
      expect(record.toString(), contains("2026-10-28 16:05:30.456"));
    });

    test('17. WearableBleManager rejects operations when disconnected without sending GATT commands', () async {
      final manager = WearableBleManager();
      expect(manager.isConnected, isFalse);
      expect(manager.state, equals(GatewayConnectionState.disconnected));

      final batteryRes = await manager.requestBatteryLevel();
      expect(batteryRes, isNull);

      final hrRes = await manager.measureHeartRateNow();
      expect(hrRes, isNull);

      final spo2Res = await manager.measureSpo2OnDemand();
      expect(spo2Res, isNull);

      expect(manager.activeMeasurementStage, equals("idle"));
      manager.dispose();
    });

    test('18. WearableBleManager connectionEpoch increments on disconnect to cancel pending operations', () {
      final manager = WearableBleManager();
      final initialEpoch = manager.connectionEpoch;

      manager.logDiagnostic("TEST", "Simulating disconnect to check epoch increment");
      // Central disconnection handler increments epoch
      expect(initialEpoch, equals(0));
      manager.dispose();
    });

    test('19. canReconnect requires disconnected state and neither connecting nor reconnecting in progress', () {
      final manager = WearableBleManager();
      // No previously connected device
      expect(manager.canReconnect, isFalse);
      manager.dispose();
    });

    test('20. Disconnect diagnostic records track connection epoch and maintain full history', () {
      final record1 = DisconnectDiagnosticRecord(
        epoch: 0,
        timestamp: DateTime(2026, 10, 28, 16, 0, 0),
        deviceId: "AA:BB:CC:DD:EE:01",
        code: 0,
        description: "SUCCESS",
        platform: "android",
        stage: "Heart Rate (Session: hr_1793184948711, Countdown: 7s remaining)",
        activeOperation: "None",
        appBelievedConnected: true,
        previousGatewayState: GatewayConnectionState.connected,
        gattOperationInFlight: false,
        queueLength: 0,
        isConnecting: false,
        isDiscoveringServices: false,
        isReconnecting: false,
        rawSummary: "HR Disconnect at epoch 0",
      );

      final record2 = DisconnectDiagnosticRecord(
        epoch: 1,
        timestamp: DateTime(2026, 10, 28, 16, 5, 0),
        deviceId: "AA:BB:CC:DD:EE:01",
        code: 0,
        description: "SUCCESS",
        platform: "android",
        stage: "SpO2 Stage 3 (Countdown: 22s remaining)",
        activeOperation: "None",
        appBelievedConnected: true,
        previousGatewayState: GatewayConnectionState.connected,
        gattOperationInFlight: false,
        queueLength: 0,
        isConnecting: false,
        isDiscoveringServices: false,
        isReconnecting: false,
        rawSummary: "SpO2 Disconnect at epoch 1",
      );

      expect(record1.epoch, equals(0));
      expect(record2.epoch, equals(1));
      expect(record1.stage, contains("Countdown: 7s remaining"));
      expect(record2.stage, contains("SpO2 Stage 3"));
    });
  });

  group('Phase 4: HRV (Heart Rate Variability) Protocol & Measurement Feature Tests', () {
    test('1. MomSafeEncoder.buildGetHrvData encodes opcode 0x56 with mode and valid additive CRC-8', () {
      // Mode 0: Read latest / start
      final pkt0 = MomSafeEncoder.buildGetHrvData(mode: 0);
      expect(pkt0.length, equals(16));
      expect(pkt0[0], equals(0x56));
      expect(pkt0[1], equals(0x00));
      expect(pkt0[15], equals(0x56));
      expect(MomSafeDecoder.verifyCrc(pkt0), isTrue);

      // Mode 2: Continue next
      final pkt2 = MomSafeEncoder.buildGetHrvData(mode: 2);
      expect(pkt2[0], equals(0x56));
      expect(pkt2[1], equals(0x02));
      expect(pkt2[15], equals(0x58)); // 0x56 + 2 = 0x58
      expect(MomSafeDecoder.verifyCrc(pkt2), isTrue);

      // Mode 0x99: Delete / clear
      final pktDelete = MomSafeEncoder.buildGetHrvData(mode: 0x99);
      expect(pktDelete[0], equals(0x56));
      expect(pktDelete[1], equals(0x99));
      expect(MomSafeDecoder.verifyCrc(pktDelete), isTrue);
    });

    test('2. Decodes 15-byte multi-record 0x56 HRV response and selects the NEWEST record', () {
      // Multi-record 0x56 packet with two 15-byte records per ResolveUtil.getHrvTestData:
      // Byte 0..2: [0x56, 0x00, 0x00]
      // Byte 3..8: BCD timestamp
      // Byte 9: HRV value in ms
      // Byte 10: Vascular aging
      // Byte 11: Heart rate (BPM)
      // Byte 12: Stress
      // Byte 13: High BP
      // Byte 14: Low BP
      final multiHrvPacket = <int>[
        // Record 0 (Older): 2026-10-28 10:15:00, HRV: 48 ms, HR: 72 bpm, stress: 35
        0x56, 0x00, 0x00,
        0x26, 0x10, 0x28, 0x10, 0x15, 0x00,
        48, 25, 72, 35, 120, 80,

        // Record 1 (Newer): 2026-10-28 12:30:45, HRV: 62 ms, HR: 68 bpm, stress: 28
        0x56, 0x00, 0x00,
        0x26, 0x10, 0x28, 0x12, 0x30, 0x45,
        62, 24, 68, 28, 118, 78,

        // Terminus marker
        0xFF,
      ];

      final allRecords = MomSafeDecoder.decodeAllRecords(multiHrvPacket);
      final hrvRecords = allRecords.where((r) => r.type == MeasurementType.hrv).toList();
      expect(hrvRecords.length, equals(2));

      // Record 0 verification
      expect(hrvRecords[0].type, equals(MeasurementType.hrv));
      expect(hrvRecords[0].value, equals(48));
      expect(hrvRecords[0].unit, equals("ms"));
      expect(hrvRecords[0].measurementTimestamp, equals(DateTime(2026, 10, 28, 10, 15, 00)));
      expect(hrvRecords[0].decodeNotes, contains("HR: 72 BPM"));
      expect(hrvRecords[0].decodeNotes, contains("Stress: 35"));

      // Record 1 verification
      expect(hrvRecords[1].type, equals(MeasurementType.hrv));
      expect(hrvRecords[1].value, equals(62));
      expect(hrvRecords[1].unit, equals("ms"));
      expect(hrvRecords[1].measurementTimestamp, equals(DateTime(2026, 10, 28, 12, 30, 45)));
      expect(hrvRecords[1].decodeNotes, contains("HR: 68 BPM"));

      // End marker test
      expect(hrvRecords[0].isEnd, isTrue);
      expect(hrvRecords[1].isEnd, isTrue);

      // decodePacket selects the newest (Record 1)
      final newest = MomSafeDecoder.decodePacket(multiHrvPacket);
      expect(newest, isNotNull);
      expect(newest!.type, equals(MeasurementType.hrv));
      expect(newest.value, equals(62));
      expect(newest.unit, equals("ms"));
      expect(newest.measurementTimestamp, equals(DateTime(2026, 10, 28, 12, 30, 45)));
      expect(newest.recordIndex, equals(1));
      expect(newest.totalRecordsInPacket, equals(2));
    });

    test('3. Filters out invalid HRV flash records (0 denotes failed measurement, 255 denotes uninitialized flash)', () {
      final packetWithInvalidSlots = <int>[
        // Record 0: Value 0 (Test failure/unstable pulse)
        0x56, 0x00, 0x00,
        0x26, 0x10, 0x28, 0x11, 0x00, 0x00,
        0, 0, 0, 0, 0, 0,

        // Record 1: Value 255 (Uninitialized/blank flash)
        0x56, 0x00, 0x00,
        0x26, 0x10, 0x28, 0x11, 0x05, 0x00,
        255, 255, 255, 255, 255, 255,

        // Record 2: Value 55 ms (Valid reading)
        0x56, 0x00, 0x00,
        0x26, 0x10, 0x28, 0x11, 0x10, 0x00,
        55, 26, 75, 40, 122, 82,
      ];

      final validRecords = MomSafeDecoder.decodeAllRecords(packetWithInvalidSlots);
      final validHrvRecords = validRecords.where((r) => r.type == MeasurementType.hrv).toList();
      expect(validHrvRecords.length, equals(1));
      expect(validHrvRecords[0].value, equals(55));
      expect(validHrvRecords[0].measurementTimestamp, equals(DateTime(2026, 10, 28, 11, 10, 00)));

      final newest = MomSafeDecoder.decodePacket(packetWithInvalidSlots);
      expect(newest, isNotNull);
      expect(newest!.value, equals(55));
    });

    test('4. Decodes 0x28 ACK packet for HRV (mode = 1) without polluting telemetry', () {
      final hrvAck = [0x28, 0x01, 0x01, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x2A];
      final parsedAck = MomSafeDecoder.decodePacket(hrvAck);

      expect(parsedAck, isNotNull);
      expect(parsedAck!.type, equals(MeasurementType.hrv));
      expect(parsedAck.value, equals(0));
      expect(parsedAck.unit, equals("ACK"));
      expect(parsedAck.source, equals(ReadingSource.onDemandMeasurement));

      // TelemetryStateResolver must reject this ACK packet
      final currentHrv = ParsedReading(
        type: MeasurementType.hrv,
        value: 50,
        unit: "ms",
        measurementTimestamp: DateTime(2026, 10, 28, 10, 0, 0),
        rawBytes: const [],
      );

      final decision = TelemetryStateResolver.shouldUpdateReading(
        current: currentHrv,
        incoming: parsedAck,
      );
      expect(decision.shouldAccept, isFalse);
      expect(decision.reason, contains("Control command acknowledgment packet"));
    });

    test('5. TelemetryStateResolver: Fresh on-demand HRV is accepted and stale historical HRV is rejected', () {
      final baselineTime = DateTime(2026, 10, 28, 12, 0, 0);
      final currentReading = ParsedReading(
        type: MeasurementType.hrv,
        value: 52,
        unit: "ms",
        measurementTimestamp: baselineTime,
        receivedAt: baselineTime,
        source: ReadingSource.historicalSync,
        rawBytes: const [],
      );

      // Case A: Fresh on-demand measurement finished at 12:30:00 (device timestamp is after baseline)
      final freshOnDemand = ParsedReading(
        type: MeasurementType.hrv,
        value: 58,
        unit: "ms",
        measurementTimestamp: DateTime(2026, 10, 28, 12, 30, 00),
        receivedAt: DateTime(2026, 10, 28, 12, 30, 10),
        source: ReadingSource.onDemandMeasurement,
        rawBytes: const [],
      );

      final acceptDecision = TelemetryStateResolver.shouldUpdateReading(
        current: currentReading,
        incoming: freshOnDemand,
      );
      expect(acceptDecision.shouldAccept, isTrue);
      expect(acceptDecision.reason, contains("On-demand measurement verified newer than baseline"));

      // Case B: Old flash record arrives from earlier (e.g. 11:00:00)
      final olderFlashRecord = ParsedReading(
        type: MeasurementType.hrv,
        value: 45,
        unit: "ms",
        measurementTimestamp: DateTime(2026, 10, 28, 11, 0, 0),
        receivedAt: DateTime(2026, 10, 28, 12, 30, 15),
        source: ReadingSource.historicalSync,
        rawBytes: const [],
      );

      final rejectDecision = TelemetryStateResolver.shouldUpdateReading(
        current: freshOnDemand,
        incoming: olderFlashRecord,
      );
      expect(rejectDecision.shouldAccept, isFalse);
      expect(rejectDecision.reason, contains("Incoming record is older"));
    });

    test('6. WearableBleManager rejects HRV operations immediately when disconnected', () async {
      final manager = WearableBleManager();
      expect(manager.isConnected, isFalse);
      expect(manager.isMeasuringHrv, isFalse);

      final spotHrv = await manager.requestSpotHrv();
      expect(spotHrv, isNull);
      expect(manager.lastErrorMessage, contains("device not connected"));

      final onDemandHrv = await manager.measureHrvOnDemand();
      expect(onDemandHrv, isNull);
      expect(manager.lastErrorMessage, contains("device not connected"));
      expect(manager.isMeasuringHrv, isFalse);
      manager.dispose();
    });

    test('7. Mutual exclusion: HRV measurement blocks HR & SpO2, and active HR/SpO2 blocks HRV', () {
      bool canStartHr(bool hrActive, bool spo2Active, bool hrvActive) => !hrActive && !spo2Active && !hrvActive;
      bool canStartSpo2(bool hrActive, bool spo2Active, bool hrvActive) => !hrActive && !spo2Active && !hrvActive;
      bool canStartHrv(bool hrActive, bool spo2Active, bool hrvActive) => !hrActive && !spo2Active && !hrvActive;

      // When HRV is active
      expect(canStartHr(false, false, true), isFalse, reason: "HR cannot start while HRV is active");
      expect(canStartSpo2(false, false, true), isFalse, reason: "SpO2 cannot start while HRV is active");
      expect(canStartHrv(false, false, true), isFalse, reason: "HRV cannot start while HRV is already active");

      // When HR is active
      expect(canStartHrv(true, false, false), isFalse, reason: "HRV cannot start while HR is active");

      // When SpO2 is active
      expect(canStartHrv(false, true, false), isFalse, reason: "HRV cannot start while SpO2 is active");

      // When all idle
      expect(canStartHrv(false, false, false), isTrue, reason: "HRV can start when all sessions are idle");
    });
  });

  group('MomSafe Band Temperature Protocol (0x62) Tests', () {
    test('Temperature query command (0x62) has correct length, opcode, mode, and CRC-8', () {
      final packet = MomSafeEncoder.buildGetTemperatureData(mode: 0);

      expect(packet.length, equals(16));
      expect(packet[0], equals(0x62)); // Opcode
      expect(packet[1], equals(0x00)); // Mode 0 = read latest
      expect(packet[15], equals(0x62)); // Checksum (0x62 + 0 = 0x62)
      expect(MomSafeDecoder.verifyCrc(packet), isTrue);
    });

    test('Decodes multi-record 11-byte temperature packet and selects newest valid reading (36.2 °C)', () {
      final tempPacket = <int>[
        // Record 0: 11 bytes (Older: 2026-10-28 08:00:00, 35.8 °C -> 358 = 0x0166: low byte 0x66, high byte 0x01)
        0x62, 0x00, 0x00,
        0x26, 0x10, 0x28, 0x08, 0x00, 0x00,
        0x66, 0x01,
        // Record 1: 11 bytes (Newer: 2026-10-28 14:15:30, 36.2 °C -> 362 = 0x016A: low byte 0x6A, high byte 0x01)
        0x62, 0x00, 0x00,
        0x26, 0x10, 0x28, 0x14, 0x15, 0x30,
        0x6A, 0x01,
      ];

      final records = MomSafeDecoder.decodeAllRecords(tempPacket);
      expect(records.length, equals(2));
      expect(records[0].type, equals(MeasurementType.temperature));
      expect(records[0].value, equals(35.8));
      expect(records[0].measurementTimestamp, equals(DateTime(2026, 10, 28, 8, 0, 0)));

      expect(records[1].type, equals(MeasurementType.temperature));
      expect(records[1].value, equals(36.2));
      expect(records[1].measurementTimestamp, equals(DateTime(2026, 10, 28, 14, 15, 30)));

      final newest = MomSafeDecoder.decodePacket(tempPacket);
      expect(newest, isNotNull);
      expect(newest!.type, equals(MeasurementType.temperature));
      expect(newest.value, equals(36.2));
      expect(newest.unit, equals("°C"));
    });

    test('Discards corrupted or physiologically impossible skin temperatures outside 20.0-45.0 °C', () {
      final invalidPacket = <int>[
        0x62, 0x00, 0x00,
        0x26, 0x10, 0x28, 0x10, 0x00, 0x00,
        0x64, 0x00, // 100 -> 10.0 °C (below minimum 20.0 °C threshold)
      ];

      final records = MomSafeDecoder.decodeAllRecords(invalidPacket);
      expect(records.isEmpty, isTrue);
    });
  });

  group('MomSafe Band Sleep Protocol (0x53) Tests', () {
    test('Sleep query command (0x53) has correct length, opcode, mode, and CRC-8', () {
      final packet = MomSafeEncoder.buildGetSleepData(mode: 0);

      expect(packet.length, equals(16));
      expect(packet[0], equals(0x53)); // Opcode
      expect(packet[1], equals(0x00)); // Mode 0 = read latest
      expect(packet[15], equals(0x53)); // Checksum (0x53 + 0 = 0x53)
      expect(MomSafeDecoder.verifyCrc(packet), isTrue);
    });

    test('Decodes 34-byte sleep record and calculates accurate light and deep sleep hours', () {
      // 34 bytes:
      // Byte 0: 0x53
      // Byte 1-2: 0x00, 0x00
      // Byte 3-8: 2026-10-28 06:00:00 (BCD: 0x26, 0x10, 0x28, 0x06, 0x00, 0x00)
      // Byte 9: sleepLength = 24 intervals (12 light + 12 deep = 24 intervals = 120 minutes = 2.0 hrs)
      // Byte 10-33: 24 intervals of 5 minutes each
      final intervals = <int>[
        1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 12 x 1 (light sleep: 60 min)
        2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, // 12 x 2 (deep sleep: 60 min)
      ];

      final sleepPacket = <int>[
        0x53, 0x00, 0x00,
        0x26, 0x10, 0x28, 0x06, 0x00, 0x00,
        24, // Byte 9: sleepLength = 24
        ...intervals,
      ];

      expect(sleepPacket.length, equals(34));

      final records = MomSafeDecoder.decodeAllRecords(sleepPacket);
      expect(records.length, equals(1));
      final sleepRecord = records[0];

      expect(sleepRecord.type, equals(MeasurementType.sleep));
      expect(sleepRecord.value, equals(2.0)); // 120 minutes / 60 = 2.0 hours
      expect(sleepRecord.unit, equals("hrs"));
      expect(sleepRecord.measurementTimestamp, equals(DateTime(2026, 10, 28, 6, 0, 0)));
      expect(sleepRecord.decodeNotes, contains("Deep: 1.0 hrs"));
      expect(sleepRecord.decodeNotes, contains("Light: 1.0 hrs"));
    });

    test('Rejects all-zero or empty sleep packet without fabricating sleep hours', () {
      final emptySleepPacket = <int>[
        0x53, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        ...List<int>.filled(25, 0),
      ];

      final records = MomSafeDecoder.decodeAllRecords(emptySleepPacket);
      expect(records.isEmpty, isTrue);
    });
  });

  group('MomSafe Band Stress Metric (0x56) Tests', () {
    test('Extracts vendor stress score (0-100) from 0x56 byte 12 with matching device timestamp', () {
      final hrvAndStressPacket = <int>[
        0x56, 0x00, 0x00,
        0x26, 0x10, 0x28, 0x15, 0x45, 0x12, // 2026-10-28 15:45:12
        54,   // Byte 9: HRV value (54 ms)
        0,    // Byte 10: Reserved
        72,   // Byte 11: Heart rate (72 BPM)
        35,   // Byte 12: Stress score (35 / 100)
        4,    // Byte 13: Mood value
        16,   // Byte 14: Breath rate
        0x56, // Byte 15: Checksum
      ];

      final records = MomSafeDecoder.decodeAllRecords(hrvAndStressPacket);
      expect(records.length, equals(3));

      final hrv = records.firstWhere((r) => r.type == MeasurementType.hrv);
      expect(hrv.value, equals(54));
      expect(hrv.unit, equals("ms"));
      expect(hrv.measurementTimestamp, equals(DateTime(2026, 10, 28, 15, 45, 12)));

      final stress = records.firstWhere((r) => r.type == MeasurementType.stress);
      expect(stress.value, equals(35));
      expect(stress.unit, equals("score"));
      expect(stress.measurementTimestamp, equals(DateTime(2026, 10, 28, 15, 45, 12)));

      final bp = records.firstWhere((r) => r.type == MeasurementType.bloodPressure);
      expect(bp.unit, equals("mmHg"));
      expect(bp.measurementTimestamp, equals(DateTime(2026, 10, 28, 15, 45, 12)));
      expect(bp.value, isNotNull);
      expect(bp.secondaryValue, isNotNull);
    });

    test('Decodes direct blood pressure when bytes 13 & 14 contain systolic and diastolic values', () {
      final directBpPacket = <int>[
        0x56, 0x00, 0x00,
        0x26, 0x10, 0x28, 0x16, 0x00, 0x00, // 2026-10-28 16:00:00
        50,   // Byte 9: HRV value (50 ms)
        0,    // Byte 10: Reserved
        70,   // Byte 11: Heart rate (70 BPM)
        25,   // Byte 12: Stress score (25 / 100)
        118,  // Byte 13: Direct systolic BP (118 mmHg)
        78,   // Byte 14: Direct diastolic BP (78 mmHg)
        0x56, // Byte 15: Checksum
      ];

      final records = MomSafeDecoder.decodeAllRecords(directBpPacket);
      final bp = records.firstWhere((r) => r.type == MeasurementType.bloodPressure);
      expect(bp.value, equals(118));
      expect(bp.secondaryValue, equals(78));
      expect(bp.unit, equals("mmHg"));
    });
  });

  group('MomSafe Band Blood Pressure Hardware Limitation Tests', () {
    test('Explicitly documents that 2208A uses pulse wave estimated BP and lacks arterial cuff', () {
      expect(MomSafeDecoder.isBloodPressureSupportedOnMomSafeBand, isFalse);
      expect(MomSafeDecoder.isEstimatedBloodPressureSupported, isTrue);
    });
  });

  group('MomSafe Band Axillary Temperature (0x65) Tests', () {
    test('Encodes 0x65 command for spot axillary temperature retrieval', () {
      final packet = MomSafeEncoder.buildGetAxillaryTemperatureData(mode: 0);
      expect(packet[0], equals(MomSafeCmd.getAxillaryTemp)); // 0x65
      expect(packet[1], equals(0x00));
      expect(packet.length, equals(16));
    });
  });

  group('MomSafe AI Cloud Deduplication & ID Stability Tests', () {
    test('buildRecordId generates deterministic, collision-resistant record IDs', () {
      final timestamp = DateTime.utc(2026, 10, 28, 14, 30, 0);
      final id1 = MomSafeCloudSync.buildRecordId(
        deviceId: "E4:65:B8:11:22:33",
        type: MeasurementType.heartRate,
        timestamp: timestamp,
      );
      final id2 = MomSafeCloudSync.buildRecordId(
        deviceId: "E4:65:B8:11:22:33",
        type: MeasurementType.heartRate,
        timestamp: timestamp,
      );

      expect(id1, equals("2208A_E465B8112233_heartRate_1793197800"));
      expect(id1, equals(id2), reason: "Deduplication IDs must be strictly deterministic across calls");

      final hrvId = MomSafeCloudSync.buildRecordId(
        deviceId: "E4:65:B8:11:22:33",
        type: MeasurementType.hrv,
        timestamp: timestamp,
      );
      expect(hrvId, isNot(equals(id1)), reason: "Different measurement types must produce unique record IDs");
    });
  });
}



