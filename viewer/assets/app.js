/* Plain scripts and relative media paths intentionally support file:// opening. */
'use strict';
(() => {
  const data = window.SUPPLEMENT;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  if (!data || !data.scenes.length) {
    $('status').textContent = 'The scene list is missing. Keep video.html and its assets folder together.';
    return;
  }
  const state = {dataset:'t2v', scene:'t2v-01', budget:2, rate:2, sync:true};
  let player = null;
  const subset = () => data.scenes.filter(s => s.dataset === state.dataset);
  const currentScene = () => data.scenes.find(s => s.id === state.scene);
  const frameTime = (entry, kind) => entry[`${kind}Frame`] / entry.fps;

  class Playback {
    constructor(entries, cards) {
      this.entries = entries;
      this.cards = cards;
      this.videos = cards.map(c => c.querySelector('video'));
      this.pending = [null, null, null];
      this.destroyed = false;
      this.scrubbing = false;
      this.raf = 0;
      this.lastSync = 0;
      this.abort = new AbortController();
      const signal = this.abort.signal;
      this.videos.forEach((v, i) => {
        v.muted = true;
        v.playbackRate = state.rate;
        for (const event of ['loadedmetadata','loadeddata','canplay','seeked','timeupdate','play','pause']) {
          v.addEventListener(event, () => {
            if (event === 'loadedmetadata' || event === 'seeked') this.applyPending(i);
            this.update();
            this.animate();
          }, {signal});
        }
        v.addEventListener('ended', () => {
          if (state.sync) this.pauseAll();
          this.update();
        }, {signal});
        v.addEventListener('error', () => {
          if (!this.destroyed) $('status').textContent = `Could not play ${entries[i].label}. Open the page after extracting the complete folder.`;
        }, {signal});
        v.addEventListener('click', () => this.toggle(i), {signal});
        cards[i].querySelector('.local-play').addEventListener('click', () => this.toggle(i), {signal});
        cards[i].querySelector('.video-expand').addEventListener('click', () => {
          const wrap = cards[i].querySelector('.video-wrap');
          if (document.fullscreenElement) document.exitFullscreen();
          else if (wrap.requestFullscreen) wrap.requestFullscreen().catch(() => {});
        }, {signal});
        this.bindSlider(cards[i].querySelector('input[type=range]'), i, signal);
      });
      this.bindSlider($('master-seek'), null, signal);
      $('master-seek').max = String(this.lastTime(0));
      $('master-seek').step = String(1 / entries[0].fps);
      this.update();
    }
    lastTime(i) { return (this.entries[i].frames - 1) / this.entries[i].fps; }
    indices(i = null) { return i === null || state.sync ? [0,1,2] : [i]; }
    isPlaying() { return this.videos.some(v => !v.paused && !v.ended); }
    pauseAll() { this.videos.forEach(v => v.pause()); this.update(); }
    async playIndices(indices) {
      if (this.destroyed) return;
      this.videos.forEach(v => { v.playbackRate = state.rate; });
      const results = await Promise.allSettled(indices.map(i => this.videos[i].play()));
      if (this.destroyed) return;
      if (results.some(r => r.status === 'rejected' && r.reason?.name !== 'AbortError')) {
        this.pauseAll();
        $('status').textContent = 'Playback was blocked. Press Play all again to start the videos.';
      }
      this.animate();
      this.update();
    }
    async playAll() {
      if (this.destroyed) return;
      const target = this.videos[0].ended || this.videos[0].currentTime >= this.lastTime(0) - .02
        ? 0 : this.videos[0].currentTime;
      if (state.sync) {
        this.pauseAll();
        this.seek(target);
        if (!await this.settled()) return;
      } else {
        this.videos.forEach((v,i) => { if (v.ended) this.queueSeek(i, 0); });
        if (!await this.settled()) return;
      }
      if (!this.destroyed) await this.playIndices([0,1,2]);
    }
    toggle(i = null) {
      $('status').textContent = '';
      if (i === null || state.sync) {
        if (this.isPlaying()) this.pauseAll(); else this.playAll();
      } else {
        const v = this.videos[i];
        if (!v.paused) v.pause();
        else {
          if (v.ended) this.queueSeek(i, 0);
          this.playIndices([i]);
        }
      }
    }
    queueSeek(i, seconds) {
      const fps = this.entries[i].fps;
      this.pending[i] = Math.max(0, Math.min(this.lastTime(i), Math.round(seconds * fps) / fps));
      this.applyPending(i);
    }
    applyPending(i) {
      const v = this.videos[i];
      if (this.destroyed || v.readyState < 1 || v.seeking || this.pending[i] === null) return;
      const target = this.pending[i];
      this.pending[i] = null;
      if (Math.abs(v.currentTime - target) > .001) v.currentTime = target;
    }
    seek(seconds, i = null) {
      this.indices(i).forEach(j => this.queueSeek(j, seconds));
      this.update();
    }
    async settled(indices = [0,1,2]) {
      const start = performance.now();
      while (!this.destroyed && indices.some(i => this.videos[i].readyState < 2 ||
          this.videos[i].seeking || this.pending[i] !== null)) {
        indices.forEach(i => this.applyPending(i));
        if (performance.now() - start > 8000) {
          $('status').textContent = 'The videos are still loading. Please try playback again in a moment.';
          return false;
        }
        await new Promise(r => setTimeout(r, 12));
      }
      return !this.destroyed;
    }
    bindSlider(slider, index, signal) {
      let active = false;
      let resume = [];
      const begin = () => {
        if (active) return;
        active = true;
        this.scrubbing = true;
        resume = this.indices(index).filter(i => !this.videos[i].paused && !this.videos[i].ended);
        this.indices(index).forEach(i => this.videos[i].pause());
      };
      const end = async () => {
        if (!active) return;
        active = false;
        const ready = await this.settled(this.indices(index));
        this.scrubbing = false;
        if (ready && resume.length) this.playIndices(resume);
        this.update();
      };
      slider.addEventListener('pointerdown', begin, {signal});
      slider.addEventListener('input', () => { begin(); this.seek(Number(slider.value), index); }, {signal});
      slider.addEventListener('change', end, {signal});
      slider.addEventListener('pointerup', end, {signal});
      slider.addEventListener('pointercancel', end, {signal});
      slider.addEventListener('blur', end, {signal});
    }
    update() {
      if (this.destroyed) return;
      this.videos.forEach((v,i) => {
        const c = this.cards[i];
        const current = this.pending[i] ?? v.currentTime;
        const range = c.querySelector('input[type=range]');
        range.value = String(current);
        c.querySelector('output').textContent = current.toFixed(2);
        c.querySelector('.local-play').textContent = v.paused || v.ended ? '▶' : 'Ⅱ';
        c.querySelector('.local-play').setAttribute('aria-label', `${v.paused ? 'Play' : 'Pause'} ${this.entries[i].label}`);
        c.querySelector('.video-state').textContent = v.readyState < 2 ? 'Loading…' : '';
      });
      const t = this.pending[0] ?? this.videos[0].currentTime;
      $('master-seek').value = String(t);
      $('master-time').textContent = `${t.toFixed(2)} / ${this.entries[0].duration.toFixed(2)} s`;
      const playing = this.isPlaying();
      $('play-all').querySelector('.play-label').textContent = playing ? 'Pause all' : 'Play all';
      $('play-all').querySelector('.play-icon').textContent = playing ? 'Ⅱ' : '▶';
      $('play-all').setAttribute('aria-label', playing ? 'Pause all videos' : 'Play all videos');
    }
    animate() {
      if (this.destroyed || this.raf || !this.isPlaying()) return;
      this.raf = requestAnimationFrame(now => {
        this.raf = 0;
        if (this.destroyed) return;
        const master = this.videos[0];
        if (state.sync && !this.scrubbing && !master.paused && !master.seeking && now - this.lastSync > 100) {
          this.lastSync = now;
          for (let i = 1; i < 3; i++) {
            const v = this.videos[i];
            if (!v.paused && !v.seeking && v.readyState >= 2 && Math.abs(v.currentTime - master.currentTime) > .085) {
              this.queueSeek(i, master.currentTime);
            }
          }
        }
        this.update();
        this.animate();
      });
    }
    destroy() {
      this.destroyed = true;
      this.abort.abort();
      cancelAnimationFrame(this.raf);
      this.videos.forEach(v => { v.pause(); v.removeAttribute('src'); v.load(); });
    }
  }

  function openPair(entry, scene) {
    player.pauseAll();
    $('pair-dialog-title').textContent = `${scene.title} · ${entry.label} · CLIP ${entry.clipScore.toFixed(3)}`;
    $('enlarged-pair').innerHTML = ['departure','revisit'].map(kind =>
      `<figure><figcaption>${kind === 'departure' ? 'Departure' : 'Revisit'} · ${frameTime(entry,kind).toFixed(2)} s · frame ${entry[`${kind}Frame`]}</figcaption><img src="${esc(entry[`${kind}Image`])}" alt="${esc(scene.title)} — ${esc(entry.label)} ${kind}"></figure>`).join('');
    $('pair-dialog').showModal();
  }

  function buildCard(entry, scene) {
    const card = document.createElement('article');
    card.className = 'method-card';
    card.dataset.method = entry.method;
    const aspect = `${entry.width} / ${entry.height}`;
    card.innerHTML = `<div class="method-heading"><span class="method-name">${esc(entry.label)}</span><span class="score" title="CLIP similarity of this method's evaluation frame pair">CLIP ↑<strong>${entry.clipScore.toFixed(3)}</strong></span></div>
      <div class="video-wrap" style="aspect-ratio:${aspect}"><video src="${esc(entry.video)}" poster="${esc(entry.departureImage)}" preload="auto" muted playsinline aria-label="${esc(entry.label)} rollout for ${esc(scene.title)}"></video><span class="video-state">Loading…</span><button type="button" class="video-expand" aria-label="Enlarge ${esc(entry.label)} video" title="Full screen">⛶</button></div>
      <div class="local-transport"><button type="button" class="local-play" aria-label="Play ${esc(entry.label)}">▶</button><input type="range" min="0" max="${(entry.frames-1)/entry.fps}" step="${1/entry.fps}" value="0" aria-label="Seek ${esc(entry.label)} video"><output>0.00</output></div>
      <div class="pair-grid">${['departure','revisit'].map(kind => `<button type="button" class="pair-button" data-kind="${kind}" aria-label="Enlarge ${esc(entry.label)} departure and revisit frames"><span class="frame-label"><span>${kind === 'departure' ? 'Departure' : 'Revisit'}</span><time>${frameTime(entry,kind).toFixed(2)} s</time></span><img src="${esc(entry[`${kind}Image`])}" alt="${esc(entry.label)} ${kind} frame" style="aspect-ratio:${aspect}" decoding="async"></button>`).join('')}</div>`;
    card.querySelectorAll('.pair-button').forEach(b => b.addEventListener('click', () => openPair(entry, scene)));
    return card;
  }

  function setHash() {
    const p = new URLSearchParams({task:state.dataset, scene:state.scene, budget:String(state.budget)});
    // replaceState works with local files; no fetch, server or external resource.
    try { history.replaceState(null, '', `#${p}`); } catch (_) { /* the page still works in restricted viewers */ }
  }

  function render({time = 0} = {}) {
    if (player) player.destroy();
    $('status').textContent = '';
    $('prompt-details').open = false;
    if ($('pair-dialog').open) $('pair-dialog').close();
    const scenes = subset();
    if (!scenes.some(s => s.id === state.scene)) state.scene = scenes[0].id;
    const scene = currentScene();
    const index = scenes.findIndex(s => s.id === scene.id);
    document.querySelectorAll('[data-dataset]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.dataset === state.dataset)));
    $('budget').value = String(state.budget);
    $('scene-title').textContent = scene.title;
    $('scene-number').textContent = String(scene.number).padStart(2,'0');
    $('scene-type').textContent = state.dataset === 't2v' ? scene.category : scene.environment === 'indoor' ? 'Indoor' : 'Outdoor';
    $('trajectory').textContent = scene.trajectoryLabel;
    $('scene-select').innerHTML = scenes.map(s => `<option value="${esc(s.id)}">${String(s.number).padStart(2,'0')} · ${esc(s.title)}</option>`).join('');
    $('scene-select').value = scene.id;
    $('page-count').textContent = `${index+1} / ${scenes.length}`;
    $('previous').disabled = index === 0;
    $('next').disabled = index === scenes.length-1;
    $('prompt-content').replaceChildren(...scene.prompts.map((prompt,i) => {
      const p = document.createElement('p');
      p.textContent = state.dataset === 't2v' ? `${i+1}. ${prompt}` : prompt;
      return p;
    }));
    const entries = ['mc', 'moc', 'base'].map(method =>
      scene.budgets[String(state.budget)].find(entry => entry.method === method));
    const cards = entries.map(e => buildCard(e,scene));
    $('comparison').replaceChildren(...cards);
    player = new Playback(entries, cards);
    if (time > 0) player.seek(time);
    document.title = `${scene.title} · MosaiChunk supplementary videos`;
    setHash();
  }

  function turnPage(delta) {
    const scenes = subset();
    const index = scenes.findIndex(s => s.id === state.scene);
    const next = scenes[index+delta];
    if (next) { state.scene = next.id; render(); }
  }

  function readHash() {
    const p = new URLSearchParams(location.hash.slice(1));
    state.dataset = p.get('task') === 'i2v' ? 'i2v' : 't2v';
    state.budget = p.get('budget') === '1' ? 1 : 2;
    state.scene = p.get('scene') || `${state.dataset}-01`;
  }

  document.querySelectorAll('[data-dataset]').forEach(b => b.addEventListener('click', () => {
    if (state.dataset !== b.dataset.dataset) {
      state.dataset = b.dataset.dataset; state.scene = `${state.dataset}-01`; render();
    }
  }));
  $('budget').addEventListener('change', () => {
    const time = player.videos[0].currentTime;
    state.budget = Number($('budget').value); render({time});
  });
  $('scene-select').addEventListener('change', () => { state.scene = $('scene-select').value; render(); });
  $('previous').addEventListener('click', () => turnPage(-1));
  $('next').addEventListener('click', () => turnPage(1));
  $('play-all').addEventListener('click', () => player.toggle());
  $('restart').addEventListener('click', () => { player.pauseAll(); player.seek(0); });
  $('sync').addEventListener('change', async () => {
    state.sync = $('sync').checked;
    if (state.sync) {
      const resume = player.isPlaying();
      const time = player.videos[0].currentTime;
      player.pauseAll(); player.seek(time);
      if (resume) { await player.settled(); player.playAll(); }
    }
  });
  document.querySelectorAll('[data-rate]').forEach(b => b.addEventListener('click', () => {
    state.rate = Number(b.dataset.rate);
    document.querySelectorAll('[data-rate]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    player.videos.forEach(v => { v.playbackRate = state.rate; });
  }));
  $('close-pair').addEventListener('click', () => $('pair-dialog').close());
  $('pair-dialog').addEventListener('click', e => { if (e.target === $('pair-dialog')) $('pair-dialog').close(); });
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing ||
        e.target.closest('input,select,textarea,[contenteditable="true"],dialog') || $('pair-dialog').open) return;
    if (e.code === 'KeyA' || e.code === 'KeyD') {
      e.preventDefault(); if (!e.repeat) turnPage(e.code === 'KeyA' ? -1 : 1);
    } else if (e.code === 'Space') {
      // Space still controls playback after a navigation button was clicked.
      e.preventDefault(); if (!e.repeat) player.toggle();
    }
    else if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      e.preventDefault();
      const amount = (e.shiftKey ? 1/player.entries[0].fps : .5) * (e.code === 'ArrowLeft' ? -1 : 1);
      player.pauseAll(); player.seek(player.videos[0].currentTime + amount);
    } else if (e.code === 'PageDown' || e.code === 'PageUp') {
      e.preventDefault(); turnPage(e.code === 'PageDown' ? 1 : -1);
    }
  });
  window.addEventListener('hashchange', () => { readHash(); render(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) player.pauseAll(); });
  window.addEventListener('pagehide', () => player?.pauseAll());
  readHash();
  render();
})();
