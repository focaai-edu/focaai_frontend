# SPEC — foca.ai frontend

Regras de negócio vigentes do frontend. Toda mudança de comportamento entra neste
documento na mesma entrega (PR) que a implementa, referenciando a issue.
Em caso de conflito com o `CLAUDE.md`, **este documento prevalece**.

- Regras têm identificador estável (`RF01`...). Não renumere; regra removida vira "revogada".
- Contratos de API (endpoints REST, eventos Socket.IO e payloads) são definidos no
  [`docs/SPEC.md` do backend](https://github.com/focaai-edu/focaai_backend/blob/main/docs/SPEC.md)
  (seções 4 e 5) e não são duplicados aqui. Referências `RNxx` apontam para aquele documento.

---

## 1. Escopo

No **fluxo central** (o aluno se distrai → o sistema sabe o que foi falado → resume com IA → o aluno recupera), o frontend:

1. decide no navegador do aluno, a partir da webcam, se ele está atento, e avisa o backend quando o status muda;
2. captura o áudio do professor e o envia em trechos para transcrição;
3. mostra a transcrição ao vivo, avisa o aluno quando um resumo fica pronto e apresenta a revisão da aula.

Nenhuma imagem da webcam do aluno sai do navegador. Só o status e os ângulos são enviados.

Câmera da sala está fora do fluxo central (seção 4).

## 2. Regras de negócio

### 2.1 Detecção de atenção (webcam do aluno)

**RF01 — Pose da cabeça.** Yaw, pitch e roll (em graus) vêm da matriz de transformação facial do MediaPipe Face Landmarker (4×4, column-major `m`):
- `yaw = atan2(−m[2], √(m[0]² + m[1]²))`: virar para os lados;
- `pitch = atan2(m[6], m[10])`: **negativo = cabeça para baixo**, positivo = para cima;
- `roll = atan2(m[1], m[0])`: inclinar para o ombro.

Sem matriz (ausente ou com menos de 16 valores), a pose é `0, 0, 0`.

**RF02 — Abertura dos olhos (EAR).** EAR é a média dos dois olhos, calculada sobre os landmarks 33, 160, 158, 133, 153, 144 (esquerdo) e 362, 385, 387, 263, 373, 380 (direito): `(|p1−p5| + |p2−p4|) / (2·|p0−p3|)`. Um landmark ausente, ou largura zero, conta como olho aberto (`1.0`).

**RF03 — Limiares por modo.** Fonte única: `src/lib/attentionAlgo.js` (`MODE_THRESHOLDS`).

| Modo | \|yaw\| máx. | pitch p/ cima máx. | pitch p/ baixo máx. | EAR mín. |
|---|---|---|---|---|
| `full_attention` (Atenção total) | 25° | 20° | 15° | 0.20 |
| `activity` (Atividade) | 25° | 25° | permitido | 0.18 |
| `exam` (Prova) | 20° | 20° | permitido | 0.22 |
| `break` (Intervalo) | sem monitoramento | — | — | — |

**RF04 — Decisão por frame.** Um frame é **desatento** se qualquer condição do modo ativo for violada: `|yaw| > yaw`; `pitch > pitch_up`; `pitch < −pitch_down` (quando o modo não permite olhar para baixo); ou `EAR < ear`. Caso contrário, é **atento**.

**RF05 — Intervalo.** Em `break`, todo frame conta como atento, a ausência de rosto é ignorada e nada é emitido (RF09).

### 2.2 Estabilização e emissão

**RF06 — Estabilização.** A primeira classificação da sessão é confirmada imediatamente. A partir daí, um status novo só é confirmado depois de se manter por **1 s** seguido (`STABLE_MS`). Oscilações perto do limiar não viram eventos.

**RF07 — Ausência de rosto.** Sem rosto detectado por **8 s** seguidos (`NO_FACE_SECONDS`), o status vira `no_camera` imediatamente, sem estabilização. Qualquer frame com rosto zera a contagem.

**RF08 — Emissão.** `attention_update` é emitido quando um status é confirmado e é diferente do anterior (RF06/RF07), e sempre que RF09 ou RF10 pedirem, desde que o socket esteja conectado. O payload segue o contrato do backend (RN12): `class_id`, `status`, `source` e os ângulos e EAR do frame que confirmou o status.

**RF09 — Reemissão na troca de modo.** Ao receber `monitoring_mode_changed` para um modo diferente de `break`, o cliente emite de novo o status confirmado atual, mesmo sem mudança. O backend fecha os eventos na troca (RN06) e depende dessa reemissão para abrir os novos com o modo correto. Em `break`, nada é emitido.

**RF10 — Reconexão.** Na tela de aula ao vivo, quando o socket reconecta depois de uma queda, o cliente emite `join_class` de novo e, em seguida, o status confirmado atual.

### 2.3 Aula ao vivo

**RF11 — Entrar e sair (aluno).** A tela `/student/classes/:id/live` só abre para aula `live`; caso contrário, volta ao painel. Ao abrir, emite `join_class`. Ao sair (botão "Sair" ou ao deixar a página), emite `leave_class`. Ao receber `class_ended`, vai para a revisão (`/student/classes/:id/review`).

**RF12 — Transcrição ao vivo.** Aluno e professor veem cada `new_transcription` da aula em ordem de chegada, com o horário local, com rolagem automática para o fim.

**RF13 — Aviso de resumo pronto.** Ao receber `summary_ready` com o próprio `student_id`, o aluno vê por 8 s: "Você perdeu um trecho da aula — o resumo já está disponível na revisão." O aviso respeita `prefers-reduced-motion`. `summary_ready` de outros alunos é ignorado.

**RF14 — Áudio do professor.** Com a aula `live`, a tela do professor (e a câmera da sala, `/room`) grava o microfone em trechos de **5 s**. Cada trecho é um WebM completo (um `MediaRecorder` por trecho). Trechos com 500 bytes ou menos são descartados. Cada trecho é enviado como `audio_chunk { class_id, audio, duration_ms }`, onde `duration_ms` é a duração real da gravação (o último trecho, ao encerrar, é mais curto). A gravação para ao encerrar a aula ou ao sair da tela.

**RF15 — Troca de modo (professor).** O professor troca o modo pelos botões da aula ao vivo. A interface marca o novo modo na hora (otimista) e emite `change_monitoring_mode`. Todos os clientes da sala se atualizam ao receber `monitoring_mode_changed`.

### 2.4 Revisão da aula (aluno)

**RF16 — Revisão.** A tela `/student/classes/:id/review` mostra:
- percentual e tempos de atenção do próprio aluno (relatório do backend);
- a linha do tempo completa dos seus eventos (atento, distraído, sem câmera);
- a lista de distrações com o resumo de cada uma. Um clique abre o resumo completo;
- a transcrição completa da aula;
- um download `.txt` com os resumos.

Distração sem resumo:
- se a aula terminou há menos de 60 s, mostra "Gerando resumo…" e recarrega os dados a cada 5 s;
- depois disso, mostra "Resumo não disponível para este trecho.".

**RF17 — Datas.** As datas vêm da API em UTC com `Z` (RN24) e são exibidas no horário local do navegador, em `pt-BR`.

### 2.5 Processamento

**RF18 — Pipeline no navegador.** O MediaPipe Face Landmarker (`@mediapipe/tasks-vision` 0.10.18, via CDN, delegate CPU, modo VIDEO, 1 rosto) roda num **Web Worker** (`public/attention-worker.js`) para não travar a interface. O próximo frame só é enviado ao worker quando o anterior termina (backpressure). O worker devolve pose, EAR e landmarks; a decisão (RF04–RF07) roda no hook `useAttention`.

## 3. Status de implementação

Situação do código em 27/09/2026 (`main` @ `27cb1aa`). Atualize a linha na mesma entrega que corrigir a divergência. Issues sem prefixo são deste repo; `backend#N` = focaai-edu/focaai_backend#N.

| Regra | Status | Divergência atual | Issue |
|---|---|---|---|
| RF01 | ✅ | — | — |
| RF02 | ✅ | — | — |
| RF03 | ✅ | O worker tem uma cópia antiga de limiares, não usada na decisão (a decisão usa `attentionAlgo.js`) | — |
| RF04 | ✅ | — | — |
| RF05 | ✅ | — | — |
| RF06 | ✅ | — | — |
| RF07 | ✅ | — | — |
| RF08 | ✅ | — | — |
| RF09 | ⚠️ | Só emite quando o status muda; a troca de modo não reemite | #3 |
| RF10 | ⚠️ | A tela do aluno não refaz `join_class` ao reconectar | #3 |
| RF11 | ✅ | — | — |
| RF12 | ✅ | — | — |
| RF13 | ⚠️ | Escuta `attention_alert`, que o backend nunca emite; `summary_ready` não é escutado | #5 (+ backend#3) |
| RF14 | ⚠️ | Não envia `duration_ms` (o backend assume 5 s); em `/room` não há descarte de trechos ≤ 500 bytes (as duas telas têm cópias diferentes da gravação) | #4 (+ backend#4) |
| RF15 | ✅ | — | — |
| RF16 | ⚠️ | Distração sem resumo mostra "Sem resumo disponível." direto, sem estado "gerando" | #5 |
| RF17 | ⚠️ | Correto no frontend, mas horários de eventos e resumos aparecem 3 h adiantados porque o backend envia sem `Z` | backend#8 |
| RF18 | ✅ | — | — |

Cobertura por testes: nenhuma ainda (#2).

## 4. Fora do fluxo central (experimental)

Sem regras fechadas; o comportamento atual é descrito só para referência.

- **Câmera da sala (`/room`).** O professor escolhe a fonte: webcam do computador ou câmera IP MJPEG, via proxy do backend. As câmeras cadastradas ficam no `localStorage`. A cada 3 s, um frame JPEG é enviado por `room_frame`; o backend detecta os rostos (YuNet) e devolve caixas e o agregado atentos/desatentos, que são desenhados sobre o vídeo. A tela também grava o áudio da aula (RF14) e troca o modo (RF15).
- **Teste com imagem estática (`/room-test`).** Envia uma imagem para `POST /api/room/analyze-frame`, com parâmetros ajustáveis (detecção, limiares, pose), para calibrar o algoritmo da câmera da sala. Os limiares da câmera da sala são do backend e hoje diferem de RF03.
- `src/lib/faceDetection.js` (detecção em grade) e as funções de pose de `attentionAlgo.js` eram usadas pela versão da câmera da sala no navegador e ficaram como base para reuso.
- Pendente de decisão de produto: câmera anônima ou identificada; calibração de posição/altura da câmera; unificar os limiares com RF03.

## 5. Desenvolvimento

- Rodar: `npm run dev` (porta 5173; API e socket em `VITE_API_URL` / `VITE_SOCKET_URL`, padrão `http://localhost:5000`).
- Verificações: `npm run lint`, `npm test` (Vitest, a partir de #2) e `npm run build`.
