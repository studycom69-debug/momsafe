import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:permission_handler/permission_handler.dart';
import 'ble/wearable_ble_manager.dart';
import 'protocol/momsafe_constants.dart';
import 'protocol/momsafe_decoder.dart';
import 'protocol/telemetry_state_resolver.dart';
import 'sync/momsafe_cloud_sync.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const MomSafeGatewayApp());
}

class MomSafeGatewayApp extends StatelessWidget {
  const MomSafeGatewayApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'MomSafe Wearable Gateway',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFFE11D48), // MomSafe Rose
          brightness: Brightness.light,
        ),
        useMaterial3: true,
      ),
      home: const GatewayDashboardScreen(),
    );
  }
}

class GatewayDashboardScreen extends StatefulWidget {
  const GatewayDashboardScreen({super.key});

  @override
  State<GatewayDashboardScreen> createState() => _GatewayDashboardScreenState();
}

class _GatewayDashboardScreenState extends State<GatewayDashboardScreen> with WidgetsBindingObserver {
  final WearableBleManager _bleManager = WearableBleManager();
  final MomSafeCloudSync _cloudSync = MomSafeCloudSync();
  
  GatewayConnectionState _connectionState = GatewayConnectionState.disconnected;
  List<DiscoveredWearable> _devices = [];
  List<RawDiagnosticLog> _logs = [];
  
  // Real measurement state (guaranteed to display the latest accepted reading)
  ParsedReading? _latestHeartRate;
  ParsedReading? _latestSpo2;
  ParsedReading? _latestHrv;
  ParsedReading? _latestStress;
  ParsedReading? _latestTemperature;
  ParsedReading? _latestSleep;
  ParsedReading? _latestBattery;
  ParsedReading? _latestBloodPressure;

  // Preserved history records
  final List<ParsedReading> _heartRateHistory = [];
  final List<ParsedReading> _spo2History = [];
  final List<ParsedReading> _hrvHistory = [];
  final List<ParsedReading> _stressHistory = [];
  final List<ParsedReading> _temperatureHistory = [];
  final List<ParsedReading> _sleepHistory = [];
  final List<ParsedReading> _bloodPressureHistory = [];
  
