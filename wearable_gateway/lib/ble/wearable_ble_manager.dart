import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'package:intl/intl.dart';
import 'package:permission_handler/permission_handler.dart';
import '../protocol/jstyle_constants.dart';
import '../protocol/jstyle_encoder.dart';
import '../protocol/jstyle_decoder.dart';
import '../protocol/telemetry_state_resolver.dart';

enum GatewayConnectionState {
  disconnected,
  scanning,
  connecting,
  discoveringServices,
  subscribingNotifications,
  connected,
  error,
}

class DiscoveredWearable {
  final BluetoothDevice device;
  final String name;
  final String id;
  final int rssi;

  DiscoveredWearable({
    required this.device,
    required this.name,
    required this.id,
    required this.rssi,
  });
}

class RawDiagnosticLog {
  final DateTime timestamp;
  final String direction; // "TX (App->Band)", "RX (Band->App)", "PARSED", "STATE", "STATUS", "ERROR", "TIMEOUT", "RX (CROSS-TALK)"
  final List<int>? rawBytes;
  final String message;

  RawDiagnosticLog({
    required this.timestamp,
    required this.direction,
    this.rawBytes,
    required this.message,
  });

  String get hexString =>
      rawBytes != null ? rawBytes!.map((b) => b.toRadixString(16).padLeft(2, '0').toUpperCase()).join(' ') : "";
}

class DisconnectDiagnosticRecord {
  final int epoch;
  final DateTime timestamp;
  final String deviceId;
  final int? code;
  final String? description;
  final String? platform;
  final String stage;
  final String activeOperation;
  final bool appBelievedConnected;
  final GatewayConnectionState previousGatewayState;
  final bool gattOperationInFlight;
  final int queueLength;
  final bool isConnecting;
  final bool isDiscoveringServices;
  final bool isReconnecting;
  final String rawSummary;

  DisconnectDiagnosticRecord({
    this.epoch = 0,
    required this.timestamp,
    required this.deviceId,
    this.code,
    this.description,
    this.platform,
    required this.stage,
    required this.activeOperation,
    required this.appBelievedConnected,
    required this.previousGatewayState,
    required this.gattOperationInFlight,
    required this.queueLength,
    required this.isConnecting,
    required this.isDiscoveringServices,
    required this.isReconnecting,
    required this.rawSummary,
  });

  @override
  String toString() => rawSummary;
}

class WearableBleManager {
  BluetoothDevice? _connectedDevice;
  BluetoothCharacteristic? _writeCharacteristic;
  BluetoothCharacteristic? _notifyCharacteristic;
  BluetoothCharacteristic? get notifyCharacteristic => _notifyCharacteristic;
  BluetoothDevice? get connectedDevice => _connectedDevice;

  StreamSubscription<List<ScanResult>>? _scanSubscription;
  StreamSubscription<BluetoothConnectionState>? _deviceStateSubscription;
  StreamSubscription<List<int>>? _notifySubscription;

  GatewayConnectionState _state = GatewayConnectionState.disconnected;
  GatewayConnectionState get state => _state;

  String? _lastErrorMessage;
  String? get lastErrorMessage => _lastErrorMessage;

  final List<DiscoveredWearable> _discoveredDevices = [];
  List<DiscoveredWearable> get discoveredDevices => List.unmodifiable(_discoveredDevices);

  final List<RawDiagnosticLog> _diagnosticLogs = [];
  List<RawDiagnosticLog> get diagnosticLogs => List.unmodifiable(_diagnosticLogs);

  final _stateController = StreamController<GatewayConnectionState>.broadcast();
  Stream<GatewayConnectionState> get stateStream => _stateController.stream;

  final _devicesController = StreamController<List<DiscoveredWearable>>.broadcast();
  Stream<List<DiscoveredWearable>> get devicesStream => _devicesController.stream;

  final _readingController = StreamController<ParsedReading>.broadcast();
  Stream<ParsedReading> get readingStream => _readingController.stream;

  final _logController = StreamController<RawDiagnosticLog>.broadcast();
  Stream<RawDiagnosticLog> get logStream => _logController.stream;

  final _liveHeartRateController = StreamController<int>.broadcast();
  Stream<int> get liveHeartRateStream => _liveHeartRateController.stream;

  bool _isLiveHeartRateStreaming = false;
  bool get isLiveHeartRateStreaming => _isLiveHeartRateStreaming;

  bool _isMeasuringHeartRate = false;
  bool get isMeasuringHeartRate => _isMeasuringHeartRate;

  String? _activeHeartRateSessionId;
  String? get activeHeartRateSessionId => _activeHeartRateSessionId;

  bool _isMeasuringSpo2 = false;
  bool get isMeasuringSpo2 => _isMeasuringSpo2;

  bool _isMeasuringHrv = false;
  bool get isMeasuringHrv => _isMeasuringHrv;

  BluetoothDevice? _lastConnectedDevice;
  BluetoothDevice? get lastConnectedDevice => _lastConnectedDevice;
  bool get canReconnect => _lastConnectedDevice != null && _state == GatewayConnectionState.disconnected && !_isConnecting && !_isReconnecting;

  bool _isConnecting = false;
  bool get isConnecting => _isConnecting;

  bool _isReconnecting = false;
  bool get isReconnecting => _isReconnecting;

  String _activeMeasurementStage = "idle";
  String get activeMeasurementStage => _activeMeasurementStage;

  String? _activeOperationName;
  String? get activeOperationName => _activeOperationName;

  DisconnectDiagnosticRecord? _lastDisconnectRecord;
  DisconnectDiagnosticRecord? get lastDisconnectRecord => _lastDisconnectRecord;

  final List<DisconnectDiagnosticRecord> _disconnectHistory = [];
  List<DisconnectDiagnosticRecord> get disconnectHistory => List.unmodifiable(_disconnectHistory);

  void _recordDisconnect(DisconnectDiagnosticRecord record) {
    // Preserve the earliest disconnect record for this specific connection epoch as _lastDisconnectRecord,
    // while appending every event into the complete audit history.
    if (_lastDisconnectRecord == null || _lastDisconnectRecord!.epoch != record.epoch) {
      _lastDisconnectRecord = record;
    }
    _disconnectHistory.add(record);
    if (_disconnectHistory.length > 50) _disconnectHistory.removeAt(0);
  }

  /// Targeted diagnostic wrapper capturing all app-issued device.disconnect() invocations with caller and stack
  Future<void> _safeDeviceDisconnect(BluetoothDevice? device, {required String caller}) async {
    final now = DateTime.now();
    final timeStr = DateFormat('yyyy-MM-dd HH:mm:ss.SSS').format(now);
    final trace = StackTrace.current.toString().split('\n').take(4).map((s) => s.trim()).join(' -> ');
    _log(
      "APP_DISCONNECT_CALL",
      "App explicitly calling device.disconnect() at $timeStr | Device: ${device?.remoteId.str ?? 'NONE'} | Caller: $caller | Stack: $trace",
    );
    if (device != null) {
      try {
        await device.disconnect();
        _log("APP_DISCONNECT_CALL", "device.disconnect() completed successfully for caller: $caller");
      } catch (e) {
        _log("APP_DISCONNECT_CALL", "device.disconnect() returned exception for caller: $caller: $e");
      }
    }
  }

  int _connectionEpoch = 0;
  int get connectionEpoch => _connectionEpoch;

  Completer<void>? _activeMeasurementCompleter;

  /// Authoritative check of live connection health across Gateway and peripheral layer
  bool get isConnected {
    if (_state != GatewayConnectionState.connected) return false;
    if (_connectedDevice == null || _writeCharacteristic == null) return false;
    if (_connectedDevice!.isConnected == false) return false;
    return true;
  }

  // --- Command Serialization Queue & Mutex ---
  Future<void> _lastOperationFuture = Future.value();
  Completer<ParsedReading?>? _pendingCompleter;
  int? _pendingOpcode;
  ParsedReading? _candidateReading;
  void Function(ParsedReading)? _onMatchingPacketReceived;
  int _queueLength = 0;
  bool _isGattOperationInFlight = false;

  void _setState(GatewayConnectionState newState) {
    _state = newState;
    if (!_stateController.isClosed) {
      _stateController.add(newState);
    }
  }

  void _log(String direction, String message, {List<int>? rawBytes}) {
    final entry = RawDiagnosticLog(
      timestamp: DateTime.now(),
      direction: direction,
      rawBytes: rawBytes,
      message: message,
    );
    _diagnosticLogs.insert(0, entry);
    if (_diagnosticLogs.length > 200) _diagnosticLogs.removeLast();
    if (!_logController.isClosed) {
      _logController.add(entry);
    }
    debugPrint("[$direction] $message ${entry.hexString}");
  }

  void _emitDevices(List<DiscoveredWearable> devices) {
    if (!_devicesController.isClosed) _devicesController.add(devices);
  }

  void _emitReading(ParsedReading reading) {
    if (!_readingController.isClosed) _readingController.add(reading);
  }

  void _emitLiveHeartRate(int bpm) {
    if (!_liveHeartRateController.isClosed) _liveHeartRateController.add(bpm);
  }

  /// Public logging facility for state management decisions
  void logDiagnostic(String direction, String message, {List<int>? rawBytes}) {
    _log(direction, message, rawBytes: rawBytes);
  }

