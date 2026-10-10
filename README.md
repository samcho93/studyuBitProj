# ⏱️ 마이크로비트 프로젝트



| | |
|---|---|
| 사이트 | https://studyubitproj.pages.dev/ |
| 학생용 | https://studyubitproj.pages.dev/student.html |
| 교사용 | https://studyubitproj.pages.dev/teacher.html |
| 엔진 | micro:bit MicroPython형 (원본 studyMpython) |
| 대상 · 수준 | 초중고 · 입문 |

## 로컬에서 보기

```bash
python server/serve.py --port 8080
```

Windows 는 `start.bat`, 같은 네트워크의 학생에게는 `start-lan.bat`.

## 배포 (Cloudflare Pages)

```bash
npx wrangler pages deploy . --project-name studyubitproj --branch main
```

## 커리큘럼

| # | 챕터 | 교시 |
|---|---|---|
| 01 | 🚀 마이크로비트와 프로젝트 준비 | 시뮬레이터와 실제 보드 둘러보기 · 프로젝트를 만드는 방법 — 단계별 개발과 토론 |
| 02 | 📐 센서로 움직임 읽기 | 가속도 센서 — 흔들림을 숫자로 · 지자기 센서 — 방향 알아내기 |
| 03 | 👟 걸음 수 세기 — 만보기 만들기 | 걸음은 어떻게 생길까 — 가속도 그래프 읽기 · 만보기 완성 — 걸음 검출 함수 쓰기 |
| 04 | 🎵 케이던스와 메트로놈 비트음 | 케이던스 측정하기 · 메트로놈 비트음으로 페이스 맞추기 |
| 05 | 📈 보폭 계산과 러닝 데이터 시각화 | 보폭 · 거리 계산과 러닝 기록 저장 · 웹으로 러닝 데이터 보기 |
| 06 | 🧭 걸음과 방향으로 위치 찾기 | 실내에서 위치를 아는 방법 — 추측항법 · 움직임으로 위치 추적하기 |
| 07 | 🗺️ 가상 공간 설계와 경로 기록 | 2차원 공간 설계하기 · 이동 경로 저장하기 |
| 08 | 🏁 경로 시각화와 정확도 높이기 | 웹 지도에서 경로 보기 · 정확도 개선과 프로젝트 발표 |

## 콘텐츠 작성 · 검사

- 형식: `docs/LESSON_GUIDE.md`
- 검사: `node tools/validate.js <id>`

_lectureBuilder 로 생성됨._
