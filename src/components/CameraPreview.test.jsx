import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import CameraPreview from './CameraPreview';

describe('CameraPreview (#55 — Caixa ao redor do rosto na tela ao vivo do aluno)', () => {
  let mockCtx;
  let origGetContext;

  beforeEach(() => {
    mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      drawImage: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arcTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      fillText: vi.fn(),
      fillRect: vi.fn(),
      measureText: vi.fn(() => ({ width: 45 })),
      roundRect: vi.fn(),
      lineWidth: 0,
      strokeStyle: '',
      fillStyle: '',
      font: '',
      textBaseline: '',
    };
    origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCtx);

    Object.defineProperty(HTMLVideoElement.prototype, 'readyState', { value: 4, configurable: true });
    Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { value: 640, configurable: true });
    Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { value: 480, configurable: true });
  });

  afterEach(() => {
    cleanup();
    HTMLCanvasElement.prototype.getContext = origGetContext;
  });

  it('renderiza o canvas e o elemento de vídeo oculto', () => {
    const videoRef = { current: null };
    const { container } = render(
      <CameraPreview
        videoRef={videoRef}
        source="webcam"
        landmarksRef={{ current: null }}
        poseRef={{ current: null }}
      />
    );

    const canvas = container.querySelector('canvas');
    const video = container.querySelector('video');
    expect(canvas).toBeTruthy();
    expect(video).toBeTruthy();
    expect(video.className).toContain('hidden');
  });

  it('exibe alerta de erro quando fornecido', () => {
    const videoRef = { current: null };
    render(
      <CameraPreview
        videoRef={videoRef}
        source="webcam"
        error="Câmera indisponível"
        landmarksRef={{ current: null }}
        poseRef={{ current: null }}
      />
    );

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Câmera indisponível');
  });

  it('exibe badge da fonte quando ativo e sem erro', () => {
    const videoRef = { current: null };
    render(
      <CameraPreview
        videoRef={videoRef}
        source="webcam"
        landmarksRef={{ current: null }}
        poseRef={{ current: null }}
      />
    );

    expect(screen.getByText('Webcam')).toBeTruthy();
  });

  it('desenha o vídeo espelhado e a caixa delimitadora com o status do aluno', () => {
    const videoRef = { current: null };
    const landmarksRef = {
      current: new Float32Array([0.3, 0.3, 0.5, 0.5]),
    };
    const poseRef = {
      current: { yaw: 5, pitch: -2, roll: 1 },
    };

    render(
      <CameraPreview
        videoRef={videoRef}
        source="webcam"
        landmarksRef={landmarksRef}
        poseRef={poseRef}
        status="attentive"
      />
    );

    // draw() roda imediatamente para source="webcam"
    expect(mockCtx.drawImage).toHaveBeenCalledWith(expect.any(HTMLVideoElement), 0, 0, 640, 480);
    expect(mockCtx.stroke).toHaveBeenCalled();
    expect(mockCtx.fillText).toHaveBeenCalledWith('Atento', expect.any(Number), expect.any(Number));
  });

  it('não desenha a caixa quando não há landmarks detectados', () => {
    const videoRef = { current: null };
    const landmarksRef = { current: null };
    const poseRef = { current: null };

    render(
      <CameraPreview
        videoRef={videoRef}
        source="webcam"
        landmarksRef={landmarksRef}
        poseRef={poseRef}
        status="attentive"
      />
    );

    expect(mockCtx.drawImage).toHaveBeenCalled();
    expect(mockCtx.stroke).not.toHaveBeenCalled();
    expect(mockCtx.fillText).not.toHaveBeenCalledWith('Atento', expect.any(Number), expect.any(Number));
  });
});
