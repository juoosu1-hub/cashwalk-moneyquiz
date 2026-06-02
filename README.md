# 캐시워크 돈버는퀴즈 사이트

GitHub Pages에 바로 올릴 수 있는 날짜별 캐시워크 돈버는퀴즈 정답 확인 사이트입니다. 사이트 브랜드명은 `캐시워크 돈버는퀴즈`로 통일했습니다.

## 구성

- `index.html`: 홈, 최신 글, 빠른 날짜 링크
- `archive.html`: 날짜별 글 목록
- `data/answers.json`: 날짜별 정답 데이터
- `answers/2026-06-03.html`: 날짜별 정답 글 예시
- `answers/2026-06-02.html`: 날짜별 정답 글 예시
- `guide.html`: 정답 확인 방법 안내
- `about.html`, `contact.html`, `privacy.html`, `terms.html`: 애드센스 심사에 필요한 기본 페이지

## 배포 전 변경할 것

1. `YOUR_GITHUB_USERNAME`을 실제 GitHub 계정명으로 바꿉니다.
2. 저장소명이 다르면 `cashwalk-moneyquiz` 경로를 실제 저장소명으로 바꿉니다.
3. `your-email@example.com`을 실제 문의 이메일로 바꿉니다.
4. `data/answers.json`의 `확인 필요` 부분을 실제 확인한 정답으로 교체합니다.
5. 매일 새 글을 만들 때는 `answers/YYYY-MM-DD.html` 형식으로 복사해 제목, 설명, 본문, 사이트맵, `data/answers.json`을 업데이트합니다.

## ChatGPT 무료버전 사용법

ChatGPT 무료버전은 GitHub Pages에서 자동 호출할 수 있는 API가 아닙니다. 캐시워크 앱에서 직접 확인한 문제 문장과 정답 후보를 ChatGPT에 붙여넣고 JSON으로 정리한 다음, 그 결과를 `data/answers.json`에 넣는 방식으로 운영하세요.

API로 완전 자동화를 하려면 별도 서버와 OpenAI API 키가 필요합니다. API 키는 브라우저 JavaScript나 공개 GitHub 저장소에 넣으면 안 됩니다.

## GitHub Actions 자동화

이 사이트는 GitHub Actions로 날짜별 정답 데이터를 자동 갱신할 수 있습니다.

### 1. GitHub Secrets 설정

GitHub 저장소에서 Settings > Secrets and variables > Actions > Secrets에 아래 값을 추가합니다.

- `OPENAI_API_KEY`: OpenAI API 키

### 2. GitHub Variables 설정

Settings > Secrets and variables > Actions > Variables에 아래 값을 추가합니다.

- `SITE_BASE_URL`: 배포 주소 예시 `https://YOUR_GITHUB_USERNAME.github.io/cashwalk-moneyquiz`
- `ANSWER_SOURCE_URLS`: 정답 후보를 가져올 URL 목록. 여러 개면 줄바꿈 또는 쉼표로 구분
- `OPENAI_MODEL`: 사용할 모델명. 비워두면 워크플로 기본값을 사용

### 3. 실행 방식

`.github/workflows/update-answers.yml`은 한국 시간 기준 오전/낮/저녁에 실행되도록 설정되어 있습니다. GitHub Actions 탭에서 `Run workflow`로 수동 실행도 가능합니다.

### 4. 자동화가 하는 일

1. `ANSWER_SOURCE_URLS` 또는 `data/source-pages.json`의 URL을 읽습니다.
2. 페이지 텍스트에서 오늘 날짜의 캐시워크 돈버는퀴즈 정답 후보를 추출합니다.
3. OpenAI API에 “추측 금지” 규칙으로 JSON 정리를 요청합니다.
4. 신뢰 가능한 항목이 있을 때만 `data/answers.json`, `answers/YYYY-MM-DD.html`, `sitemap.xml`을 업데이트합니다.
5. 변경 사항을 자동 커밋합니다.

정답 원천 URL이 없으면 자동화는 가짜 정답을 만들지 않고 종료됩니다. 애드센스 승인 관점에서도 실제 확인 가능한 정보와 충분한 안내 문장을 함께 유지하는 편이 안전합니다.

## 운영 팁

애드센스 심사에는 단순 정답 나열보다 독자가 이해할 수 있는 안내 문장, 업데이트 시간, 정정 메모, 개인정보처리방침과 문의 페이지가 중요합니다. 실제 정답을 올릴 때도 문제 키워드와 확인 시간을 함께 남겨 콘텐츠 품질을 유지하세요.