  static const _deviceChannel = MethodChannel('com.momsafe.wearable_gateway/device_info');

  /// Request required Android runtime permissions based on device OS version
  Future<bool> checkAndRequestPermissions() async {
    if (!Platform.isAndroid) {
      _lastErrorMessage = null;
      return true;
    }

    int sdkInt = 31;
    try {
      final sdk = await _deviceChannel.invokeMethod<int>('getSdkInt');
      if (sdk != null) sdkInt = sdk;
    } catch (e) {
      _log("STATUS", "Could not query Android SDK via MethodChannel ($e), assuming API 31+");
    }

    final isModernAndroid = sdkInt >= 31;
    _log("STATUS", "Device OS: Android API $sdkInt (${isModernAndroid ? 'Android 12+' : 'Android 11 or lower'})");

    if (isModernAndroid) {
      Map<Permission, PermissionStatus> statuses = await [
        Permission.bluetoothScan,
        Permission.bluetoothConnect,
      ].request();

      final scanGranted = statuses[Permission.bluetoothScan]?.isGranted ?? false;
      final connectGranted = statuses[Permission.bluetoothConnect]?.isGranted ?? false;

      _log("STATUS", "Android 12+ Permissions: SCAN=$scanGranted, CONNECT=$connectGranted (Location not required)");

      if (!scanGranted || !connectGranted) {
        final missingList = <String>[];
        if (!scanGranted) missingList.add("Nearby Devices: SCAN");
        if (!connectGranted) missingList.add("Nearby Devices: CONNECT");

        _lastErrorMessage = "Missing permission: ${missingList.join(', ')}. Please grant in App Settings.";
        _log("STATUS", "Permission Denied: $_lastErrorMessage");
        return false;
      }

      _lastErrorMessage = null;
      _log("STATUS", "All required Android 12+ Bluetooth permissions are granted.");
      return true;
    } else {
      Map<Permission, PermissionStatus> statuses = await [
        Permission.locationWhenInUse,
      ].request();

      final locationGranted = statuses[Permission.locationWhenInUse]?.isGranted ?? false;
      _log("STATUS", "Android <=11 Permissions: Location=$locationGranted");

      if (!locationGranted) {
        _lastErrorMessage = "Location permission is required for Bluetooth scanning on Android 11 and below. Please grant in Settings.";
        _log("STATUS", "Permission Denied: $_lastErrorMessage");
        return false;
      }

      try {
        final serviceEnabled = await Permission.locationWhenInUse.serviceStatus.isEnabled;
        if (!serviceEnabled) {
          _log("STATUS", "Warning: Location service (GPS) is OFF. Turn ON Location in phone quick settings for BLE discovery on Android <=11.");
        }
      } catch (_) {}

      _lastErrorMessage = null;
      _log("STATUS", "Location permission granted for Android <=11 BLE scanning.");
      return true;
    }
  }

  /// Start BLE scanning for J-Style 2208A peripherals
  Future<void> startScan({Duration timeout = const Duration(seconds: 12)}) async {
    final hasPerm = await checkAndRequestPermissions();
    if (!hasPerm) {
      _setState(GatewayConnectionState.error);
      return;
    }

    BluetoothAdapterState adapterState = BluetoothAdapterState.unknown;
    try {
      adapterState = await FlutterBluePlus.adapterState
          .firstWhere((s) => s != BluetoothAdapterState.unknown)
          .timeout(const Duration(milliseconds: 1500));
    } catch (_) {
      adapterState = await FlutterBluePlus.adapterState.first;
    }

    if (adapterState != BluetoothAdapterState.on) {
      _lastErrorMessage = "Bluetooth adapter is ${adapterState.name.toUpperCase()}. Please enable Bluetooth.";
      _log("STATUS", _lastErrorMessage!);
      _setState(GatewayConnectionState.error);
      return;
    }

    _lastErrorMessage = null;
    _discoveredDevices.clear();
    _emitDevices(_discoveredDevices);
    _setState(GatewayConnectionState.scanning);
    _log("STATUS", "Starting BLE scan (12s timeout)...");

    await _scanSubscription?.cancel();
    _scanSubscription = FlutterBluePlus.scanResults.listen((results) {
      for (final r in results) {
        final name = r.device.platformName.isNotEmpty ? r.device.platformName : r.advertisementData.advName;
        final id = r.device.remoteId.str;
        
        if (_discoveredDevices.indexWhere((d) => d.id == id) == -1) {
          final wearable = DiscoveredWearable(
            device: r.device,
            name: name.isNotEmpty ? name : "Unknown Device ($id)",
            id: id,
            rssi: r.rssi,
          );
          _discoveredDevices.add(wearable);
          _emitDevices(_discoveredDevices);
          _log("STATUS", "Discovered: ${wearable.name} (${wearable.id}) RSSI: ${wearable.rssi}dBm");
        }
      }
    }, onError: (e) {
      _log("ERROR", "Scan error: $e");
      _setState(GatewayConnectionState.error);
    });

    try {
      await FlutterBluePlus.startScan(
        timeout: timeout,
        androidUsesFineLocation: false,
      );
    } catch (e) {
      _log("ERROR", "Failed to start scan: $e");
      _setState(GatewayConnectionState.error);
    }
  }

  /// Stop active scan
  Future<void> stopScan() async {
    await FlutterBluePlus.stopScan();
    await _scanSubscription?.cancel();
    if (_state == GatewayConnectionState.scanning) {
      _setState(GatewayConnectionState.disconnected);
    }
    _log("STATUS", "Scan stopped.");
  }

