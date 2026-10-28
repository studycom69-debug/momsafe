import 'jstyle_constants.dart';
import 'jstyle_decoder.dart';

/// Decision result for evaluating incoming telemetry against currently displayed state
class StateUpdateDecision {
  final bool shouldAccept;
  final String reason;

  const StateUpdateDecision({
    required this.shouldAccept,
    required this.reason,
  });
}

/// Central state selection and evaluation engine.
/// Enforces chronological ordering, source precedence, and deduplication
/// so older historical records arriving late never overwrite newer measurements.
class TelemetryStateResolver {
  /// Evaluates whether [incoming] reading should replace the [current] displayed reading.
  static StateUpdateDecision shouldUpdateReading({
    required ParsedReading? current,
    required ParsedReading incoming,
  }) {
    // 0. Filter out protocol acknowledgment packets (unit == "ACK" or value == 0 with ACK)
    if (incoming.unit == "ACK") {
      return const StateUpdateDecision(
        shouldAccept: false,
        reason: "Rejected: Control command acknowledgment packet is not a telemetry measurement",
      );
    }

    // 1. If no reading is currently displayed, always accept
    if (current == null) {
      return StateUpdateDecision(
        shouldAccept: true,
        reason: "Initial reading accepted for ${incoming.type.name} (Value: ${incoming.value} ${incoming.unit})",
      );
    }

    // 2. Both records have valid device measurement timestamps (e.g. 0x55, 0x60, 0x62)
    if (incoming.measurementTimestamp != null && current.measurementTimestamp != null) {
      final incomingDevTime = incoming.measurementTimestamp!;
      final currentDevTime = current.measurementTimestamp!;

      if (incomingDevTime.isAfter(currentDevTime)) {
        final reason = incoming.source == ReadingSource.onDemandMeasurement
            ? "Accepted: On-demand measurement verified newer than baseline ($incomingDevTime > $currentDevTime)"
            : "Accepted: Incoming device timestamp ($incomingDevTime) is newer than current ($currentDevTime)";
        return StateUpdateDecision(
          shouldAccept: true,
          reason: reason,
        );
      } else if (incomingDevTime.isBefore(currentDevTime)) {
        return StateUpdateDecision(
          shouldAccept: false,
          reason: "Rejected: Incoming record is older ($incomingDevTime < $currentDevTime)",
        );
      } else {
        // Device timestamps are identical (same measurement session)
        if (incoming.source == ReadingSource.liveSensor && current.source != ReadingSource.liveSensor) {
          return const StateUpdateDecision(
            shouldAccept: true,
            reason: "Accepted: Live sensor stream takes precedence over historical sync for identical device timestamp",
          );
        }
        if (incoming.source == ReadingSource.onDemandMeasurement && current.source != ReadingSource.onDemandMeasurement) {
          return const StateUpdateDecision(
            shouldAccept: true,
            reason: "Accepted: On-demand measurement takes precedence over background sync for identical device timestamp",
          );
        }
        if (incoming.value != current.value && incoming.receivedAt.isAfter(current.receivedAt)) {
          return const StateUpdateDecision(
            shouldAccept: true,
            reason: "Accepted: Revised reading with identical device timestamp",
          );
        }
        return StateUpdateDecision(
          shouldAccept: false,
          reason: "Deduplicated: Duplicate record with identical device timestamp ($incomingDevTime)",
        );
      }
    }

    // 3. Incoming has device timestamp, but current does not (e.g. initial untimestamped status, or current is live stream/on-demand)
    if (incoming.measurementTimestamp != null && current.measurementTimestamp == null) {
      // If current is an active live sensor reading or recent on-demand measurement,
      // an incoming historical flash sync record (0x55 / 0x60) must NOT overwrite it if the flash record is older than when current was captured!
      if ((current.source == ReadingSource.liveSensor || current.source == ReadingSource.onDemandMeasurement) &&
          incoming.source == ReadingSource.historicalSync) {
        if (incoming.measurementTimestamp!.isAfter(current.receivedAt)) {
          return StateUpdateDecision(
            shouldAccept: true,
            reason: "Accepted: Stored flash record (${incoming.measurementTimestamp}) is newer than live measurement (${current.receivedAt})",
          );
        } else {
          return StateUpdateDecision(
            shouldAccept: false,
            reason: "Rejected: Stored flash record (${incoming.measurementTimestamp}) is older than live measurement (${current.receivedAt})",
          );
        }
      }

      return const StateUpdateDecision(
        shouldAccept: true,
        reason: "Accepted: Timestamped device record takes precedence over untimestamped entry",
      );
    }

    // 4. Incoming lacks device timestamp, but current has one
    if (incoming.measurementTimestamp == null && current.measurementTimestamp != null) {
      // Live optical stream (0x09) and on-demand measurements represent real-time active wrist measurements.
      // If incoming was captured in the active app session, it takes precedence over past recorded history!
      if (incoming.source == ReadingSource.liveSensor || incoming.source == ReadingSource.onDemandMeasurement) {
        if (incoming.receivedAt.isAfter(current.measurementTimestamp!)) {
          final reason = incoming.source == ReadingSource.liveSensor
              ? "Accepted: Live optical sensor stream takes precedence over past recorded measurement"
              : "Accepted: Fresh on-demand measurement (${incoming.receivedAt}) takes precedence over past recorded measurement";
          return StateUpdateDecision(
            shouldAccept: true,
            reason: reason,
          );
        }
      }
      // Battery is real-time status telemetry without a device clock; allow updates based on receive time
      if (incoming.type == MeasurementType.battery) {
        if (incoming.receivedAt.isAfter(current.receivedAt)) {
          return const StateUpdateDecision(
            shouldAccept: true,
            reason: "Accepted: Fresh real-time battery status query",
          );
        }
      }
      return const StateUpdateDecision(
        shouldAccept: false,
        reason: "Rejected: Preserving timestamped device record over older untimestamped payload",
      );
    }

    // 5. Neither record has device timestamp (e.g. Battery queries 0x13, continuous liveSensor 0x09, on-demand live HR)
    if (incoming.receivedAt.isAfter(current.receivedAt)) {
      final desc = incoming.source == ReadingSource.liveSensor
          ? "Accepted: Live stream reading (${incoming.value} ${incoming.unit})"
          : incoming.source == ReadingSource.onDemandMeasurement
              ? "Accepted: On-demand measurement result (${incoming.value} ${incoming.unit})"
              : incoming.type == MeasurementType.battery
                  ? "Accepted: Fresh real-time battery status query (${incoming.receivedAt} > ${current.receivedAt})"
                  : "Accepted: Newer receive timestamp (${incoming.receivedAt} > ${current.receivedAt})";
      return StateUpdateDecision(
        shouldAccept: true,
        reason: desc,
      );
    }

    return const StateUpdateDecision(
      shouldAccept: false,
      reason: "Rejected: Older receive timestamp",
    );
  }
}
