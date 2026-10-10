/* 강좌별 추가 기능 — lectureBuilder 가 엔진을 갱신해도 이 파일은 덮어쓰지 않습니다.
 * 쓸 수 있는 전역:
 *   MB_COURSE  강좌 데이터 (order · chapters)
 *   window.app 현재 상태 (= window.MbApp) — role('student'|'teacher') · view('doc'|'slides') · route · target('sim'|'board')
 *              app.sim(micro:bit 시뮬레이터) · app.console(콘솔 · 셸) · app.runCode(code, {label}) · app.toast(msg)
 *   MbEngine   파이썬 실행 환경(Pyodide) 상태 · MB_FIG 본문 그림용 보드 그리기 도우미
 * 화면이 바뀔 때마다:
 *   document.addEventListener('lb:render', function (e) {
 *     // e.detail = app.route = { type: 'home' | 'chapter' | 'section', ch, sec }
 *   });
 */