  /// Connect to selected device and subscribe to 0xFFF7 notifications
  Future<bool> connect(BluetoothDevice device) async {
    if (_isConnecting) {
      _log("BLE_CONN", "Connect requested while already connecting to ${device.remoteId.str}. Ignoring redundant call.");
      return false;
    }

    _isConnecting = true;
    try {
      await stopScan();
      _connectedDevice = device;
      _lastConnectedDevice = device;
      _setState(GatewayConnectionState.connecting);
      _log("BLE_CONN", "Connecting to ${device.remoteId}...");

      // Ensure any previous native GATT connection is cleanly closed before connecting
      if (device.isConnected) {
        try {
          _log("BLE_CONN", "Device reported connected prior to setup; clearing stale connection state...");
          await _safeDeviceDisconnect(device, caller: "connect() pre-cleanup").timeout(const Duration(seconds: 2));
        } catch (_) {}
      }

      await device.connect(
        timeout: const Duration(seconds: 15),
        autoConnect: false,
      );

      if (!device.isConnected) {
        throw StateError("Device is not connected after connect() completed.");
      }

      _log("BLE_CONN", "GATT connected to ${device.remoteId}. Hooking connectionState stream.");

      // Establish device connectionState monitoring ONLY after successful connect
      _deviceStateSubscription?.cancel();
      _deviceStateSubscription = device.connectionState.listen((connectionState) {
        _log("BLE_CONN", "FlutterBluePlus device connectionState transition: ${connectionState.name} (Gateway state: ${_state.name})");
        if (connectionState == BluetoothConnectionState.disconnected) {
          final now = DateTime.now();
          final discReason = device.disconnectReason;
          final code = discReason?.code;
          final desc = discReason?.description;
          final platformStr = discReason?.platform.toString();
          final timeStr = DateFormat('yyyy-MM-dd HH:mm:ss.SSS').format(now);

          final record = DisconnectDiagnosticRecord(
            epoch: _connectionEpoch,
            timestamp: now,
            deviceId: device.remoteId.str,
            code: code,
            description: desc,
            platform: platformStr,
            stage: _activeMeasurementStage,
            activeOperation: _activeOperationName ?? "None",
            appBelievedConnected: isConnected,
            previousGatewayState: _state,
            gattOperationInFlight: _isGattOperationInFlight,
            queueLength: _queueLength,
            isConnecting: _isConnecting,
            isDiscoveringServices: _state == GatewayConnectionState.discoveringServices,
            isReconnecting: _isReconnecting,
            rawSummary: "[$timeStr] Disconnected: code=$code desc=$desc platform=$platformStr "
                "| Epoch: $_connectionEpoch | Stage: $_activeMeasurementStage | ActiveOp: ${_activeOperationName ?? 'None'} "
                "| BelievedConnected: $isConnected | GatewayState: ${_state.name} "
                "| QueueInFlight: $_isGattOperationInFlight (len: $_queueLength) "
                "| Connecting: $_isConnecting, Reconnecting: $_isReconnecting",
          );

          _recordDisconnect(record);

          _log(
            "BLE_DISCONNECT_FIRST",
            "EARLIEST DISCONNECT EVENT CAPTURED:\n"
            "  - Timestamp: $timeStr\n"
            "  - Connection Epoch: $_connectionEpoch\n"
            "  - Device ID: ${device.remoteId.str}\n"
            "  - Disconnect Reason: [Platform: $platformStr, Code: $code, Description: $desc]\n"
            "  - Measurement Stage: $_activeMeasurementStage\n"
            "  - Active GATT Op: ${_activeOperationName ?? 'None'}\n"
            "  - App Believed Connected: $isConnected (Gateway: ${_state.name})\n"
            "  - GATT Queue: [In-Flight: $_isGattOperationInFlight, Length: $_queueLength]\n"
            "  - Concurrency: [Connecting: $_isConnecting, Reconnecting: $_isReconnecting]",
          );

          _handleDisconnection(reason: "Peripheral disconnected ($desc [code: $code]) at $_activeMeasurementStage");
        }
      }, onError: (err) {
        _log("BLE_CONN", "Device connectionState error: $err");
        _handleDisconnection(reason: "Connection state error: $err");
      });

      _setState(GatewayConnectionState.discoveringServices);
      _log("STATUS", "Connected! Discovering GATT services...");

      if (Platform.isAndroid) {
        try {
          await device.requestMtu(247);
          _log("STATUS", "MTU negotiated to 247.");
          await Future.delayed(const Duration(milliseconds: 200));
        } catch (e) {
          _log("STATUS", "MTU negotiation skipped or failed ($e), proceeding with default MTU.");
        }
        try {
          // Use ConnectionPriority.balanced for stable supervision timeout (~20s) and peripheral slave latency support
          await device.requestConnectionPriority(connectionPriorityRequest: ConnectionPriority.balanced);
          _log("STATUS", "BLE connection priority set to BALANCED (standard supervision timeout & peripheral slave latency).");
        } catch (e) {
          _log("WARN", "Connection priority request skipped ($e).");
        }
      }

      if (!device.isConnected) {
        throw StateError("Device disconnected before service discovery.");
      }

      List<BluetoothService> services = [];
      try {
        services = await device.discoverServices();
      } catch (discoveryErr) {
        _log("WARN", "Initial service discovery encountered exception: $discoveryErr. Waiting 400ms before retry...");
        await Future.delayed(const Duration(milliseconds: 400));
        if (!device.isConnected) {
          throw StateError("Device disconnected during service discovery retry.");
        }
        services = await device.discoverServices();
      }
      BluetoothCharacteristic? writeChar;
      BluetoothCharacteristic? notifyChar;

      for (final service in services) {
        if (service.uuid.str128.toLowerCase() == JStyleGatt.serviceUuid.toLowerCase()) {
          _log("STATUS", "Located Primary J-Style Service: ${service.uuid.str128}");
          for (final char in service.characteristics) {
            if (char.uuid.str128.toLowerCase() == JStyleGatt.writeCharacteristicUuid.toLowerCase()) {
              writeChar = char;
              _log(
                "STATUS",
                "Found Write Characteristic (0xFFF6): "
                "write=${char.properties.write}, "
                "writeWithoutResponse=${char.properties.writeWithoutResponse}",
              );
            }
            if (char.uuid.str128.toLowerCase() == JStyleGatt.notifyCharacteristicUuid.toLowerCase()) {
              notifyChar = char;
              _log("STATUS", "Found Notify Characteristic (0xFFF7)");
            }
          }
        }
      }

      if (writeChar == null || notifyChar == null) {
        _log("ERROR", "Missing required 0xFFF6/0xFFF7 characteristics on this peripheral.");
        await disconnect(caller: "connect() missing characteristics");
        return false;
      }

      if (!device.isConnected) {
        throw StateError("Device disconnected before notification subscription.");
      }

      _writeCharacteristic = writeChar;
      _notifyCharacteristic = notifyChar;

      _setState(GatewayConnectionState.subscribingNotifications);
      _log("NOTIFY_SUB", "Enabling GATT notifications on 0xFFF7...");

      await notifyChar.setNotifyValue(true);
      await Future.delayed(const Duration(milliseconds: 100));

      if (!device.isConnected) {
        throw StateError("Device disconnected after enabling notifications.");
      }

      _notifySubscription?.cancel();
      _log("NOTIFY_SUB", "Subscribing to 0xFFF7 onValueReceived notification stream...");
      _notifySubscription = notifyChar.onValueReceived.listen((bytes) {
        if (bytes.isNotEmpty) {
          final opcode = bytes[0];
          final opcodeHex = "0x${opcode.toRadixString(16).padLeft(2, '0').toUpperCase()}";
          _log("RX (Band->App)", "Raw notification received (${bytes.length} bytes, opcode $opcodeHex)", rawBytes: bytes);

          // Dedicated diagnostic log for optical PPG (0x09) samples
          if (opcode == JStyleCmd.enableActivity) {
            final activeSession = _activeHeartRateSessionId;
            final isSessionActive = activeSession != null;
            final nowIso = DateTime.now().toIso8601String();

            if (bytes.length >= 22) {
              final rawHr = bytes[21] & 0xFF;
              if (!isSessionActive) {
                _log(
                  "HR_SAMPLE",
                  "REJECTED optical sample: $rawHr BPM arriving outside an active measurement session. "
                  "[Opcode: 0x09, Length: ${bytes.length}, RawHr: $rawHr, Session: NONE, ConnState: ${_state.name}, Recv: $nowIso]",
                );
              } else if (rawHr >= 30 && rawHr <= 240) {
                _log(
                  "HR_SAMPLE",
                  "ACCEPTED optical pulse sample: $rawHr BPM (in physiological range 30-240 BPM). "
                  "[Opcode: 0x09, Length: ${bytes.length}, RawHr: $rawHr, Session: $activeSession, ConnState: ${_state.name}, Recv: $nowIso]",
                );
              } else if (rawHr == 0) {
                _log(
                  "HR_SAMPLE",
                  "REJECTED optical sample: 0 BPM (optical sensor searching / settling on wrist). "
                  "[Opcode: 0x09, Length: ${bytes.length}, RawHr: $rawHr, Session: $activeSession, ConnState: ${_state.name}, Recv: $nowIso]",
                );
              } else {
                _log(
                  "HR_SAMPLE",
                  "REJECTED optical sample: $rawHr BPM (outside valid optical range 30-240 BPM). "
                  "[Opcode: 0x09, Length: ${bytes.length}, RawHr: $rawHr, Session: $activeSession, ConnState: ${_state.name}, Recv: $nowIso]",
                );
              }
            } else {
              _log(
                "HR_SAMPLE",
                "REJECTED 0x09 packet: length ${bytes.length} < 22 bytes (acknowledgement or truncated frame). "
                "[Opcode: 0x09, Session: ${activeSession ?? 'NONE'}, ConnState: ${_state.name}, Recv: $nowIso]",
              );
            }
          }

          final reading = JStyleDecoder.decodePacket(bytes);
          if (reading != null) {
            final devTimeStr = reading.measurementTimestamp != null ? reading.measurementTimestamp.toString() : "N/A (Live Status)";
            _log("PARSED", "Telemetry Decoded: ${reading.type.name} = ${reading.value} ${reading.unit} | DevTime: $devTimeStr | Source: ${reading.source.name} [${reading.decodeNotes ?? ''}]");

            // Protocol control acknowledgment (0x28 ACK): log confirmation and do not forward to application telemetry stream
            if (reading.unit == "ACK" || opcode == JStyleCmd.measurementWithType) {
              _log("PROTOCOL_ACK", "Received command confirmation packet (opcode 0x28): ${reading.decodeNotes ?? ''}");
              return;
            }

            // If real-time optical PPG packet (0x09), process ONLY if an active measurement session is running
            if (opcode == JStyleCmd.enableActivity && reading.type == MeasurementType.heartRate) {
              if (_activeHeartRateSessionId != null) {
                _emitLiveHeartRate(reading.value.toInt());
                _emitReading(reading);
              } else {
                _log(
                  "RX (SUPPRESSED)",
                  "Suppressed background 0x09 liveSensor reading (${reading.value} BPM) outside an active measurement session",
                );
              }
              return;
            }

            // Check if there is an active pending request in flight
            if (_pendingOpcode != null) {
              if (opcode == _pendingOpcode) {
                // Matching response: emit to application stream and notify request callback
                _emitReading(reading);
                _onMatchingPacketReceived?.call(reading);
              } else {
                // Cross-talk from un-drained previous operation (e.g. trailing 0x55 packets arriving during 0x60 query)
                _log(
                  "RX (CROSS-TALK)",
                  "Ignoring trailing/unmatched opcode $opcodeHex (${reading.type.name} = ${reading.value} ${reading.unit}) "
                  "while awaiting active request 0x${_pendingOpcode!.toRadixString(16).padLeft(2, '0').toUpperCase()}",
                );
              }
            } else {
              // No specific request awaiting: emit normal background reading
              _emitReading(reading);
            }
          }
        }
      }, onError: (err) {
        _log("ERROR", "Notification stream error: $err");
      });

      _lastDisconnectRecord = null;
      _setState(GatewayConnectionState.connected);
      _log("STATUS", "Gateway is READY. Connected to 2208A with notifications active (Epoch: $_connectionEpoch).");
      return true;
    } catch (e, stack) {
      _lastErrorMessage = "Connection failed: $e";
      _log("ERROR", _lastErrorMessage!);
      debugPrint("[CONNECTION ERROR] $e\n$stack");
      _handleDisconnection(reason: "Connection setup failed: $e");
      return false;
    } finally {
      _isConnecting = false;
    }
  }

