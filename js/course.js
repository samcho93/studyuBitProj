/* 마이크로비트 프로젝트 — 강좌 설정
 * lectureBuilder 가 docs/curriculum.json 으로 생성합니다. (직접 고치면 다음 생성 때 덮어씀)
 * 각 챕터는 lessons/<id>.js 에서 MB_COURSE.addChapter({...}) 로 등록합니다.
 */
window.MB_COURSE = {
  "title": "마이크로비트 프로젝트",
  "shortTitle": "마이크로비트 프로젝트",
  "subtitle": "",
  "icon": "⏱️",
  "intro": "micro:bit 하나로 <b>러닝 데이터 측정기</b>와 <b>실내 이동 경로 추적기</b>를 차근차근 만들어 보는 프로젝트 강좌입니다. 가속도 · 지자기 센서로 걸음 수 · 케이던스 · 보폭 · 방향을 재고, 메트로놈 비트음을 내고, 저장한 데이터를 웹 화면에서 그래프와 지도로 확인합니다. 매 교시는 수업 전 <b>생각하기</b> 질문으로 시작하고, 단계마다 생길 수 있는 문제를 미리 토론하며, 어려운 계산은 준비된 함수로 가져다 씁니다.",
  "footer": "마이크로비트 프로젝트",
  "teacherPass": "samcho93",
  "docBase": "",
  "order": [
    {
      "id": "ch01",
      "no": "01",
      "title": "마이크로비트와 프로젝트 준비",
      "icon": "🚀"
    },
    {
      "id": "ch02",
      "no": "02",
      "title": "센서로 움직임 읽기",
      "icon": "📐"
    },
    {
      "id": "ch03",
      "no": "03",
      "title": "걸음 수 세기 — 만보기 만들기",
      "icon": "👟"
    },
    {
      "id": "ch04",
      "no": "04",
      "title": "케이던스와 메트로놈 비트음",
      "icon": "🎵"
    },
    {
      "id": "ch05",
      "no": "05",
      "title": "보폭 계산과 러닝 데이터 시각화",
      "icon": "📈"
    },
    {
      "id": "ch06",
      "no": "06",
      "title": "걸음과 방향으로 위치 찾기",
      "icon": "🧭"
    },
    {
      "id": "ch07",
      "no": "07",
      "title": "가상 공간 설계와 경로 기록",
      "icon": "🗺️"
    },
    {
      "id": "ch08",
      "no": "08",
      "title": "경로 시각화와 정확도 높이기",
      "icon": "🏁"
    }
  ],
  "chapters": {},
  "addChapter": function (ch) { this.chapters[ch.id] = ch; }
};
