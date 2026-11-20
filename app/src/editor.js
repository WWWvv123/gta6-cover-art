// editor.js — wires the Sunset Cover Studio page: photos, panels, caption, export.
//
// The state lives in one object; every control edits it and calls renderPreview().
// The preview canvas draws at the export size and CSS scales it down, so what you see
// is the PNG you get. Dragging on the preview pans the selected panel's photo; the
// wheel zooms it. Photos are read on this machine and never uploaded anywhere.

import { SIZES, GRADES, LAYOUTS, panelRects, drawPoster, renderCover } from './poster.js';
import { applyShot } from './shots.js';

const $ = (id) => document.getElementById(id);
const preview = $('preview');
const pctx = preview.getContext('2d');

const TITLE_COLORS = ['#ffffff', '#ffe66d', '#ff5da2', '#7ef9ff'];

// One panel per slot; layouts use the first few. A panel keeps its own crop.
function freshPanel(photo) {
  return { photo, zoom: 1, panX: 0, panY: 0 };
}

const state = {
  photos: [], // { name, img } — samples first, then the user's own
  panels: [freshPanel(0), freshPanel(1), freshPanel(0), freshPanel(1)],
  layout: 'hero',
  grade: 'sunset',
  title: 'Sunset Heist',
  subtitle: 'Vice City · 1986',
  titleColor: '#ffffff',
  size: 'square',
  selected: 0,
};

let fontsReady = false;

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

async function loadSamples() {
  for (const [name, file] of [['Sunset Driver', 'sunset-driver.jpg'], ['Boardwalk Dusk', 'boardwalk-dusk.jpg']]) {
    try {
      const img = await loadImage(`./samples/${file}`);
      state.photos.push({ name, img });
    } catch {
      // A missing sample only removes a starting photo; the app still works.
    }
  }
}

async function waitForFonts() {
  try {
    await Promise.all([
      document.fonts.load('100px Anton', 'SUNSET'),
      document.fonts.load('100px "Bebas Neue"', 'VICE'),
    ]);
    await document.fonts.ready;
    fontsReady = true;
  } catch {
    fontsReady = false; // the canvas falls back to system fonts
  }
}

/** Draws the preview at the export size, plus the selected panel's outline. */
function renderPreview() {
  const size = SIZES[state.size];
  if (preview.width !== size.w || preview.height !== size.h) {
    preview.width = size.w;
    preview.height = size.h;
  }
  drawPoster(pctx, state, size.w, size.h);
  const { rects } = panelRects(state.layout, size.w, size.h);
  const rect = rects[state.selected];
  if (rect) {
    pctx.save();
    pctx.lineWidth = Math.max(3, Math.round(Math.min(size.w, size.h) * 0.006));
    pctx.strokeStyle = '#ffe66d';
    pctx.setLineDash([Math.round(pctx.lineWidth * 4), Math.round(pctx.lineWidth * 2.5)]);
    pctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    pctx.restore();
  }
  window.__posterReady = true;
}

function setStatus(text) {
  $('status').textContent = text;
}

function refreshPhotoList() {
  const strip = $('photoStrip');
  strip.innerHTML = '';
  state.photos.forEach((photo, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'thumb';
    button.textContent = photo.name;
    button.title = `Use “${photo.name}” in the selected panel`;
    button.addEventListener('click', () => {
      state.panels[state.selected].photo = i;
      state.panels[state.selected].zoom = 1;
      state.panels[state.selected].panX = 0;
      state.panels[state.selected].panY = 0;
      syncPanelControls();
      renderPreview();
    });
    strip.appendChild(button);
  });
}

function refreshPanelSelect() {
  const select = $('panelPhoto');
  select.innerHTML = '';
  state.photos.forEach((photo, i) => {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = photo.name;
    select.appendChild(option);
  });
  const none = document.createElement('option');
  none.value = '';
  none.textContent = '(empty panel)';
  select.appendChild(none);
}

function panelCount() {
  return panelRects(state.layout, 1080, 1080).rects.length;
}

