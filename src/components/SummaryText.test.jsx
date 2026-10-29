import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import SummaryText, { summaryPreview } from './SummaryText';

afterEach(cleanup);

const html = (md) => render(<SummaryText text={md} />).container;

describe('SummaryText — resumo em Markdown (#5 CA13/CA14, V04)', () => {
  it('CA13: negrito vira <strong>, "- item" vira <ul><li>, "#" vira título; sem marcadores literais', () => {
    const c = html('# Fotossíntese\n\nA taxa depende de **luz** e água.\n\n- Clorofila absorve luz\n- Ocorre nos **cloroplastos**');
    expect(c.querySelector('h4').textContent).toBe('Fotossíntese');
    expect([...c.querySelectorAll('strong')].map((s) => s.textContent)).toEqual(['luz', 'cloroplastos']);
    expect([...c.querySelectorAll('ul > li')].map((li) => li.textContent)).toEqual(['Clorofila absorve luz', 'Ocorre nos cloroplastos']);
    expect(c.textContent).not.toMatch(/\*\*|^- |#/m);
  });

  it('CA13: "1." vira lista numerada e "* item" também é lista', () => {
    const c = html('1. primeiro\n2. segundo\n\n* um\n* dois');
    expect([...c.querySelectorAll('ol > li')].map((li) => li.textContent)).toEqual(['primeiro', 'segundo']);
    expect(c.querySelectorAll('ul > li')).toHaveLength(2);
  });

  it('CA13: resumo sem Markdown continua como parágrafo (linhas juntas no mesmo parágrafo)', () => {
    const c = html('Nenhum conteúdo falado nesse período.');
    expect(c.querySelectorAll('p')).toHaveLength(1);
    expect(c.querySelector('p').textContent).toBe('Nenhum conteúdo falado nesse período.');
    const two = html('linha um\nlinha dois\n\noutro parágrafo');
    expect(two.querySelectorAll('p')).toHaveLength(2);
  });

  it('CA14 (erro): HTML no resumo aparece como texto literal, sem criar elementos', () => {
    const c = html('Veja <b>isto</b> e <img src=x onerror="alert(1)">');
    expect(c.querySelector('b')).toBeNull();
    expect(c.querySelector('img')).toBeNull();
    expect(c.textContent).toContain('<b>isto</b>');
    expect(c.textContent).toContain('<img src=x onerror="alert(1)">');
  });

  it('"**" sem par fica literal; texto vazio não renderiza nada', () => {
    expect(html('2 ** 3').textContent).toBe('2 ** 3');
    expect(html('').textContent).toBe('');
  });

  it('summaryPreview tira os marcadores para as prévias de uma linha', () => {
    expect(summaryPreview('# Título\n- **Luz** e água\n1. passo')).toBe('Título Luz e água passo');
  });
});
