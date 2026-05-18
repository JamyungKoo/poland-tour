// v3-flex.js — 유연한 동선 (편집 시트 드래그 + Pass + 슬롯 번호 + 동적 임베드)
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

  // ====== 슬롯 번호 계산 ======
  // 활성 정거장(Pass 안 된)에 1~N 슬롯 번호 부여. Pass된 건 null. extension도 일반 슬롯.
  function buildSlotMap() {
    const map = new Map();
    let slot = 1;
    for (const id of order) {
      if (passed.has(id)) { map.set(id, null); continue; }
      map.set(id, String(slot).padStart(2, '0'));
      slot++;
    }
    return map;
  }
  function slotLabel(stop, slotMap) {
    const v = slotMap.get(stop.id);
    return v === null ? '—' : v;
  }

  // ====== 본문 카드 ======
  function renderStopCard(stop, prevActive, slotMap) {
    const article = document.createElement('article');
    article.className = 'stop v3-stop';
    article.dataset.stopId = stop.id;
    article.id = stop.id;
    if (passed.has(stop.id)) article.classList.add('passed');
    if (visited.has(stop.id)) article.classList.add('visited');

    const dirUrl = window.NaviCore.googleMapsDirections(
      prevActive ? prevActive.lat : null,
      prevActive ? prevActive.lon : null,
      stop.lat, stop.lon, stop.nameKr
    );
    const placeUrl = window.NaviCore.googleMapsPlace(stop.lat, stop.lon, stop.namePl);
    const slot = slotLabel(stop, slotMap);
    const isPassed = passed.has(stop.id);
    const nameKr = stop.nameKr.replace(/\s*—\s*종착\s*$/, '');

    article.innerHTML = `
      <div class="stop-toolbar">
        <button class="btn-pass" data-stop-id="${stop.id}" aria-label="동선에서 제외/포함">
          ${isPassed ? '↶ 복귀' : '✕ Pass'}
        </button>
      </div>
      <figure class="stop-photo">
        <span class="stop-num">${slot}</span>
        <img src="${stop.image}" alt="${nameKr}" loading="lazy">
      </figure>
      <div class="stop-body">
        <div class="stop-time">${stop.time}${stop.stay ? ' · 머무는 시간 ' + stop.stay : ''}</div>
        <h2>${nameKr}</h2>
        <div class="stop-pl">${stop.namePl}</div>
        ${stop.paragraphs.map((p) => `<p>${p}</p>`).join('')}
        <div class="stop-actions">
          <a class="btn-directions" href="${dirUrl}" target="_blank" rel="noopener">🗺️ 구글 지도 길찾기</a>
          <a class="btn-place" href="${placeUrl}" target="_blank" rel="noopener" title="장소만 보기">📍</a>
          <button class="btn-visit ${visited.has(stop.id) ? 'checked' : ''}" data-stop-id="${stop.id}">
            ${visited.has(stop.id) ? '✓ 방문함' : '☐ 방문'}
          </button>
        </div>
      </div>
    `;
    return article;
  }

  // ====== 도보 임베드 ======
  function renderWalkEmbed(fromStop, toStop, slotMap) {
    const div = document.createElement('div');
    div.className = 'walk v3-walk';
    div.dataset.walkBetween = `${fromStop.id}-${toStop.id}`;
    const src = `https://maps.google.com/maps?saddr=${fromStop.lat},${fromStop.lon}&daddr=${toStop.lat},${toStop.lon}&dirflg=w&t=m&output=embed`;
    div.innerHTML = `
      <div class="walk-content">
        <span class="walk-label">${slotLabel(fromStop, slotMap)} → ${slotLabel(toStop, slotMap)}</span>
        <div class="walk-map">
          <iframe src="${src}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
        </div>
      </div>
    `;
    return div;
  }

  // ====== 편집 시트 한 줄 ======
  function renderSheetRow(stop, slotMap) {
    const row = document.createElement('div');
    row.className = 'sheet-row';
    row.dataset.stopId = stop.id;
    if (passed.has(stop.id)) row.classList.add('passed');
    const slot = slotLabel(stop, slotMap);
    const nameKr = stop.nameKr.replace(/\s*—\s*종착\s*$/, '');
    row.innerHTML = `
      <span class="sheet-handle" aria-label="드래그">⠿</span>
      <span class="sheet-num">${slot}</span>
      <span class="sheet-name">${nameKr}</span>
      <button class="sheet-pass" data-stop-id="${stop.id}" aria-label="동선에서 제외/포함">
        ${passed.has(stop.id) ? '↶' : '✕'}
      </button>
    `;
    return row;
  }

  // ====== 메인 렌더 ======
  function render() {
    const slotMap = buildSlotMap();
    const allOrdered = order.map((id) => stopMap[id]);

    // 본문
    const container = document.getElementById('stops-container');
    container.innerHTML = '';
    let prevActive = null;
    allOrdered.forEach((stop, idx) => {
      container.appendChild(renderStopCard(stop, prevActive, slotMap));
      if (!passed.has(stop.id)) {
        const remaining = allOrdered.slice(idx + 1).filter((s) => !passed.has(s.id));
        if (remaining.length > 0) {
          container.appendChild(renderWalkEmbed(stop, remaining[0], slotMap));
        }
        prevActive = stop;
      }
    });

    // 편집 시트
    const sheetList = document.getElementById('sheet-list');
    if (sheetList) {
      sheetList.innerHTML = '';
      allOrdered.forEach((stop) => sheetList.appendChild(renderSheetRow(stop, slotMap)));
    }

    updateProgress();
    updateMap(slotMap);
    if (window.V3Flex && window.V3Flex._updateNav) window.V3Flex._updateNav();
  }

  function updateProgress() {
    const activeAll = order
      .map((id) => stopMap[id])
      .filter((s) => !passed.has(s.id));
    const done = activeAll.filter((s) => visited.has(s.id));
    const pct = activeAll.length ? Math.round((done.length / activeAll.length) * 100) : 0;
    const fillEl = document.querySelector('.progress-bar .fill');
    const countEl = document.querySelector('.progress-bar .count');
    if (fillEl) fillEl.style.width = pct + '%';
    if (countEl) countEl.textContent = `${done.length} / ${activeAll.length}`;
  }

  // ====== Leaflet ======
  let map, polyline, markers = [];
  function initMap() {
    map = L.map('overview-map', { zoomControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap',
    }).addTo(map);
    updateMap(buildSlotMap());
  }
  function updateMap(slotMap) {
    if (!map) return;
    if (polyline) { map.removeLayer(polyline); polyline = null; }
    markers.forEach((m) => map.removeLayer(m));
    markers = [];
    const allInOrder = order.map((id) => stopMap[id]);
    const active = allInOrder.filter((s) => !passed.has(s.id));
    const passedList = allInOrder.filter((s) => passed.has(s.id));

    // 폴리라인: 활성 정거장만 연결
    if (active.length > 0) {
      polyline = L.polyline(active.map((s) => [s.lat, s.lon]), {
        color: '#b8420a', weight: 4, opacity: 0.75,
      }).addTo(map);
    }

    // 활성 마커: 빨강 + 슬롯번호
    active.forEach((s) => {
      const slot = slotMap.get(s.id) || '?';
      const nameKr = s.nameKr.replace(/\s*—\s*종착\s*$/, '');
      const icon = L.divIcon({
        className: 'stop-marker',
        html: `<div style="background:#b8420a;color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${slot}</div>`,
        iconSize: [28, 28], iconAnchor: [14, 14],
      });
      const m = L.marker([s.lat, s.lon], { icon }).addTo(map)
        .bindPopup(`<strong>${slot}. ${nameKr}</strong><br><em style="color:#666;font-size:12px">${s.namePl}</em>`);
      markers.push(m);
    });

    // Pass 마커: 초록 원 (번호 없음, 작게)
    passedList.forEach((s) => {
      const nameKr = s.nameKr.replace(/\s*—\s*종착\s*$/, '');
      const icon = L.divIcon({
        className: 'stop-marker passed',
        html: `<div style="background:#4a7c4e;color:white;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.25);opacity:0.85">✓</div>`,
        iconSize: [22, 22], iconAnchor: [11, 11],
      });
      const m = L.marker([s.lat, s.lon], { icon }).addTo(map)
        .bindPopup(`<strong style="color:#4a7c4e">Pass</strong> · ${nameKr}<br><em style="color:#666;font-size:12px">${s.namePl}</em>`);
      markers.push(m);
    });

    // 줌: fitBounds만 (롤백 — setZoom +1 제거)
    if (active.length > 1) {
      map.fitBounds(polyline.getBounds(), { padding: [30, 30] });
    } else if (active.length === 1) {
      map.setView([active[0].lat, active[0].lon], 14);
    } else if (passedList.length > 0) {
      const bounds = L.latLngBounds(passedList.map((s) => [s.lat, s.lon]));
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }

  // ====== 편집 시트 (Bottom Sheet + 미니맵 fixed) ======
  function toggleSheet(forceState) {
    const sheet = document.getElementById('edit-sheet');
    const btn = document.getElementById('btn-edit-sheet');
    const backdrop = document.getElementById('sheet-backdrop');
    const mapEl = document.getElementById('overview-map');
    if (!sheet) return;
    const open = forceState !== undefined ? forceState : !sheet.classList.contains('open');
    sheet.classList.toggle('open', open);
    if (backdrop) backdrop.classList.toggle('open', open);
    if (mapEl) mapEl.classList.toggle('floating', open);
    document.body.classList.toggle('sheet-open', open);
    if (btn) btn.textContent = open ? '▼ 편집 중' : '▼ 동선 편집';
    // Leaflet은 컨테이너 크기가 변하면 invalidateSize 필요
    if (map) setTimeout(() => map.invalidateSize(), 320);
  }

  function setupSheetSortable() {
    const list = document.getElementById('sheet-list');
    if (!list) return;
    new Sortable(list, {
      handle: '.sheet-handle',
      draggable: '.sheet-row',
      animation: 180,
      delay: 120,
      delayOnTouchOnly: true,
      forceFallback: true,
      fallbackTolerance: 4,
      onEnd: () => {
        const newOrder = Array.from(list.querySelectorAll('.sheet-row'))
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
      const passBtn = e.target.closest('.btn-pass, .sheet-pass');
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
        render();
        return;
      }
      const editBtn = e.target.closest('#btn-edit-sheet');
      if (editBtn) { toggleSheet(); return; }
      const closeBtn = e.target.closest('#btn-close-sheet, #sheet-backdrop');
      if (closeBtn) { toggleSheet(false); return; }
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

  // ====== v3 전용 하단 네비 (슬롯 번호 동기화) ======
  let currentIdx = 0;
  function setupV3BottomNav() {
    const nav = document.querySelector('.bottom-nav');
    if (!nav) return;
    const prevBtn = nav.querySelector('.prev');
    const nextBtn = nav.querySelector('.next');
    const centerCurrent = nav.querySelector('.center .current');
    const centerTotal = nav.querySelector('.center .total');

    function updateNav() {
      const slotMap = buildSlotMap();
      const allOrdered = order.map((id) => stopMap[id]);
      const activeStops = allOrdered.filter((s) => !passed.has(s.id));
      if (centerTotal) centerTotal.textContent = activeStops.length;
      if (allOrdered.length === 0) return;

      const stop = allOrdered[currentIdx] || allOrdered[0];
      const prev = currentIdx > 0 ? allOrdered[currentIdx - 1] : null;
      const next = currentIdx < allOrdered.length - 1 ? allOrdered[currentIdx + 1] : null;

      const slotOf = (s) => {
        const v = slotMap.get(s.id);
        return v === null ? '—' : v;
      };
      centerCurrent.textContent = slotOf(stop);
      prevBtn.disabled = !prev;
      nextBtn.disabled = !next;
      const fmt = (s) => `${slotOf(s)} ${s.nameKr.replace(/\s*—\s*종착\s*$/, '')}`;
      prevBtn.querySelector('.target').textContent = prev ? fmt(prev) : '—';
      nextBtn.querySelector('.target').textContent = next ? fmt(next) : '—';
    }

    prevBtn.addEventListener('click', () => {
      if (currentIdx > 0) {
        currentIdx--;
        const id = order[currentIdx];
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        updateNav();
      }
    });
    nextBtn.addEventListener('click', () => {
      if (currentIdx < order.length - 1) {
        currentIdx++;
        const id = order[currentIdx];
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        updateNav();
      }
    });

    // 스크롤로 currentIdx 추적 (viewport 중심에 가까운 카드)
    let raf = null;
    function onScroll() {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        if (document.body.classList.contains('sheet-open')) return;
        const cards = Array.from(document.querySelectorAll('#stops-container .v3-stop'));
        const viewCenter = window.scrollY + window.innerHeight / 2;
        let bestIdx = 0, bestDist = Infinity;
        cards.forEach((el, i) => {
          const rect = el.getBoundingClientRect();
          const center = rect.top + window.scrollY + rect.height / 2;
          const dist = Math.abs(center - viewCenter);
          if (dist < bestDist) { bestDist = dist; bestIdx = i; }
        });
        if (bestIdx !== currentIdx) {
          currentIdx = bestIdx;
          updateNav();
        }
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    // 렌더 후마다 nav 갱신 (slotMap 변화 반영)
    window.V3Flex._updateNav = updateNav;
    updateNav();
  }

  window.V3Flex = {
    _updateNav: null,
    init() {
      render();
      initMap();
      setupSheetSortable();
      setupClickHandlers();
      setupScrollToTop();
      setupReset();
      setupV3BottomNav();
    },
  };
})();