function syncPanelControls() {
  const panel = state.panels[state.selected];
  $('panelLabel').textContent = `Panel ${state.selected + 1} of ${panelCount()}`;
  $('panelPhoto').value = panel.photo == null ? '' : String(panel.photo);
  $('zoom').value = String(panel.zoom || 1);
  $('zoomValue').textContent = `${Math.round((panel.zoom || 1) * 100)}%`;
}

function syncChoiceButtons(groupId, value) {
  document.querySelectorAll(`#${groupId} button`).forEach((button) => {
    button.classList.toggle('active', button.dataset.value === value);
  });
}

function syncAll() {
  syncChoiceButtons('layoutButtons', state.layout);
  syncChoiceButtons('gradeButtons', state.grade);
  syncChoiceButtons('sizeButtons', state.size);
  syncChoiceButtons('colorButtons', state.titleColor);
  $('titleInput').value = state.title;
  $('subtitleInput').value = state.subtitle;
  refreshPhotoList();
  refreshPanelSelect();
  syncPanelControls();
}

function selectPanel(index) {
  const count = panelCount();
  state.selected = Math.max(0, Math.min(count - 1, index));
  syncPanelControls();
  renderPreview();
}

function canvasPoint(event) {
  const box = preview.getBoundingClientRect();
  return {
    x: ((event.clientX - box.left) / box.width) * preview.width,
    y: ((event.clientY - box.top) / box.height) * preview.height,
  };
}

function hitPanel(point) {
  const { rects } = panelRects(state.layout, preview.width, preview.height);
  return rects.findIndex((r) => point.x >= r.x && point.x < r.x + r.w && point.y >= r.y && point.y < r.y + r.h);
}

function setupPointer() {
  let dragging = false;
  let last = null;
  preview.addEventListener('pointerdown', (event) => {
    const point = canvasPoint(event);
    const hit = hitPanel(point);
    if (hit === -1) return;
    selectPanel(hit);
    dragging = true;
    last = point;
    preview.setPointerCapture(event.pointerId);
  });
  preview.addEventListener('pointermove', (event) => {
    if (!dragging || !last) return;
    const point = canvasPoint(event);
    const { rects } = panelRects(state.layout, preview.width, preview.height);
    const rect = rects[state.selected];
    if (!rect) return;
    const panel = state.panels[state.selected];
    panel.panX += (point.x - last.x) / rect.w;
    panel.panY += (point.y - last.y) / rect.h;
    last = point;
    renderPreview();
  });
  const stop = () => { dragging = false; last = null; };
  preview.addEventListener('pointerup', stop);
  preview.addEventListener('pointercancel', stop);
  preview.addEventListener('wheel', (event) => {
    event.preventDefault();
    const panel = state.panels[state.selected];
    panel.zoom = Math.max(1, Math.min(2.5, (panel.zoom || 1) - Math.sign(event.deltaY) * 0.1));
    syncPanelControls();
    renderPreview();
  }, { passive: false });
}

