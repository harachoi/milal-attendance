# Vercel 배포 가이드 (GitHub 자동 배포)

이 가이드는 `attendance-app`을 **GitHub → Vercel** 자동 배포로 올리는 과정입니다.
한 번 셋업하면 다음부터는 `git push`만 해도 자동으로 새 버전이 배포됩니다.

> 진행 순서: **1) Firebase 셋업 → 2) 로컬 동작 확인 → 3) GitHub 업로드 → 4) Vercel 연결 → 5) 도메인을 Firebase에 등록**

---

## 1. Firebase 셋업 (먼저 완료)

[FIREBASE_SETUP.md](./FIREBASE_SETUP.md)의 1~6단계를 끝내고
- `.env.local` 파일에 값이 채워져 있고
- `npm run dev` 실행 시 헤더에 **● 실시간** 배지가 보이는 상태여야 합니다.

---

## 2. GitHub 새 리포지토리 만들기

1. [https://github.com/new](https://github.com/new) 접속
2. **Repository name**: `attendance-app` (원하는 이름)
3. **Private** 선택 권장 (Firebase config는 클라이언트 코드라 비밀은 아니지만 좋은 습관)
4. **README/.gitignore/license는 모두 비워둠** (현재 폴더에 이미 있음)
5. **Create repository** 클릭
6. 다음 화면에서 표시되는 명령어를 메모해두세요. 예시:
   ```
   git@github.com:사용자명/attendance-app.git
   ```

---

## 3. 로컬에서 GitHub에 푸시

`attendance-app` 폴더로 이동한 뒤:

```bash
cd "/Users/harachoi/Desktop/Files/my/ai project/attendance-app"

# 별도 깃 저장소로 초기화 (부모 폴더의 깃과 분리)
git init
git checkout -b main
git add .
git commit -m "Initial commit: 밀알청년 출석체크 PWA"

# 위에서 받은 주소로 교체
git remote add origin git@github.com:사용자명/attendance-app.git
git push -u origin main
```

> `.env.local`은 `.gitignore`에 의해 자동 제외됩니다.

---

## 4. Vercel 가입 및 GitHub 연동

1. [https://vercel.com](https://vercel.com) 접속
2. **Sign Up** → **Continue with GitHub** (GitHub 계정으로 로그인)
3. 처음이면 GitHub 권한 허용 (Vercel이 리포 목록을 보게 됨)
4. 대시보드에서 **Add New... → Project**
5. **Import Git Repository** 섹션에서 방금 만든 `attendance-app` 리포 옆 **Import** 클릭
6. 권한이 필요하면 **Adjust GitHub App Permissions** → `attendance-app` 추가

---

## 5. 프로젝트 설정

Import 화면에서:

| 설정 | 값 |
|---|---|
| **Framework Preset** | Vite (자동 감지됨) |
| **Root Directory** | `./` (그대로) |
| **Build Command** | `npm run build` (자동) |
| **Output Directory** | `dist` (자동) |
| **Install Command** | `npm install` (자동) |
| **Node.js Version** | 20.x (자동, `.nvmrc` 덕분) |

### 환경 변수 (Environment Variables) — 중요!

`.env.local`의 값들을 그대로 옮기세요. **Environment Variables** 섹션에서 6개 추가:

| Name | Value |
|---|---|
| `VITE_FIREBASE_API_KEY` | (`.env.local`의 값) |
| `VITE_FIREBASE_AUTH_DOMAIN` | … |
| `VITE_FIREBASE_PROJECT_ID` | … |
| `VITE_FIREBASE_STORAGE_BUCKET` | … |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | … |
| `VITE_FIREBASE_APP_ID` | … |

각각 **Production, Preview, Development** 환경에 모두 적용.

→ **Deploy** 클릭. 1~2분 후 배포 완료.

---

## 6. Firebase에 도메인 허가 등록 (필수)

Vercel이 발급한 도메인(예: `attendance-app-xxx.vercel.app`)을 Firebase Authentication의
허용 도메인 목록에 추가하지 않으면 로그인이 차단됩니다.

1. [Firebase 콘솔](https://console.firebase.google.com) → 프로젝트 → **Authentication**
2. 상단 **Settings (설정)** 탭
3. **Authorized domains (승인된 도메인)** 섹션에서 **Add domain**
4. Vercel에서 받은 도메인 입력 (예: `attendance-app-xxx.vercel.app`)
5. **Add** 클릭

(나중에 커스텀 도메인을 붙이면 그 도메인도 마찬가지로 추가)

---

## 7. 다 됐는지 확인

1. Vercel에서 받은 URL 접속
2. 헤더 우측에 **● 실시간** 배지 — 잘 동작
3. 다른 기기(또는 시크릿 창)에서 같은 URL 접속, 한쪽에서 체크하면 다른 쪽에 즉시 반영
4. iPhone 사파리에서 접속 → "홈 화면에 추가" → 아이콘 탭 → 앱처럼 풀스크린 실행 ✓

---

## 워크스페이스 분리 (선택)

여러 그룹이 한 Firebase 프로젝트를 공유한다면 URL에 `?ws=` 파라미터를 붙이세요:
- `https://attendance-app.vercel.app/?ws=youth1` → 청년 1부
- `https://attendance-app.vercel.app/?ws=youth2` → 청년 2부

각 워크스페이스는 별도 문서로 저장되어 데이터가 섞이지 않습니다.

---

## 다음 배포 (이후 변경 사항 올릴 때)

```bash
git add .
git commit -m "변경 내용 설명"
git push
```

→ Vercel이 자동으로 새 빌드를 시작하고, 1~2분 뒤 같은 URL에 반영됩니다.

---

## 커스텀 도메인 (선택, 예: `attendance.our-church.com`)

1. Vercel 프로젝트 → **Settings → Domains**
2. 도메인 입력 후 안내된 DNS 레코드를 도메인 등록처에 설정
3. HTTPS는 자동 발급
4. 새 도메인을 다시 **Firebase Authentication의 승인된 도메인**에 추가

---

## 문제 해결

| 증상 | 원인/해결 |
|---|---|
| 빌드 실패: `tsc -b` 에러 | Vercel 빌드 로그 확인 — 보통 의존성 미설치이거나 타입 오류 |
| 페이지는 뜨는데 배지가 "오류" | Vercel 환경 변수가 빠지거나 Firebase 승인 도메인 미등록 |
| 배지가 "오프라인"으로만 보임 | 익명 인증 비활성화. Firebase Auth에서 익명 사용 설정 켜기 |
| 사진 저장이 안 됨 (iOS) | 첫 클릭은 "공유 / 사진 앱 저장" 버튼 사용, 시스템 공유 시트가 떠야 함 |
| PWA 설치 배너가 안 보임 | 이미 설치되었거나 닫기 누른 후. `localStorage.removeItem('pwa.installDismissed')` 후 새로고침 |

---

준비 완료. 이 가이드대로 진행하면 5~10분 내에 인터넷에 올릴 수 있습니다.
