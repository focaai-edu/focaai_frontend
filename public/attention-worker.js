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
 *   { type: 'pose', yaw, pitch, roll, ear, timestamp }
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

// Head pose computation from MediaPipe 478 face landmarks
// Using simplified method based on nose, chin, eye corners

function computeHeadPose(landmarks) {
  // Key landmarks (MediaPipe FaceMesh indices)
  // Nose tip: 1
  // Chin: 152
  // Left eye inner: 133, outer: 33
  // Right eye inner: 362, outer: 263
  // Mouth left: 61, right: 291
  // Forehead (for pitch): 10

  const noseTip = landmarks[1];
  const chin = landmarks[152];
  const leftEye = landmarks[33];    // outer corner
  const rightEye = landmarks[263];  // outer corner
  const forehead = landmarks[10];

  if (!noseTip || !chin || !leftEye || !rightEye || !forehead) {
    return { yaw: 0, pitch: 0, roll: 0 };
  }

  // Compute face center (midpoint between eyes + nose)
  const faceCenterX = (leftEye.x + rightEye.x + noseTip.x) / 3;
  const faceCenterY = (leftEye.y + rightEye.y + noseTip.y) / 3;

  // Yaw: horizontal angle of nose relative to face center
  // Distance from nose to face center X = yaw indicator
  const eyeMidX = (leftEye.x + rightEye.x) / 2;
  const yaw = (noseTip.x - eyeMidX) * 60; // Scale to degrees approx

  // Pitch: vertical angle — nose to forehead distance
  const pitch = (noseTip.y - forehead.y) * 50;

  // Roll: angle of eye line
  const dx = rightEye.x - leftEye.x;
  const dy = rightEye.y - leftEye.y;
  const roll = Math.atan2(dy, dx) * (180 / Math.PI);

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
          outputFacialTransformationMatrixes: false,
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
          const pose = computeHeadPose(landmarks);
          const ear = computeEAR(landmarks);

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
