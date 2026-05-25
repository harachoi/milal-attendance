# 밀알청년 출석체크 (attendance-app)

5개 조(사랑/믿음/인내/영광/소망)의 청년·교사 출석을 휴대폰에서 터치로 체크하고,
한 장의 PNG 이미지로 내려받거나 날짜별 엑셀로 추출할 수 있는 **PWA + 실시간 동기화** 웹앱.

## 주요 기능

- **터치 한 번 출석 체크** — 이름 누르면 `O` 표시, 행 강조, 햅틱
- **조 단위 전체 체크/해제**
- **실시간 소계** — 조별·전체 청년/교사 인원 자동 집계
- **명단 편집** — 청년/교사 인앱 추가·수정·삭제·"굵게" 표시
- **사역자 / 봉사교사 / 참관** + **헌금 / 메모** 입력
- **이미지 저장** — 두 번째 사진과 같은 레이아웃 PNG (1280px) 다운로드/공유
- **날짜별 기록** — 매주 출석을 따로 저장
- **엑셀 추출** — 왼쪽 이름, 오른쪽 날짜별 O 표시 + 요약/조별 통계 시트
- **PWA** — 홈 화면에 설치, 오프라인 동작, 자동 업데이트
- **실시간 동기화** (Firebase 연결 시) — 여러 명이 동시에 보고 편집

## 빠른 실행

```bash
nvm use 20
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/
```

## 폴더 구조

```
src/
├── App.tsx                       메인 컨테이너
├── main.tsx                      엔트리 + PWA 등록
├── pwa.ts                        Service Worker 등록
├── index.css                     Tailwind + Pretendard
├── types.ts                      DayRecord/AttendanceState 등 타입
├── data/initialData.ts           초기 명단
├── store/AttendanceStore.tsx     Context + localStorage + Firestore sync
├── firebase/
│   ├── config.ts                 환경 변수 (가벼움, firebase import X)
│   └── sync.ts                   동적 로드되는 실시간 동기화 레이어
├── utils/
│   ├── format.ts                 날짜/금액 포매팅
│   └── excel.ts                  xlsx 매트릭스 생성 (동적 로드)
└── components/
    ├── Header.tsx                상단 요약 + 액션 + 동기화 배지
    ├── InstallPrompt.tsx         PWA 설치 안내
    ├── TeamTabs.tsx              조 선택 탭
    ├── TeamAttendance.tsx        조별 출석 표
    ├── MemberRow.tsx             멤버 한 행
    ├── ExtraGroups.tsx           사역자/봉사교사/참관/헌금/메모
    ├── EditMembersModal.tsx      명단 편집 화면
    ├── RecordsModal.tsx          날짜 기록 + 엑셀 다운로드
    ├── SnapshotView.tsx          PNG로 캡처할 전체 현황 레이아웃
    └── SnapshotModal.tsx         미리보기 + 다운로드/공유
```

## 사용 흐름

1. 상단 날짜 확인 (기본 오늘)
2. 조 탭을 눌러 청년·교사 이름을 차례로 탭
3. 사역자/봉사교사/참관 필요한 사람 추가·체크
4. 헌금 금액 입력
5. **이미지 저장** → PNG 다운로드/공유
6. 다음 주에는 날짜 바꾸기 → 새 기록 시작
7. 분기/연말에 **기록 / 엑셀** → **엑셀(.xlsx)** 다운로드

## 데이터 저장

- 기본: **이 기기 (localStorage)** 에만 저장 — 새로고침해도 유지
- Firebase 연결 시: **Firestore** 에 자동 실시간 동기화 — 여러 명이 동시에 보고 편집

## Firebase 연동 (선택)

여러 명이 함께 사용하려면 [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) 가이드를 따라 5분 셋업 후 `.env.local` 채우기만 하면 됩니다.

연결되면 헤더 우측에 **● 실시간** 배지가 표시되고, 같은 URL을 가진 모든 기기 사이에서 변경사항이 즉시 반영됩니다.

URL `?ws=xxx` 파라미터로 워크스페이스를 분리할 수 있어 여러 그룹이 한 Firebase 프로젝트를 공유할 수 있습니다.

## PWA 설치

- **Android Chrome / 데스크탑 Chrome**: 상단 배너의 "앱으로 설치"
- **iOS Safari**: 공유 → "홈 화면에 추가"
- 설치 후: 풀스크린 앱처럼 동작, 오프라인에서도 데이터 사용 가능

> 실제 설치는 HTTPS 환경에서만 가능 (`localhost`는 예외). Vercel/Netlify 등에 배포하면 됩니다.

## 비고

초기 명단은 두 사진에서 최대한 정확히 옮겼지만 손글씨/저화질 부분은
부정확할 수 있습니다. 앱의 **명단 편집**에서 자유롭게 수정하세요.
