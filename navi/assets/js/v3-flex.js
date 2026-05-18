// v3-flex.js — 유연한 동선 (드래그 정렬 + Pass + 동적 구글 임베드)
(function () {
  'use strict';
  const STORAGE_ORDER = 'tourOrder_v3';
  const STORAGE_PASSED = 'tourPassed_v3';
  const STORAGE_VISITED = 'warsawTourVisited_v1';

  const data = window.TOUR_DATA;
  const stops = data.stops;
  const stopMap = Object.fromEntries(stops.map((s) => [s.id, s]));

  let order = loadOrder();
  let passed = new Set(JSON.parse(localStorage.getItem(STORAGE_PASSED) || '[]'));
  let visited = new Set(JSON.parse(localStorage.getItem(STORAGE_VISITED) || '[]'));

  function loadOrder() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_ORDER) || 'null');
      const ids = new Set(stops.map((s) => s.id));
      if (Array.isArray(saved) && saved.length === stops.length && saved.every((id) => ids.has(id))) {
        return saved;
      }
    } catch (e) {}
    return stops.map((s) => s.id);
  }
  const save = {
    order: () => localStorage.setItem(STORAGE_ORDER, JSON.stringify(order)),
    passed: () => localStorage.setItem(STORAGE_PASSED, JSON.stringify([...passed])),
    visited: () => localStorage.setItem(STORAGE_VISITED, JSON.stringify([...visited])),
  };

  // ====== 카드 ======
  function renderStopCard(stop, prevActive) {
    const article = document.createElement('article');
    article.className = 'stop v3-stop';
    article.dataset.stopId = stop.id;
    article.id = stop.id;
    if (passed.has(stop.id)) article.classList.add('passed');
    if (visited.has(stop.id)) article.classList.add('visited');
    if (stop.terminus) article.classList.add('terminus');
    if (stop.extension) article.classList.add('extension');

    const dirUrl = window.NaviCore.googleMapsDirections(
      prevActive ? prevActive.lat : null,
      prevActive ? prevActive.lon : null,
      stop.lat, stop.lon, stop.nameKr
    );

    article.innerHTML = `
      <div class="stop-toolbar">
        <button class="drag-handle" aria-label="순서 변경 (길게 눌러 드래그)" title="길게 눌러 드래그">⠿</button>
        <button class="btn-pass" data-stop-id="${stop.id}" aria-label="동선에서 제외/포함">
          ${passed.has(stop.id) ? '↶ 복귀' : '✕ Pass'}
        </button>
      </div>
      <figure class="stop-photo">
        <span class="stop-num">${stop.num}${stop.terminus ? ' · 종착' : ''}</span>
        <img src="${stop.image}" alt="${stop.nameKr}" loading="lazy">
      </figure>
      <div class="stop-body">
        <div class="stop-time">${stop.time}${stop.stay ? ' · 머무는 시간 ' + stop.stay : ''}</div>
        <h2>${stop.nameKr}</h2>
        <div class="stop-pl">${stop.namePl}</div>
        ${stop.paragraphs.map((p) => `<p>${p}</p>`).join('')}
        <div class="stop-actions">
          <a class="btn-directions" href="${dirUrl}" target="_blank" rel="noopener">🗺️ 구글 지도 길찾기</a>
          <button class="btn-visit ${visited.has(stop.id) ? 'checked' : ''}" data-stop-id="${stop.id}">
            ${visited.has(stop.id) ? '✓ 방문함' : '☐ 방문'}
          </button>
        </div>
      </div>
    `;
    return article;
  }

  // ====== 도보 임베드 ======
  function renderWalkEmbed(fromStop, toStop) {
    const div = document.createElement('div');
    div.className = 'walk v3-walk';
    div.dataset.walkBetween = `${fromStop.id}-${toStop.id}`;
    const src = `https://maps.google.com/maps?saddr=${fromStop.lat},${fromStop.lon}&daddr=${toStop.lat},${toStop.lon}&dirflg=w&t=m&output=embed`;
    div.innerHTML = `
      <div class="walk-content">
        <span class="walk-label">${fromStop.num} → ${toStop.num}</span>
        <div class="walk-map">
          <iframe src="${src}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
        </div>
      </div>
    `;
    return div;
  }

  // ====== 메인 렌더 ======
  function render() {
    const container = document.getElementById('stops-container');
    container.innerHTML = '';
    const allOrdered = order.map((id) => stopMap[id]);

    let prevActive = null;
    allOrdered.forEach((stop, idx) => {
      container.appendChild(renderStopCard(stop, prevActive));

      if (!passed.has(stop.id)) {
        const remaining = allOrdered.slice(idx + 1).filter((s) => !passed.has(s.id));
        if (remaining.length > 0) {
          container.appendChild(renderWalkEmbed(stop, remaining[0]));
        }
        prevActive = stop;
      }
    });

    updateProgress();
    updateMap();
  }

  // ====== 진행도 ======
  function updateProgress() {
    const activeMain = order
      .map((id) => stopMap[id])
      .filter((s) => !s.extension && !passed.has(s.id));
    const done = activeMain.filter((s) => visited.has(s.id));
    const pct = activeMain.length ? Math.round((done.length / activeMain.length) * 100) : 0;
    const fillEl = document.querySelector('.progress-bar .fill');
    const countEl = document.querySelector('.progress-bar .count');
    if (fillEl) fillEl.style.width = pct + '%';
    if (countEl) countEl.textContent = `${done.length} / ${activeMain.length}`;
  }

  // ====== Leaflet 지도 ======
  let map, polyline, markers = [];
  function initMap() {
    map = L.map('overview-map', { zoomControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap',
    }).addTo(map);
    updateMap();
  }
  function updateMap() {
    if (!map) return;
    if (polyline) { map.removeLayer(polyline); polyline = null; }
    markers.forEach((m) => map.removeLayer(m));
    markers = [];

    const activeMain = order
      .map((id) => stopMap[id])
      .filter((s) => !s.extension && !passed.has(s.id));
    if (activeMain.length === 0) return;

    polyline = L.polyline(activeMain.map((s) => [s.lat, s.lon]), {
      color: '#b8420a', weight: 4, opacity: 0.75,
    }).addTo(map);

    activeMain.forEach((s) => {
      const color = s.terminus ? '#4a7c4e' : '#b8420a';
      const icon = L.divIcon({
        className: 'stop-marker',
        html: `<div style="background:${color};color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${s.num}</div>`,
        iconSize: [28, 28], iconAnchor: [14, 14],
      });
      const m = L.marker([s.lat, s.lon], { icon }).addTo(map)
        .bindPopup(`<strong>${s.num}. ${s.nameKr}</strong><br><em style="color:#666;font-size:12px">${s.namePl}</em>`);
      markers.push(m);
    });

    if (activeMain.length > 1) {
      map.fitBounds(polyline.getBounds(), { padding: [30, 30] });
    } else {
      map.setView([activeMain[0].lat, activeMain[0].lon], 14);
    }
  }

  // ====== Sortable ======
  function setupSortable() {
    const container = document.getElementById('stops-container');
    new Sortable(container, {
      handle: '.drag-handle',
      draggable: '.v3-stop',
      filter: '.v3-walk',
      animation: 200,
      delay: 150,
      delayOnTouchOnly: true,
      touchStartThreshold: 5,
      forceFallback: true,
      fallbackTolerance: 5,
      onEnd: () => {
        const newOrder = Array.from(container.querySelectorAll('.v3-stop'))
          .map((el) => el.dataset.stopId);
        order = newOrder;
        save.order();
        render();
      },
    });
  }

  // ====== 이벤트 ======
  function setupClickHandlers() {
    document.addEventListener('click', (e) => {
      const passBtn = e.target.closest('.btn-pass');
      if (passBtn) {
        const id = passBtn.dataset.stopId;
        if (passed.has(id)) passed.delete(id);
        else passed.add(id);
        save.passed();
        render();
        return;
      }
      const visitBtn = e.target.closest('.btn-visit');
      if (visitBtn) {
        const id = visitBtn.dataset.stopId;
        if (visited.has(id)) visited.delete(id);
        else visited.add(id);
        save.visited();
        const card = document.getElementById(id);
        if (card) card.classList.toggle('visited');
        visitBtn.classList.toggle('checked');
        visitBtn.textContent = visited.has(id) ? '✓ 방문함' : '☐ 방문';
        updateProgress();
        return;
      }
    });
  }

  function setupScrollToTop() {
    const btn = document.getElementById('btn-scroll-top');
    if (!btn) return;
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  function setupReset() {
    const btn = document.getElementById('btn-reset-order');
    if (!btn) return;
    btn.addEventListener('click', () => {
      if (!confirm('순서와 Pass 상태를 초기 상태로 되돌릴까요? (방문 체크는 유지)')) return;
      localStorage.removeItem(STORAGE_ORDER);
      localStorage.removeItem(STORAGE_PASSED);
      order = stops.map((s) => s.id);
      passed = new Set();
      render();
    });
  }

  window.V3Flex = {
    init() {
      render();
      initMap();
      setupSortable();
      setupClickHandlers();
      setupScrollToTop();
      setupReset();
    },
  };
})();
