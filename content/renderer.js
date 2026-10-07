/* Media engine adapted from marwanrabah/portfolio (functional reference).
   Salmaa-specific presentation, navigation, and content are independent. */
const CONTENT = window.SITE_CONTENT;
const SETTINGS = {
  autoplay: true,
  rememberSound: true,
  pauseOffscreen: true,
  viewerEnabled: true,
  ...(CONTENT.playback || {}),
};

const sectionsRoot = document.getElementById('sectionsRoot');
const viewer = document.getElementById('mediaViewer');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
const saveData = Boolean(connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || ''));
const mediaRecords = [];
const sectionRecords = new Map();
const soundStorageKey = 'salmaa:sound-preference';
// Storage can be unavailable in private browsing or embedded contexts.
const storage = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* Keep session preference. */ } },
};
let soundPreference = SETTINGS.rememberSound
  ? (storage.get(soundStorageKey) || 'muted')
  : 'muted';
let activeRecord = null;
let viewerRecord = null;
let viewerIndex = 0;
let viewerHistoryState = false;
let viewerMedia = null;
let viewerPlay = null;
let viewerSound = null;
let viewerTitle = null;
let viewerCounter = null;
let viewerMuted = false;
let viewerOpener = null;
let viewerScrollY = 0;
let autoplayTimer = null;
const visibleRecords = new Map();

const emit = (name, detail = {}) => {
  window.dispatchEvent(new CustomEvent(`portfolio:${name}`, { detail }));
};

const icon = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="8,5 19,12 8,19"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>',
  mute: '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>',
  sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>',
  expand: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M21 16v5h-5"/></svg>',
};

function localPosterPath(src) {
  const filename = src.split('/').pop().replace(/\.[^.]+$/, '');
  return `media/posters/${filename}.jpg`;
}

function shouldAnimate() { return !prefersReducedMotion.matches; }

function setSoundPreference(value) {
  soundPreference = value;
  if (SETTINGS.rememberSound) storage.set(soundStorageKey, value);
  document.documentElement.dataset.sound = value;
  emit('sound-change', { value });
}

function updateSoundButton(button, muted) {
  if (!button) return;
  button.innerHTML = muted ? icon.mute : icon.sound;
  button.setAttribute('aria-label', muted ? 'Turn sound on' : 'Turn sound off');
  button.setAttribute('aria-pressed', String(!muted));
  button.dataset.label = muted ? 'Muted' : 'Sound on';
  button.title = muted ? 'Turn sound on' : 'Turn sound off';
}

function showPlaybackFeedback(card, playing) {
  const feedback = card?.querySelector('.play-feedback');
  if (!feedback) return;
  feedback.innerHTML = playing ? icon.pause : icon.play;
  feedback.classList.remove('is-visible');
  void feedback.offsetWidth;
  feedback.classList.add('is-visible');
  clearTimeout(feedback._timer);
  feedback._timer = window.setTimeout(() => feedback.classList.remove('is-visible'), 720);
}

function safePlay(media) {
  try { return Promise.resolve(media.play()).then(() => true, () => false); }
  catch { return Promise.resolve(false); }
}

function getPoster(item) {
  if (item.poster) return item.poster;
  if (item.src) return localPosterPath(item.src);
  if (item.embed === 'youtube') return `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`;
  if (item.embed === 'vimeo') return `https://vumbnail.com/${item.id}.jpg`;
  return '';
}

function createButton(className, label, content) {
  const button = document.createElement('button');
  button.className = className;
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.innerHTML = content;
  return button;
}

function setLoading(card, loading) {
  card.classList.toggle('is-loading', loading);
  card.setAttribute('aria-busy', String(loading));
}

function stopRecord(record, reset = false, feedback = false) {
  if (!record) return;
  if (feedback) record.userPaused = true;
  record.stop?.(reset);
  if (feedback) showPlaybackFeedback(record.card, false);
  if (record === activeRecord) {
    activeRecord = null;
    emit('media-stop', { title: record.item.title, section: record.section.id });
  }
}

function stopOtherMedia(record) {
  mediaRecords.forEach(other => {
    if (other !== record && other.isPlaying?.()) stopRecord(other);
  });
}

function activateRecord(record, { autoplay = false, feedback = false } = {}) {
  if (!record) return;
  if (viewer?.open || document.hidden) return;
  record.autoStarted = autoplay;
  if (!autoplay) record.userPaused = false;
  stopOtherMedia(record);
  activeRecord = record;
  record.load?.();
  const muted = autoplay ? true : soundPreference !== 'unmuted';
  record.setMuted?.(muted);
  record.play?.({ muted, feedback });
  emit('media-start', { title: record.item.title, section: record.section.id, autoplay });
}

