// shots.js — fixed scenes for screenshots, driven by the page's query string.
//
//   ?shot=editor&photo=sunset-driver&caption=Sunset%20Heist
//   ?shot=cover&photo=boardwalk-dusk&caption=Boardwalk%20Queen&layout=triptych&grade=neon&size=wide
//
// `photo` names a sample file (without .jpg). `cover` hides the editor controls so the
// poster fills the window. window.__shotReady is set once the scene is painted.

const SAMPLES = {
  'sunset-driver': 'Sunset Driver',
  'boardwalk-dusk': 'Boardwalk Dusk',
};

export async function applyShot(shot, query, state, ui) {
  const photoName = query.get('photo') || 'sunset-driver';
  const photoIndex = state.photos.findIndex((p) => p.name === SAMPLES[photoName]);
  if (photoIndex !== -1) {
    state.panels.forEach((panel, i) => {
      panel.photo = photoIndex;
      panel.zoom = 1.1;
      panel.panX = (i - 1) * 0.1;
      panel.panY = 0;
    });
    state.panels[0].photo = photoIndex;
  }
  const second = query.get('photo2');
  if (second) {
    const secondIndex = state.photos.findIndex((p) => p.name === SAMPLES[second]);
    if (secondIndex !== -1 && state.panels[1]) state.panels[1].photo = secondIndex;
  }
  if (query.get('layout')) state.layout = query.get('layout');
  if (query.get('grade')) state.grade = query.get('grade');
  if (query.get('size')) state.size = query.get('size');
  if (query.get('caption')) state.title = query.get('caption');
  if (query.get('subtitle')) state.subtitle = query.get('subtitle');
  if (query.get('color')) state.titleColor = query.get('color');
  state.selected = 0;
  ui.syncAll();
  ui.renderPreview();
  if (shot === 'cover') document.body.classList.add('shot-cover');
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
}