  // Loading & error state
  String? _activeRequestName;
  String? _measurementProgressText;
  String? _lastErrorBanner;
  String? _lastInfoBanner;
  bool _isSyncingCloud = false;
  String? _cloudSyncStatus;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);

    _bleManager.stateStream.listen((state) {
      if (mounted) {
        setState(() {
          _connectionState = state;
          if (state == GatewayConnectionState.disconnected) {
            _activeRequestName = null;
            _measurementProgressText = null;
            final disc = _bleManager.lastDisconnectRecord;
            if (disc != null) {
              final codeStr = disc.code != null ? "Code ${disc.code}" : "OS Link Loss";
              final descStr = disc.description != null && disc.description!.isNotEmpty ? " (${disc.description})" : "";
              _lastErrorBanner = "Disconnected: $codeStr$descStr at ${disc.stage}. Tap Reconnect.";
            } else {
              _lastErrorBanner = _bleManager.lastErrorMessage ?? "Band disconnected. Tap Reconnect to continue.";
            }
          }
        });
      }
    });

    _bleManager.devicesStream.listen((devices) {
      if (mounted) setState(() => _devices = devices);
    });

    _bleManager.logStream.listen((log) {
      if (mounted) setState(() => _logs = _bleManager.diagnosticLogs);
    });

    // Main telemetry stream listener with chronological state validation
    _bleManager.readingStream.listen((reading) {
      if (mounted) {
        _applyReading(reading);
      }
    });
  }

  /// Evaluates and applies incoming telemetry according to chronological ordering and source rules
  void _applyReading(ParsedReading incoming) {
    ParsedReading? current;
    switch (incoming.type) {
      case MeasurementType.heartRate:
        current = _latestHeartRate;
        break;
      case MeasurementType.spo2:
        current = _latestSpo2;
        break;
      case MeasurementType.hrv:
        current = _latestHrv;
        break;
      case MeasurementType.stress:
        current = _latestStress;
        break;
      case MeasurementType.temperature:
      case MeasurementType.skinTemperature:
        current = _latestTemperature;
        break;
      case MeasurementType.sleep:
        current = _latestSleep;
        break;
      case MeasurementType.battery:
        current = _latestBattery;
        break;
      case MeasurementType.bloodPressure:
        current = _latestBloodPressure;
        break;
    }

    // Preserve in history collection (deduplicated by measurement timestamp)
    void addToHistory(List<ParsedReading> list, ParsedReading reading) {
      final exists = list.any((r) =>
          r.measurementTimestamp != null &&
          reading.measurementTimestamp != null &&
          r.measurementTimestamp!.isAtSameMomentAs(reading.measurementTimestamp!));
      if (!exists) {
        list.insert(0, reading);
        if (list.length > 50) list.removeLast();
      }
    }

    if (incoming.type == MeasurementType.heartRate) {
      addToHistory(_heartRateHistory, incoming);
    } else if (incoming.type == MeasurementType.spo2) {
      addToHistory(_spo2History, incoming);
    } else if (incoming.type == MeasurementType.hrv) {
      addToHistory(_hrvHistory, incoming);
    } else if (incoming.type == MeasurementType.stress) {
      addToHistory(_stressHistory, incoming);
    } else if (incoming.type == MeasurementType.temperature || incoming.type == MeasurementType.skinTemperature) {
      addToHistory(_temperatureHistory, incoming);
    } else if (incoming.type == MeasurementType.sleep) {
      addToHistory(_sleepHistory, incoming);
    } else if (incoming.type == MeasurementType.bloodPressure) {
      addToHistory(_bloodPressureHistory, incoming);
    }

    final decision = TelemetryStateResolver.shouldUpdateReading(
      current: current,
      incoming: incoming,
    );

    final timeFmt = DateFormat('yyyy-MM-dd HH:mm:ss');
    final prevStr = current != null
        ? "${current.value} ${current.unit} (Device: ${current.measurementTimestamp != null ? timeFmt.format(current.measurementTimestamp!) : 'N/A'})"
        : "None";
    final incDevStr = incoming.measurementTimestamp != null ? timeFmt.format(incoming.measurementTimestamp!) : 'N/A';
    final incRecvStr = DateFormat('HH:mm:ss.SSS').format(incoming.receivedAt);

    final sessionId = _bleManager.activeHeartRateSessionId ?? "NONE";
    if (decision.shouldAccept) {
      _bleManager.logDiagnostic(
        "STATE",
        "ACCEPTED ${incoming.type.name.toUpperCase()}: ${incoming.value} ${incoming.unit} "
        "[Session: $sessionId, Device: $incDevStr, Recv: $incRecvStr, Source: ${incoming.source.name}] "
        "| Replaced: $prevStr | Reason: ${decision.reason} | UI New State: ${incoming.value} ${incoming.unit}",
      );

      setState(() {
        switch (incoming.type) {
          case MeasurementType.heartRate:
            _latestHeartRate = incoming;
            break;
          case MeasurementType.spo2:
            _latestSpo2 = incoming;
            break;
          case MeasurementType.hrv:
            _latestHrv = incoming;
            break;
          case MeasurementType.stress:
            _latestStress = incoming;
            break;
          case MeasurementType.temperature:
          case MeasurementType.skinTemperature:
            _latestTemperature = incoming;
            break;
          case MeasurementType.sleep:
            _latestSleep = incoming;
            break;
          case MeasurementType.battery:
            _latestBattery = incoming;
            break;
          case MeasurementType.bloodPressure:
            _latestBloodPressure = incoming;
            break;
        }
      });
    } else {
      _bleManager.logDiagnostic(
        "STATE",
        "REJECTED ${incoming.type.name.toUpperCase()}: ${incoming.value} ${incoming.unit} "
        "[Session: $sessionId, Device: $incDevStr, Recv: $incRecvStr, Source: ${incoming.source.name}] "
        "| Preserved: $prevStr | Reason: ${decision.reason} | UI Kept: $prevStr",
      );
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    if (state == AppLifecycleState.resumed) {
      _bleManager.handleAppResume();
      if (mounted) setState(() {});
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _bleManager.dispose();
    super.dispose();
  }

  Color _getStatusColor() {
    switch (_connectionState) {
      case GatewayConnectionState.connected:
        return Colors.green;
      case GatewayConnectionState.connecting:
      case GatewayConnectionState.discoveringServices:
      case GatewayConnectionState.subscribingNotifications:
        return Colors.amber;
      case GatewayConnectionState.scanning:
        return Colors.blue;
      case GatewayConnectionState.error:
        return Colors.red;
      case GatewayConnectionState.disconnected:
        return Colors.grey;
    }
  }

  String _getStatusText() {
    switch (_connectionState) {
      case GatewayConnectionState.connected:
        return "CONNECTED (0xFFF6/0xFFF7 READY)";
      case GatewayConnectionState.connecting:
        return "CONNECTING...";
      case GatewayConnectionState.discoveringServices:
        return "DISCOVERING GATT SERVICES...";
      case GatewayConnectionState.subscribingNotifications:
        return "SUBSCRIBING 0xFFF7 NOTIFICATIONS...";
      case GatewayConnectionState.scanning:
        return "SCANNING FOR MOMSAFE BAND...";
      case GatewayConnectionState.error:
        return _bleManager.lastErrorMessage ?? "ERROR (CHECK BLUETOOTH / PERMISSIONS)";
      case GatewayConnectionState.disconnected:
        return "DISCONNECTED";
    }
  }

  Future<void> _handleMeasurementRequest({
    required String name,
    required Future<ParsedReading?> Function() requestAction,
  }) async {
    if (_activeRequestName != null) return; // Prevent concurrent button requests

    setState(() {
      _activeRequestName = name;
      _measurementProgressText = "Requesting $name from band...";
      _lastErrorBanner = null;
      _lastInfoBanner = null;
    });

    try {
      final reading = await requestAction();
      if (reading != null && mounted) {
        _applyReading(reading);
      } else if (mounted) {
        final err = _bleManager.lastErrorMessage ?? "$name request timed out or failed.";
        setState(() => _lastErrorBanner = err);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(err),
            backgroundColor: Colors.red.shade800,
            duration: const Duration(seconds: 4),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        final err = "Request error: $e";
        setState(() => _lastErrorBanner = err);
      }
    } finally {
      if (mounted) {
        setState(() {
          _activeRequestName = null;
          _measurementProgressText = null;
        });
      }
    }
  }

  /// Genuine On-Demand Heart Rate (Phase 1): Starts 0x09 optical stream for 12 seconds
  Future<void> _handleMeasureHeartRateNow() async {
    if (_activeRequestName != null) return;

    setState(() {
      _activeRequestName = "Measure Heart Rate Now";
      _measurementProgressText = "Starting optical sensor (0x09)... Keep wrist still";
      _lastErrorBanner = null;
      _lastInfoBanner = null;
    });

    try {
      final reading = await _bleManager.measureHeartRateNow(
        duration: const Duration(seconds: 12),
        onProgress: (bpm, secsRemaining) {
          if (mounted) {
            setState(() {
              _measurementProgressText = bpm > 0
                  ? "Measuring Live HR: $bpm BPM ($secsRemaining s left)... Keep still"
                  : "Stabilizing optical sensor ($secsRemaining s left)... Keep still";
            });
          }
        },
      );

      if (reading != null && mounted) {
        _applyReading(reading);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text("Captured Live Heart Rate: ${reading.value} BPM (Live Optical Sensor)"),
            backgroundColor: Colors.teal.shade800,
            duration: const Duration(seconds: 4),
          ),
        );
      } else if (mounted) {
        if (!_bleManager.isConnected) {
          final disc = _bleManager.lastDisconnectRecord;
          setState(() {
            _lastErrorBanner = disc != null
                ? "Band disconnected: [${disc.code ?? 'OS'}] ${disc.description ?? 'Link loss'} at ${disc.stage}. Tap Reconnect."
                : (_bleManager.lastErrorMessage ?? "Band disconnected during heart-rate measurement. Tap Reconnect.");
          });
        } else {
          setState(() {
            _lastInfoBanner = "Could not detect a stable optical pulse. Make sure the band is snug on your wrist and retry.";
          });
        }
      }
    } catch (e) {
      if (mounted) setState(() => _lastErrorBanner = "Live HR measurement error: $e");
    } finally {
      if (mounted) {
        setState(() {
          _activeRequestName = null;
          _measurementProgressText = null;
        });
      }
    }
  }

  /// Genuine On-Demand SpO2 (Phase 2): Commands 0x28, monitors 30s test, queries 0x60, verifies freshness
  Future<void> _handleMeasureSpo2Now() async {
    if (_activeRequestName != null) return;

    final baselineTime = _latestSpo2?.measurementTimestamp;

    setState(() {
      _activeRequestName = "Measure SpO2 Now";
      _measurementProgressText = "Commanding band measurement (0x28)...";
      _lastErrorBanner = null;
      _lastInfoBanner = null;
    });

    try {
      final reading = await _bleManager.measureSpo2OnDemand(
        baselineTimestamp: baselineTime,
        measurementDuration: const Duration(seconds: 30),
        onProgress: (secsRemaining) {
          if (mounted) {
            setState(() {
              _measurementProgressText = "Measuring SpO₂ on band ($secsRemaining s left)... Please rest wrist flat and remain still";
            });
          }
        },
      );

      if (reading != null && mounted) {
        _applyReading(reading);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text("Fresh On-Demand SpO₂ recorded: ${reading.value}%"),
            backgroundColor: Colors.purple.shade800,
            duration: const Duration(seconds: 4),
          ),
        );
      } else if (mounted) {
        if (!_bleManager.isConnected) {
          final disc = _bleManager.lastDisconnectRecord;
          setState(() {
            _lastErrorBanner = disc != null
                ? "Band disconnected: [${disc.code ?? 'OS'}] ${disc.description ?? 'Link loss'} at ${disc.stage}. Tap Reconnect."
                : (_bleManager.lastErrorMessage ?? "Band disconnected during SpO2 measurement. Tap Reconnect.");
          });
        } else {
          final lastTimeStr = _latestSpo2?.measurementTimestamp != null
              ? DateFormat('HH:mm:ss').format(_latestSpo2!.measurementTimestamp!)
              : "earlier";
          final lastValStr = _latestSpo2 != null ? "${_latestSpo2!.value}%" : "--";
          setState(() {
            _lastInfoBanner = "No new SpO₂ reading received from band. Preserving last recorded measurement ($lastValStr, measured at $lastTimeStr). Make sure the band is snug and still.";
          });
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Text("No new SpO₂ reading received from band. Preserved last recorded value."),
              backgroundColor: Colors.orange.shade800,
              duration: const Duration(seconds: 4),
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) setState(() => _lastErrorBanner = "SpO₂ measurement error: $e");
    } finally {
      if (mounted) {
        setState(() {
          _activeRequestName = null;
          _measurementProgressText = null;
        });
      }
    }
  }

  /// Genuine On-Demand HRV (Phase 3): Commands 0x28 (type 1), monitors 30s test, queries 0x56, verifies freshness
  Future<void> _handleMeasureHrvNow() async {
    if (_activeRequestName != null) return;

    final baselineTime = _latestHrv?.measurementTimestamp;

    setState(() {
      _activeRequestName = "Measure HRV Now";
      _measurementProgressText = "Commanding band HRV measurement (0x28)...";
      _lastErrorBanner = null;
      _lastInfoBanner = null;
    });

    try {
      final reading = await _bleManager.measureHrvOnDemand(
        baselineTimestamp: baselineTime,
        measurementDuration: const Duration(seconds: 30),
        onProgress: (secsRemaining) {
          if (mounted) {
            setState(() {
              _measurementProgressText = "Measuring HRV on band ($secsRemaining s left)... Please rest wrist flat and remain still";
            });
          }
        },
      );

      if (reading != null && mounted) {
        _applyReading(reading);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text("Fresh On-Demand HRV recorded: ${reading.value} ms (SDNN)"),
            backgroundColor: Colors.teal.shade800,
            duration: const Duration(seconds: 4),
          ),
        );
      } else if (mounted) {
        if (!_bleManager.isConnected) {
          final disc = _bleManager.lastDisconnectRecord;
          setState(() {
            _lastErrorBanner = disc != null
                ? "Band disconnected: [${disc.code ?? 'OS'}] ${disc.description ?? 'Link loss'} at ${disc.stage}. Tap Reconnect."
                : (_bleManager.lastErrorMessage ?? "Band disconnected during HRV measurement. Tap Reconnect.");
          });
        } else {
          final lastTimeStr = _latestHrv?.measurementTimestamp != null
              ? DateFormat('HH:mm:ss').format(_latestHrv!.measurementTimestamp!)
              : "earlier";
          final lastValStr = _latestHrv != null ? "${_latestHrv!.value} ms" : "--";
          setState(() {
            _lastInfoBanner = "No new HRV reading received from band. Preserving last recorded measurement ($lastValStr, measured at $lastTimeStr). Make sure the band is snug and still.";
          });
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Text("No new HRV reading received from band. Preserved last recorded value."),
              backgroundColor: Colors.orange.shade800,
              duration: const Duration(seconds: 4),
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) setState(() => _lastErrorBanner = "HRV measurement error: $e");
    } finally {
      if (mounted) {
        setState(() {
          _activeRequestName = null;
          _measurementProgressText = null;
        });
      }
    }
  }

  /// Synchronize accumulated wearable vitals to MomSafe AI Cloud
  Future<void> _handleCloudSync() async {
    if (_isSyncingCloud) return;

    if (!_cloudSync.isAuthenticated) {
      _showCloudSignInDialog();
      return;
    }

    setState(() {
      _isSyncingCloud = true;
      _cloudSyncStatus = "Uploading readings to MomSafe AI Cloud...";
    });

    final allReadings = <ParsedReading>[
      if (_latestHeartRate != null) _latestHeartRate!,
      if (_latestSpo2 != null) _latestSpo2!,
      if (_latestHrv != null) _latestHrv!,
      if (_latestStress != null) _latestStress!,
      if (_latestTemperature != null) _latestTemperature!,
      if (_latestSleep != null) _latestSleep!,
      if (_latestBloodPressure != null) _latestBloodPressure!,
      ..._heartRateHistory,
      ..._spo2History,
      ..._hrvHistory,
      ..._stressHistory,
      ..._temperatureHistory,
      ..._sleepHistory,
      ..._bloodPressureHistory,
    ];

    final deviceId = _bleManager.connectedDevice?.remoteId.str ?? "MomSafe Band";
    final result = await _cloudSync.syncReadings(
      readings: allReadings,
      deviceId: deviceId,
    );

    setState(() {
      _isSyncingCloud = false;
      _cloudSyncStatus = result.message;
    });

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result.message),
          backgroundColor: result.success ? Colors.green.shade800 : Colors.red.shade800,
          duration: const Duration(seconds: 4),
        ),
      );
    }
  }

  void _showCloudSignInDialog() {
    final emailCtrl = TextEditingController(text: "studycom69@gmail.com");

    showDialog(
      context: context,
      builder: (ctx) {
        bool isLoading = false;
        String? errorMsg;

        return StatefulBuilder(
          builder: (ctx, setDlgState) {
            return AlertDialog(
              title: const Row(
                children: [
                  Icon(Icons.cloud_sync, color: Color(0xFFE11D48)),
                  SizedBox(width: 8),
                  Text("Connect MomSafe Account"),
                ],
              ),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    "Connect your MomSafe AI account using your Google login email to sync wearable vitals directly to your pregnancy dashboard.",
                    style: TextStyle(fontSize: 12, color: Colors.black54),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: emailCtrl,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(
                      labelText: "MomSafe Email (Google Account)",
                      hintText: "user@gmail.com",
                      prefixIcon: Icon(Icons.email, size: 18),
                      border: OutlineInputBorder(),
                      contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    "No password needed. Vitals sync directly to your authenticated profile.",
                    style: TextStyle(fontSize: 11, color: Colors.black38, fontStyle: FontStyle.italic),
                  ),
                  if (errorMsg != null) ...[
                    const SizedBox(height: 8),
                    Text(errorMsg!, style: const TextStyle(color: Colors.red, fontSize: 11)),
                  ],
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text("Cancel"),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFE11D48),
                    foregroundColor: Colors.white,
                  ),
                  onPressed: isLoading
                      ? null
                      : () async {
                          setDlgState(() {
                            isLoading = true;
                            errorMsg = null;
                          });
                          final session = await _cloudSync.connectWithEmail(
                            email: emailCtrl.text.trim(),
                          );
                          if (session != null) {
                            if (mounted) {
                              setState(() {
                                _cloudSyncStatus = "Connected as ${session.email}";
                              });
                            }
                            Navigator.pop(ctx);
                            _handleCloudSync();
                          } else {
                            setDlgState(() {
                              isLoading = false;
                              errorMsg = "Account not found for ${emailCtrl.text.trim()}. Make sure you have signed in to MomSafe AI web first.";
                            });
                          }
                        },
                  child: isLoading
                      ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Text("Connect & Sync"),
                ),
              ],
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('yyyy-MM-dd HH:mm:ss');
    final timeFormat = DateFormat('HH:mm:ss');
    final isBusy = _activeRequestName != null;

    return Scaffold(
      appBar: AppBar(
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text("MomSafe Gateway", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
            Text("MomSafe Band Telemetry Pipeline", style: TextStyle(fontSize: 12, color: Colors.black54)),
          ],
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16.0),
            child: Chip(
              avatar: CircleAvatar(backgroundColor: _getStatusColor(), radius: 6),
              label: Text(
                _connectionState == GatewayConnectionState.connected ? "Online" : "Offline",
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
              ),
            ),
          )
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Status Banner
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: _getStatusColor().withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: _getStatusColor().withValues(alpha: 0.4)),
              ),
              child: Row(
                children: [
                  Icon(Icons.bluetooth_searching, color: _getStatusColor()),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      _getStatusText(),
                      style: TextStyle(fontWeight: FontWeight.bold, color: _getStatusColor(), fontSize: 13),
                    ),
                  ),
                ],
              ),
            ),
            if (_lastErrorBanner != null) ...[
              const SizedBox(height: 8),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.red.shade300),
                ),
                child: Row(
                  children: [
                    Icon(Icons.warning_amber_rounded, color: Colors.red.shade800, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _lastErrorBanner!,
                        style: TextStyle(fontSize: 12, color: Colors.red.shade900),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, size: 16),
                      onPressed: () => setState(() => _lastErrorBanner = null),
                    ),
                  ],
                ),
              ),
            ],
            if (_connectionState == GatewayConnectionState.error) ...[
              Container(
                margin: const EdgeInsets.only(top: 8),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.red.shade200),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(Icons.error_outline, color: Colors.red.shade700, size: 18),
                        const SizedBox(width: 8),
                        Text(
                          "Permission / Adapter Diagnostics",
                          style: TextStyle(fontWeight: FontWeight.bold, color: Colors.red.shade900, fontSize: 13),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      _bleManager.lastErrorMessage ?? "Bluetooth scanning halted. Verify Nearby Devices permissions and Bluetooth state.",
                      style: TextStyle(fontSize: 12, color: Colors.red.shade900),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        OutlinedButton.icon(
                          style: OutlinedButton.styleFrom(
                            foregroundColor: Colors.red.shade900,
                            side: BorderSide(color: Colors.red.shade300),
                            visualDensity: VisualDensity.compact,
                          ),
                          icon: const Icon(Icons.settings, size: 16),
                          label: const Text("App Settings", style: TextStyle(fontSize: 12)),
                          onPressed: () => openAppSettings(),
                        ),
                        const SizedBox(width: 8),
                        ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.red.shade600,
                            foregroundColor: Colors.white,
                            visualDensity: VisualDensity.compact,
                          ),
                          icon: const Icon(Icons.refresh, size: 16),
                          label: const Text("Retry Permissions", style: TextStyle(fontSize: 12)),
                          onPressed: () async {
                            final granted = await _bleManager.checkAndRequestPermissions();
                            if (granted) {
                              _bleManager.startScan();
                            }
                          },
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 16),

            // Scan / Disconnect Controls
            Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    icon: _connectionState == GatewayConnectionState.scanning
                        ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.search),
                    label: Text(_connectionState == GatewayConnectionState.scanning ? "Scanning..." : "Scan for MomSafe Band"),
                    onPressed: _connectionState == GatewayConnectionState.scanning
                        ? _bleManager.stopScan
                        : _bleManager.startScan,
                  ),
                ),
                if (_connectionState == GatewayConnectionState.connected) ...[
                  const SizedBox(width: 10),
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(backgroundColor: Colors.red.shade50, foregroundColor: Colors.red),
                    icon: const Icon(Icons.bluetooth_disabled),
                    label: const Text("Disconnect"),
                    onPressed: _bleManager.disconnect,
                  ),
                ] else if (_bleManager.canReconnect) ...[
                  const SizedBox(width: 10),
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(backgroundColor: Colors.teal.shade50, foregroundColor: Colors.teal.shade900),
                    icon: const Icon(Icons.refresh),
                    label: const Text("Reconnect"),
                    onPressed: _bleManager.reconnect,
                  ),
                ],
              ],
            ),
            const SizedBox(height: 16),

            // Discovered Peripherals List (if not connected)
            if (_connectionState != GatewayConnectionState.connected) ...[
              const Text("Discovered Peripherals", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
              const SizedBox(height: 8),
              if (_devices.isEmpty)
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade100,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Center(
                    child: Text("No devices found. Tap 'Scan for MomSafe Band' with the band nearby.",
                        style: TextStyle(color: Colors.black54, fontSize: 13)),
                  ),
                )
              else
                ListView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: _devices.length,
                  itemBuilder: (context, i) {
                    final d = _devices[i];
                    final isMomSafeBand = d.name.toLowerCase().contains("2208") || d.name.toLowerCase().contains("jstyle");
                    return Card(
                      elevation: 1,
                      margin: const EdgeInsets.symmetric(vertical: 4),
                      color: isMomSafeBand ? const Color(0xFFFFF1F2) : Colors.white,
                      child: ListTile(
                        leading: Icon(Icons.watch, color: isMomSafeBand ? const Color(0xFFE11D48) : Colors.grey),
                        title: Text(d.name, style: TextStyle(fontWeight: isMomSafeBand ? FontWeight.bold : FontWeight.normal)),
                        subtitle: Text("${d.id} • RSSI: ${d.rssi} dBm"),
                        trailing: ElevatedButton(
                          onPressed: () => _bleManager.connect(d.device),
                          child: const Text("Connect"),
                        ),
                      ),
                    );
                  },
                ),
              const SizedBox(height: 16),
            ],

            // Measurements Card (When Connected)
            if (_connectionState == GatewayConnectionState.connected) ...[
              Card(
                elevation: 2,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text("Measurement Triggers", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: Colors.green.shade100,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: const Text(
                              "SERIALIZED GATT QUEUE",
                              style: TextStyle(color: Colors.green, fontWeight: FontWeight.bold, fontSize: 10),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      // Section 1: Genuine On-Demand Measurement
                      const Row(
                        children: [
                          Icon(Icons.bolt, color: Color(0xFFE11D48), size: 18),
                          SizedBox(width: 6),
                          Text("Measure Now (Active Sensors)", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                        ],
                      ),
                      const SizedBox(height: 2),
                      const Text(
                        "Activates band sensors right now. Heart rate streams live via 0x09; SpO₂ tests on-wrist via 0x28.",
                        style: TextStyle(fontSize: 11, color: Colors.black54),
                      ),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFE11D48),
                              foregroundColor: Colors.white,
                            ),
                            icon: _activeRequestName == "Measure Heart Rate Now"
                                ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                : const Icon(Icons.favorite, color: Colors.white, size: 18),
                            label: Text(_activeRequestName == "Measure Heart Rate Now" ? "Measuring..." : "Measure Heart Rate Now (0x09)"),
                            onPressed: isBusy ? null : _handleMeasureHeartRateNow,
                          ),
                          ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.indigo,
                              foregroundColor: Colors.white,
                            ),
                            icon: _activeRequestName == "Measure SpO2 Now"
                                ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                : const Icon(Icons.water_drop, color: Colors.white, size: 18),
                            label: Text(_activeRequestName == "Measure SpO2 Now" ? "Measuring..." : "Measure SpO₂ Now (0x28)"),
                            onPressed: isBusy ? null : _handleMeasureSpo2Now,
                          ),
                          ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.teal.shade700,
                              foregroundColor: Colors.white,
                            ),
                            icon: _activeRequestName == "Measure HRV Now"
                                ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                : const Icon(Icons.graphic_eq, color: Colors.white, size: 18),
                            label: Text(_activeRequestName == "Measure HRV Now" ? "Measuring..." : "Measure HRV Now (0x28)"),
                            onPressed: isBusy ? null : _handleMeasureHrvNow,
                          ),
                        ],
                      ),

                      const SizedBox(height: 16),
                      // Section 2: Sync Stored Band Records
                      const Row(
                        children: [
                          Icon(Icons.history, color: Colors.blueGrey, size: 18),
                          SizedBox(width: 6),
                          Text("Sync Stored Records (Flash Logs)", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                        ],
                      ),
                      const SizedBox(height: 2),
                      const Text(
                        "Reads background auto-interval records previously stored in the band's flash memory.",
                        style: TextStyle(fontSize: 11, color: Colors.black54),
                      ),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          OutlinedButton.icon(
                            icon: _activeRequestName == "Sync Heart Rate"
                                ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                                : const Icon(Icons.sync, color: Colors.red, size: 18),
                            label: Text(_activeRequestName == "Sync Heart Rate" ? "Syncing..." : "Sync Stored HR (0x55)"),
                            onPressed: isBusy
                                ? null
                                : () => _handleMeasurementRequest(
                                      name: "Sync Heart Rate",
                                      requestAction: _bleManager.requestSpotHeartRate,
                                    ),
                          ),
                          OutlinedButton.icon(
                            icon: _activeRequestName == "Sync SpO2"
                                ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                                : const Icon(Icons.sync, color: Colors.blue, size: 18),
                            label: Text(_activeRequestName == "Sync SpO2" ? "Syncing..." : "Sync Stored SpO₂ (0x60)"),
                            onPressed: isBusy
                                ? null
                                : () => _handleMeasurementRequest(
                                      name: "Sync SpO2",
                                      requestAction: _bleManager.requestSpotSpo2,
                                    ),
                          ),
                          OutlinedButton.icon(
                            icon: _activeRequestName == "Sync HRV"
                                ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                                : const Icon(Icons.sync, color: Colors.teal, size: 18),
                            label: Text(_activeRequestName == "Sync HRV" ? "Syncing..." : "Sync Stored HRV (0x56)"),
                            onPressed: isBusy
                                ? null
                                : () => _handleMeasurementRequest(
                                      name: "Sync HRV",
                                      requestAction: _bleManager.requestSpotHrv,
                                    ),
                          ),
                          OutlinedButton.icon(
                            icon: _activeRequestName == "Sync Temperature"
                                ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                                : const Icon(Icons.thermostat, color: Colors.deepOrange, size: 18),
                            label: Text(_activeRequestName == "Sync Temperature" ? "Syncing..." : "Sync Temp (0x65/0x62)"),
                            onPressed: isBusy
                                ? null
                                : () => _handleMeasurementRequest(
                                      name: "Sync Temperature",
                                      requestAction: _bleManager.requestSpotTemperature,
                                    ),
                          ),
                          OutlinedButton.icon(
                            icon: _activeRequestName == "Sync Sleep"
                                ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                                : const Icon(Icons.bedtime, color: Colors.purple, size: 18),
                            label: Text(_activeRequestName == "Sync Sleep" ? "Syncing..." : "Sync Sleep (0x53)"),
                            onPressed: isBusy
                                ? null
                                : () => _handleMeasurementRequest(
                                      name: "Sync Sleep",
                                      requestAction: _bleManager.requestSleepHistory,
                                    ),
                          ),
                          OutlinedButton.icon(
                            icon: _activeRequestName == "Battery"
                                ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2))
                                : const Icon(Icons.battery_charging_full, color: Colors.orange, size: 18),
                            label: Text(_activeRequestName == "Battery" ? "Querying..." : "Battery (0x13)"),
                            onPressed: isBusy
                                ? null
                                : () => _handleMeasurementRequest(
                                      name: "Battery",
                                      requestAction: _bleManager.requestBatteryLevel,
                                    ),
                          ),
                        ],
                      ),

                      // In-Flight Progress Banner
                      if (isBusy) ...[
                        const SizedBox(height: 14),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          decoration: BoxDecoration(
                            color: Colors.blue.shade50,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: Colors.blue.shade200),
                          ),
                          child: Row(
                            children: [
                              const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2.5)),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                  _measurementProgressText ?? "Communicating with band...",
                                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.blue.shade900),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],

                      // Stale / Informational Banner
                      if (_lastInfoBanner != null && !isBusy) ...[
                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          decoration: BoxDecoration(
                            color: Colors.amber.shade50,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: Colors.amber.shade300),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Icon(Icons.info_outline, color: Colors.amber.shade900, size: 18),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  _lastInfoBanner!,
                                  style: TextStyle(fontSize: 12, color: Colors.amber.shade900),
                                ),
                              ),
                              IconButton(
                                icon: const Icon(Icons.close, size: 16),
                                visualDensity: VisualDensity.compact,
                                padding: EdgeInsets.zero,
                                onPressed: () => setState(() => _lastInfoBanner = null),
                              ),
                            ],
                          ),
                        ),
                      ],
                      const Divider(height: 24),
                      
                      // Parsed Metrics Display
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text("Decoded Readings (Validated via Protocol CRC):",
                              style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.black87)),
                          Text(
                            "History: ${_heartRateHistory.length} HR, ${_spo2History.length} SpO₂, ${_hrvHistory.length} HRV, ${_stressHistory.length} Stress, ${_temperatureHistory.length} Temp, ${_sleepHistory.length} Sleep",
                            style: const TextStyle(fontSize: 10, color: Colors.black45),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      // Metric Row 1: Heart Rate & SpO2
                      Row(
                        children: [
                          Expanded(
                            child: _buildMetricTile(
                              title: "Heart Rate",
                              reading: _latestHeartRate,
                              fallbackUnit: "BPM",
                              icon: Icons.favorite,
                              iconColor: Colors.red,
                              dateFormat: dateFormat,
                              timeFormat: timeFormat,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: _buildMetricTile(
                              title: "SpO₂ Saturation",
                              reading: _latestSpo2,
                              fallbackUnit: "%",
                              icon: Icons.water_drop,
                              iconColor: Colors.blue,
                              dateFormat: dateFormat,
                              timeFormat: timeFormat,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      // Metric Row 2: HRV & Stress
                      Row(
                        children: [
                          Expanded(
                            child: _buildMetricTile(
                              title: "HRV (SDNN)",
                              reading: _latestHrv,
                              fallbackUnit: "ms",
                              icon: Icons.graphic_eq,
                              iconColor: Colors.teal,
                              dateFormat: dateFormat,
                              timeFormat: timeFormat,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: _buildMetricTile(
                              title: "Stress Index",
                              reading: _latestStress,
                              fallbackUnit: "/100",
                              icon: Icons.psychology,
                              iconColor: Colors.deepPurple,
                              dateFormat: dateFormat,
                              timeFormat: timeFormat,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      // Metric Row 3: Skin Temperature & Sleep
                      Row(
                        children: [
                          Expanded(
                            child: _buildMetricTile(
                              title: "Skin Temp (Surface)",
                              reading: _latestTemperature,
                              fallbackUnit: "°C",
                              icon: Icons.thermostat,
                              iconColor: Colors.deepOrange,
                              dateFormat: dateFormat,
                              timeFormat: timeFormat,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: _buildMetricTile(
                              title: "Sleep Duration",
                              reading: _latestSleep,
                              fallbackUnit: "hrs",
                              icon: Icons.bedtime,
                              iconColor: Colors.purple,
                              dateFormat: dateFormat,
                              timeFormat: timeFormat,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      // Metric Row 4: Battery & Blood Pressure Limitation
                      Row(
                        children: [
                          Expanded(
                            child: _buildMetricTile(
                              title: "Band Battery Level",
                              reading: _latestBattery,
                              fallbackUnit: "%",
                              icon: Icons.battery_full,
                              iconColor: Colors.orange,
                              dateFormat: dateFormat,
                              timeFormat: timeFormat,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: _buildMetricTile(
                              title: "Estimated BP",
                              reading: _latestBloodPressure,
                              fallbackUnit: "mmHg",
                              icon: Icons.speed,
                              iconColor: Colors.deepPurple,
                              dateFormat: dateFormat,
                              timeFormat: timeFormat,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // MomSafe AI Cloud Sync Card
              Card(
                elevation: 2,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Row(
                            children: [
                              Icon(Icons.cloud_upload, color: Color(0xFFE11D48), size: 20),
                              SizedBox(width: 8),
                              Text("MomSafe AI Cloud Sync", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                            ],
                          ),
                          Chip(
                            avatar: CircleAvatar(
                              backgroundColor: _cloudSync.isAuthenticated ? Colors.green : Colors.grey,
                              radius: 5,
                            ),
                            label: Text(
                              _cloudSync.isAuthenticated ? "Connected" : "Offline",
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        _cloudSync.isAuthenticated
                            ? "Connected to: ${_cloudSync.currentSession?.email}"
                            : "Connect your MomSafe AI account (Google email) to sync wearable vitals directly to your maternal dashboard.",
                        style: const TextStyle(fontSize: 12, color: Colors.black54),
                      ),
                      if (_cloudSyncStatus != null) ...[
                        const SizedBox(height: 6),
                        Text(_cloudSyncStatus!, style: TextStyle(fontSize: 11, color: Colors.green.shade800, fontWeight: FontWeight.bold)),
                      ],
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFE11D48),
                              foregroundColor: Colors.white,
                            ),
                            icon: _isSyncingCloud
                                ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                : const Icon(Icons.sync, color: Colors.white, size: 18),
                            label: Text(_isSyncingCloud ? "Syncing to Cloud..." : "Sync Vitals to Web App"),
                            onPressed: _isSyncingCloud ? null : _handleCloudSync,
                          ),
                          const SizedBox(width: 10),
                          if (!_cloudSync.isAuthenticated)
                            OutlinedButton.icon(
                              icon: const Icon(Icons.login, size: 16),
                              label: const Text("Connect Account"),
                              onPressed: _showCloudSignInDialog,
                            )
                          else
                            TextButton(
                              onPressed: () {
                                setState(() {
                                  _cloudSync.signOut();
                                  _cloudSyncStatus = null;
                                });
                              },
                              child: const Text("Disconnect", style: TextStyle(fontSize: 12, color: Colors.black45)),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
            ],

            // Raw Diagnostics Console
            Card(
              elevation: 1,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              color: Colors.grey.shade900,
              child: Padding(
                padding: const EdgeInsets.all(12.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text("Protocol Diagnostic Terminal (0xFFF6 / 0xFFF7)",
                            style: TextStyle(color: Colors.white70, fontWeight: FontWeight.bold, fontSize: 13)),
                        Text("${_logs.length} events",
                            style: const TextStyle(color: Colors.white38, fontSize: 11)),
                      ],
                    ),
                    const Divider(color: Colors.white24),
                    SizedBox(
                      height: 180,
                      child: _logs.isEmpty
                          ? const Center(
                              child: Text("No protocol packets exchanged yet.",
                                  style: TextStyle(color: Colors.white38, fontSize: 12)),
                            )
                          : ListView.builder(
                              itemCount: _logs.length,
                              itemBuilder: (context, i) {
                                final l = _logs[i];
                                final timeStr = DateFormat('HH:mm:ss.SSS').format(l.timestamp);
                                final isTx = l.direction.startsWith("TX");
                                final isRx = l.direction.startsWith("RX");
                                final isParsed = l.direction == "PARSED";
                                final isState = l.direction == "STATE";
                                final isError = l.direction == "ERROR" || l.direction == "TIMEOUT";
                                
                                final color = isError
                                    ? Colors.redAccent
                                    : isState
                                        ? Colors.orangeAccent
                                        : isParsed
                                            ? Colors.amberAccent
                                            : isTx
                                                ? Colors.cyanAccent
                                                : isRx
                                                    ? Colors.greenAccent
                                                    : Colors.white70;

                                return Padding(
                                  padding: const EdgeInsets.symmetric(vertical: 2.0),
                                  child: Text(
                                    "[$timeStr] ${l.direction}: ${l.message} ${l.hexString}",
                                    style: TextStyle(color: color, fontSize: 11, fontFamily: 'monospace'),
                                  ),
                                );
                              },
                            ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMetricTile({
    required String title,
    required ParsedReading? reading,
    required String fallbackUnit,
    required IconData icon,
    required Color iconColor,
    required DateFormat dateFormat,
    required DateFormat timeFormat,
  }) {
    final hasData = reading != null;
    final valueStr = hasData
        ? (reading.type == MeasurementType.bloodPressure && reading.secondaryValue != null
            ? "${reading.value.toInt()}/${reading.secondaryValue!.toInt()}"
            : (reading.type == MeasurementType.heartRate ||
                    reading.type == MeasurementType.spo2 ||
                    reading.type == MeasurementType.hrv ||
                    reading.type == MeasurementType.stress ||
                    reading.type == MeasurementType.battery)
                ? "${reading.value.toInt()}"
                : "${reading.value}")
        : "--";
    final unitStr = hasData ? reading.unit : fallbackUnit;

    // Maternal baseline temperature calculation
    final isTemperature = reading != null &&
        (reading.type == MeasurementType.temperature || reading.type == MeasurementType.skinTemperature);
    String? tempBaselineNote;
    Color tempBaselineColor = Colors.teal;
    if (isTemperature) {
      const double baseline = 36.5;
      final diff = (reading.value - baseline);
      final diffSign = diff > 0 ? "+" : "";
      if (diff.abs() < 0.05) {
        tempBaselineNote = "At baseline (36.5°C)";
        tempBaselineColor = Colors.teal;
      } else {
        tempBaselineNote = "$diffSign${diff.toStringAsFixed(1)}°C ${diff > 0 ? 'above' : 'below'} baseline (36.5°C)";
        tempBaselineColor = diff > 0.8
            ? Colors.red.shade700
            : diff > 0.3
                ? Colors.orange.shade800
                : Colors.teal.shade800;
      }
    }

    // Freshness calculation
    String freshnessLabel = "";
    Color freshnessColor = Colors.grey;
    if (hasData) {
      if (reading.source == ReadingSource.liveSensor) {
        freshnessLabel = "LIVE SENSOR";
        freshnessColor = Colors.teal;
      } else if (reading.source == ReadingSource.onDemandMeasurement) {
        freshnessLabel = "ON-DEMAND";
        freshnessColor = Colors.purple;
      } else if (reading.measurementTimestamp != null) {
        final age = DateTime.now().difference(reading.measurementTimestamp!);
        if (age.inMinutes <= 15 && age.inMinutes >= 0) {
          freshnessLabel = "FRESH";
          freshnessColor = Colors.green;
        } else if (reading.measurementTimestamp!.day == DateTime.now().day &&
            reading.measurementTimestamp!.month == DateTime.now().month &&
            reading.measurementTimestamp!.year == DateTime.now().year) {
          freshnessLabel = "TODAY";
          freshnessColor = Colors.blue;
        } else {
          freshnessLabel = "ARCHIVED";
          freshnessColor = Colors.orange;
        }
      } else {
        freshnessLabel = "LIVE STATUS";
        freshnessColor = Colors.teal;
      }
    }

    String sourceLabel = "";
    if (hasData) {
      switch (reading.source) {
        case ReadingSource.historicalSync:
          sourceLabel = "Stored Flash Log (0x55/0x60)";
          break;
        case ReadingSource.liveSensor:
          sourceLabel = "Live Optical Stream (0x09)";
          break;
        case ReadingSource.onDemandMeasurement:
          sourceLabel = "Verified On-Demand Test (0x28)";
          break;
        case ReadingSource.deviceReported:
          sourceLabel = "Hardware Telemetry (0x13)";
          break;
        case ReadingSource.cached:
          sourceLabel = "App Memory Cache";
          break;
      }
    }

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Icon(icon, size: 16, color: iconColor),
                  const SizedBox(width: 6),
                  Text(title, style: const TextStyle(fontSize: 12, color: Colors.black54)),
                ],
              ),
              if (hasData)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                  decoration: BoxDecoration(
                    color: freshnessColor.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    freshnessLabel,
                    style: TextStyle(color: freshnessColor, fontWeight: FontWeight.bold, fontSize: 9),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(valueStr, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
              const SizedBox(width: 4),
              Text(unitStr, style: const TextStyle(fontSize: 12, color: Colors.black54)),
            ],
          ),
          if (tempBaselineNote != null) ...[
            const SizedBox(height: 3),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
              decoration: BoxDecoration(
                color: tempBaselineColor.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                tempBaselineNote,
                style: TextStyle(fontSize: 9.5, color: tempBaselineColor, fontWeight: FontWeight.bold),
              ),
            ),
          ],
          if (reading?.type == MeasurementType.bloodPressure && hasData) ...[
            const SizedBox(height: 3),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
              decoration: BoxDecoration(
                color: Colors.deepPurple.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(4),
              ),
              child: const Text(
                "Estimated (Pulse Wave / MomSafe Band)",
                style: TextStyle(fontSize: 8.5, color: Colors.deepPurple, fontWeight: FontWeight.bold),
              ),
            ),
          ],
          const SizedBox(height: 4),
          if (hasData) ...[
            Text(
              reading.measurementTimestamp != null
                  ? "Device: ${dateFormat.format(reading.measurementTimestamp!)}"
                  : "Device Time: Real-time sensor query",
              style: const TextStyle(fontSize: 10, color: Colors.black87, fontWeight: FontWeight.w500),
            ),
            const SizedBox(height: 1),
            Text(
              "Received: ${timeFormat.format(reading.receivedAt)} • $sourceLabel",
              style: const TextStyle(fontSize: 9, color: Colors.black45),
            ),
            if (reading.decodeNotes != null) ...[
              const SizedBox(height: 2),
              Text(
                reading.decodeNotes!,
                style: TextStyle(fontSize: 8.5, color: Colors.blueGrey.shade700, fontStyle: FontStyle.italic),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ] else ...[
            const Text(
              "No reading received yet",
              style: TextStyle(fontSize: 10, color: Colors.black45),
            ),
          ],
        ],
      ),
    );
  }
}
