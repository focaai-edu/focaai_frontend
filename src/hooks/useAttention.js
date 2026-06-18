import { useState, useRef, useCallback } from 'react';
import socket from '../services/socket';
import { isDistracted } from '../lib/attentionAlgo';

/**
 * useAttention — decide o status de atenção da webcam do aluno.
 *
 * DECISÃO: usa EXATAMENTE o mesmo algoritmo da câmera da sala (/room) —
 * `isDistracted()` de lib/attentionAlgo.js, instantâneo por ângulo/EAR. O mesmo
 * rosto, no mesmo ângulo, é classificado de forma idêntica nas duas telas.
 *
 * ESTABILIZAÇÃO: como aqui o status é PERSISTIDO (vira attention_event), uma troca
 * só é confirmada depois de se manter por `STABLE_MS`. Isso evita flicker perto do
 * limiar virar enxurrada de eventos — sem alterar a fronteira de decisão.
 *
 * ESPECÍFICO DO ALUNO (não existe no /room): status `no_camera` por ausência de
 * rosto e emissão de `attention_update` apenas na troca confirmada de status.
 */

const STABLE_MS = 1000;       // tempo que um novo status precisa se manter p/ valer
const NO_FACE_SECONDS = 8;    // segundos sem rosto até marcar `no_camera`

export function useAttention(classId, studentId, monitoringMode = 'full_attention', source = 'webcam') {
  const [status, setStatus] = useState('disconnected');
  const [earValue, setEarValue] = useState(1.0);
  const [poseValues, setPoseValues] = useState({ yaw: 0, pitch: 0, roll: 0 });

  const currentStatus = useRef(null);     // status confirmado (exibido + persistido)
  const candidate = useRef(null);         // status pendente de confirmação
  const candidateSince = useRef(0);       // quando o candidato apareceu
  const noFaceSeconds = useRef(0);
  const lastFrameTime = useRef(Date.now());

  const emitUpdate = useCallback((newStatus, pose) => {
    if (!socket.connected) return;
    socket.emit('attention_update', {
      class_id: classId,
      student_id: studentId,
      status: newStatus,
      source,
      monitoring_mode: monitoringMode,
      ...(pose ? { yaw: pose.yaw, pitch: pose.pitch, roll: pose.roll, ear: pose.ear } : {}),
    });
  }, [classId, studentId, source, monitoringMode]);

  // Confirma um status (com estabilização) e emite na troca.
  const commit = useCallback((newStatus, pose) => {
    if (newStatus === currentStatus.current) {
      candidate.current = newStatus; // já é o status atual — nada pendente
      return;
    }
    const now = Date.now();
    // Primeira classificação é imediata; trocas seguintes exigem estabilidade.
    if (currentStatus.current !== null) {
      if (newStatus !== candidate.current) {
        candidate.current = newStatus;
        candidateSince.current = now;
        return;
      }
      if (now - candidateSince.current < STABLE_MS) return;
    }
    currentStatus.current = newStatus;
    candidate.current = newStatus;
    setStatus(newStatus);
    emitUpdate(newStatus, pose);
  }, [emitUpdate]);

  const processPose = useCallback((pose) => {
    lastFrameTime.current = Date.now();
    setPoseValues({ yaw: pose.yaw, pitch: pose.pitch, roll: pose.roll });
    setEarValue(pose.ear);

    // Intervalo: sem monitoramento — sempre atento (igual ao /room).
    const raw = monitoringMode === 'break'
      ? 'attentive'
      : (isDistracted(pose.yaw, pose.pitch, pose.ear, monitoringMode) ? 'distracted' : 'attentive');

    commit(raw, pose);
  }, [monitoringMode, commit]);

  const processNoFace = useCallback(() => {
    if (monitoringMode === 'break') return;

    const now = Date.now();
    const dt = (now - lastFrameTime.current) / 1000;
    lastFrameTime.current = now;

    noFaceSeconds.current += dt;
    if (noFaceSeconds.current >= NO_FACE_SECONDS && currentStatus.current !== 'no_camera') {
      currentStatus.current = 'no_camera';
      candidate.current = 'no_camera';
      setStatus('no_camera');
      emitUpdate('no_camera', null);
    }
  }, [monitoringMode, emitUpdate]);

  // Rosto reapareceu — zera o contador de ausência.
  const resetNoFace = useCallback(() => {
    noFaceSeconds.current = 0;
  }, []);

  return {
    status,
    earValue,
    poseValues,
    processPose,
    processNoFace,
    resetNoFace,
    currentStatus: currentStatus.current,
  };
}