function toggleRecordSound(record) {
  if (!record) return;
  stopOtherMedia(record);
  activeRecord = record;
  record.load?.();
  const nextMuted = !record.isMuted();
  record.setMuted(nextMuted);
  setSoundPreference(nextMuted ? 'muted' : 'unmuted');
  record.userPaused = false;
  record.autoStarted = false;
  if (!record.isPlaying()) record.play({ muted: nextMuted });
}

function createLocalRecord(item, section, isReel, track) {
  const card = document.createElement('article');
  card.className = `video-card${isReel ? ' reel-card' : ''}`;
  card.tabIndex = 0;
  card.setAttribute('aria-label', item.title || 'Video');
  const video = document.createElement('video');
  video.poster = getPoster(item);
  video.preload = 'none';
  video.playsInline = true;
  video.loop = item.loop !== false;
  video.muted = true;
  if (item.fit === 'contain') video.classList.add('contain-video');
  const controls = document.createElement('div');
  controls.className = 'media-controls';
  const playButton = createButton('media-play', `Play ${item.title || 'video'}`, icon.play);
  const soundButton = createButton('media-sound', 'Turn sound on', icon.mute);
  const expandButton = createButton('media-expand', 'Open in focused viewer', icon.expand);
  const progress = document.createElement('input');
  progress.className = 'media-progress';
  progress.type = 'range';
  progress.min = '0';
  progress.max = '100';
  progress.step = '0.1';
  progress.value = '0';
  progress.disabled = true;
  progress.setAttribute('aria-label', `Seek ${item.title || 'video'}`);
  progress.title = 'Seek video';
  updateSoundButton(soundButton, true);
  const feedback = document.createElement('div');
  feedback.className = 'play-feedback';
  feedback.setAttribute('aria-hidden', 'true');
  expandButton.dataset.label = 'Open';
  expandButton.title = 'Open media viewer';
  expandButton.hidden = !SETTINGS.viewerEnabled;
  controls.append(playButton, soundButton, expandButton);
  const error = document.createElement('div');
  error.className = 'media-error';
  error.textContent = 'Media unavailable · tap to retry';
  error.hidden = true;
  card.append(video, progress, feedback, controls, error);
  track.appendChild(card);
  let playToken = 0;

  const record = {
    item, section, card, video, soundButton, expandButton, progress,
    load() {
      if (!video.src || video.error) {
        video.src = item.src;
        video.preload = 'metadata';
        video.load();
      }
      error.hidden = true;
    },
    play({ muted = true, feedback: showFeedback = false } = {}) {
      const request = ++playToken;
      video.muted = muted;
      setLoading(card, true);
      if (showFeedback) showPlaybackFeedback(card, true);
      safePlay(video).then(ok => {
        if (request !== playToken) return;
        if (!ok) {
          setLoading(card, false);
          card.classList.remove('is-playing');
        }
      });
    },
    stop(reset = false) {
      playToken += 1;
      video.pause();
      setLoading(card, false);
      if (reset) video.currentTime = 0;
      card.classList.remove('is-playing');
    },
    setMuted(muted) { video.muted = muted; updateSoundButton(soundButton, muted); },
    isMuted: () => video.muted,
    isPlaying: () => !video.paused || card.classList.contains('is-loading'),
  };

  soundButton.addEventListener('click', event => { event.stopPropagation(); toggleRecordSound(record); });
  playButton.addEventListener('click', event => {
    event.stopPropagation();
    if (record.isPlaying()) stopRecord(record, false, true);
    else activateRecord(record, { feedback: true });
  });
  expandButton.addEventListener('click', event => { event.stopPropagation(); openViewer(record, null, event.currentTarget); });
  progress.addEventListener('pointerdown', event => event.stopPropagation());
  progress.addEventListener('click', event => event.stopPropagation());
  progress.addEventListener('input', event => {
    event.stopPropagation();
    if (Number.isFinite(video.duration) && video.duration > 0) {
      video.currentTime = (Number(event.target.value) / 100) * video.duration;
    }
  });
  card.addEventListener('click', () => {
    if (record.isPlaying()) stopRecord(record, false, true);
    else activateRecord(record, { feedback: true });
  });
  card.addEventListener('keydown', event => {
    if (event.target !== card) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (record.isPlaying()) stopRecord(record, false, true);
      else activateRecord(record, { feedback: true });
    }
  });
  video.addEventListener('play', () => {
    if (viewer?.open || document.hidden) { record.stop(); return; }
    stopOtherMedia(record);
    activeRecord = record;
    card.classList.add('is-playing');
    playButton.innerHTML = icon.pause;
    playButton.setAttribute('aria-label', `Pause ${item.title || 'video'}`);
  });
  video.addEventListener('pause', () => {
    card.classList.remove('is-playing');
    playButton.innerHTML = icon.play;
    playButton.setAttribute('aria-label', `Play ${item.title || 'video'}`);
  });
  video.addEventListener('volumechange', () => updateSoundButton(soundButton, video.muted));
  video.addEventListener('playing', () => setLoading(card, false));
  video.addEventListener('waiting', () => setLoading(card, true));
  video.addEventListener('canplay', () => { if (!video.paused) setLoading(card, false); });
  video.addEventListener('loadedmetadata', () => { progress.disabled = !Number.isFinite(video.duration); });
  video.addEventListener('timeupdate', () => {
    if (Number.isFinite(video.duration) && video.duration > 0 && document.activeElement !== progress) {
      progress.value = String((video.currentTime / video.duration) * 100);
    }
  });
  video.addEventListener('ended', () => stopRecord(record, true));
  video.addEventListener('error', () => { stopRecord(record); record.userPaused = true; error.hidden = false; });
  mediaRecords.push(record);
  return record;
}