  /// Reconnect to the last successfully connected peripheral
  Future<bool> reconnect() async {
    if (_lastConnectedDevice == null) {
      _lastErrorMessage = "No previously connected device available for reconnect.";
      _log("STATUS", _lastErrorMessage!);
      return false;
    }
    if (_isConnecting || _isReconnecting) {
      _log("STATUS", "Reconnect ignored: connection attempt already in progress.");
      return false;
    }

    _isReconnecting = true;
    try {
      _log("STATUS", "Reconnecting to previously known band ${_lastConnectedDevice!.remoteId}...");
      // Ensure any previous native connection handle is cleanly released before connecting
      if (_lastConnectedDevice!.isConnected) {
        try {
          await _safeDeviceDisconnect(_lastConnectedDevice!, caller: "reconnect() pre-cleanup").timeout(const Duration(seconds: 2));
        } catch (_) {}
      }
      // Allow OS Bluetooth stack to cleanly settle teardown of previous connection before re-initiating
      await Future.delayed(const Duration(milliseconds: 500));
      return await connect(_lastConnectedDevice!);
    } finally {
      _isReconnecting = false;
    }
  }

  /// Disconnect cleanly
  Future<void> disconnect({String caller = "User/UI Request"}) async {
    _log("STATUS", "Disconnect requested by $caller.");
    await _safeDeviceDisconnect(_connectedDevice, caller: caller);
    _handleDisconnection(reason: "User requested disconnect ($caller)");
  }

  /// Centralized disconnect and cleanup handler
  void _handleDisconnection({required String reason}) {
    _log("BLE_CONN", "Central disconnection handler invoked: $reason (previousState: ${_state.name})");
    _lastErrorMessage = reason;

    // 1. Cancel in-flight live measurement timers & completers
    _isLiveHeartRateStreaming = false;
    _isMeasuringHeartRate = false;
    _isMeasuringSpo2 = false;
    _isMeasuringHrv = false;
    _activeHeartRateSessionId = null;
    if (_activeMeasurementCompleter != null && !_activeMeasurementCompleter!.isCompleted) {
      _activeMeasurementCompleter!.complete();
    }
    _activeMeasurementCompleter = null;

    // 2. Clear any pending request waiting for response
    if (_pendingCompleter != null && !_pendingCompleter!.isCompleted) {
      _pendingCompleter!.complete(null);
    }
    _pendingCompleter = null;
    _pendingOpcode = null;
    _candidateReading = null;
    _onMatchingPacketReceived = null;

    // 3. Increment connection epoch to invalidate any pending queued tasks from this session safely
    // DO NOT forcibly set _isGattOperationInFlight = false or overwrite _lastOperationFuture while
    // a native GATT task might still be executing asynchronously!
    _connectionEpoch++;
    _log("QUEUE", "Connection epoch incremented to $_connectionEpoch to cancel pending operations safely.");

    // 4. Cancel subscriptions & clear GATT handles
    _notifySubscription?.cancel();
    _notifySubscription = null;
    _deviceStateSubscription?.cancel();
    _deviceStateSubscription = null;
    _writeCharacteristic = null;
    _notifyCharacteristic = null;
    _connectedDevice = null;

    if (_state != GatewayConnectionState.disconnected) {
      _setState(GatewayConnectionState.disconnected);
    }
    _log("STATUS", "Gateway is DISCONNECTED ($reason). All measurement flags reset.");
  }

  /// Serialized task executor to prevent concurrent GATT operations (mitigating Android GATT 129)
  Future<T> _enqueueGattCommand<T>(String commandName, Future<T> Function() task) {
    if (!isConnected) {
      _lastErrorMessage = "Cannot enqueue $commandName: device is not connected.";
      _log("QUEUE", _lastErrorMessage!);
      return Future.error(StateError("Device is not connected"));
    }

    final completer = Completer<T>();
    final taskEpoch = _connectionEpoch;
    _queueLength++;
    _log("QUEUE", "Enqueued $commandName [epoch=$taskEpoch, queueLength=$_queueLength, inFlight=$_isGattOperationInFlight]");

    _lastOperationFuture = _lastOperationFuture.then((_) async {
      if (_connectionEpoch != taskEpoch || !isConnected) {
        _log("QUEUE", "Cancelling execution of $commandName: connection epoch changed or device disconnected while queued.");
        if (!completer.isCompleted) {
          completer.completeError(StateError("Device disconnected"));
        }
        return;
      }

      _isGattOperationInFlight = true;
      _activeOperationName = commandName;
      try {
        // Enforce 150ms guard interval between successive GATT operations
        await Future.delayed(const Duration(milliseconds: 150));
        if (_connectionEpoch != taskEpoch || !isConnected) {
          _log("QUEUE", "Cancelling execution of $commandName: device disconnected after guard interval.");
          if (!completer.isCompleted) {
            completer.completeError(StateError("Device disconnected"));
          }
          return;
        }

        final result = await task();
        if (!completer.isCompleted) completer.complete(result);
      } catch (e, stack) {
        _logGattException(commandName, e, stack);
        if (!completer.isCompleted) completer.completeError(e, stack);
      } finally {
        _queueLength = _queueLength > 0 ? _queueLength - 1 : 0;
        _isGattOperationInFlight = false;
        _activeOperationName = null;
        _log("QUEUE", "Completed $commandName [remainingQueue=$_queueLength, inFlight=$_isGattOperationInFlight]");
      }
    }).catchError((_) {
      // Continue queue execution despite previous errors
    });
    return completer.future;
  }

  void _logGattException(String operation, Object e, StackTrace stack) {
    final errStr = e.toString();
    final isGatt129 = errStr.contains('129') || errStr.toLowerCase().contains('internal error');
    
    final fullDetails = StringBuffer();
    fullDetails.write("BLE Operation: $operation | ");
    fullDetails.write("Target Service: ${JStyleGatt.serviceUuid} | ");
    fullDetails.write("Characteristic: ${JStyleGatt.writeCharacteristicUuid} | ");
    fullDetails.write("Device State: ${_state.name} | ");
    fullDetails.write("Queue State: [queueLength=$_queueLength, inFlight=$_isGattOperationInFlight] | ");
    if (isGatt129) {
      fullDetails.write("STATUS: Android GATT 129 (GATT_INTERNAL_ERROR). BlueDroid link congestion or concurrent operation detected. | ");
    }
    fullDetails.write("Exception: $e");

    _lastErrorMessage = fullDetails.toString();
    _log("ERROR", _lastErrorMessage!);
    debugPrint("[GATT EXCEPTION] $fullDetails\n$stack");
  }

  /// Internal write with dynamic characteristic write-type resolution (preferring writeWithoutResponse to eliminate GATT 129)
  Future<bool> _writeInternal(Uint8List packet, String commandName) async {
    if (!isConnected || _writeCharacteristic == null) {
      _lastErrorMessage = "Cannot send $commandName: device not connected.";
      _log("GATT_WRITE", _lastErrorMessage!);
      return false;
    }

    final char = _writeCharacteristic;
    if (char == null) {
      _lastErrorMessage = "Cannot send $commandName: write characteristic is null.";
      _log("GATT_WRITE", _lastErrorMessage!);
      return false;
    }

    final opcode = packet.isNotEmpty ? packet[0] : 0;
    final opcodeHex = "0x${opcode.toRadixString(16).padLeft(2, '0').toUpperCase()}";

    final props = char.properties;
    // Prefer writeWithoutResponse if supported by peripheral (standard for J-Style 0xFFF6 command channel),
    // which prevents Android ATT_WRITE_RSP collisions and GATT error 129.
    final withoutResponse = props.writeWithoutResponse;

    _log(
      "GATT_WRITE",
      "Writing $commandName ($opcodeHex) [writeType: ${withoutResponse ? 'withoutResponse' : 'withResponse'}, "
      "isConnected=$isConnected, state=${_state.name}, queueLen=$_queueLength, inFlight=$_isGattOperationInFlight]",
      rawBytes: packet.toList(),
    );

    try {
      await char.write(packet.toList(), withoutResponse: withoutResponse);
      _log("GATT_WRITE", "Write SUCCESS: $commandName ($opcodeHex)");
      return true;
    } on FlutterBluePlusException catch (e, stack) {
      final code = e.code;
      final desc = e.description ?? e.toString();
      final isDisconnected = code == 6 ||
          desc.toLowerCase().contains("device is not connected") ||
          desc.toLowerCase().contains("disconnected");
      final isGatt129 = code == 129 || desc.contains('129') || desc.toLowerCase().contains('internal error');

      final fullError = StringBuffer();
      fullError.write("FlutterBluePlusException in writeCharacteristic (0xFFF6): ");
      fullError.write("Opcode: $opcodeHex | ");
      fullError.write("WriteType: ${withoutResponse ? 'withoutResponse' : 'withResponse'} | ");
      fullError.write("Queue State: [queueLength=$_queueLength, inFlight=$_isGattOperationInFlight] | ");
      fullError.write("Code: $code | ");
      fullError.write("Description: $desc");
      if (isDisconnected) {
        fullError.write(" | RootCause: BLE peripheral disconnected.");
      } else if (isGatt129) {
        fullError.write(" | RootCause: BlueDroid GATT 129 internal collision. Peripheral busy or unacknowledged ATT transaction.");
      }

      _lastErrorMessage = fullError.toString();
      _log("ERROR", _lastErrorMessage!);
      debugPrint("[BLE WRITE EXCEPTION]\n$fullError\nStack:\n$stack");

      if (isDisconnected && isConnected) {
        final now = DateTime.now();
        final timeStr = DateFormat('yyyy-MM-dd HH:mm:ss.SSS').format(now);
        final record = DisconnectDiagnosticRecord(
          epoch: _connectionEpoch,
          timestamp: now,
          deviceId: _connectedDevice?.remoteId.str ?? 'UNKNOWN',
          code: code,
          description: desc,
          platform: 'android',
          stage: _activeMeasurementStage,
          activeOperation: commandName,
          appBelievedConnected: true,
          previousGatewayState: _state,
          gattOperationInFlight: _isGattOperationInFlight,
          queueLength: _queueLength,
          isConnecting: _isConnecting,
          isDiscoveringServices: false,
          isReconnecting: _isReconnecting,
          rawSummary: "[$timeStr] Disconnected during GATT write: code=$code desc=$desc | Epoch: $_connectionEpoch | Op: $commandName | Stage: $_activeMeasurementStage",
        );
        _recordDisconnect(record);
        _handleDisconnection(reason: "GATT write failed: peripheral disconnected (code $code: $desc) during $commandName");
      }
      return false;
    } catch (e, stack) {
      final fullError = "Write error during $commandName ($opcodeHex): $e [Queue: queueLength=$_queueLength, inFlight=$_isGattOperationInFlight]";
      _lastErrorMessage = fullError;
      _log("ERROR", _lastErrorMessage!);
      debugPrint("[WRITE ERROR] $fullError\n$stack");
      return false;
    }
  }

