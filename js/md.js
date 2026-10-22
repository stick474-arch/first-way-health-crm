/* Aetherium — a small, safe Markdown renderer for documents: headings, paragraphs, lists, checklists
   (clickable), tables, quotes, rules, **bold**, *italic*, `code` and https links. Text is escaped first. */
const Md = (() => {
  const esc = U.esc;

  function inline(s) {
    let h = esc(s);
    h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
    h = h.replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    h = h.replace(/(^|[\s(])(https:\/\/[^\s<]+[^\s<.,;:!?)])/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');
    h = h.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    h = h.replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=$|[\s).,;:!?])/g, '$1<i>$2</i>');
    h = h.replace(/(^|[\s(])_([^_\s][^_]*?)_(?=$|[\s).,;:!?])/g, '$1<i>$2</i>');
    return h;
  }

  const cells = (line) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

  // checkable: render "- [ ]" items as checkboxes carrying their line number
  function render(text, { checkable = false, readOnly = false } = {}) {
    const lines = String(text || '').replace(/\r/g, '').split('\n');
    const out = [];
    let i = 0;
    let list = null; // 'ul' | 'ol'
    const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
    while (i < lines.length) {
      const ln = lines[i];
      const t = ln.trim();
      if (!t) { closeList(); i++; continue; }
      let m;
      if ((m = t.match(/^(#{1,4})\s+(.*)$/))) { closeList(); const lvl = Math.min(4, m[1].length + 1); out.push(`<h${lvl}>${inline(m[2])}</h${lvl}>`); i++; continue; }
      if (/^(-{3,}|\*{3,})$/.test(t)) { closeList(); out.push('<hr>'); i++; continue; }
      if (t.startsWith('|')) {
        closeList();
        const rows = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(lines[i]); i++; }
        const hasHead = rows.length > 1 && /^\|?\s*:?-{2,}/.test(rows[1].trim());
        const head = hasHead ? cells(rows[0]) : null;
        const body = (hasHead ? rows.slice(2) : rows).map(cells);
        out.push(`<div class="table-wrap"><table class="table md-table">${head ? `<thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead>` : ''}<tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
        continue;
      }
      if (t.startsWith('>')) {
        closeList();
        const q = [];
        while (i < lines.length && lines[i].trim().startsWith('>')) { q.push(inline(lines[i].trim().replace(/^>\s?/, ''))); i++; }
        out.push(`<blockquote>${q.join('<br>')}</blockquote>`);
        continue;
      }
      if ((m = t.match(/^(?:[-*•]\s+)?\[( |x|X)\]\s+(.*)$/))) {
        if (list !== 'ul') { closeList(); out.push('<ul class="md-checks">'); list = 'ul'; }
        const done = m[1].toLowerCase() === 'x';
        out.push(`<li class="${done ? 'done' : ''}"><label><input type="checkbox" ${done ? 'checked' : ''} ${checkable ? `data-md-line="${i}"` : ''} ${!checkable || readOnly ? 'disabled' : ''}><span>${inline(m[2])}</span></label></li>`);
        i++; continue;
      }
      if ((m = t.match(/^[-*•]\s+(.*)$/))) {
        if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; }
        out.push(`<li>${inline(m[1])}</li>`);
        i++; continue;
      }
      if ((m = t.match(/^(\d+)[.)]\s+(.*)$/))) {
        if (list !== 'ol') { closeList(); out.push(`<ol start="${m[1]}">`); list = 'ol'; }
        out.push(`<li>${inline(m[2])}</li>`);
        i++; continue;
      }
      closeList();
      const para = [];
      while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|\||>|[-*•]\s|\d+[.)]\s|\[[ xX]\]\s|-{3,}$)/.test(lines[i].trim())) { para.push(inline(lines[i].trim())); i++; }
      if (!para.length) { para.push(inline(t)); i++; }
      out.push(`<p>${para.join('<br>')}</p>`);
    }
    closeList();
    return `<div class="md">${out.join('')}</div>`;
  }

  // Flip the checkbox on a given line of the source text
  function toggleLine(text, n) {
    const lines = String(text || '').split('\n');
    if (lines[n] === undefined) return text;
    lines[n] = lines[n].replace(/\[( |x|X)\]/, (m, c) => (c.trim() ? '[ ]' : '[x]'));
    return lines.join('\n');
  }

  // Progress of a checklist: done / total
  function progress(text) {
    const all = String(text || '').match(/^\s*(?:[-*•]\s+)?\[( |x|X)\]\s+/gm) || [];
    return { total: all.length, done: all.filter((x) => /\[[xX]\]/.test(x)).length };
  }

  return { render, inline, toggleLine, progress };
})();