function createRemoteRecord(item, section, isReel, track) {
  const card = document.createElement('article');
  card.className = `video-card${isReel ? ' reel-card' : ''}`;
  card.tabIndex = 0;
  card.setAttribute('aria-label', item.title || 'Video');
  const poster = document.createElement('img');
  poster.className = 'video-poster';
  poster.src = getPoster(item);
  poster.alt = item.title || 'Video thumbnail';
  poster.loading = 'lazy';
  const controls = document.createElement('div');
  controls.className = 'media-controls';
  const playButton = createButton('media-play', `Play ${item.title || 'video'}`, icon.play);
  const expandButton = createButton('media-expand', 'Open in focused viewer', icon.expand);
  const feedback = document.createElement('div');
  feedback.className = 'play-feedback';
  feedback.setAttribute('aria-hidden', 'true');
  expandButton.dataset.label = 'Open';
  expandButton.title = 'Open media viewer';
  expandButton.hidden = !SETTINGS.viewerEnabled;
  controls.append(playButton, expandButton);
  const error = document.createElement('div');
  error.className = 'media-error';
  error.textContent = 'Media unavailable · tap to retry';
  error.hidden = true;
  card.append(poster, feedback, controls, error);
  track.appendChild(card);
  let iframe = null;
  let playing = false;
  let loadingTimer = null;
  const record = {
    item, section, card, expandButton,
    load() {},
    play({ muted = true } = {}) {
      if (iframe) return;
      error.hidden = true;
      setLoading(card, true);
      iframe = createEmbed(item, muted);
      const currentFrame = iframe;
      iframe.addEventListener('load', () => {
        if (iframe !== currentFrame) return;
        clearTimeout(loadingTimer);
        setLoading(card, false);
      }, { once: true });
      loadingTimer = window.setTimeout(() => {
        if (iframe !== currentFrame) return;
        setLoading(card, false);
        error.hidden = false;
      }, 12000);
      card.insertBefore(iframe, controls);
      poster.hidden = true;
      playing = true;
      card.classList.add('is-playing', 'has-embed');
      playButton.hidden = true;
    },
    stop() {
      clearTimeout(loadingTimer);
      setLoading(card, false);
      iframe?.remove();
      iframe = null;
      playing = false;
      poster.hidden = false;
      error.hidden = true;
      card.classList.remove('is-playing', 'has-embed');
      playButton.hidden = false;
    },
    isPlaying: () => playing || card.classList.contains('is-loading'),
  };
  playButton.addEventListener('click', event => { event.stopPropagation(); activateRecord(record); });
  expandButton.addEventListener('click', event => { event.stopPropagation(); openViewer(record, null, event.currentTarget); });
  card.addEventListener('click', () => { if (record.isPlaying()) stopRecord(record, false, true); else activateRecord(record, { feedback: true }); });
  card.addEventListener('keydown', event => { if (event.target === card && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); if (record.isPlaying()) stopRecord(record, false, true); else activateRecord(record, { feedback: true }); } });
  mediaRecords.push(record);
  return record;
}

// Provider controls preserve playback position when seeking, pausing or muting.
// They also remain usable when autoplay is denied or a provider rejects an embed.
function createEmbed(item, muted) {
  const iframe = document.createElement('iframe');
  iframe.allow = 'autoplay; fullscreen; picture-in-picture';
  iframe.allowFullscreen = true;
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  iframe.title = item.title || 'Video';
  iframe.src = item.embed === 'youtube'
    ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(item.id)}?autoplay=1&mute=${muted ? 1 : 0}&playsinline=1&rel=0`
    : `https://player.vimeo.com/video/${encodeURIComponent(item.id)}?autoplay=1&muted=${muted ? 1 : 0}&playsinline=1&dnt=1`;
  return iframe;
}

