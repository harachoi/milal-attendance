# Firebase 5분 셋업 가이드

이 앱은 Firebase가 설정되어 있지 않으면 자동으로 **로컬 전용 모드**(이 기기에만 저장)로 동작합니다. 여러 명이 동시에 보고 편집하려면 아래 단계를 따라 Firebase를 연결하세요.

## 1. Firebase 프로젝트 생성 (3분)

1. [https://console.firebase.google.com](https://console.firebase.google.com) 접속
2. 로그인 (Google 계정)
3. **"프로젝트 추가"** 클릭
4. 이름: `attendance-app` 등 원하는 이름 입력 → 계속
5. Google Analytics: **사용 안 함**(불필요) → 프로젝트 만들기
6. 1분 정도 기다린 후 **계속** 클릭

## 2. 웹 앱 등록 (1분)

1. 프로젝트 홈에서 `</>` (웹) 아이콘 클릭
2. 앱 닉네임: `attendance-web` (임의) → 앱 등록
3. **Firebase Hosting은 체크하지 않음** → 다음
4. 표시되는 `firebaseConfig` 객체의 값들을 메모해 두세요. 예시:

```js
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXX...",
  authDomain: "attendance-app-xxx.firebaseapp.com",
  projectId: "attendance-app-xxx",
  storageBucket: "attendance-app-xxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef..."
};
```

## 3. Firestore 데이터베이스 생성 (1분)

1. 왼쪽 메뉴 → **빌드 → Firestore Database**
2. **데이터베이스 만들기** 클릭
3. 위치: `asia-northeast3 (Seoul)` 권장 → 다음
4. **"테스트 모드로 시작"** 선택 (나중에 보안 규칙을 더 강화할 수 있음) → 사용 설정

## 4. 익명 인증 활성화 (1분)

1. 왼쪽 메뉴 → **빌드 → Authentication**
2. **시작하기** → 로그인 방법 탭
3. **익명** 행 클릭 → 사용 설정 → 저장

## 5. 환경 변수 파일 만들기

프로젝트 루트(`attendance-app/`)에 **`.env.local`** 파일을 만들고 2단계에서 메모한 값을 넣으세요:

```
VITE_FIREBASE_API_KEY=AIzaSyXXXXXXXX...
VITE_FIREBASE_AUTH_DOMAIN=attendance-app-xxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=attendance-app-xxx
VITE_FIREBASE_STORAGE_BUCKET=attendance-app-xxx.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef...
```

> `.env.example` 파일을 그대로 복사해서 시작하면 편합니다:
> `cp .env.example .env.local`

## 6. 개발 서버 재시작

```bash
npm run dev
```

브라우저에서 헤더 우측에 **● 실시간** 배지가 보이면 연결 완료입니다.

## 7. 보안 규칙 (선택 — 권장)

기본은 30일 후 모든 접근이 차단되는 "테스트 모드"입니다. 실서비스에서는 아래 규칙으로 바꾸세요. Firestore Database → **규칙** 탭에서:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /workspaces/{wsId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

→ "익명 로그인 한 사용자만 읽기/쓰기 가능"

## 워크스페이스 분리 (선택)

여러 청년부/그룹이 한 Firebase 프로젝트를 같이 쓰려면 URL에 `?ws=` 파라미터를 붙이세요.

- `https://your-app.com/?ws=youth1` → "youth1" 워크스페이스
- `https://your-app.com/?ws=youth2` → "youth2" 워크스페이스
- 파라미터가 없으면 기본 `main` 워크스페이스

각 워크스페이스는 완전히 분리되어 있고, 같은 코드를 가진 사람들끼리만 데이터를 공유합니다.

## 문제 해결

- **배지가 "오류"로 표시됨** → Authentication에서 익명 로그인이 활성화됐는지 확인
- **데이터가 다른 기기에 안 보임** → 같은 URL(같은 `?ws=` 코드)을 사용하는지 확인
- **`.env.local` 변경 후 반영 안 됨** → Vite 개발 서버는 환경 변수 변경 시 **재시작** 필요
- **무료 한도** → Firestore 무료 한도는 50K 읽기/20K 쓰기/일 — 청년부 한 그룹은 충분히 안에 들어갑니다
