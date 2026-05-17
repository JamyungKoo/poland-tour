# Poland Tour

폴란드 교양강의 시리즈의 모바일 동반 투어 도구.
강의에서 다룬 도시를 현장에서 직접 걸을 때 사용하는 PWA.

## 구조

```
poland-tour/
├── index.html        루트 → warsaw 리다이렉트
├── navi/             공용 엔진 (도시 무관)
│   └── assets/       CSS, JS, 아이콘
└── warsaw/           바르샤바 도시 데이터 + 페이지
    ├── index.html        랜딩 (두 버전 비교)
    ├── v1-leaflet.html   인터랙티브 지도 + 구글지도 길찾기
    ├── v2-embed.html     구글 지도 iframe 임베드
    ├── manifest.json     PWA 매니페스트
    ├── sw.js             Service Worker (오프라인 캐시)
    ├── stops-data.js     13정거장 + 1연장 데이터
    └── images/           정거장 사진
```

## 사용

- 웹: <https://jamyungkoo.github.io/poland-tour/>
- 안드로이드 Chrome → "홈 화면에 추가" → PWA로 설치
- 오프라인 캐시 + 컨택트리스 카드 길찾기 + 방문 체크 + 현재 위치 마커

## 도시 추가

새 도시(예: `krakow/`) 폴더를 만들고 같은 패턴의 HTML/manifest/sw/stops-data/images만 추가하면 `navi/`의 공용 엔진을 재사용.

## 라이선스

- 코드: MIT
- 이미지: Wikimedia Commons (CC BY-SA / Public Domain)
