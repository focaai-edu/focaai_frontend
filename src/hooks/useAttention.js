import { useState, useRef, useCallback, useEffect } from 'react';
import socket from '../services/socket';

/**
 * Default thresholds per monitoring mode.
 * - full_attention: strict — 30s distraction threshold
 * - activity: lenient — 120s distraction threshold, pitch_down disabled
 * - exam: strictest — 15s for sideways glance
 * - break: no attention monitoring
 */
const DEFAULT_THRESHOLDS = {
  full_attention: {
    yaw: { limit: 25, time_seconds: 5 },
    pitchUp: { limit: 20, time_seconds: 4 },
    pitchDown: { limit: 15, time_seconds: 4 },
    roll: { limit: 30, time_seconds: 5 },
    noFace: { time_seconds: 8 },
    distraction_threshold: 30,
  },
  activity: {
    yaw: { limit: 25, time_seconds: 10 },
    pitchUp: { limit: 25, time_seconds: 8 },
    pitchDown: null, // Disabled — students may look down during activity
    roll: { limit: 35, time_seconds: 8 },
    noFace: { time_seconds: 8 },
    distraction_threshold: 120,
  },
  exam: {
    yaw: { limit: 20, time_seconds: 3 },
    pitchUp: { limit: 20, time_seconds: 5 },
    pitchDown: null, // Students write during exam
    roll: { limit: 25, time_seconds: 5 },
    noFace: { time_seconds: 8 },
    distraction_threshold: 15,
  },
  break: null,
};

/**
 * Checks if a pose value exceeds a threshold.
 * Returns true if the value is outside the acceptable range.
 */
function exceedsThreshold(value, criterion) {
  if (!criterion) return false;
  const { limit } = criterion;
  return Math.abs(value) > limit;
}

export function useAttention(classId, studentId, monitoringMode = 'full_attention', source = 'webcam') {
  const [status, setStatus] = useState('disconnected');
  const [customThresholds, setCustomThresholds] = useState(null);
  const [earValue, setEarValue] = useState(1.0);
  const [poseValues, setPoseValues] = useState({ yaw: 0, pitch: 0, roll: 0 });

  // Timer refs for non-cumulative tracking
  const timers = useRef({
    yaw: 0,
    pitchDown: 0,
    pitchUp: 0,
    roll: 0,
    noFace: 0,
  });
  const lastFrameTime = useRef(Date.now());
  const currentStatus = useRef(null);
  const distractionStart = useRef(null);
  const drowsyFrames = useRef(0);

  const getModeThresholds = useCallback(() => {
    if (customThresholds && customThresholds[monitoringMode]) {
      return { ...DEFAULT_THRESHOLDS[monitoringMode], ...customThresholds[monitoringMode] };
    }
    return DEFAULT_THRESHOLDS[monitoringMode];
  }, [monitoringMode, customThresholds]);

  const processPose = useCallback((pose) => {
    const modeThresholds = getModeThresholds();
    if (!modeThresholds) {
      // Break mode — no monitoring
      setStatus('attentive');
      return;
    }

    const now = Date.now();
    const dt = (now - lastFrameTime.current) / 1000; // seconds since last frame
    lastFrameTime.current = now;

    setPoseValues({ yaw: pose.yaw, pitch: pose.pitch, roll: pose.roll });
    setEarValue(pose.ear);

    let isDistracted = false;

    // Check each criterion
    const criteria = [
      { key: 'yaw', value: Math.abs(pose.yaw), threshold: modeThresholds.yaw },
      { key: 'roll', value: Math.abs(pose.roll), threshold: modeThresholds.roll },
      { key: 'pitchUp', value: pose.pitch > 0 ? pose.pitch : 0, threshold: modeThresholds.pitchUp },
      { key: 'pitchDown', value: pose.pitch < 0 ? -pose.pitch : 0, threshold: modeThresholds.pitchDown },
    ];

    for (const { key, value, threshold } of criteria) {
      if (threshold && value > threshold.limit) {
        timers.current[key] += dt;
        if (timers.current[key] >= threshold.time_seconds) {
          isDistracted = true;
        }
      } else {
        // Reset timer if within threshold (non-cumulative)
        timers.current[key] = 0;
      }
    }

    // No face timer is tracked by the caller (processNoFace)

    // Drowsiness check
    if (pose.ear < 0.2) {
      drowsyFrames.current += 1;
      if (drowsyFrames.current >= 90) { // ~3 seconds at 30fps
        isDistracted = true;
        // Drowsiness event will be logged
      }
    } else {
      drowsyFrames.current = Math.max(0, drowsyFrames.current - 1);
    }

    // Determine status
    let newStatus = 'attentive';
    if (isDistracted) {
      newStatus = 'distracted';
    }

    // Only emit on status change
    if (newStatus !== currentStatus.current) {
      currentStatus.current = newStatus;
      setStatus(newStatus);

      // Emit attention update via WebSocket
      if (socket.connected) {
        socket.emit('attention_update', {
          class_id: classId,
          student_id: studentId,
          status: newStatus,
          source: source,
          monitoring_mode: monitoringMode,
          yaw: pose.yaw,
          pitch: pose.pitch,
          roll: pose.roll,
          ear: pose.ear,
        });
      }

      if (newStatus === 'distracted') {
        distractionStart.current = now;
      } else if (newStatus === 'attentive' && distractionStart.current) {
        // Distraction ended — duration is in attention_service
        distractionStart.current = null;
      }
    }
  }, [classId, studentId, source, monitoringMode, getModeThresholds]);

  const processNoFace = useCallback(() => {
    const modeThresholds = getModeThresholds();
    if (!modeThresholds) return;

    const now = Date.now();
    const dt = (now - lastFrameTime.current) / 1000;
    lastFrameTime.current = now;

    timers.current.noFace += dt;
    if (timers.current.noFace >= (modeThresholds.noFace?.time_seconds || 8)) {
      if (currentStatus.current !== 'no_camera') {
        currentStatus.current = 'no_camera';
        setStatus('no_camera');

        if (socket.connected) {
          socket.emit('attention_update', {
            class_id: classId,
            student_id: studentId,
            status: 'no_camera',
            source: source,
            monitoring_mode: monitoringMode,
          });
        }
      }
    }
  }, [classId, studentId, source, monitoringMode, getModeThresholds]);

  // Reset face-not-found timer when face is found
  const resetNoFace = useCallback(() => {
    timers.current.noFace = 0;
  }, []);

  return {
    status,
    earValue,
    poseValues,
    processPose,
    processNoFace,
    resetNoFace,
    setCustomThresholds,
    currentStatus: currentStatus.current,
  };
}