function renderMediaItem(item, section, isReel, track) {
  if (item.external) {
    const link = document.createElement('a');
    link.className = `video-card${isReel ? ' reel-card' : ''}`;
    link.href = item.external; link.target = '_blank'; link.rel = 'noopener';
    link.textContent = `${item.title || 'Open media'} ↗`;
    link.style.cssText = 'display:flex;align-items:center;justify-content:center;color:#aaa;text-decoration:none;font-size:11px;letter-spacing:.12em;text-transform:uppercase;';
    track.appendChild(link);
    return null;
  }
  if (item.src) return createLocalRecord(item, section, isReel, track);
  const embed = item.embed || (['vimeo', 'youtube'].includes(section.type) ? section.type : '');
  if (embed === 'youtube' || embed === 'vimeo') return createRemoteRecord({ ...item, embed }, section, isReel, track);
  return null;
}

function addDragToScroll(wrap) {
  let pointerId = null;
  let startX = 0;
  let startScroll = 0;
  let moved = false;
  wrap.addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch' || event.button !== 0 || event.target.closest('button, input, a, iframe')) return;
    pointerId = event.pointerId; startX = event.clientX; startScroll = wrap.scrollLeft; moved = false;
  });
  wrap.addEventListener('pointermove', event => {
    if (pointerId !== event.pointerId) return;
    const delta = event.clientX - startX;
    if (Math.abs(delta) > 6 && !moved) { moved = true; wrap.setPointerCapture?.(pointerId); }
    if (moved) { event.preventDefault(); wrap.classList.add('dragging'); wrap.scrollLeft = startScroll - delta; }
  });
  const release = event => {
    if (pointerId !== event.pointerId) return;
    if (wrap.hasPointerCapture?.(pointerId)) wrap.releasePointerCapture(pointerId);
    pointerId = null;
    wrap.classList.remove('dragging');
  };
  wrap.addEventListener('pointerup', release); wrap.addEventListener('pointercancel', release);
  wrap.addEventListener('pointerleave', event => { if (!moved) release(event); });
  wrap.addEventListener('click', event => {
    if (moved) { event.preventDefault(); event.stopPropagation(); moved = false; }
  }, true);
}

function scheduleAutoplay() {
  clearTimeout(autoplayTimer);
  if (document.hidden || viewer?.open || !SETTINGS.autoplay || saveData || prefersReducedMotion.matches) return;
  autoplayTimer = setTimeout(() => {
    if (document.hidden || viewer?.open) return;
    // A preview must never interrupt something the visitor explicitly played.
    if (activeRecord && !activeRecord.autoStarted && activeRecord.isPlaying()) return;
    const candidates = [...visibleRecords.entries()]
      .filter(([record, ratio]) => ratio >= 0.6 && record.item.src && !record.userPaused);
    candidates.sort((a, b) => {
      const distance = record => {
        const rect = record.card.getBoundingClientRect();
        return Math.hypot(rect.left + rect.width / 2 - innerWidth / 2, rect.top + rect.height / 2 - innerHeight / 2);
      };
      return distance(a[0]) - distance(b[0]);
    });
    const best = candidates[0]?.[0];
    if (best && activeRecord !== best) activateRecord(best, { autoplay: true });
  }, 180);
}

function setupRail(wrap, records) {
  addDragToScroll(wrap);
  const recordByCard = new Map(records.map(record => [record.card, record]));
  const observer = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const record = recordByCard.get(entry.target);
      if (!record) return;
      if (entry.isIntersecting) {
        visibleRecords.set(record, entry.intersectionRatio);
      } else {
        visibleRecords.delete(record);
        if (SETTINGS.pauseOffscreen && record.isPlaying()) stopRecord(record);
      }
    });
    scheduleAutoplay();
  }, { threshold: [0, 0.6, 0.85, 1] }) : null;
  records.forEach(record => observer?.observe(record.card));
}

