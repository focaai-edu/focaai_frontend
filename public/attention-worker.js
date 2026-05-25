/* foca.ai — Attention Monitor Web Worker
 *
 * Runs MediaPipe Face Landmarker off the main thread.
 * Receives video frames, computes head pose + EAR, posts back attention state.
 *
 * Messages FROM main thread:
 *   { type: 'init', thresholds: {...} }
 *   { type: 'frame', imageBitmap: ImageBitmap, timestamp: number }
 *   { type: 'set_thresholds', thresholds: {...} }
 *
 * Messages TO main thread:
 *   { type: 'ready' }
 *   { type: 'pose', yaw, pitch, roll, ear, landmarkBuffer, timestamp }
 *   { type: 'error', message: string }
 */

'use strict';

let faceLandmarker = null;
let wasmLoaded = false;
let thresholds = {
  full_attention: { yaw: 25, pitch_up: 20, pitch_down: 15, roll: 30, ear: 0.2 },
  activity:       { yaw: 25, pitch_up: 25, pitch_down: null, roll: 35, ear: 0.18 },
  exam:           { yaw: 20, pitch_up: 20, pitch_down: null, roll: 25, ear: 0.22 },
  break:          null
};

// Head pose computation from MediaPipe facial transformation matrix.
// Takes the 16-element column-major Float32Array from
// results.facialTransformationMatrixes[0].data and returns Euler angles in degrees.

function computeHeadPose(m) {
  // m is a 16-element column-major Float32Array (4x4). Guard for absence.
  if (!m || m.length < 16) return { yaw: 0, pitch: 0, roll: 0 };

  // Column-major: element[row][col] = m[col*4 + row]
  const m00 = m[0],  m10 = m[1],  m20 = m[2];
  const m01 = m[4],  m11 = m[5],  m21 = m[6];
  const m02 = m[8],  m12 = m[9],  m22 = m[10];

  const RAD2DEG = 180 / Math.PI;

  // Axis mapping empirically verified against MediaPipe's facial transformation
  // matrix (debug session 260525, two live measurement rounds):
  //   - Left/right turn (yaw)   lands in atan2(-m20, sy)  → reached ~±44° on turn
  //   - Up/down nod      (pitch) lands in atan2(m21, m22) → down ≈ -28°, up ≈ +34°
  //   - Shoulder tilt    (roll)  lands in atan2(m10, m00)
  // pitch sign already matches the useAttention contract (pitch < 0 = head DOWN,
  // pitch > 0 = head UP), confirmed via EAR drop on look-down — no flip needed.
  const sy = Math.sqrt(m00 * m00 + m10 * m10); // cos magnitude, keeps yaw in range

  const yaw   = Math.atan2(-m20, sy) * RAD2DEG; // left/right turn
  const pitch = Math.atan2(m21, m22) * RAD2DEG; // up/down nod (down < 0, up > 0)
  const roll  = Math.atan2(m10, m00) * RAD2DEG; // shoulder tilt

  return { yaw, pitch, roll };
}


function computeEAR(landmarks) {
  // MediaPipe eye landmark indices
  // Left eye: 33, 160, 158, 133, 153, 144
  // Right eye: 362, 385, 387, 263, 373, 380
  const leftEyeIndices = [33, 160, 158, 133, 153, 144];
  const rightEyeIndices = [362, 385, 387, 263, 373, 380];

  function eyeAspectRatio(eyePts) {
    if (eyePts.some(p => !p)) return 1.0;

    // Vertical distances
    const A = Math.hypot(eyePts[1].x - eyePts[5].x, eyePts[1].y - eyePts[5].y);
    const B = Math.hypot(eyePts[2].x - eyePts[4].x, eyePts[2].y - eyePts[4].y);

    // Horizontal distance
    const C = Math.hypot(eyePts[0].x - eyePts[3].x, eyePts[0].y - eyePts[3].y);

    if (C === 0) return 1.0;
    return (A + B) / (2.0 * C);
  }

  const leftEAR = eyeAspectRatio(leftEyeIndices.map(i => landmarks[i]));
  const rightEAR = eyeAspectRatio(rightEyeIndices.map(i => landmarks[i]));

  return (leftEAR + rightEAR) / 2.0;
}


// ---- Worker message handler ----
self.onmessage = async function(event) {
  const { type } = event.data;

  switch (type) {
    case 'init': {
      const { thresholds: newThresholds } = event.data;
      if (newThresholds) thresholds = { ...thresholds, ...newThresholds };

      try {
        // Dynamic import of MediaPipe tasks-vision bundle (not the /wasm folder)
        const { FilesetResolver, FaceLandmarker } = await import(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs'
        );

        // forVisionTasks receives the WASM base directory path
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
        );

        faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'CPU', // GPU may not be available inside Web Workers
          },
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: true,
          runningMode: 'VIDEO',
          numFaces: 1,
        });

        wasmLoaded = true;
        self.postMessage({ type: 'ready' });
      } catch (err) {
        self.postMessage({ type: 'error', message: 'Failed to load MediaPipe: ' + err.message });
      }
      break;
    }

    case 'set_thresholds': {
      if (event.data.thresholds) {
        // Merge custom per-student thresholds
        Object.assign(thresholds, event.data.thresholds);
      }
      break;
    }

    case 'frame': {
      if (!wasmLoaded || !faceLandmarker) {
        // Not ready yet — skip frame
        return;
      }

      const { imageBitmap, timestamp } = event.data;
      if (!imageBitmap) return;

      try {
        const results = faceLandmarker.detectForVideo(imageBitmap, timestamp || Date.now());

        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
          const landmarks = results.faceLandmarks[0];
          const matrixData = results.facialTransformationMatrixes?.[0]?.data;
          const pose = computeHeadPose(matrixData);
          const ear = computeEAR(landmarks);

          // Throttled diagnostic — logs head pose + EAR ~1x/s to the browser console
          const _now = Date.now();
          if (!self.__lastLog || _now - self.__lastLog > 1000) {
            self.__lastLog = _now;
            const matLen = matrixData ? matrixData.length : 'MISSING';
            console.log(
              `[attention-worker] matrix=${matLen} | yaw=${pose.yaw.toFixed(1)} pitch=${pose.pitch.toFixed(1)} roll=${pose.roll.toFixed(1)} | ear=${ear.toFixed(3)}`
            );
          }

          // Pack x,y of all 478 landmarks into a transferable Float32Array
          const buf = new Float32Array(landmarks.length * 2);
          for (let i = 0; i < landmarks.length; i++) {
            buf[i * 2]     = landmarks[i].x;
            buf[i * 2 + 1] = landmarks[i].y;
          }

          self.postMessage(
            { type: 'pose', yaw: pose.yaw, pitch: pose.pitch, roll: pose.roll, ear, landmarkBuffer: buf, timestamp: timestamp || Date.now() },
            [buf.buffer]
          );
        } else {
          // No face detected
          self.postMessage({
            type: 'no_face',
            timestamp: timestamp || Date.now()
          });
        }

        // Close the ImageBitmap to free memory
        imageBitmap.close();
      } catch (err) {
        self.postMessage({ type: 'error', message: 'Frame processing error: ' + err.message });
        try { imageBitmap.close(); } catch {}
      }
      break;
    }
  }
};