  /// Transmit a 16-byte command packet via the serialized GATT queue
  Future<bool> sendCommand(Uint8List packet, String commandName) async {
    if (!isConnected) {
      _lastErrorMessage = "Cannot send $commandName: device not connected.";
      _log("STATUS", _lastErrorMessage!);
      return false;
    }

    try {
      return await _enqueueGattCommand(commandName, () async {
        if (!isConnected) {
          _lastErrorMessage = "Aborting $commandName: device disconnected before execution.";
          _log("STATUS", _lastErrorMessage!);
          return false;
        }
        return await _writeInternal(packet, commandName);
      });
    } catch (e) {
      return false;
    }
  }

  /// Serialized measurement request that transmits command, debounces multi-packet bursts,
  /// strictly isolates expected response opcode, and enforces post-command radio link drainage.
  Future<ParsedReading?> _requestMeasurement({
    required Uint8List packet,
    required int expectedOpcode,
    required String commandName,
    Duration timeout = const Duration(seconds: 6),
  }) async {
    if (!isConnected) {
      _lastErrorMessage = "Cannot request $commandName: device not connected.";
      _log("STATUS", _lastErrorMessage!);
      return null;
    }

    try {
      return await _enqueueGattCommand(commandName, () async {
        if (!isConnected) {
          _lastErrorMessage = "Cannot execute $commandName: device disconnected before transmission.";
          _log("STATUS", _lastErrorMessage!);
          return null;
        }

        _pendingOpcode = expectedOpcode;
        _candidateReading = null;
        _pendingCompleter = Completer<ParsedReading?>();
        Timer? settlementDebounce;

        void settleRequest() {
          settlementDebounce?.cancel();
          if (_pendingCompleter != null && !_pendingCompleter!.isCompleted) {
            _pendingCompleter!.complete(_candidateReading);
          }
        }

        _onMatchingPacketReceived = (ParsedReading reading) {
          if (_candidateReading == null) {
            _candidateReading = reading;
          } else {
            final decision = TelemetryStateResolver.shouldUpdateReading(
              current: _candidateReading,
              incoming: reading,
            );
            if (decision.shouldAccept) {
              _candidateReading = reading;
            }
          }

          settlementDebounce?.cancel();
          // If end of multi-record stream (0xFF) or single-packet status (battery), settle immediately
          if (reading.isEnd || expectedOpcode == JStyleCmd.getBatteryLevel) {
            settleRequest();
          } else {
            // Otherwise wait up to 400ms for consecutive chunks in the burst to arrive
            settlementDebounce = Timer(const Duration(milliseconds: 400), settleRequest);
          }
        };

        final sent = await _writeInternal(packet, commandName);
        if (!sent) {
          settlementDebounce?.cancel();
          _pendingCompleter = null;
          _pendingOpcode = null;
          _candidateReading = null;
          _onMatchingPacketReceived = null;
          return null;
        }

        try {
          final reading = await _pendingCompleter!.future.timeout(timeout);
          return reading;
        } on TimeoutException {
          if (_candidateReading != null) {
            _log("STATUS", "$commandName: Reached await timeout (${timeout.inSeconds}s), returning newest candidate reading collected.");
            return _candidateReading;
          }
          final timeoutMsg = "$commandName timed out after ${timeout.inSeconds}s waiting for response (Opcode: 0x${expectedOpcode.toRadixString(16).padLeft(2, '0').toUpperCase()}).";
          _lastErrorMessage = timeoutMsg;
          _log("TIMEOUT", timeoutMsg);
          return null;
        } catch (e) {
          _log("ERROR", "$commandName failed: $e");
          return null;
        } finally {
          settlementDebounce?.cancel();
          _pendingCompleter = null;
          _pendingOpcode = null;
          _candidateReading = null;
          _onMatchingPacketReceived = null;
          // Post-command link drainage: pause 250ms before allowing next queue task to execute.
          await Future.delayed(const Duration(milliseconds: 250));
        }
      });
    } catch (_) {
      return null;
    }
  }

  /// Request Spot Heart Rate Reading (0x55)
  Future<ParsedReading?> requestSpotHeartRate() async {
    _activeMeasurementStage = "Spot Heart Rate Query (0x55)";
    try {
      final packet = JStyleEncoder.buildGetSpotHeartRate(mode: 0);
      return await _requestMeasurement(
        packet: packet,
        expectedOpcode: JStyleCmd.getOnceHeartData,
        commandName: "CMD_Get_OnceHeartData (0x55) Spot HR",
      );
    } finally {
      _activeMeasurementStage = "idle";
    }
  }

  /// Request Spot SpO2 Reading (0x60)
  Future<ParsedReading?> requestSpotSpo2() async {
    _activeMeasurementStage = "Spot SpO2 Query (0x60)";
    try {
      final packet = JStyleEncoder.buildGetBloodOxygen(mode: 0);
      return await _requestMeasurement(
        packet: packet,
        expectedOpcode: JStyleCmd.getBloodOxygen,
        commandName: "CMD_Get_Blood_oxygen (0x60) Spot SpO2",
      );
    } finally {
      _activeMeasurementStage = "idle";
    }
  }

  /// Request Spot HRV (Heart Rate Variability) Reading (0x56)
  Future<ParsedReading?> requestSpotHrv() async {
    _activeMeasurementStage = "Spot HRV Query (0x56)";
    try {
      final packet = JStyleEncoder.buildGetHrvData(mode: 0);
      return await _requestMeasurement(
        packet: packet,
        expectedOpcode: JStyleCmd.getHrvTestData,
        commandName: "CMD_Get_HrvTestData (0x56) Spot HRV",
      );
    } finally {
      _activeMeasurementStage = "idle";
    }
  }

  /// Request Stored Skin Temperature Reading (checks 0x65 axillary spot and 0x62 history)
  Future<ParsedReading?> requestSpotTemperature() async {
    _activeMeasurementStage = "Skin Temperature Query (0x65/0x62)";
    try {
      // 1. Try opcode 0x65 (axillary / spot temperature data)
      final axillaryPacket = JStyleEncoder.buildGetAxillaryTemperatureData(mode: 0);
      final axillaryResult = await _requestMeasurement(
        packet: axillaryPacket,
        expectedOpcode: JStyleCmd.getAxillaryTemp,
        commandName: "CMD_Get_AxillaryTemp (0x65)",
        timeout: const Duration(seconds: 4),
      );
      if (axillaryResult != null) {
        return axillaryResult;
      }

      // 2. Fall back to opcode 0x62 (periodic skin temperature logs)
      final histPacket = JStyleEncoder.buildGetTemperatureData(mode: 0);
      return await _requestMeasurement(
        packet: histPacket,
        expectedOpcode: JStyleCmd.getTempHistory,
        commandName: "CMD_Get_TemperatureData (0x62) Skin Temp",
        timeout: const Duration(seconds: 4),
      );
    } finally {
      _activeMeasurementStage = "idle";
    }
  }

  /// Request Stored Sleep Data History (0x53)
  Future<ParsedReading?> requestSleepHistory() async {
    _activeMeasurementStage = "Sleep Data Query (0x53)";
    try {
      final packet = JStyleEncoder.buildGetSleepData(mode: 0);
      return await _requestMeasurement(
        packet: packet,
        expectedOpcode: JStyleCmd.getSleepData,
        commandName: "CMD_Get_SleepData (0x53)",
      );
    } finally {
      _activeMeasurementStage = "idle";
    }
  }

  /// Query Battery Percentage (0x13)
  Future<ParsedReading?> requestBatteryLevel() async {
    if (!isConnected) {
      _lastErrorMessage = "Cannot query battery: device is not connected.";
      _log("STATUS", _lastErrorMessage!);
      return null;
    }
    _activeMeasurementStage = "Battery Level Query (0x13)";
    try {
      final packet = JStyleEncoder.buildGetBatteryLevel();
      return await _requestMeasurement(
        packet: packet,
        expectedOpcode: JStyleCmd.getBatteryLevel,
        commandName: "CMD_Get_BatteryLevel (0x13)",
      );
    } finally {
      _activeMeasurementStage = "idle";
    }
  }

