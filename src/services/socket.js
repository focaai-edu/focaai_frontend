import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

const socket = io(SOCKET_URL, {
  autoConnect: false,
  withCredentials: true,
});

// Única forma de abrir a conexão. connect() com o CONNECT ainda pendente manda
// outro CONNECT no mesmo engine; o servidor recusa o duplicado com 44 "Unable
// to connect" e o cliente se destrói, prendendo todo emit no buffer (#49).
// `active` vale enquanto conecta ou está conectado.
export function connectSocket() {
  if (!socket.active) socket.connect();
}

socket.on('connect_error', (err) => {
  console.error('[socket] conexão recusada:', err.message);
});

export default socket;
