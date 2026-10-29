// Botões só com ícone (sem texto visível, ou só "×"/"✕") precisam de aria-label (#16 CA4).
export function iconButtonsWithoutLabel(root = document.body) {
  return [...root.querySelectorAll('button')].filter((b) => {
    const text = b.textContent.replace(/[×✕\s]/g, '');
    return text === '' && !b.getAttribute('aria-label');
  });
}
