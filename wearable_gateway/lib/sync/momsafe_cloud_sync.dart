import 'dart:convert';
import 'dart:io';
import '../protocol/jstyle_constants.dart';
import '../protocol/jstyle_decoder.dart';

/// Authentication state and session details for MomSafe AI Cloud
class MomSafeAuthSession {
  final String userId;
  final String email;
  final String accessToken;
  final String? refreshToken;
  final DateTime expiresAt;

  const MomSafeAuthSession({
    required this.userId,
    required this.email,
    required this.accessToken,
    this.refreshToken,
    required this.expiresAt,
  });

  bool get isExpired => DateTime.now().isAfter(expiresAt);
}

/// Result of a synchronization operation
class SyncResult {
  final bool success;
  final int recordsUploaded;
  final int recordsDeduplicated;
  final String message;
  final DateTime syncTime;

  const SyncResult({
    required this.success,
    required this.recordsUploaded,
    required this.recordsDeduplicated,
    required this.message,
    required this.syncTime,
  });
}

/// Cloud Sync Integration between J-Style 2208A Flutter Gateway and MomSafe AI Supabase
class MomSafeCloudSync {
  static const String supabaseUrl = "https://frupdhslwhwyxclhcqve.supabase.co";
  static const String supabaseAnonKey =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZydXBkaHNsd2h3eXhjbGhjcXZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNTM5MTEsImV4cCI6MjA4NzkyOTkxMX0.FsKYWrxlXQCzomx3da12fJFF0LzBp2OERaRq6mKqV1A";

  final HttpClient _client = HttpClient();
  MomSafeAuthSession? _session;

  MomSafeAuthSession? get currentSession => _session;
  bool get isAuthenticated => _session != null && !_session!.isExpired;

