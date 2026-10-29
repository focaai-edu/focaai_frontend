/**
 * Resumo gerado por IA em Markdown simples (#5, V04): títulos `#`, listas `-`/`*`
 * e `1.`, parágrafos e **negrito**. Tudo vira elemento React a partir de texto;
 * não há HTML cru (sem dangerouslySetInnerHTML), então `<b>` no resumo aparece
 * literalmente. O subconjunto é o que o prompt do resumo produz; o resto fica texto.
 */

const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^[-*]\s+(.*)$/;
const ORDERED = /^\d+[.)]\s+(.*)$/;

// **negrito** → <strong>; "**" sem par fica como está.
function inline(text, keyPrefix) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) => (i % 2 === 1 ? <strong key={`${keyPrefix}-${i}`}>{part}</strong> : part));
}

// Agrupa as linhas em blocos: título, lista (ul/ol) ou parágrafo.
function toBlocks(markdown) {
  const blocks = [];
  for (const raw of markdown.split('\n')) {
    const line = raw.trim();
    const last = blocks[blocks.length - 1];
    if (!line) { blocks.push(null); continue; }
    let m;
    if ((m = line.match(HEADING))) blocks.push({ type: 'heading', text: m[2] });
    else if ((m = line.match(BULLET)) || (m = line.match(ORDERED))) {
      const type = BULLET.test(line) ? 'ul' : 'ol';
      if (last && last.type === type) last.items.push(m[1]);
      else blocks.push({ type, items: [m[1]] });
    } else if (last && last.type === 'p') last.lines.push(line);
    else blocks.push({ type: 'p', lines: [line] });
  }
  return blocks.filter(Boolean);
}

export default function SummaryText({ text, className = '' }) {
  if (!text) return null;
  return (
    <div className={`space-y-2 ${className}`}>
      {toBlocks(text).map((block, i) => {
        if (block.type === 'heading') {
          return <h4 key={i} className="text-sm font-semibold m-0">{inline(block.text, i)}</h4>;
        }
        if (block.type === 'ul' || block.type === 'ol') {
          const List = block.type;
          return (
            <List key={i} className={`m-0 pl-5 space-y-1 ${block.type === 'ul' ? 'list-disc' : 'list-decimal'}`}>
              {block.items.map((item, j) => <li key={j}>{inline(item, `${i}-${j}`)}</li>)}
            </List>
          );
        }
        return <p key={i} className="m-0">{inline(block.lines.join(' '), i)}</p>;
      })}
    </div>
  );
}

// Versão de uma linha, sem marcadores, para prévias (lista da revisão, relatório).
export function summaryPreview(text) {
  if (!text) return '';
  return toBlocks(text)
    .flatMap((b) => (b.type === 'p' ? b.lines : b.type === 'heading' ? [b.text] : b.items))
    .map((t) => t.replace(/\*\*(.+?)\*\*/g, '$1'))
    .join(' ');
}