function createShell(section) {
  const container = document.createElement('section');
  container.id = section.id;
  container.className = `portfolio-section layout-${section.layout || 'motion'}`;
  container.setAttribute('aria-labelledby', `${section.id}-label`);
  const header = document.createElement('div'); header.className = 'section-header';
  const titles = document.createElement('div'); titles.className = 'section-title-group';
  const label = document.createElement('h3');
  label.className = 'section-label'; label.textContent = section.title; label.id = `${section.id}-label`;
  const description = document.createElement('p'); description.className = 'section-description'; description.textContent = section.description || '';
  titles.append(label, description); header.append(titles); container.append(header); sectionsRoot.append(container);
  if (section.type === 'projects') {
    const grid = document.createElement('div'); grid.className = 'projects-grid'; container.append(grid);
    return { content: grid };
  }
  const wrap = document.createElement('div'); wrap.className = 'video-scroll-wrap'; wrap.setAttribute('aria-labelledby', label.id);
  wrap.id = `${section.id}-rail`; wrap.setAttribute('role', 'region'); wrap.tabIndex = 0;
  const nav = document.createElement('div'); nav.className = 'rail-nav';
  const prev = createButton('carousel-btn', `Previous ${section.title} videos`, '&#8592;');
  const next = createButton('carousel-btn', `Next ${section.title} videos`, '&#8594;');
  [prev, next].forEach(button => button.setAttribute('aria-controls', wrap.id));
  const move = direction => wrap.scrollBy({ left: direction * ((wrap.querySelector('.work-item')?.offsetWidth || wrap.clientWidth * 0.8) + parseFloat(getComputedStyle(wrap.firstElementChild).gap || 0)), behavior: shouldAnimate() ? 'smooth' : 'auto' });
  prev.addEventListener('click', () => move(-1)); next.addEventListener('click', () => move(1));
  wrap.addEventListener('keydown', event => {
    if (event.target !== wrap || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1);
  });
  const update = () => { prev.disabled = wrap.scrollLeft <= 1; next.disabled = wrap.scrollLeft >= wrap.scrollWidth - wrap.clientWidth - 1; };
  wrap.addEventListener('scroll', update, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(update).observe(wrap);
  nav.append(prev, next); header.append(nav);
  const track = document.createElement('div'); track.className = 'video-track'; wrap.append(track); container.append(wrap);
  return { wrap, content: track };
}

function preloadImage(src) { if (src) { const image = new Image(); image.src = src; } }

function setViewerLoading(loading) {
  viewerMedia?.classList.toggle('is-loading', loading);
}

function setViewerPlayState(playing) {
  if (!viewerPlay) return;
  viewerPlay.innerHTML = playing ? icon.pause : icon.play;
  viewerPlay.setAttribute('aria-label', `${playing ? 'Pause' : 'Play'} media`);
}

function playViewerVideo(media, request) {
  if (!media || request !== viewerMedia?._request) return;
  const attempt = (viewerMedia._playRequest || 0) + 1;
  viewerMedia._playRequest = attempt;
  const isCurrent = () => request === viewerMedia?._request && attempt === viewerMedia._playRequest;
  setViewerLoading(true);
  const finish = () => {
    if (!isCurrent()) return;
    setViewerLoading(false);
    setViewerPlayState(true);
  };
  media.addEventListener('playing', finish, { once: true });
  media.addEventListener('error', () => {
    if (!isCurrent()) return;
    setViewerLoading(false);
    setViewerPlayState(false);
  }, { once: true });
  safePlay(media).then(ok => {
    if (ok || !isCurrent() || media.error) return ok;
    // Sound autoplay can be blocked. Keep the viewer usable and let the user
    // turn sound on from the dedicated sound control.
    media.muted = true;
    viewerMuted = true;
    viewerMedia._muted = true;
    updateSoundButton(viewerSound, true);
    return safePlay(media);
  }).then(ok => {
    if (!ok && isCurrent()) {
      setViewerLoading(false);
      setViewerPlayState(false);
    }
  });
}

function renderProjects(projects, grid, section) {
  projects.forEach((project, projectIndex) => {
    const wrapper = document.createElement('div');
    const card = document.createElement('article'); card.className = 'project-card'; card.tabIndex = 0;
    const image = document.createElement('img'); image.alt = project.title || 'Project'; image.loading = 'lazy'; image.decoding = 'async'; image.draggable = false;
    const images = project.images || []; let current = 0; let updateToken = 0;
    const gallerySection = { ...section, id: `${section.id}-${projectIndex}` };
    const gallery = images.map((entry, index) => ({
      item: { image: typeof entry === 'string' ? entry : entry.src, title: `${project.title || 'Project'}, image ${index + 1}` },
      section: gallerySection, card,
    }));
    sectionRecords.set(gallerySection.id, gallery);
    const expand = createButton('carousel-btn project-expand', 'View full image', icon.expand);
    expand.hidden = !SETTINGS.viewerEnabled || !images.length;
    expand.addEventListener('click', event => { event.stopPropagation(); openViewer(gallery[current]); });
    const counter = document.createElement('div'); counter.className = 'carousel-counter'; counter.setAttribute('aria-live', 'polite');
    const nav = document.createElement('div'); nav.className = 'carousel-nav';
    const prev = createButton('carousel-btn', 'Previous image', '&#8592;'); const next = createButton('carousel-btn', 'Next image', '&#8594;'); nav.append(prev, next);
    const update = () => {
      if (!images.length) return;
      const token = ++updateToken;
      const src = typeof images[current] === 'string' ? images[current] : images[current].src;
      const following = images[(current + 1) % images.length];
      preloadImage(typeof following === 'string' ? following : following?.src);
      counter.textContent = `${String(current + 1).padStart(2, '0')} / ${String(images.length).padStart(2, '0')}`;
      counter.setAttribute('aria-label', `Image ${current + 1} of ${images.length}`);
      const apply = () => { if (token !== updateToken) return; image.src = src; image.alt = project.title ? `${project.title}, image ${current + 1}` : 'Project image'; image.style.opacity = '1'; };
      if (!image.src) apply(); else if (shouldAnimate()) { image.style.opacity = '0'; setTimeout(apply, 160); } else apply();
    };
    const move = direction => { if (!images.length) return; current = (current + direction + images.length) % images.length; update(); emit('project-image', { title: project.title, index: current }); };
    prev.addEventListener('click', event => { event.stopPropagation(); move(-1); }); next.addEventListener('click', event => { event.stopPropagation(); move(1); });
    card.addEventListener('keydown', event => {
      if (event.target !== card) return;
      if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
      if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openViewer(gallery[current]); }
    });
    addSwipe(card, direction => move(direction));
    update(); card.append(image, expand); if (images.length > 1) card.append(nav, counter); wrapper.appendChild(card);
    if (project.title) { const title = document.createElement('div'); title.className = 'project-title-bar'; title.textContent = project.title; wrapper.appendChild(title); }
    grid.appendChild(wrapper);
  });
}

