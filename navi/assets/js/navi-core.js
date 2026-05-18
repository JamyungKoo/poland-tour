// navi-core.js — 공통 기능: 렌더링, 방문 체크, 하단 네비, 진행도
(function () {
  'use strict';

  const STORAGE_KEY = 'warsawTourVisited_v1';
  const data = window.TOUR_DATA;
  if (!data) throw new Error('stops-data.js must load before navi-core.js');

  // ====== 방문 상태 ======
  function loadVisited() {
    try {
      return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
    } catch (e) {
      return new Set();
    }
  }
  function saveVisited(set) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  }
  const visited = loadVisited();

  // ====== 구글지도 딥링크 ======
  // origin이 있으면 길찾기, 없으면 단순 위치 보기
  function googleMapsDirections(fromLat, fromLon, toLat, toLon, toName) {
    const dest = `${toLat},${toLon}`;
    const origin = fromLat && fromLon ? `${fromLat},${fromLon}` : '';
    const params = new URLSearchParams({
      api: '1',
      destination: dest,
      travelmode: 'walking',
    });
    if (origin) params.set('origin', origin);
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }
  function googleMapsPlace(lat, lon, name) {
    const q = encodeURIComponent(`${name} @${lat},${lon}`);
    return `https://www.google.com/maps/search/?api=1&query=${q}`;
  }

  // ====== 정거장 카드 렌더링 ======
  function renderStop(stop, idx, prevStop) {
    const article = document.createElement('article');
    article.className = 'stop';
    if (stop.terminus) article.classList.add('terminus');
    if (stop.extension) article.classList.add('extension');
    if (visited.has(stop.id)) article.classList.add('visited');
    article.id = stop.id;
    article.dataset.idx = idx;

    const fromLat = prevStop ? prevStop.lat : null;
    const fromLon = prevStop ? prevStop.lon : null;
    const dirUrl = googleMapsDirections(fromLat, fromLon, stop.lat, stop.lon, stop.nameKr);
    const placeUrl = googleMapsPlace(stop.lat, stop.lon, stop.namePl);

    const stayLabel = stop.stay ? ` · 머무는 시간 ${stop.stay}` : '';
    const paragraphsHtml = stop.paragraphs.map(p => `<p>${p}</p>`).join('');

    article.innerHTML = `
      <figure class="stop-photo">
        <span class="stop-num">${stop.num}${stop.terminus ? ' · 종착' : ''}</span>
        <img src="${stop.image}" alt="${stop.nameKr}" loading="lazy">
      </figure>
      <div class="stop-body">
        <div class="stop-time">${stop.time}${stayLabel}</div>
        <h2>${stop.nameKr}</h2>
        <div class="stop-pl">${stop.namePl}</div>
        ${paragraphsHtml}
        <div class="stop-actions">
          <a class="btn-directions" href="${dirUrl}" target="_blank" rel="noopener">
            🗺️ 구글 지도 길찾기
          </a>
          <a class="btn-place" href="${placeUrl}" target="_blank" rel="noopener" title="장소만 보기">
            📍
          </a>
          <button class="btn-visit ${visited.has(stop.id) ? 'checked' : ''}" data-stop-id="${stop.id}">
            ${visited.has(stop.id) ? '✓ 방문함' : '☐ 방문'}
          </button>
        </div>
      </div>
    `;
    return article;
  }

  // ====== 도보 구간 렌더링 ======
  function renderWalk(walk, fromStop, toStop, withEmbed) {
    const div = document.createElement('div');
    div.className = 'walk' + (walk.tram ? ' tram' : '');
    let embedHtml = '';
    if (withEmbed && fromStop && toStop) {
      const src = `https://www.google.com/maps/embed/v1/directions?key=__NO_KEY__&origin=${fromStop.lat},${fromStop.lon}&destination=${toStop.lat},${toStop.lon}&mode=${walk.tram ? 'transit' : 'walking'}`;
      // 키 없으면 임베드 API가 작동 안 함. fallback으로 query 기반 임베드 사용.
      const fallbackSrc = `https://maps.google.com/maps?saddr=${fromStop.lat},${fromStop.lon}&daddr=${toStop.lat},${toStop.lon}&dirflg=${walk.tram ? 'r' : 'w'}&t=m&output=embed`;
      embedHtml = `
        <div class="walk-map">
          <iframe src="${fallbackSrc}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
        </div>`;
    }
    div.innerHTML = `
      <span class="arrow">↓</span>
      <div class="walk-content">
        <span class="walk-mode">${walk.mode}</span>
        <div class="walk-text">${walk.text}</div>
        ${embedHtml}
      </div>
    `;
    return div;
  }

  // ====== 메인 렌더 ======
  function render({ container, withEmbed = false }) {
    const stops = data.stops;
    const frag = document.createDocumentFragment();
    stops.forEach((stop, idx) => {
      const prev = idx > 0 ? stops[idx - 1] : null;
      frag.appendChild(renderStop(stop, idx, prev));
      if (stop.walkAfter && idx < stops.length - 1) {
        const next = stops[idx + 1];
        frag.appendChild(renderWalk(stop.walkAfter, stop, next, withEmbed));
      }
    });
    container.appendChild(frag);
    bindEvents();
    updateProgress();
  }

  // ====== 이벤트 바인딩 ======
  function bindEvents() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-visit');
      if (!btn) return;
      const id = btn.dataset.stopId;
      const article = document.getElementById(id);
      if (visited.has(id)) {
        visited.delete(id);
        article.classList.remove('visited');
        btn.classList.remove('checked');
        btn.textContent = '☐ 방문';
      } else {
        visited.add(id);
        article.classList.add('visited');
        btn.classList.add('checked');
        btn.textContent = '✓ 방문함';
      }
      saveVisited(visited);
      updateProgress();
    });
  }

  // ====== 진행도 ======
  function updateProgress() {
    const total = data.stops.filter(s => !s.extension).length;
    const done = data.stops.filter(s => !s.extension && visited.has(s.id)).length;
    const pct = total ? Math.round(done / total * 100) : 0;
    const fillEl = document.querySelector('.progress-bar .fill');
    const countEl = document.querySelector('.progress-bar .count');
    if (fillEl) fillEl.style.width = pct + '%';
    if (countEl) countEl.textContent = `${done} / ${total}`;
  }

  // ====== 하단 네비: 현재 보이는 정거장 추적 ======
  let currentIdx = 0;
  function setupBottomNav() {
    const nav = document.querySelector('.bottom-nav');
    if (!nav) return;
    const prevBtn = nav.querySelector('.prev');
    const nextBtn = nav.querySelector('.next');
    const centerCurrent = nav.querySelector('.center .current');
    const centerTotal = nav.querySelector('.center .total');
    centerTotal.textContent = data.stops.length;

    function updateNav() {
      const stop = data.stops[currentIdx];
      const prev = currentIdx > 0 ? data.stops[currentIdx - 1] : null;
      const next = currentIdx < data.stops.length - 1 ? data.stops[currentIdx + 1] : null;
      centerCurrent.textContent = stop.num;
      prevBtn.disabled = !prev;
      nextBtn.disabled = !next;
      prevBtn.querySelector('.target').textContent = prev ? `${prev.num} ${prev.nameKr}` : '—';
      nextBtn.querySelector('.target').textContent = next ? `${next.num} ${next.nameKr}` : '—';
    }

    prevBtn.addEventListener('click', () => {
      if (currentIdx > 0) {
        currentIdx--;
        document.getElementById(data.stops[currentIdx].id).scrollIntoView({ behavior: 'smooth', block: 'start' });
        updateNav();
      }
    });
    nextBtn.addEventListener('click', () => {
      if (currentIdx < data.stops.length - 1) {
        currentIdx++;
        document.getElementById(data.stops[currentIdx].id).scrollIntoView({ behavior: 'smooth', block: 'start' });
        updateNav();
      }
    });

    // 스크롤 위치에 따라 currentIdx 갱신 (viewport 중앙에 가장 가까운 정거장)
    const stopEls = Array.from(document.querySelectorAll('.stop'));
    let raf = null;
    function onScroll() {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        const viewCenter = window.scrollY + window.innerHeight / 2;
        let bestIdx = 0, bestDist = Infinity;
        stopEls.forEach((el, i) => {
          const rect = el.getBoundingClientRect();
          const top = rect.top + window.scrollY;
          const center = top + rect.height / 2;
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
    onScroll();
    updateNav();
  }

  // ====== 헤더 메타 채우기 ======
  function fillHeader() {
    const titleEl = document.querySelector('.tour-header h1');
    const subEl = document.querySelector('.tour-header .subtitle');
    const totalKmEl = document.querySelector('.tour-meta .total-km .val');
    const totalTimeEl = document.querySelector('.tour-meta .total-time .val');
    const stopsCountEl = document.querySelector('.tour-meta .stops-count .val');
    if (titleEl) titleEl.textContent = data.meta.title;
    if (subEl) subEl.textContent = data.meta.subtitle;
    if (totalKmEl) totalKmEl.textContent = data.meta.totalKm;
    if (totalTimeEl) totalTimeEl.textContent = data.meta.totalTime;
    if (stopsCountEl) stopsCountEl.textContent = data.meta.stopsCount;
  }

  // ====== 티켓 가이드 (펼침 카드) ======
  function injectTicketCard(target) {
    const el = document.createElement('details');
    el.className = 'ticket-card';
    el.innerHTML = `
      <summary>🎫 대중교통 티켓 가이드 (탭하여 펼치기)</summary>
      <div class="ticket-body">
        <p><strong>바르샤바 ZTM/WTP — Zone 1</strong>. 모든 투어 정거장은 Zone 1.</p>
        <h4>티켓 종류와 가격</h4>
        <table>
          <thead><tr><th>종류</th><th>가격</th><th>언제</th></tr></thead>
          <tbody>
            <tr><td>20분권</td><td class="price">3.40 zł</td><td>짧은 한 정거장</td></tr>
            <tr><td><strong>75분권</strong> ⭐</td><td class="price">4.40 zł</td><td>환승 자유, 가장 일반적</td></tr>
            <tr><td>24시간권</td><td class="price">15 zł</td><td>4회 이상 탈 거면 이게 이득</td></tr>
            <tr><td>72시간권</td><td class="price">36 zł</td><td>3일 이상 체류</td></tr>
            <tr><td>주말권 (금19시~월8시)</td><td class="price">24 zł</td><td>주말 도시 탐방</td></tr>
          </tbody>
        </table>
        <h4>어디서 어떻게 사는가</h4>
        <ul>
          <li><strong>컨택트리스 카드 직접 태그</strong> ⭐ — 마스터/비자 컨택트리스 카드, Apple Pay, Google Pay로 차내 노란 단말기에 그대로 태그. 자동 75분권. <strong>일일 누적 15 zł 도달 시 자동 무료(cap)</strong>.</li>
          <li><strong>자동판매기(Biletomat)</strong> — 모든 메트로역과 주요 정류장. 영어 지원, 카드/현금 OK.</li>
          <li><strong>모바일 앱</strong> — mobiWAWA(공식), jakdojade(길찾기+티켓), SkyCash. 한국에서 미리 설치 가능.</li>
          <li><strong>차내 자판기</strong> — 카드만 받는 경우 많음.</li>
        </ul>
        <div class="warning">
          ⚠️ <strong>종이 티켓은 탑승 즉시 노란 펀치기(kasownik)에 찍을 것!</strong> 안 찍으면 무임승차 벌금 약 266 zł. 컨택트리스 카드와 모바일 앱은 단말기 태그/앱 활성화만으로 OK.
        </div>
        <h4>이 투어에서 권장</h4>
        <ul>
          <li>도보 위주, 트램/버스 2회 이내 (8→9, 12→13) → <strong>컨택트리스 카드 그대로 태그</strong> (자동 cap, 결국 최대 15 zł)</li>
          <li>박물관 등 다른 곳도 많이 다닐 예정 → <strong>24시간권 15 zł</strong></li>
        </ul>
        <p style="font-size: 11px; color: var(--ink-mute); margin-top: 10px;">출처: wtp.waw.pl · 2026년 5월 기준. 출발 직전 공식 사이트 재확인 권장.</p>
      </div>
    `;
    target.appendChild(el);
  }

  // ====== 외부 API ======
  window.NaviCore = {
    render,
    setupBottomNav,
    fillHeader,
    injectTicketCard,
    data,
    visited,
    googleMapsDirections,
    googleMapsPlace,
  };
})();
