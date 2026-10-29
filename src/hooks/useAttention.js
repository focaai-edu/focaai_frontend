import { useState, useRef, useCallback, useEffect } from 'react';
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
 * rosto ou câmera indisponível, `distracted` com a aba oculta, e emissão de
 * `attention_update` apenas na troca confirmada de status.
 */

const STABLE_MS = 1000;       // tempo que um novo status precisa se manter p/ valer
const NO_FACE_MS = 8000;      // tempo sem rosto até marcar `no_camera`
const HIDDEN_MS = 1000;       // aba oculta por mais que isso conta como `distracted`

export function useAttention(classId, monitoringMode = 'full_attention', source = 'webcam') {
  const [status, setStatus] = useState('disconnected');

  // Parâmetros do render mais recente: callbacks, timers e listeners leem daqui,
  // então nunca decidem com um modo antigo (#8, F01).
  const params = useRef(null);
  params.current = { classId, monitoringMode, source };

  const currentStatus = useRef(null);     // status confirmado (exibido + persistido)
  const confirmedPose = useRef(null);     // ângulos/EAR do frame que confirmou o status
  const candidate = useRef(null);         // status pendente de confirmação
  const candidateSince = useRef(0);       // quando o candidato apareceu
  const noFaceSince = useRef(null);       // início da ausência de rosto atual (null = há rosto)
  const hidden = useRef(false);           // aba oculta: frames são ignorados

  const emitUpdate = useCallback((newStatus, pose) => {
    if (!socket.connected) return;
    const p = params.current;
    socket.emit('attention_update', {
      // Sem student_id: o servidor identifica o aluno pela sessão (backend#7, #24).
      class_id: p.classId,
      status: newStatus,
      source: p.source,
      monitoring_mode: p.monitoringMode,
      ...(pose ? { yaw: pose.yaw, pitch: pose.pitch, roll: pose.roll, ear: pose.ear } : {}),
    });
  }, []);

  // Confirma um status na hora, sem estabilização.
  const confirm = useCallback((newStatus, pose) => {
    if (newStatus === currentStatus.current) return;
    currentStatus.current = newStatus;
    confirmedPose.current = pose;
    candidate.current = newStatus;
    setStatus(newStatus);
    emitUpdate(newStatus, pose);
  }, [emitUpdate]);

  // Reanuncia o status confirmado (sem mudança), para o backend abrir o evento
  // com o modo novo ou depois de uma reconexão. Nada sai em `break` (RF09, #3).
  const reannounce = useCallback(() => {
    if (currentStatus.current === null || params.current.monitoringMode === 'break') return;
    emitUpdate(currentStatus.current, confirmedPose.current);
  }, [emitUpdate]);

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
    confirm(newStatus, pose);
  }, [confirm]);

  const processPose = useCallback((pose) => {
    const mode = params.current.monitoringMode;
    // Intervalo: sem monitoramento — nada é confirmado nem emitido (RF05).
    // Aba oculta: o status fica no `distracted` da aba (#8, F02).
    if (mode === 'break' || hidden.current) return;

    const raw = isDistracted(pose.yaw, pose.pitch, pose.ear, mode) ? 'distracted' : 'attentive';
    commit(raw, pose);
  }, [commit]);

  // A ausência conta a partir do primeiro frame sem rosto processado fora do
  // intervalo; o tempo do break e o de carga do detector não entram (#8, F14).
  const processNoFace = useCallback(() => {
    if (params.current.monitoringMode === 'break' || hidden.current) {
      noFaceSince.current = null;
      return;
    }

    const now = Date.now();
    if (noFaceSince.current === null) noFaceSince.current = now;
    if (now - noFaceSince.current >= NO_FACE_MS) confirm('no_camera', null);
  }, [confirm]);

  // Rosto reapareceu — zera o contador de ausência.
  const resetNoFace = useCallback(() => {
    noFaceSince.current = null;
  }, []);

  // Câmera negada, ausente ou desconectada, ou detector que não carregou (#8, F03/F16).
  const markNoCamera = useCallback(() => {
    if (params.current.monitoringMode === 'break') return;
    confirm('no_camera', null);
  }, [confirm]);

  // Troca de modo: reemite o status atual com o modo novo (RF09). Sair de `break`
  // é uma troca como outra qualquer, então o status congelado sai uma vez.
  const previousMode = useRef(monitoringMode);
  useEffect(() => {
    if (previousMode.current === monitoringMode) return;
    previousMode.current = monitoringMode;
    reannounce();
  }, [monitoringMode, reannounce]);

  // Reconexão: reemite o status atual depois do `join_class` da tela (RF10).
  // Os listeners de `connect` rodam em sequência; a microtask garante que o
  // join_class da página, registrado depois deste, saia antes do status.
  useEffect(() => {
    const onConnect = () => queueMicrotask(reannounce);
    socket.on('connect', onConnect);
    return () => socket.off('connect', onConnect);
  }, [reannounce]);

  // Aba oculta: o navegador para de entregar frames, então o status congelaria.
  // Depois de HIDDEN_MS oculta, o aluno conta como `distracted` (#8, F02).
  useEffect(() => {
    let timer = null;
    function onVisibility() {
      clearTimeout(timer);
      timer = null;
      if (document.visibilityState === 'hidden') {
        hidden.current = true;
        timer = setTimeout(() => {
          if (params.current.monitoringMode === 'break' || currentStatus.current === 'no_camera') return;
          confirm('distracted', null);
        }, HIDDEN_MS);
      } else {
        hidden.current = false;
        // Ao voltar, a decisão recomeça pelos frames, com estabilização normal.
        candidate.current = currentStatus.current;
        noFaceSince.current = null;
      }
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [confirm]);

  return {
    status,
    processPose,
    processNoFace,
    resetNoFace,
    markNoCamera,
  };
}