function renderSection(section) {
  const shell = createShell(section);
  if (section.type === 'projects') { renderProjects(section.items || [], shell.content, section); return; }
  const records = (section.items || []).map(item => renderMediaItem(item, section, section.layout === 'reels', shell.content)).filter(Boolean);
  records.forEach(record => {
    const wrapper = document.createElement('div'); wrapper.className = 'work-item';
    record.card.before(wrapper); wrapper.append(record.card);
    const caption = document.createElement('div'); caption.className = 'work-caption';
    const title = document.createElement('h4'); title.textContent = record.item.title;
    const subtitle = document.createElement('p'); subtitle.textContent = record.item.subtitle || '';
    caption.append(title, subtitle); wrapper.append(caption);
    record.card.setAttribute('aria-label', `${record.item.title}${record.item.subtitle ? ', ' + record.item.subtitle : ''}`);
    record.video?.setAttribute('aria-label', `${record.item.title} ${record.item.subtitle || ''}`);
    // Autoplay has no native controls; seeking/sound/fullscreen are exposed by buttons.
    record.video?.setAttribute('disablepictureinpicture', '');
  });
  sectionRecords.set(section.id, records); setupRail(shell.wrap, records);
}

function openViewer(record, index = null, opener = document.activeElement) {
  if (!SETTINGS.viewerEnabled || !viewer || !record) return;
  mediaRecords.forEach(other => stopRecord(other));
  viewerMuted = soundPreference !== 'unmuted';
  viewerOpener = opener;
  viewerScrollY = window.scrollY;
  const records = sectionRecords.get(record.section.id) || [record];
  viewerRecord = record; viewerIndex = index === null ? records.indexOf(record) : index;
  if (!viewerHistoryState) { history.pushState({ ...history.state, portfolioViewer: true }, '', window.location.href); viewerHistoryState = true; }
  viewer.showModal(); document.body.classList.add('viewer-open');
  document.body.style.top = `-${viewerScrollY}px`;
  renderViewer(records);
  document.getElementById('viewerClose').focus({ preventScroll: true });
  emit('viewer-open', { title: record.item.title, section: record.section.id });
}

