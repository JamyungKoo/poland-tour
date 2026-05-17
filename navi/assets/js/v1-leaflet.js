// v1-leaflet.js — Leaflet 인터랙티브 지도
(function () {
  'use strict';
  const { data } = window.NaviCore;

  function initMap() {
    const map = L.map('overview-map', {
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(map);

    const mainStops = data.stops.filter(s => !s.extension);
    const extStop = data.stops.find(s => s.extension);

    // 폴리라인: 정거장 1→13 도보 경로
    const latlngs = mainStops.map(s => [s.lat, s.lon]);
    const polyline = L.polyline(latlngs, {
      color: '#b8420a',
      weight: 4,
      opacity: 0.75,
      dashArray: null,
    }).addTo(map);

    // 마커: 각 정거장
    mainStops.forEach((s) => {
      const isTerminus = s.terminus;
      const color = isTerminus ? '#4a7c4e' : '#b8420a';
      const icon = L.divIcon({
        className: 'stop-marker',
        html: `<div style="background:${color};color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${s.num}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      const marker = L.marker([s.lat, s.lon], { icon }).addTo(map);
      marker.bindPopup(`
        <strong>${s.num}. ${s.nameKr}</strong><br>
        <em style="color:#666;font-size:12px">${s.namePl}</em><br>
        <a href="#${s.id}" onclick="this.closest('.leaflet-popup').querySelector('.leaflet-popup-close-button')?.click();">상세 보기 ↓</a>
      `);
    });

    // 연장 정거장 (점선 연결)
    if (extStop) {
      const terminus = mainStops[mainStops.length - 1];
      L.polyline([[terminus.lat, terminus.lon], [extStop.lat, extStop.lon]], {
        color: '#908882',
        weight: 3,
        opacity: 0.5,
        dashArray: '6, 6',
      }).addTo(map);
      const extIcon = L.divIcon({
        className: 'stop-marker',
        html: `<div style="background:#5b5450;color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)">+1</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      L.marker([extStop.lat, extStop.lon], { icon: extIcon })
        .addTo(map)
        .bindPopup(`<strong>+1. ${extStop.nameKr}</strong> (옵션 연장)`);
    }

    // 전체 경로 fit
    map.fitBounds(polyline.getBounds(), { padding: [30, 30] });

    // ====== Geolocation: 현재 위치 마커 ======
    setupGeolocation(map, mainStops);

    return map;
  }

  function setupGeolocation(map, mainStops) {
    if (!navigator.geolocation) return;
    let userMarker = null;
    let userCircle = null;

    function handlePos(pos) {
      const { latitude, longitude, accuracy } = pos.coords;
      const latlng = [latitude, longitude];
      if (!userMarker) {
        userMarker = L.circleMarker(latlng, {
          radius: 8,
          fillColor: '#2563eb',
          color: '#fff',
          weight: 3,
          opacity: 1,
          fillOpacity: 1,
        }).addTo(map).bindPopup('내 위치');
        userCircle = L.circle(latlng, {
          radius: accuracy,
          fillColor: '#2563eb',
          color: '#2563eb',
          weight: 1,
          opacity: 0.3,
          fillOpacity: 0.1,
        }).addTo(map);
      } else {
        userMarker.setLatLng(latlng);
        userCircle.setLatLng(latlng).setRadius(accuracy);
      }
      updateNearestStop(latitude, longitude, mainStops);
    }
    function handleErr(err) {
      console.warn('Geolocation error:', err.message);
    }

    const btn = document.getElementById('btn-locate');
    if (btn) {
      btn.addEventListener('click', () => {
        btn.disabled = true;
        btn.textContent = '⌛ 위치 확인 중…';
        navigator.geolocation.getCurrentPosition((pos) => {
          handlePos(pos);
          map.setView([pos.coords.latitude, pos.coords.longitude], 15);
          btn.disabled = false;
          btn.textContent = '📍 내 위치';
          // 이후 watchPosition으로 갱신
          navigator.geolocation.watchPosition(handlePos, handleErr, {
            enableHighAccuracy: true, maximumAge: 10000,
          });
        }, (err) => {
          btn.disabled = false;
          btn.textContent = '📍 내 위치';
          alert('위치 권한이 필요합니다.\n' + err.message);
        }, { enableHighAccuracy: true, timeout: 10000 });
      });
    }
  }

  function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function updateNearestStop(lat, lon, mainStops) {
    let nearest = null, minD = Infinity;
    mainStops.forEach(s => {
      const d = haversineKm(lat, lon, s.lat, s.lon);
      if (d < minD) { minD = d; nearest = s; }
    });
    const el = document.getElementById('nearest-stop');
    if (el && nearest) {
      const meters = Math.round(minD * 1000);
      el.textContent = `가장 가까운 정거장: ${nearest.num} ${nearest.nameKr} (${meters >= 1000 ? (minD).toFixed(2) + 'km' : meters + 'm'})`;
    }
  }

  window.V1Leaflet = { initMap };
})();