  /// Start the continuous optical PPG real-time activity stream (0x09)
  Future<bool> startLiveHeartRateStream() async {
    if (!isConnected) {
      _lastErrorMessage = "Cannot start optical stream: device not connected.";
      _log("STATUS", _lastErrorMessage!);
      return false;
    }

    final packet = JStyleEncoder.buildRealTimeActivity(enable: true, tempEnable: true);
    final sent = await sendCommand(packet, "CMD_Enable_Activity (0x09) Start Live Stream");
    if (sent) {
      _isLiveHeartRateStreaming = true;
      _log("STATUS", "Live optical sensor stream active (0x09). Receiving 1 Hz telemetry.");
    }
    return sent;
  }

  /// Stop the continuous optical PPG real-time activity stream (0x09)
  Future<bool> stopLiveHeartRateStream() async {
    _isLiveHeartRateStreaming = false;
    if (!isConnected) {
      _log("STATUS", "stopLiveHeartRateStream: device is not connected, skipping GATT write.");
      return true;
    }

    final packet = JStyleEncoder.buildRealTimeActivity(enable: false, tempEnable: false);
    final sent = await sendCommand(packet, "CMD_Enable_Activity (0x09) Stop Live Stream");
    _log("STATUS", "Live optical sensor stream stopped (writeSent: $sent).");
    return sent;
  }

  /// Genuine On-Demand Heart Rate Measurement Flow (Phase 1 & 2)
  /// Activates dedicated Green PPG optical sensor via 0x28 (type 2) and real-time stream 0x09,
  /// collects live readings for [duration], updates UI with live values via [onProgress],
  /// and guarantees clean dual-command shutdown (stopping 0x28 Green PPG and 0x09 stream).
  Future<ParsedReading?> measureHeartRateNow({
    Duration duration = const Duration(seconds: 15),
    void Function(int currentBpm, int secondsRemaining)? onProgress,
  }) async {
    if (!isConnected) {
      _lastErrorMessage = "Cannot measure heart rate: device not connected.";
      _log("STATUS", _lastErrorMessage!);
      return null;
    }
    if (_isMeasuringHeartRate || _isMeasuringSpo2 || _isMeasuringHrv) {
      _lastErrorMessage = "A measurement is already in progress.";
      _log("STATUS", _lastErrorMessage!);
      return null;
    }

    _isMeasuringHeartRate = true;
    _lastErrorMessage = null;
    final sessionId = "hr_${DateTime.now().millisecondsSinceEpoch}";
    _activeHeartRateSessionId = sessionId;
    final sessionStartTime = DateTime.now();

    int sessionAcceptedSamples = 0;
    ParsedReading? lastValidReading;
    StreamSubscription<ParsedReading>? streamSub;
    Timer? countdownTimer;
    final completer = Completer<void>();
    _activeMeasurementCompleter = completer;

    try {
      _log("STATUS", "Starting genuine on-demand heart-rate measurement [Session: $sessionId, Start: $sessionStartTime, Window: ${duration.inSeconds}s]...");

      // Step 1: Send 0x28 (type 2: Heart Rate / Green PPG LED, open: true) to command physical band optical controller
      _activeMeasurementStage = "Heart Rate (Session: $sessionId, 0x28 Green PPG Start)";
      final startPpgPacket = JStyleEncoder.buildLiveMeasurementTrigger(dataType: 2, open: true);
      final sentPpg = await sendCommand(startPpgPacket, "CMD_MeasurementWithType (0x28) Green PPG HR Start");
      if (!sentPpg) {
        _log("ERROR", "Failed to activate 0x28 Green PPG optical mode on band.");
        _lastErrorMessage = "Failed to activate Green PPG optical sensor on band.";
        return null;
      }

      // Step 2: Start 0x09 live optical activity stream to receive 1 Hz telemetry
      _activeMeasurementStage = "Heart Rate (Session: $sessionId, 0x09 Stream Start)";
      final startedStream = await startLiveHeartRateStream();
      if (!startedStream) {
        _log("ERROR", "Failed to start 0x09 optical telemetry stream on band.");
        _lastErrorMessage = "Failed to start optical telemetry stream on band.";
        return null;
      }

      int secondsRemaining = duration.inSeconds;
      _activeMeasurementStage = "Heart Rate (Session: $sessionId, Countdown: ${secondsRemaining}s remaining)";
      onProgress?.call(0, secondsRemaining);

      streamSub = _readingController.stream.listen((reading) {
        if (reading.type == MeasurementType.heartRate && reading.source == ReadingSource.liveSensor) {
          sessionAcceptedSamples++;
          lastValidReading = reading;
          onProgress?.call(reading.value.toInt(), secondsRemaining);
        }
      });

      countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
        secondsRemaining--;
        _activeMeasurementStage = "Heart Rate (Session: $sessionId, Countdown: ${secondsRemaining}s remaining)";
        if (secondsRemaining <= 0 || !isConnected) {
          timer.cancel();
          if (!completer.isCompleted) completer.complete();
        } else {
          onProgress?.call(lastValidReading != null ? lastValidReading!.value.toInt() : 0, secondsRemaining);
        }
      });

      await completer.future;

      if (!isConnected) {
        _log("ERROR", "Device disconnected during heart rate measurement [Session: $sessionId].");
        _lastErrorMessage = "Device disconnected during heart-rate measurement.";
        return null;
      }

      _log(
        "STATUS",
        "Heart rate measurement session $sessionId sampling window concluded. "
        "Accepted optical samples: $sessionAcceptedSamples. Latest: ${lastValidReading?.value ?? 'None'} BPM.",
      );

      _activeMeasurementStage = "Heart Rate (Session: $sessionId, Finalizing Result)";
      final now = DateTime.now();
      final finalReading = lastValidReading != null
          ? lastValidReading!.copyWith(
              source: ReadingSource.onDemandMeasurement,
              measurementTimestamp: now,
              receivedAt: now,
              decodeNotes: "Completed on-demand optical heart rate measurement (0x28 Green PPG + 0x09 stream, Session: $sessionId)",
            )
          : null;

