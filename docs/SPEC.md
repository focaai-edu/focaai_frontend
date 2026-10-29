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

**RF05 — Intervalo.** Em `break`, nenhum status é confirmado: frames desatentos, ausência de rosto e aba oculta são ignorados, e nada é emitido (RF09). O tempo do intervalo não conta para RF07 (#8).

### 2.2 Estabilização e emissão

**RF06 — Estabilização.** A primeira classificação da sessão é confirmada imediatamente. A partir daí, um status novo só é confirmado depois de se manter por **1 s** seguido (`STABLE_MS`). Oscilações perto do limiar não viram eventos.

**RF07 — Ausência de rosto.** Sem rosto detectado por **8 s** seguidos (`NO_FACE_MS`), o status vira `no_camera` imediatamente, sem estabilização. A contagem começa no primeiro frame sem rosto processado fora do `break`; o tempo de carga do detector e o do intervalo não entram (#8). Qualquer frame com rosto zera a contagem.

**RF19 — Aba oculta.** Com a aba oculta (`document.visibilityState === "hidden"`) por mais de **1 s** (`HIDDEN_MS`), fora do `break`, o status vira `distracted` imediatamente (o navegador para de entregar frames, e o status congelaria). Frames que chegam com a aba oculta são ignorados. Ao voltar, a decisão recomeça pelos frames, com a estabilização de RF06. Com o status em `no_camera`, a aba oculta não o muda (#8).

**RF20 — Câmera indisponível.** Se a câmera é negada ou não existe (`getUserMedia` falha) ou a track de vídeo termina (webcam desconectada), o status vira `no_camera` imediatamente, sem esperar RF07, e a tela mostra "Não foi possível acessar a câmera. Seu professor verá você como sem câmera." Só é emitido `attention_update { status: "no_camera" }`; `camera_disabled` não é usado. Em `break`, a marcação espera o fim do intervalo (#8).

**RF08 — Emissão.** `attention_update` é emitido quando um status é confirmado e é diferente do anterior (RF06/RF07), e sempre que RF09 ou RF10 pedirem, desde que o socket esteja conectado. O payload segue o contrato do backend (RN12): `class_id`, `status`, `source`, `monitoring_mode` e os ângulos e EAR do frame que confirmou o status (sem ângulos em `no_camera`). Não leva `student_id`: o servidor identifica o aluno pela sessão da conexão (backend#7, #24).

**RF09 — Reemissão na troca de modo.** Ao receber `monitoring_mode_changed` para um modo diferente de `break`, o cliente emite de novo o status confirmado atual (`attentive`, `distracted` ou `no_camera`), mesmo sem mudança, com o modo novo e os ângulos do frame que o confirmou. O backend fecha os eventos na troca (RN06) e depende dessa reemissão para abrir os novos com o modo correto. Em `break`, nada é emitido e o status confirmado fica congelado (RF05); sair de `break` é uma troca como as outras, então o status congelado sai uma vez. Sem status confirmado ainda, nada sai (#3).

**RF10 — Reconexão.** Na tela de aula ao vivo, quando o socket (re)conecta, o cliente emite `join_class` de novo e, em seguida, o status confirmado atual (exceto em `break`). Se a tela abre com o socket desconectado, o `join_class` sai uma única vez, no `connect`. O aluno também consulta `GET /api/classes/:id` a cada reconexão e a cada `error` do servidor: se a aula não está mais `live` (o `class_ended` pode ter se perdido na queda), vai para a revisão, o que para câmera e detector. O professor, em `/teacher/classes/:id/live`, também refaz o `join_class` ao reconectar, para seguir recebendo `new_transcription`, `student_joined` e `student_left` (#3).

### 2.3 Aula ao vivo

**RF21 — Erros do servidor.** Todo `error { message }` do servidor (enviado só ao remetente) aparece por 6 s num aviso não bloqueante (`role="alert"`), em qualquer tela, sem trocar de tela. Sem `message`, o aviso diz "Ocorreu um erro no servidor." Um erro novo substitui o anterior e reinicia o prazo (#3).

**RF22 — Socket e sessão.** O socket só conecta com um usuário autenticado (login, cadastro ou `/api/auth/me` com usuário) e é desconectado no logout (antes da chamada ao servidor, mesmo se ela falhar), quando `/api/auth/me` não traz usuário e quando o usuário da sessão muda. O servidor guarda o usuário da conexão no handshake, então trocar de conta na mesma aba sempre abre uma conexão nova. Quem controla o ciclo é o `AuthContext`; as páginas não abrem a conexão por conta própria. A identidade nos eventos vem da sessão da conexão (focaai-edu/focaai_backend#7); o `attention_update` não manda `student_id` (#7, #24).

**RF11 — Entrar e sair (aluno).** A tela `/student/classes/:id/live` só abre para aula `live`; caso contrário, volta ao painel. Ao abrir, emite `join_class`. Ao sair (botão "Sair" ou ao deixar a página), emite `leave_class`. Ao receber `class_ended`, vai para a revisão (`/student/classes/:id/review`).

**RF12 — Transcrição ao vivo.** Aluno e professor veem cada `new_transcription` da aula em ordem de chegada, com o horário local, com rolagem automática para o fim.

**RF13 — Aviso de resumo pronto.** Ao receber `summary_ready` com o próprio `student_id`, o aluno vê por 8 s: "Você perdeu um trecho da aula — o resumo já está disponível na revisão." O aviso respeita `prefers-reduced-motion` (a animação só existe com `motion-safe`). `summary_ready` de outros alunos, ou de outra aula, é ignorado. O antigo `attention_alert` não é mais escutado (#5).

**RF14 — Áudio do professor.** Com a aula `live`, a tela do professor (e a câmera da sala, `/room`, com a sala aberta) grava o microfone em trechos de **5 s**, pelo mesmo hook `useAudioChunks(classId)`; nenhuma página cria `MediaRecorder` por conta própria. Cada trecho é um WebM completo (um `MediaRecorder` por trecho). Trechos com 500 bytes ou menos são descartados nas duas telas. Cada trecho é enviado como `audio_chunk { class_id, audio, duration_ms }`, onde `duration_ms` é o tempo real entre `recorder.start()` e o fim do trecho, arredondado (o último, ao parar, é mais curto). Parar a gravação (encerrar a aula, "Fechar Sala", sair da tela) finaliza e envia o trecho em curso, para a aula em que ele foi gravado, antes de liberar o microfone. Sem conexão, o trecho é descartado (sem fila nem reenvio) e o indicador troca "Gravando" por "Sem conexão — o áudio não está sendo enviado"; ao reconectar, nada do período offline é enviado. Se a permissão do microfone (ou da webcam do aluno) chega depois de sair da tela, as tracks são paradas na hora e nada é gravado (#4).

**RF23 — Professor no fluxo central.** "Iniciar" (depois do `PATCH /start` com sucesso) e "Acessar" levam o professor para `/teacher/classes/:id/live`; a câmera da sala (`/room`) fica como opção secundária ("Câmera da sala" no card). O dashboard usa só REST para iniciar e encerrar, sem `start_class`/`end_class` pelo socket. A tela ao vivo grava o microfone (RF14) sem depender de `/room`; com o microfone negado, mostra "Não foi possível acessar o microfone. A aula continua, mas sem transcrição." e não emite `audio_chunk`. "Encerrar Aula" só para a gravação depois de o `PATCH /end` dar certo; se falhar, mostra "Erro ao encerrar aula." e segue gravando. A grade de alunos mostra o `attention_status { student_id, status }` de cada um; com `student_left`, o card fica como "Fora da aula" (#9).

**RF24 — Professor desconectado.** O aluno mostra "Professor desconectado" (`role="status"`) enquanto `teacher_presence.connected` da aula dele for `false`, recebido pelo evento `teacher_presence { class_id, connected, changed_at }` ou pelo campo `teacher_presence` do `class_state` (ao entrar ou reconectar). Eventos de outra aula são ignorados (backend RN25/RN26, #9).

**RF25 — Sair com a aula ao vivo.** Em `/teacher/classes/:id/live` e em `/room` com uma aula ao vivo selecionada: fechar ou recarregar a aba pede a confirmação do navegador (`beforeunload`); navegação interna (voltar, menu, "← Painel") e "Fechar Sala" abrem o diálogo "A aula continua ao vivo. Encerrar a aula também?" com "Encerrar aula" (`PATCH /end` e segue; se falhar, fica na tela com "Erro ao encerrar aula."), "Sair sem encerrar" e "Continuar na aula". Saídas causadas pelo fim da aula (encerrar, `class_ended`) não perguntam. As duas telas têm o botão "← Painel", que volta para `/teacher/dashboard` sem encerrar a aula. A confirmação de navegação usa `useBlocker`, por isso o app roda num data router (`createBrowserRouter` com uma rota curinga para `<App />`) (#9).

**RF26 — Duração da aula.** Um formatador único (`src/lib/duration.js`) mostra a duração no card ao vivo do dashboard ("Ao vivo há …") e no cabeçalho das telas ao vivo do aluno e do professor: "menos de 1 min", "12 min", "1 h 05 min", "26 h 10 min". Acima de 24 h, as telas ao vivo mostram também "Aula aberta há mais de 24 horas. Encerre-a se ela já terminou." (`role="status"`) (#9).

**RF15 — Troca de modo (professor).** O professor troca o modo pelos botões da aula ao vivo. A interface marca o novo modo na hora (otimista) e emite `change_monitoring_mode`. Todos os clientes da sala se atualizam ao receber `monitoring_mode_changed`.

### 2.4 Revisão da aula (aluno)

**RF16 — Revisão.** A tela `/student/classes/:id/review` mostra:
- percentual e tempos de atenção do próprio aluno (relatório do backend);
- a linha do tempo completa dos seus eventos (atento, distraído, sem câmera), na escala real da aula: vai do `started_at` ao `ended_at` da aula, cada segmento tem posição e largura do seu início e duração, os intervalos sem evento aparecem como "Fora", evento aberto vai até o fim da aula, e aula de duração 0 não quebra a barra;
- a lista de distrações com a duração em segundos ("20 s", "1 min 35 s") e a prévia do resumo sem marcadores. Um clique abre o resumo completo, renderizado como Markdown simples (títulos, listas, parágrafos e **negrito**, em `SummaryText`), sem HTML cru: HTML no resumo aparece como texto;
- o resumo de uma distração da linha do tempo é casado pelo `attention_event_id` quando o relatório o traz, senão pelo instante de início (nunca pela string, que pode vir como "+00:00" ou "Z");
- a transcrição completa da aula;
- um download `.txt` com os resumos.

Distração sem resumo:
- se a aula terminou há menos de 60 s, mostra "Gerando resumo…" e recarrega os dados a cada 5 s;
- depois disso, mostra "Resumo não disponível para este trecho.".

O relatório do professor segue a mesma regra de duração, prévia e recarga dos resumos (#5).

**RF27 — Erro de carga e atualização.** Falha de rede ou resposta 5xx no painel do aluno, na revisão, no relatório, no painel do professor ou no painel de transcrição mostra "Não foi possível carregar." com "Tentar de novo" (refaz a requisição), e não o texto de estado vazio. Respostas 4xx (não participou, aula não encerrada) continuam no estado vazio. O painel do aluno recarrega as aulas a cada 15 s e ao focar a janela, então uma aula que começa mostra "Entrar" sem recarregar a página; se uma dessas recargas falhar, a lista que já estava na tela continua (#5).

**RF17 — Datas.** As datas vêm da API em UTC com `Z` (RN24) e são exibidas no horário local do navegador, em `pt-BR`.

### 2.5 Processamento

**RF18 — Pipeline no navegador.** O MediaPipe Face Landmarker (`@mediapipe/tasks-vision` 0.10.18, via CDN, delegate CPU, modo VIDEO, 1 rosto) roda num **Web Worker** (`public/attention-worker.js`) para não travar a interface. O próximo frame só é enviado ao worker quando o anterior termina (backpressure). O worker devolve pose, EAR e landmarks; a decisão (RF04–RF07) roda no hook `useAttention`, sempre com o modo atual da aula. Um `error` do worker **antes** do `ready` é falha de inicialização (CDN ou modelo indisponível): a tela troca "Carregando detector..." por "Não foi possível iniciar o detector de atenção." com o botão "Tentar de novo" (recria o worker) e o status vira `no_camera`. Um `error` **depois** do `ready` é erro de um frame: é ignorado e o próximo frame segue (#8).

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
| RF09 | ✅ | — | — |
| RF10 | ✅ | — | — |
| RF11 | ✅ | — | — |
| RF12 | ✅ | — | — |
| RF13 | ✅ | — | — |
| RF14 | ✅ | O backend ainda ignora `duration_ms` e não aceita o trecho nos 10 s depois do fim (RN15/RN16) | backend#4 |
| RF15 | ✅ | — | — |
| RF16 | ✅ | O relatório ainda não traz `attention_event_id` nas distrações; o casamento usa o instante | backend#3 |
| RF17 | ⚠️ | Correto no frontend, mas horários de eventos e resumos aparecem 3 h adiantados porque o backend envia sem `Z` | backend#8 |
| RF18 | ✅ | — | — |
| RF19 | ✅ | — | — |
| RF20 | ✅ | — | — |
| RF21 | ✅ | — | — |
| RF22 | ✅ | — | — |
| RF23 | ✅ | — | — |
| RF24 | ✅ | — | — |
| RF25 | ✅ | — | — |
| RF26 | ✅ | — | — |
| RF27 | ✅ | — | — |

Cobertura por testes:
- Camada 1, unidade (#2, #8), em `src/lib/attentionAlgo.test.js`: RF01 (identidade e rotações conhecidas, que fixam o sinal), RF02 (EAR, landmark ausente, largura zero), RF03 e RF04 (por modo), além da paridade entre o worker e `attentionAlgo.js`.
- Camada 2, integração (#8), em `src/components/AttentionMonitor.test.jsx` e `src/pages/student/ClassLive.test.jsx`, com worker, socket e câmera falsos (`src/test/attentionHarness.js`) e timers falsos: sequência exata de `attention_update` para RF05–RF08, RF18 (troca de modo e falha do detector), RF19 e RF20.
- RF09, RF10 e RF21 (#3): reemissão na troca de modo em `AttentionMonitor.test.jsx`; reconexão do aluno (inclusive aula encerrada durante a queda) em `pages/student/ClassLive.test.jsx`; do professor em `pages/teacher/ClassLive.test.jsx`; aviso de erro em `components/ServerErrorAlert.test.jsx`. RF22 (#7): ciclo do socket com a sessão em `context/AuthContext.test.jsx` e contrato de identidade em `pages/student/ClassLive.test.jsx`. RF23–RF26 (#9): `pages/teacher/Dashboard.test.jsx`, `pages/teacher/ClassLive.test.jsx`, `pages/student/ClassLive.test.jsx`, `pages/room/RoomCamera.test.jsx` e `lib/duration.test.js`. As demais regras ainda não têm teste.
- RF14 (#4): gravação em `hooks/useAudioChunks.test.js` (duração com timers falsos, descarte ≤ 500 bytes, offline, último trecho, permissão tardia) e nas telas (`pages/teacher/ClassLive.test.jsx`, `pages/room/RoomCamera.test.jsx`); gravação única em `tests/single-audio-recorder.test.js`; webcam com permissão tardia em `components/AttentionMonitor.test.jsx`.
- RF13, RF16 e RF27 (#5): `components/SummaryText.test.jsx`, `components/AttentionTimeline.test.jsx`, `components/TranscriptPanel.test.jsx`, `pages/student/ClassReview.test.jsx`, `pages/student/ClassLive.test.jsx`, `pages/student/Dashboard.test.jsx`, `pages/teacher/ClassReport.summaries.test.jsx`, `pages/teacher/Dashboard.test.jsx` e `lib/duration.test.js`.
- Relatório do professor (#14, em `src/pages/teacher/ClassReport.test.jsx`): calibração do gráfico de atenção da turma (`AreaChart`) com domínio fixo `[0, 100]`, marcações `[0, 25, 50, 75, 100]`, formatação percentual sem repetição e margem esquerda `>= 0` prevenindo corte dos dígitos.
- Layout responsivo (#12, em `src/components/Layout.test.jsx`): colapso da sidebar no mobile (< 768px) como gaveta com backdrop, botão de menu com `aria-expanded`, fechamento por clique externo, tecla Escape e navegação por link, com margem responsiva (`ml-0 md:ml-[240px]`) e eliminação de transbordamento horizontal.
- Telas de aula ao vivo no mobile (#13, em `src/pages/ClassLiveResponsive.test.jsx`): layout empilhado (`flex-col md:flex-row`) no aluno com câmera e monitor em largura total sem esmagamento e transcrição empilhada abaixo (`w-full md:w-[300px]`); no professor, seletor de modos sem truncamento (`overflow-x-auto flex-nowrap`) e empilhamento da grade de alunos e transcrição eliminando divisão de 170px.

## 4. Fora do fluxo central (experimental)

Sem regras fechadas; o comportamento atual é descrito só para referência.

- **Câmera da sala (`/room`).** O professor escolhe a fonte: webcam do computador ou câmera IP MJPEG, via proxy do backend. As câmeras cadastradas ficam no `localStorage`. A cada 3 s, um frame JPEG é enviado por `room_frame`; o backend detecta os rostos (YuNet) e devolve caixas e o agregado atentos/desatentos, que são desenhados sobre o vídeo. A tela também grava o áudio da aula (RF14) e troca o modo (RF15). Ao receber `class_ended` da aula selecionada, fecha a sala (sem frames, sem microfone, câmera desligada), mostra "A aula foi encerrada." e recarrega as aulas ao vivo. Sair segue RF25 (#9).
- **Teste com imagem estática (`/room-test`).** Envia uma imagem para `POST /api/room/analyze-frame`, com parâmetros ajustáveis (detecção, limiares, pose), para calibrar o algoritmo da câmera da sala. Os limiares da câmera da sala são do backend e hoje diferem de RF03.
- `src/lib/faceDetection.js` (detecção em grade) e as funções de pose de `attentionAlgo.js` eram usadas pela versão da câmera da sala no navegador e ficaram como base para reuso.
- Pendente de decisão de produto: câmera anônima ou identificada; calibração de posição/altura da câmera; unificar os limiares com RF03.

## 5. Desenvolvimento

- Rodar: `npm run dev` (porta 5173; API e socket em `VITE_API_URL` / `VITE_SOCKET_URL`, padrão `http://localhost:5000`).
- Verificações: `npm run lint`, `npm test` e `npm run build` (#2).
- Testes: Vitest com `jsdom` e `@testing-library/react` (config em `vite.config.js`). `npm test` roda a suíte uma vez; `npm run test:watch` fica observando. Os testes ficam ao lado do código (`*.test.js` / `*.test.jsx`); `tests/` guarda testes do próprio ferramental (ex.: a config do ESLint).
- Lint: `eslint src/` analisa `.js` e `.jsx` com globals do navegador, JSX e as regras de hooks do React (`rules-of-hooks` como erro, `exhaustive-deps` como warning). Erros reprovam; warnings são aceitos.
