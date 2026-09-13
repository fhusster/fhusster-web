#!/usr/bin/env python3
"""Local preview that mirrors Vercel's cleanUrls: /heavy-bag/privacy serves
heavy-bag/privacy.html, / serves index.html. Run: python3 preview.py [port]"""
import http.server, os, sys
class H(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        p = super().translate_path(path)
        if not os.path.exists(p) and os.path.isfile(p + ".html"):
            return p + ".html"
        return p
    def end_headers(self):
        if self.path.rstrip("/").endswith("app-ads.txt"):
            self.send_header("Content-Type", "text/plain; charset=utf-8")
        super().end_headers()
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
os.chdir(os.path.dirname(os.path.abspath(__file__)))
print(f"Preview at http://localhost:{port}/  (Ctrl+C to stop)")
http.server.ThreadingHTTPServer(("", port), H).serve_forever()