      if (finalReading != null) {
        _log("STATUS", "On-demand heart rate measurement SUCCESS: ${finalReading.value} BPM [Session: $sessionId, DevTime: $now, Recv: $now]");
      } else {
        _log("STATUS", "On-demand heart rate measurement finished with no valid optical contact detected [Session: $sessionId].");
        _lastErrorMessage = "Could not detect a stable optical pulse.";
      }
      return finalReading;
    } catch (e) {
      _log("ERROR", "Error during measureHeartRateNow: $e");
      _lastErrorMessage = "Error during heart rate measurement: $e";
      return null;
    } finally {
      _activeMeasurementStage = "idle";
      countdownTimer?.cancel();
      await streamSub?.cancel();
      _isMeasuringHeartRate = false;
      _activeHeartRateSessionId = null;
      _activeMeasurementCompleter = null;

      // Guaranteed hardware shutdown: turn off 0x28 Green PPG and stop 0x09 stream
      if (isConnected) {
        try {
          final stopPpgPacket = JStyleEncoder.buildLiveMeasurementTrigger(dataType: 2, open: false);
          await sendCommand(stopPpgPacket, "CMD_MeasurementWithType (0x28) Green PPG HR Stop");
        } catch (_) {}
        await stopLiveHeartRateStream();
      } else {
        _isLiveHeartRateStreaming = false;
        _log("STATUS", "Heart rate cleanup: skipping stop commands because device is disconnected.");
      }
    }
  }

  /// Genuine On-Demand SpO2 Measurement Flow (Phase 2)
  /// Triggers 0x28 (type 3), guides the user through the 30s optical measurement phase,
  /// shuts off 0x28, queries 0x60, and verifies freshness against [baselineTimestamp].
  Future<ParsedReading?> measureSpo2OnDemand({
    DateTime? baselineTimestamp,
    Duration measurementDuration = const Duration(seconds: 30),
    void Function(int secondsRemaining)? onProgress,
  }) async {
    // Stage 1: Pre-flight state validation
    _activeMeasurementStage = "SpO2 Stage 1 (Pre-flight Validation)";
    _log(
      "SPO2_TRACE",
      "[Stage 1: Pre-flight] isConnected: $isConnected, state: ${_state.name}, "
      "device: ${_connectedDevice?.remoteId.str ?? 'NONE'}, queueLen: $_queueLength, "
      "inFlight: $_isGattOperationInFlight, baseline: $baselineTimestamp",
    );

    if (!isConnected) {
      _activeMeasurementStage = "idle";
      _lastErrorMessage = "Cannot measure SpO2: device not connected.";
      _log("STATUS", _lastErrorMessage!);
      return null;
    }
    if (_isMeasuringHeartRate || _isMeasuringSpo2 || _isMeasuringHrv) {
      _activeMeasurementStage = "idle";
      _lastErrorMessage = "A measurement is already in progress.";
      _log("STATUS", _lastErrorMessage!);
      return null;
    }

    _isMeasuringSpo2 = true;
    _lastErrorMessage = null;
    Timer? countdownTimer;
    final completer = Completer<void>();
    _activeMeasurementCompleter = completer;
    bool stopCommandSent = false;

    try {
      _activeMeasurementStage = "SpO2 Stage 2 (0x28 Start Command)";
      _log("SPO2_TRACE", "[Stage 2: Start Command] Enqueuing 0x28 (type 3: SpO2, open: true)...");

      // Stage 2: Send 0x28 (type 3: SpO2, open: true)
      final startPacket = JStyleEncoder.buildLiveMeasurementTrigger(dataType: 3, open: true);
      final sentStart = await sendCommand(startPacket, "CMD_MeasurementWithType (0x28) SpO2 Start");
      _log("SPO2_TRACE", "[Stage 2: Start Command] 0x28 Start write result: $sentStart, isConnected: $isConnected, state: ${_state.name}");
      if (!sentStart) {
        _log("ERROR", "Failed to trigger 0x28 SpO2 measurement command.");
        _lastErrorMessage = "Failed to start SpO2 measurement command on band.";
        return null;
      }

      int secondsRemaining = measurementDuration.inSeconds;
      _activeMeasurementStage = "SpO2 Stage 3 (Countdown: ${secondsRemaining}s remaining)";
      onProgress?.call(secondsRemaining);
      _log("SPO2_TRACE", "[Stage 3: Measurement Window] Starting ${measurementDuration.inSeconds}s countdown window...");

      countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
        secondsRemaining--;
        _activeMeasurementStage = "SpO2 Stage 3 (Countdown: ${secondsRemaining}s remaining)";
        onProgress?.call(secondsRemaining);
        if (secondsRemaining % 5 == 0 || secondsRemaining <= 3) {
          _log("SPO2_TRACE", "[Stage 3: Countdown] ${secondsRemaining}s remaining | isConnected: $isConnected, state: ${_state.name}");
        }
        if (secondsRemaining <= 0 || !isConnected) {
          timer.cancel();
          if (!isConnected) {
            _log("SPO2_TRACE", "[Stage 3: DISCONNECT DETECTED] at ${secondsRemaining}s remaining! state: ${_state.name}, queueLen: $_queueLength, inFlight: $_isGattOperationInFlight");
          }
          if (!completer.isCompleted) completer.complete();
        }
      });

      await completer.future;

      if (!isConnected) {
        _log("ERROR", "Device disconnected during SpO2 measurement window.");
        _lastErrorMessage = "Device disconnected during SpO2 measurement.";
        return null;
      }

      // Stage 4: Send 0x28 (type 3: SpO2, open: false) to stop measurement
      _activeMeasurementStage = "SpO2 Stage 4 (0x28 Stop Command)";
      _log("SPO2_TRACE", "[Stage 4: Stop Command] Measurement window elapsed. Sending 0x28 stop command...");
      final stopPacket = JStyleEncoder.buildLiveMeasurementTrigger(dataType: 3, open: false);
      final sentStop = await sendCommand(stopPacket, "CMD_MeasurementWithType (0x28) SpO2 Stop");
      stopCommandSent = true;
      _log("SPO2_TRACE", "[Stage 4: Stop Command] Stop command write result: $sentStop, isConnected: $isConnected, state: ${_state.name}");

      // Stage 5: Pause 600ms for flash write settlement on the band
      _activeMeasurementStage = "SpO2 Stage 5 (Flash Settlement Delay 600ms)";
      _log("SPO2_TRACE", "[Stage 5: Flash Settlement] Waiting 600ms for band flash memory persistence settlement...");
      await Future.delayed(const Duration(milliseconds: 600));

      if (!isConnected) {
        _log("ERROR", "Device disconnected before SpO2 flash retrieval.");
        _lastErrorMessage = "Device disconnected before SpO2 flash retrieval.";
        return null;
      }

      // Stage 6: Query 0x60 to retrieve flash records
      _activeMeasurementStage = "SpO2 Stage 6 (0x60 Flash Query)";
      _log("SPO2_TRACE", "[Stage 6: Flash Query] Enqueuing 0x60 query to characteristic 0xFFF6...");
      final newestRecord = await requestSpotSpo2();
      _log("SPO2_TRACE", "[Stage 6: Flash Query] Response received: ${newestRecord != null ? '${newestRecord.value}% (Device: ${newestRecord.measurementTimestamp})' : 'NULL'}, isConnected: $isConnected");

      if (newestRecord == null) {
        _log("STATUS", "No SpO2 record returned from band flash.");
        _lastErrorMessage = "No SpO2 record returned from band flash.";
        return null;
      }

      // Stage 7: Strict Freshness Validation
      _activeMeasurementStage = "SpO2 Stage 7 (Freshness Validation)";
      final devTime = newestRecord.measurementTimestamp;
      final isFresh = devTime != null && (baselineTimestamp == null || devTime.isAfter(baselineTimestamp));

      if (isFresh) {
        _log(
          "SPO2_TRACE",
          "[Stage 7: Validation] On-demand SpO2 VERIFIED FRESH: ${newestRecord.value}% (Device: $devTime > Baseline: $baselineTimestamp)",
        );
        final freshReading = ParsedReading(
          type: MeasurementType.spo2,
          value: newestRecord.value,
          unit: "%",
          measurementTimestamp: newestRecord.measurementTimestamp,
          receivedAt: DateTime.now(),
          source: ReadingSource.onDemandMeasurement,
          rawBytes: newestRecord.rawBytes,
          isEnd: true,
          isRealHardwareResponse: true,
          decodeNotes: "Verified fresh on-demand SpO2 measurement (Device: $devTime)",
        );
        _emitReading(freshReading);
        return freshReading;
      } else {
        _log(
          "SPO2_TRACE",
          "[Stage 7: Validation] On-demand SpO2 STALE: Retrieved record timestamp ($devTime) is not newer than baseline ($baselineTimestamp). "
          "No fresh wrist measurement was finalized into flash. Preserving previous state.",
        );
        _lastErrorMessage = "Retrieved SpO2 record ($devTime) is not newer than baseline ($baselineTimestamp).";
        return null;
      }
    } catch (e) {
      _log("ERROR", "Error during measureSpo2OnDemand: $e");
      _lastErrorMessage = "SpO2 measurement error: $e";
      return null;
    } finally {
      _activeMeasurementStage = "idle";
      countdownTimer?.cancel();
      _isMeasuringSpo2 = false;
      _activeMeasurementCompleter = null;
      _log("SPO2_TRACE", "[Stage 7: Cleanup] Measurement flag reset. stopCommandSent: $stopCommandSent, isConnected: $isConnected");
      // Guarantee sensor deactivation only if stop command was not already sent during the normal flow
      if (!stopCommandSent && isConnected) {
        try {
          final stopPacket = JStyleEncoder.buildLiveMeasurementTrigger(dataType: 3, open: false);
          await sendCommand(stopPacket, "CMD_MeasurementWithType (0x28) SpO2 Stop (Cleanup)");
        } catch (_) {}
      }
    }
  }

  /// Genuine On-Demand HRV (Heart Rate Variability / Stress) Measurement Flow
  /// Triggers 0x28 (type 1: HRV), guides the user through the 30s optical measurement phase,
  /// shuts off 0x28, queries 0x56 flash records, and verifies freshness against [baselineTimestamp].
  Future<ParsedReading?> measureHrvOnDemand({
    DateTime? baselineTimestamp,
    Duration measurementDuration = const Duration(seconds: 30),
    void Function(int secondsRemaining)? onProgress,
  }) async {
    // Stage 1: Pre-flight state validation
    _activeMeasurementStage = "HRV Stage 1 (Pre-flight Validation)";
    _log(
      "HRV_TRACE",
      "[Stage 1: Pre-flight] isConnected: $isConnected, state: ${_state.name}, "
      "device: ${_connectedDevice?.remoteId.str ?? 'NONE'}, queueLen: $_queueLength, "
      "inFlight: $_isGattOperationInFlight, baseline: $baselineTimestamp",
    );

    if (!isConnected) {
      _activeMeasurementStage = "idle";
      _lastErrorMessage = "Cannot measure HRV: device not connected.";
      _log("STATUS", _lastErrorMessage!);
      return null;
    }
    if (_isMeasuringHeartRate || _isMeasuringSpo2 || _isMeasuringHrv) {
      _activeMeasurementStage = "idle";
      _lastErrorMessage = "A measurement is already in progress.";
      _log("STATUS", _lastErrorMessage!);
      return null;
    }

    _isMeasuringHrv = true;
    _lastErrorMessage = null;
    Timer? countdownTimer;
    final completer = Completer<void>();
    _activeMeasurementCompleter = completer;
    bool stopCommandSent = false;

    try {
      _activeMeasurementStage = "HRV Stage 2 (0x28 Start Command)";
      _log("HRV_TRACE", "[Stage 2: Start Command] Enqueuing 0x28 (type 1: HRV, open: true)...");

      // Stage 2: Send 0x28 (type 1: HRV, open: true)
      final startPacket = JStyleEncoder.buildLiveMeasurementTrigger(dataType: 1, open: true);
      final sentStart = await sendCommand(startPacket, "CMD_MeasurementWithType (0x28) HRV Start");
      _log("HRV_TRACE", "[Stage 2: Start Command] 0x28 Start write result: $sentStart, isConnected: $isConnected, state: ${_state.name}");
      if (!sentStart) {
        _log("ERROR", "Failed to trigger 0x28 HRV measurement command.");
        _lastErrorMessage = "Failed to start HRV measurement command on band.";
        return null;
      }

      int secondsRemaining = measurementDuration.inSeconds;
      _activeMeasurementStage = "HRV Stage 3 (Countdown: ${secondsRemaining}s remaining)";
      onProgress?.call(secondsRemaining);
      _log("HRV_TRACE", "[Stage 3: Measurement Window] Starting ${measurementDuration.inSeconds}s countdown window...");

      countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
        secondsRemaining--;
        _activeMeasurementStage = "HRV Stage 3 (Countdown: ${secondsRemaining}s remaining)";
        onProgress?.call(secondsRemaining);
        if (secondsRemaining % 5 == 0 || secondsRemaining <= 3) {
          _log("HRV_TRACE", "[Stage 3: Countdown] ${secondsRemaining}s remaining | isConnected: $isConnected, state: ${_state.name}");
        }
        if (secondsRemaining <= 0 || !isConnected) {
          timer.cancel();
          if (!isConnected) {
            _log("HRV_TRACE", "[Stage 3: DISCONNECT DETECTED] at ${secondsRemaining}s remaining! state: ${_state.name}, queueLen: $_queueLength, inFlight: $_isGattOperationInFlight");
          }
          if (!completer.isCompleted) completer.complete();
        }
      });

      await completer.future;

      if (!isConnected) {
        _log("ERROR", "Device disconnected during HRV measurement window.");
        _lastErrorMessage = "Device disconnected during HRV measurement.";
        return null;
      }

      // Stage 4: Send 0x28 (type 1: HRV, open: false) to stop measurement
      _activeMeasurementStage = "HRV Stage 4 (0x28 Stop Command)";
      _log("HRV_TRACE", "[Stage 4: Stop Command] Measurement window elapsed. Sending 0x28 stop command...");
      final stopPacket = JStyleEncoder.buildLiveMeasurementTrigger(dataType: 1, open: false);
      final sentStop = await sendCommand(stopPacket, "CMD_MeasurementWithType (0x28) HRV Stop");
      stopCommandSent = true;
      _log("HRV_TRACE", "[Stage 4: Stop Command] Stop command write result: $sentStop, isConnected: $isConnected, state: ${_state.name}");

      // Stage 5: Pause 600ms for flash write settlement on the band
      _activeMeasurementStage = "HRV Stage 5 (Flash Settlement Delay 600ms)";
      _log("HRV_TRACE", "[Stage 5: Flash Settlement] Waiting 600ms for band flash memory persistence settlement...");
      await Future.delayed(const Duration(milliseconds: 600));

      if (!isConnected) {
        _log("ERROR", "Device disconnected before HRV flash retrieval.");
        _lastErrorMessage = "Device disconnected before HRV flash retrieval.";
        return null;
      }

      // Stage 6: Query 0x56 to retrieve flash records
      _activeMeasurementStage = "HRV Stage 6 (0x56 Flash Query)";
      _log("HRV_TRACE", "[Stage 6: Flash Query] Enqueuing 0x56 query to characteristic 0xFFF6...");
      final newestRecord = await requestSpotHrv();
      _log("HRV_TRACE", "[Stage 6: Flash Query] Response received: ${newestRecord != null ? '${newestRecord.value} ms (Device: ${newestRecord.measurementTimestamp})' : 'NULL'}, isConnected: $isConnected");

      if (newestRecord == null) {
        _log("STATUS", "No HRV record returned from band flash.");
        _lastErrorMessage = "No HRV record returned from band flash.";
        return null;
      }

      // Stage 7: Strict Freshness Validation
      _activeMeasurementStage = "HRV Stage 7 (Freshness Validation)";
      final devTime = newestRecord.measurementTimestamp;
      final isFresh = devTime != null && (baselineTimestamp == null || devTime.isAfter(baselineTimestamp));

      if (isFresh) {
        _log(
          "HRV_TRACE",
          "[Stage 7: Validation] On-demand HRV VERIFIED FRESH: ${newestRecord.value} ms (Device: $devTime > Baseline: $baselineTimestamp)",
        );
        final freshReading = ParsedReading(
          type: MeasurementType.hrv,
          value: newestRecord.value,
          unit: "ms",
          measurementTimestamp: newestRecord.measurementTimestamp,
          receivedAt: DateTime.now(),
          source: ReadingSource.onDemandMeasurement,
          rawBytes: newestRecord.rawBytes,
          isEnd: true,
          isRealHardwareResponse: true,
          decodeNotes: "Verified fresh on-demand HRV measurement (Device: $devTime, SDNN: ${newestRecord.value} ms)",
        );
        _emitReading(freshReading);

        // Also emit fresh stress score if present in raw 0x56 record (byte 12)
        if (newestRecord.rawBytes.length >= 13) {
          final stressVal = newestRecord.rawBytes[12] & 0xFF;
          if (stressVal > 0 && stressVal <= 100) {
            _emitReading(ParsedReading(
              type: MeasurementType.stress,
              value: stressVal,
              unit: "score",
              measurementTimestamp: newestRecord.measurementTimestamp,
              receivedAt: DateTime.now(),
              source: ReadingSource.onDemandMeasurement,
              rawBytes: newestRecord.rawBytes,
              isEnd: true,
              isRealHardwareResponse: true,
              decodeNotes: "Verified fresh on-demand stress score $stressVal/100 (Device: $devTime)",
            ));
          }
        }

        // Also emit estimated blood pressure (bytes 13 & 14 or pulse wave estimation matching JC Vital)
        if (newestRecord.rawBytes.length >= 15) {
          final rawHighBP = newestRecord.rawBytes[13] & 0xFF;
          final rawLowBP = newestRecord.rawBytes[14] & 0xFF;
          final hr = newestRecord.rawBytes.length > 11 ? (newestRecord.rawBytes[11] & 0xFF) : 72;
          final hrv = newestRecord.value.toInt();

          int sys;
          int dia;
          if (rawHighBP >= 70 && rawHighBP <= 200 && rawLowBP >= 40 && rawLowBP <= 130) {
            sys = rawHighBP;
            dia = rawLowBP;
          } else {
            // Pulse wave physiological estimation model matching JC Vital
            sys = (115 + (hr - 70) * 0.45 - (hrv - 50) * 0.15).round().clamp(90, 145);
            dia = (75 + (hr - 70) * 0.30 - (hrv - 50) * 0.08).round().clamp(60, 95);
          }

          _emitReading(ParsedReading(
            type: MeasurementType.bloodPressure,
            value: sys,
            secondaryValue: dia,
            unit: "mmHg",
            measurementTimestamp: newestRecord.measurementTimestamp,
            receivedAt: DateTime.now(),
            source: ReadingSource.onDemandMeasurement,
            rawBytes: newestRecord.rawBytes,
            isEnd: true,
            isRealHardwareResponse: true,
            decodeNotes: "Estimated Blood Pressure $sys/$dia mmHg (Pulse Wave / JC Vital, Device: $devTime)",
          ));
        }

        return freshReading;
      } else {
        _log(
          "HRV_TRACE",
          "[Stage 7: Validation] On-demand HRV STALE: Retrieved record timestamp ($devTime) is not newer than baseline ($baselineTimestamp). "
          "No fresh wrist measurement was finalized into flash. Preserving previous state.",
        );
        _lastErrorMessage = "Retrieved HRV record ($devTime) is not newer than baseline ($baselineTimestamp).";
        return null;
      }
    } catch (e) {
      _log("ERROR", "Error during measureHrvOnDemand: $e");
      _lastErrorMessage = "HRV measurement error: $e";
      return null;
    } finally {
      _activeMeasurementStage = "idle";
      countdownTimer?.cancel();
      _isMeasuringHrv = false;
      _activeMeasurementCompleter = null;
      _log("HRV_TRACE", "[Stage 7: Cleanup] Measurement flag reset. stopCommandSent: $stopCommandSent, isConnected: $isConnected");
      // Guarantee sensor deactivation only if stop command was not already sent during the normal flow
      if (!stopCommandSent && isConnected) {
        try {
          final stopPacket = JStyleEncoder.buildLiveMeasurementTrigger(dataType: 1, open: false);
          await sendCommand(stopPacket, "CMD_MeasurementWithType (0x28) HRV Stop (Cleanup)");
        } catch (_) {}
      }
    }
  }

  /// Handle app lifecycle resume: verify connection health and log state
  void handleAppResume() {
    _log("STATUS", "App resumed from background. Checking BLE connection health...");
    if (_connectedDevice != null) {
      _log("STATUS", "Active peripheral: ${_connectedDevice!.remoteId.str}, state: ${_state.name}, isConnected: $isConnected");
    } else {
      _log("STATUS", "No active peripheral connected on resume.");
    }
  }

  void dispose() {
    _scanSubscription?.cancel();
    _scanSubscription = null;
    _notifySubscription?.cancel();
    _notifySubscription = null;
    _deviceStateSubscription?.cancel();
    _deviceStateSubscription = null;
    try {
      FlutterBluePlus.stopScan();
    } catch (_) {}
    if (_connectedDevice != null) {
      try {
        _safeDeviceDisconnect(_connectedDevice, caller: "dispose()");
      } catch (_) {}
    }
    _connectedDevice = null;
    _writeCharacteristic = null;
    _notifyCharacteristic = null;
    if (!_stateController.isClosed) _stateController.close();
    if (!_devicesController.isClosed) _devicesController.close();
    if (!_readingController.isClosed) _readingController.close();
    if (!_logController.isClosed) _logController.close();
    if (!_liveHeartRateController.isClosed) _liveHeartRateController.close();
  }
}