function renderViewer(records) {
  const record = records[viewerIndex] || records[0]; if (!record) return; viewerRecord = record;
  mediaRecords.forEach(other => stopRecord(other));
  disposeViewerMedia();
  const request = viewerMedia._request;
  setViewerLoading(true);
  viewerTitle.textContent = [record.item.title, record.item.subtitle].filter(Boolean).join(' — ') || record.section.title;
  document.getElementById('viewerCategory').textContent = record.section.title;
  viewerCounter.textContent = `${String(viewerIndex + 1).padStart(2, '0')} / ${String(records.length).padStart(2, '0')}`;
  viewerMedia.replaceChildren();
  const item = record.item; let media;
  const isLocal = Boolean(item.src);
  viewerPlay.hidden = !isLocal;
  viewerSound.hidden = !isLocal;
  document.getElementById('viewerPrev').disabled = records.length < 2;
  document.getElementById('viewerNext').disabled = records.length < 2;
  if (item.image) {
    media = document.createElement('img');
    media.alt = item.title || 'Project image';
    media.draggable = false;
    media.addEventListener('load', () => { if (request === viewerMedia._request) setViewerLoading(false); });
    media.addEventListener('error', () => showViewerError('This image could not load.', request));
    media.src = item.image;
  } else if (item.src) {
    media = document.createElement('video');
    media.src = item.src;
    media.poster = getPoster(item);
    media.preload = 'metadata';
    media.playsInline = true;
    media.controls = true;
    media.loop = item.loop !== false;
    if (record.video?.currentTime > 0) {
      const resumeTime = record.video.currentTime;
      media.addEventListener('loadedmetadata', () => { if (request === viewerMedia._request && resumeTime < media.duration) media.currentTime = resumeTime; }, { once: true });
    }
    media.className = item.fit === 'contain' ? 'contain-video' : '';
  } else {
    media = createEmbed(item, viewerMuted);
    media.addEventListener('load', () => { if (request === viewerMedia._request) setViewerLoading(false); }, { once: true });
    viewerMedia._timer = window.setTimeout(() => showViewerError('The player is taking longer to load.', request), 15000);
    media.addEventListener('load', () => clearTimeout(viewerMedia._timer), { once: true });
  }
  viewerMedia.appendChild(media);
  viewerMedia._media = media; viewerMedia._record = record; viewerMedia._muted = viewerMuted;
  const sourceLink = document.getElementById('viewerSource');
  sourceLink.hidden = Boolean(item.image || item.src);
  if (!sourceLink.hidden) {
    sourceLink.href = item.embed === 'youtube' ? `https://www.youtube.com/watch?v=${encodeURIComponent(item.id)}` : `https://vimeo.com/${encodeURIComponent(item.id)}`;
    sourceLink.textContent = `Watch on ${item.embed === 'youtube' ? 'YouTube' : 'Vimeo'}`;
  }
  if (item.image && !storage.get('portfolio:viewer-hint-seen')) {
    const hint = document.createElement('div');
    hint.className = 'viewer-hint';
    hint.textContent = 'Swipe or use the arrows to browse';
    viewerMedia.appendChild(hint);
    window.setTimeout(() => hint.classList.add('is-hidden'), 2400);
    storage.set('portfolio:viewer-hint-seen', '1');
  }
  setViewerPlayState(true); updateSoundButton(viewerSound, viewerMedia._muted);
  if (item.src) {
    media.muted = viewerMedia._muted;
    media.addEventListener('pause', () => { if (request === viewerMedia._request) { setViewerPlayState(false); setViewerLoading(false); } });
    media.addEventListener('playing', () => { if (request === viewerMedia._request) { setViewerPlayState(true); setViewerLoading(false); } });
    media.addEventListener('volumechange', () => {
      if (request !== viewerMedia._request) return;
      viewerMuted = media.muted; viewerMedia._muted = media.muted;
      updateSoundButton(viewerSound, media.muted);
      setSoundPreference(media.muted ? 'muted' : 'unmuted');
    });
    media.addEventListener('error', () => showViewerError('This video could not load.', request));
    media.addEventListener('waiting', () => { if (request === viewerMedia._request) setViewerLoading(true); });
    playViewerVideo(media, request);
  }
  if (!saveData) {
    const nextItem = records[(viewerIndex + 1) % records.length]?.item || {};
    preloadImage(nextItem.image || getPoster(nextItem));
  }
}

function showViewerError(message, request) {
  if (request !== viewerMedia._request || !viewer.open) return;
  setViewerLoading(false);
  setViewerPlayState(false);
  if (viewerMedia.querySelector('.viewer-error')) return;
  const error = document.createElement('div');
  error.className = 'viewer-error';
  error.setAttribute('role', 'status');
  const text = document.createElement('p'); text.textContent = message;
  const retry = createButton('viewer-retry', 'Retry loading media', 'Try again');
  retry.addEventListener('click', () => renderViewer(sectionRecords.get(viewerRecord.section.id) || [viewerRecord]));
  error.append(text, retry); viewerMedia.append(error);
}

function disposeViewerMedia() {
  if (!viewerMedia) return;
  viewerMedia._request = (viewerMedia._request || 0) + 1;
  clearTimeout(viewerMedia._timer);
  const media = viewerMedia._media;
  if (media?.tagName === 'VIDEO') {
    if (viewerMedia._record?.video && Number.isFinite(media.currentTime) && media.readyState > 0) viewerMedia._record.video.currentTime = media.currentTime;
    media.pause(); media.removeAttribute('src'); media.load();
  }
  viewerMedia.replaceChildren();
  viewerMedia._media = null;
  setViewerLoading(false);
}

function closeViewer(fromPopState = false) {
  if (!viewer?.open) return;
  if (document.fullscreenElement === viewer) document.exitFullscreen?.().catch(() => {});
  disposeViewerMedia(); viewer.close(); document.body.classList.remove('viewer-open'); viewerRecord = null;
  document.body.style.top = '';
  window.scrollTo({ top: viewerScrollY, behavior: 'instant' });
  viewerOpener?.focus({ preventScroll: true });
  if (viewerHistoryState && !fromPopState) { viewerHistoryState = false; history.back(); } else viewerHistoryState = false;
  emit('viewer-close');
}

function viewerMove(direction) {
  if (!viewerRecord) return; const records = sectionRecords.get(viewerRecord.section.id) || []; if (!records.length) return;
  viewerIndex = (viewerIndex + direction + records.length) % records.length; renderViewer(records);
}

