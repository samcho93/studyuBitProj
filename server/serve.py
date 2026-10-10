"""웹 실습 강좌 — 로컬 · 교실용 정적 웹 서버

    python server/serve.py            # http://localhost:8080
    python server/serve.py --lan      # 같은 네트워크의 학생 PC 에서 접속 (교사 PC 주소 표시)
    python server/serve.py --port 9000

이 강좌는 정적 파일만으로 동작하므로 GitHub Pages 에 그대로 올려도 됩니다.
이 서버는 수업용(인터넷이 없거나 교실 내에서만 쓸 때)으로만 쓰면 됩니다.
파이썬 코드는 서버가 아니라 각 학생의 브라우저 안에서 실행됩니다.
"""
import argparse
import os
import socket
import sys
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Handler(SimpleHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, fmt, *args):
        sys.stderr.write('%s  %s\n' % (time.strftime('%H:%M:%S'), fmt % args))

    def send_head(self):
        # 수업 중 파일을 고쳐도 바로 반영되도록 조건부 요청(304)을 쓰지 않는다
        if 'If-Modified-Since' in self.headers:
            del self.headers['If-Modified-Since']
        if 'If-None-Match' in self.headers:
            del self.headers['If-None-Match']
        return super().send_head()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        return s.getsockname()[0]
    except OSError:
        return '127.0.0.1'
    finally:
        s.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--port', type=int, default=8080)
    ap.add_argument('--lan', action='store_true', help='같은 네트워크의 다른 PC 에서 접속 허용')
    args = ap.parse_args()

    host = '0.0.0.0' if args.lan else '127.0.0.1'
    httpd = ThreadingHTTPServer((host, args.port), Handler)
    print('웹 실습 강좌 서버')
    print('  학생용 : http://localhost:%d/student.html' % args.port)
    print('  교사용 : http://localhost:%d/teacher.html' % args.port)
    if args.lan:
        print('  교실(LAN) : http://%s:%d/student.html' % (lan_ip(), args.port))
    print('Ctrl+C 로 종료합니다.')
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\n서버를 종료했습니다.')


if __name__ == '__main__':
    main()