  /// Connect passwordlessly using MomSafe user account email (Google OAuth account)
  Future<MomSafeAuthSession?> connectWithEmail({required String email}) async {
    final cleanEmail = email.trim().toLowerCase();
    if (cleanEmail.isEmpty || !cleanEmail.contains('@')) return null;

    try {
      final uri = Uri.parse("$supabaseUrl/rest/v1/rpc/lookup_wearable_user_by_email");
      final request = await _client.postUrl(uri);
      request.headers.set("apikey", supabaseAnonKey);
      request.headers.set("Authorization", "Bearer $supabaseAnonKey");
      request.headers.set("Content-Type", "application/json");

      final body = jsonEncode({
        "p_email": cleanEmail,
      });
      request.write(body);

      final response = await request.close();
      final responseBody = await response.transform(utf8.decoder).join();

      if (response.statusCode == 200) {
        final decoded = jsonDecode(responseBody);
        final String? userId = decoded is String ? decoded : (decoded != null ? decoded.toString() : null);
        if (userId != null && userId.isNotEmpty && userId != "null") {
          _session = MomSafeAuthSession(
            userId: userId,
            email: cleanEmail,
            accessToken: supabaseAnonKey,
            refreshToken: null,
            expiresAt: DateTime.now().add(const Duration(days: 365)),
          );
          return _session;
        }
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  /// Sign in with MomSafe email and password
  Future<MomSafeAuthSession?> signIn({
    required String email,
    required String password,
  }) async {
    try {
      final uri = Uri.parse("$supabaseUrl/auth/v1/token?grant_type=password");
      final request = await _client.postUrl(uri);
      request.headers.set("apikey", supabaseAnonKey);
      request.headers.set("Content-Type", "application/json");

      final body = jsonEncode({
        "email": email.trim(),
        "password": password,
      });
      request.write(body);

      final response = await request.close();
      final responseBody = await response.transform(utf8.decoder).join();

      if (response.statusCode == 200) {
        final data = jsonDecode(responseBody) as Map<String, dynamic>;
        final user = data["user"] as Map<String, dynamic>;
        final expiresIn = data["expires_in"] as int? ?? 3600;
        
        _session = MomSafeAuthSession(
          userId: user["id"] as String,
          email: user["email"] as String? ?? email,
          accessToken: data["access_token"] as String,
          refreshToken: data["refresh_token"] as String?,
          expiresAt: DateTime.now().add(Duration(seconds: expiresIn)),
        );
        return _session;
      } else {
        return null;
      }
    } catch (_) {
      return null;
    }
  }

  /// Manually attach an authenticated session
  void setSession(MomSafeAuthSession session) {
    _session = session;
  }

  /// Sign out
  void signOut() {
    _session = null;
  }

  /// Builds a deterministic, stable deduplication record ID for a wearable reading
  static String buildRecordId({
    required String deviceId,
    required MeasurementType type,
    required DateTime timestamp,
  }) {
    final sanitizedId = deviceId.replaceAll(":", "").replaceAll(" ", "_");
    final epochSec = timestamp.millisecondsSinceEpoch ~/ 1000;
    return "2208A_${sanitizedId}_${type.name}_$epochSec";
  }

  /// Synchronizes a list of wearable readings to Supabase
  /// Respects user-scoped RLS and prevents duplicate rows via `device_record_id`.
  Future<SyncResult> syncReadings({
    required List<ParsedReading> readings,
    required String deviceId,
  }) async {
    if (!isAuthenticated) {
      return SyncResult(
        success: false,
        recordsUploaded: 0,
        recordsDeduplicated: 0,
        message: "Not authenticated. Sign in with your MomSafe account first.",
        syncTime: DateTime.now(),
      );
    }

    final token = _session!.accessToken;
    final userId = _session!.userId;

    // Filter out live continuous 1 Hz streams and pure command ACKs to avoid database flooding
    final uploadable = readings.where((r) {
      if (r.unit == "ACK" || r.value == 0) return false;
      // Upload genuine onDemand measurements, flash logs, and device reports
      return r.source == ReadingSource.onDemandMeasurement ||
          r.source == ReadingSource.historicalSync ||
          r.source == ReadingSource.deviceReported;
    }).toList();

    if (uploadable.isEmpty) {
      return SyncResult(
        success: true,
        recordsUploaded: 0,
        recordsDeduplicated: 0,
        message: "No finalized measurements to sync (streaming ticks are filtered).",
        syncTime: DateTime.now(),
      );
    }

    int vitalsUploaded = 0;
    int sleepUploaded = 0;

    try {
      // 1. Separate sleep records from vitals records
      final sleepReadings = uploadable.where((r) => r.type == MeasurementType.sleep).toList();
      final vitalsReadings = uploadable.where((r) => r.type != MeasurementType.sleep && r.type != MeasurementType.battery).toList();

      // 2. Prepare vitals payloads
      final vitalsPayload = vitalsReadings.map((r) {
        final timestamp = r.measurementTimestamp ?? r.receivedAt;
        final recordId = buildRecordId(
          deviceId: deviceId,
          type: r.type,
          timestamp: timestamp,
        );

        final map = <String, dynamic>{
          "source": "wearable",
          "device_id": deviceId,
          "firmware_version": "2208A_v1.0",
          "device_record_id": recordId,
          "recorded_at": timestamp.toUtc().toIso8601String(),
        };

        if (r.type == MeasurementType.heartRate) {
          map["heart_rate"] = r.value.toInt();
        } else if (r.type == MeasurementType.spo2) {
          map["spo2"] = r.value.toInt();
        } else if (r.type == MeasurementType.hrv) {
          map["hrv"] = r.value.toInt();
        } else if (r.type == MeasurementType.stress) {
          map["stress"] = r.value.toInt();
        } else if (r.type == MeasurementType.bloodPressure) {
          map["systolic_bp"] = r.value.toInt();
          map["diastolic_bp"] = (r.secondaryValue ?? 80).toInt();
        } else if (r.type == MeasurementType.temperature || r.type == MeasurementType.skinTemperature) {
          map["skin_temperature"] = r.value;
          map["temperature"] = r.value;
        }
        return map;
      }).toList();

      // 3. Prepare sleep payloads
      final sleepPayload = sleepReadings.map((r) {
        final timestamp = r.measurementTimestamp ?? r.receivedAt;
        final recordId = buildRecordId(
          deviceId: deviceId,
          type: MeasurementType.sleep,
          timestamp: timestamp,
        );

        return <String, dynamic>{
          "source": "wearable",
          "device_id": deviceId,
          "device_record_id": recordId,
          "sleep_hours": r.value,
          "sleep_quality": (r.value >= 7) ? "good" : "average",
          "recorded_at": timestamp.toUtc().toIso8601String(),
        };
      }).toList();

      // 4. Send atomic sync RPC request
      final uri = Uri.parse("$supabaseUrl/rest/v1/rpc/sync_wearable_records");
      final request = await _client.postUrl(uri);
      request.headers.set("apikey", supabaseAnonKey);
      request.headers.set("Authorization", "Bearer $token");
      request.headers.set("Content-Type", "application/json");

      final rpcBody = jsonEncode({
        "p_user_id": userId,
        "p_vitals": vitalsPayload,
        "p_sleep": sleepPayload,
      });

      request.write(rpcBody);
      final response = await request.close();
      final responseBody = await response.transform(utf8.decoder).join();

      if (response.statusCode == 200) {
        final resData = jsonDecode(responseBody) as Map<String, dynamic>? ?? {};
        final vCount = resData["vitals_uploaded"] as int? ?? vitalsPayload.length;
        final sCount = resData["sleep_uploaded"] as int? ?? sleepPayload.length;
        final total = vCount + sCount;
        return SyncResult(
          success: true,
          recordsUploaded: total,
          recordsDeduplicated: 0,
          message: "Successfully synchronized $total health records to MomSafe AI cloud.",
          syncTime: DateTime.now(),
        );
      } else {
        return SyncResult(
          success: false,
          recordsUploaded: 0,
          recordsDeduplicated: 0,
          message: "Supabase sync error (${response.statusCode}): $responseBody",
          syncTime: DateTime.now(),
        );
      }
    } catch (e) {
      return SyncResult(
        success: false,
        recordsUploaded: 0,
        recordsDeduplicated: 0,
        message: "Sync network error: $e",
        syncTime: DateTime.now(),
      );
    }
  }

  void dispose() {
    _client.close(force: true);
  }
}