function addSwipe(element, onSwipe) {
  let start = null;
  element.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.target.closest('button, input, a, iframe')) return;
    const videoTarget = event.target.closest('video');
    if (videoTarget && event.clientY > videoTarget.getBoundingClientRect().bottom - 65) return;
    start = { x: event.clientX, y: event.clientY, id: event.pointerId };
  });
  element.addEventListener('pointercancel', () => { start = null; });
  element.addEventListener('pointerup', event => {
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x; const dy = event.clientY - start.y;
    start = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) onSwipe(dx < 0 ? 1 : -1);
  });
}

function setupViewer() {
  if (!viewer) return;
  viewerTitle = document.getElementById('viewerTitle'); viewerCounter = document.getElementById('viewerCounter'); viewerMedia = document.getElementById('viewerMedia'); viewerPlay = document.getElementById('viewerPlay'); viewerSound = document.getElementById('viewerSound');
  document.addEventListener('fullscreenchange', () => {
    document.getElementById('viewerFullscreen')?.setAttribute('aria-label', document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen');
  });
  document.getElementById('viewerFullscreen')?.addEventListener('click', async () => {
    const media = viewerMedia._media;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (media?.webkitEnterFullscreen) media.webkitEnterFullscreen();
      else if (viewer.requestFullscreen) await viewer.requestFullscreen();
    } catch { /* The focused dialog already provides a full viewport fallback. */ }
  });
  document.getElementById('viewerClose')?.addEventListener('click', () => closeViewer());
  document.getElementById('viewerPrev')?.addEventListener('click', () => viewerMove(-1)); document.getElementById('viewerNext')?.addEventListener('click', () => viewerMove(1));
  viewerPlay?.addEventListener('click', () => {
    const media = viewerMedia._media;
    if (!media) return;
    if (media.tagName === 'VIDEO') {
      if (media.paused) { playViewerVideo(media, viewerMedia._request); }
      else { viewerMedia._playRequest += 1; media.pause(); setViewerPlayState(false); }
      return;
    }
  });
  viewerSound?.addEventListener('click', () => {
    const media = viewerMedia._media;
    const muted = !viewerMedia._muted;
    viewerMedia._muted = muted;
    viewerMuted = muted;
    setSoundPreference(muted ? 'muted' : 'unmuted');
    if (media?.tagName === 'VIDEO') {
      media.muted = muted;
      updateSoundButton(viewerSound, muted);
    }
  });
  viewer.addEventListener('click', event => { if (event.target === viewer) closeViewer(); }); viewer.addEventListener('cancel', event => { event.preventDefault(); closeViewer(); });
  addSwipe(viewerMedia, viewerMove);
  viewer.addEventListener('keydown', event => {
    if (event.target.closest('video, iframe, input') || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault(); viewerMove(event.key === 'ArrowLeft' ? -1 : 1);
    }
  });
  window.addEventListener('popstate', () => { if (viewer.open) closeViewer(true); });
}

function setupSectionReveals() {
  const targets = document.querySelectorAll('.section-reveal');
  if (prefersReducedMotion.matches || !('IntersectionObserver' in window)) { targets.forEach(target => target.classList.add('is-visible')); return; }
  const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (!entry.isIntersecting) return; entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }), { threshold: 0.08 });
  targets.forEach(target => observer.observe(target));
}

document.querySelector('.hero-name').textContent = CONTENT.hero.name;
document.querySelector('.hero-title').textContent = CONTENT.hero.role;
document.querySelector('.contact a[href^="https://wa.me"]').href = CONTENT.contact.whatsapp;
document.querySelector('.contact a[href^="mailto:"]').href = CONTENT.contact.email;
document.querySelector('.contact a[href^="tel:"]').href = CONTENT.contact.phone;
document.documentElement.dataset.sound = soundPreference;
document.getElementById('year').textContent = new Date().getFullYear();
setupViewer(); (CONTENT.sections || []).filter(section => section.enabled).forEach(renderSection);
const featured = mediaRecords.find(record => record.item.id === CONTENT.hero.featured);
document.getElementById('heroFeature').addEventListener('click', event => openViewer(featured, null, event.currentTarget));
document.getElementById('heroTeaser').addEventListener('click', event => openViewer(mediaRecords.find(record => record.section.id === 'teasers'), null, event.currentTarget));
function pausePageMedia() {
  clearTimeout(autoplayTimer);
  mediaRecords.forEach(record => stopRecord(record));
  const media = viewerMedia?._media;
  if (media?.tagName === 'VIDEO') { viewerMedia._playRequest += 1; media.pause(); }
  if (media?.tagName === 'IFRAME') {
    // Cross-origin players cannot be reliably paused without their SDKs.
    disposeViewerMedia();
    showViewerError('Playback paused while you were away.', viewerMedia._request);
  }
}
document.addEventListener('visibilitychange', () => { if (document.hidden) pausePageMedia(); });
window.addEventListener('pagehide', pausePageMedia);
prefersReducedMotion.addEventListener('change', () => {
  if (prefersReducedMotion.matches && activeRecord?.autoStarted) stopRecord(activeRecord);
  scheduleAutoplay();
});

