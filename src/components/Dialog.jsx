import { useEffect, useRef } from 'react';

// Elementos que recebem foco pelo teclado.
const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Container acessível de modal ou gaveta (#16, V09/F39): `role="dialog"`,
 * `aria-modal` e `aria-labelledby` para o título; ao abrir, o foco entra no
 * diálogo; Tab e Shift+Tab ficam presos dentro dele; Escape chama `onClose`; ao
 * fechar, o foco volta para quem abriu. As teclas são tratadas no próprio
 * container, então um diálogo aberto por cima de outro (câmera sobre a gaveta
 * de configurações) cuida só das suas.
 *
 * Monte o componente só enquanto o diálogo estiver aberto. A aparência fica com
 * quem usa (`className`).
 */
export default function Dialog({ titleId, onClose, className = '', children, ...rest }) {
  const ref = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // Quem abriu é capturado no primeiro render: um campo com autoFocus pega o
  // foco no commit, antes do efeito abaixo.
  const openerRef = useRef(undefined);
  if (openerRef.current === undefined) openerRef.current = document.activeElement;

  useEffect(() => {
    const node = ref.current;
    const opener = openerRef.current;
    const focusables = () => [...node.querySelectorAll(FOCUSABLE)];

    // autoFocus de um campo já colocou o foco aqui dentro: respeita.
    if (!node.contains(document.activeElement)) (focusables()[0] || node).focus();

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const list = focusables();
      if (list.length === 0) { e.preventDefault(); return; }
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && (document.activeElement === first || !node.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    node.addEventListener('keydown', onKeyDown);
    return () => {
      node.removeEventListener('keydown', onKeyDown);
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) opener.focus();
    };
  }, []);

  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className={className} {...rest}>
      {children}
    </div>
  );
}