function setupControls() {
  document.querySelectorAll('#layoutButtons button').forEach((button) => {
    button.addEventListener('click', () => {
      state.layout = button.dataset.value;
      state.selected = 0;
      syncAll();
      renderPreview();
    });
  });
  document.querySelectorAll('#gradeButtons button').forEach((button) => {
    button.addEventListener('click', () => {
      state.grade = button.dataset.value;
      syncAll();
      renderPreview();
    });
  });
  document.querySelectorAll('#sizeButtons button').forEach((button) => {
    button.addEventListener('click', () => {
      state.size = button.dataset.value;
      syncAll();
      renderPreview();
    });
  });
  document.querySelectorAll('#colorButtons button').forEach((button) => {
    button.addEventListener('click', () => {
      state.titleColor = button.dataset.value;
      syncAll();
      renderPreview();
    });
  });
  $('titleInput').addEventListener('input', (event) => {
    state.title = event.target.value;
    renderPreview();
  });
  $('subtitleInput').addEventListener('input', (event) => {
    state.subtitle = event.target.value;
    renderPreview();
  });
  $('panelPhoto').addEventListener('change', (event) => {
    const panel = state.panels[state.selected];
    panel.photo = event.target.value === '' ? null : Number(event.target.value);
    panel.zoom = 1;
    panel.panX = 0;
    panel.panY = 0;
    syncPanelControls();
    renderPreview();
  });
  $('zoom').addEventListener('input', (event) => {
    state.panels[state.selected].zoom = Number(event.target.value);
    syncPanelControls();
    renderPreview();
  });
  $('fillAll').addEventListener('click', () => {
    const source = state.panels[state.selected];
    const count = panelCount();
    for (let i = 0; i < count; i += 1) {
      // Same photo in every panel, each showing a different slice of it.
      state.panels[i].photo = source.photo;
      state.panels[i].zoom = 1.15;
      state.panels[i].panX = (i - (count - 1) / 2) * 0.12;
      state.panels[i].panY = 0;
    }
    syncPanelControls();
    renderPreview();
    setStatus('Filled every panel with the selected photo.');
  });
  $('resetCrop').addEventListener('click', () => {
    const panel = state.panels[state.selected];
    panel.zoom = 1;
    panel.panX = 0;
    panel.panY = 0;
    syncPanelControls();
    renderPreview();
  });
  $('photoFile').addEventListener('change', async (event) => {
    const files = [...event.target.files];
    for (const file of files) {
      try {
        const url = URL.createObjectURL(file);
        const img = await loadImage(url);
        state.photos.push({ name: file.name.replace(/\.[^.]+$/, ''), img });
      } catch {
        setStatus(`Could not read ${file.name}.`);
      }
    }
    event.target.value = '';
    if (files.length) {
      state.panels[state.selected].photo = state.photos.length - 1;
      syncAll();
      renderPreview();
      setStatus(`${files.length} photo${files.length > 1 ? 's' : ''} added — pick a panel, then a photo.`);
    }
  });
  $('exportBtn').addEventListener('click', async () => {
    await exportPng();
  });
}

async function exportPng() {
  const size = SIZES[state.size];
  if (!fontsReady) await waitForFonts();
  const canvas = renderCover(state, size.w, size.h);
  const done = new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        setStatus('Export failed — the browser could not make the PNG.');
        resolve(false);
        return;
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `sunset-cover-${size.w}x${size.h}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      setStatus(`Saved sunset-cover-${size.w}x${size.h}.png (${size.label}).`);
      resolve(true);
    }, 'image/png');
  });
  return done;
}

// Exposed for the screenshot scenes and for checks: the live state and a manual export.
window.__sunset = { state, exportPng, renderPreview };

async function start() {
  buildChoiceButtons();
  setupControls();
  setupPointer();
  await loadSamples();
  syncAll();
  await waitForFonts();
  renderPreview();
  const shot = new URLSearchParams(location.search).get('shot');
  if (shot) {
    await applyShot(shot, new URLSearchParams(location.search), state, { renderPreview, syncAll, loadImage });
    renderPreview();
  }
  setStatus(state.photos.length ? 'Loaded with two sample photos — add your own, or export as is.' : 'Add a photo to begin.');
}

function buildChoiceButtons() {
  const layouts = Object.entries(LAYOUTS).map(([value, def]) => [value, def.name]);
  const grades = Object.entries(GRADES).map(([value, def]) => [value, def.name]);
  const sizes = Object.entries(SIZES).map(([value, def]) => [value, def.label]);
  const colors = TITLE_COLORS.map((c) => [c, c]);
  fillButtons('layoutButtons', layouts);
  fillButtons('gradeButtons', grades);
  fillButtons('sizeButtons', sizes);
  fillButtons('colorButtons', colors, true);
}

function fillButtons(groupId, entries, isColor = false) {
  const group = $(groupId);
  group.innerHTML = '';
  for (const [value, label] of entries) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.value = value;
    if (isColor) {
      button.className = 'swatch';
      button.style.background = value;
      button.title = value;
      button.setAttribute('aria-label', `Title colour ${value}`);
    } else {
      button.textContent = label;
    }
    group.appendChild(button);
  }
}

start();
