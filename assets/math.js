/* Typeset the manuscript's variables and equations with locally hosted KaTeX. */
(() => {
  'use strict';
  const tokens = {
    'architecture-encode': [['d(s)', 'd(s)'], ['k', 'k'], ['s', 's']],
    'architecture-score': [['cₜ₋₁', 'c_{t-1}'], ['cₜ', 'c_t'], ['Q', '\\mathcal{Q}'], ['H', '\\mathcal{H}']],
    'architecture-compose': [['N', 'N'], ['cₜ', 'c_t']],
    'architecture-caption': [['N', 'N']],
    'teaser-stage-3': [['cₜ', 'c_t']],
    'architecture-stage-2': [['N', 'N'], ['cₜ', 'c_t']],
    'results-budget': [
      ['‖F_c‖ = 1', '\\lVert\\mathcal{F}_c\\rVert = 1'],
      ['‖F_c‖', '\\lVert\\mathcal{F}_c\\rVert'],
      ['F_c', '\\mathcal{F}_c'], ['c', 'c']
    ]
  };
  const escapeRegex = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const options = {throwOnError: true, strict: 'error', trust: false, output: 'htmlAndMathml'};
  // sec/3_method.tex, Eq. score; sec/appendix/A_method.tex, Eq. supp_compose.
  const equations = {
    score: String.raw`\operatorname{score}(h)=\max_{q\in\mathcal{Q}}\cos\bigl(d(q),d(h)\bigr)`,
    compose: String.raw`\begin{aligned}K_{\mathrm{far}}&=\operatorname{Concat}(K_1,\ldots,K_N),\\V_{\mathrm{far}}&=\operatorname{Concat}(w_1V_1,\ldots,w_NV_N).\end{aligned}`
  };

  function markVariables(block) {
    const pairs = tokens[block.dataset.paperCopy];
    if (!pairs) return;
    const expressions = new Map(pairs);
    const alternatives = [...expressions.keys()].sort((a,b) => b.length-a.length).map(escapeRegex).join('|');
    const pattern = new RegExp(`(?<![\\w’'])(${alternatives})(?![\\w’'])`, 'g');
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
      acceptNode: node => node.parentElement.closest('.math-inline') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const matches = [...node.data.matchAll(pattern)];
      if (!matches.length) continue;
      const fragment = document.createDocumentFragment();
      let offset = 0;
      for (const match of matches) {
        fragment.append(document.createTextNode(node.data.slice(offset, match.index)));
        const span = document.createElement('span');
        span.className = 'math-inline';
        span.dataset.tex = expressions.get(match[0]);
        span.dataset.mathText = match[0];
        span.textContent = match[0];
        fragment.append(span);
        offset = match.index + match[0].length;
      }
      fragment.append(document.createTextNode(node.data.slice(offset)));
      node.replaceWith(fragment);
    }
  }

  function render(root) {
    const blocks = [...root.querySelectorAll('[data-paper-copy]')];
    if (root.matches?.('[data-paper-copy]')) blocks.unshift(root);
    blocks.forEach(markVariables);
    for (const span of root.querySelectorAll('.math-inline[data-tex]:not([data-rendered])')) {
      katex.render(span.dataset.tex, span, options);
      span.dataset.rendered = 'true';
    }
    for (const equation of root.querySelectorAll('[data-equation]:not([data-rendered])')) {
      katex.render(equations[equation.dataset.equation], equation, {...options, displayMode: true});
      equation.dataset.rendered = 'true';
    }
  }

  window.PAPER_MATH = {render};
})();
