#!/usr/bin/env python3
"""Simple HTTP server for JSCSS project - serves from docs/ directory"""

import os
import http.server
import socketserver
from pathlib import Path

PORT = 8080

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """Custom request handler to serve from docs directory"""
    
    def do_GET(self):
        if self.path == '/':
            self.path = '/index.html'
        
        return super().do_GET()

def main():
    project_root = Path(__file__).parent
    docs_dir = project_root / 'docs'
    
    os.chdir(docs_dir)
    
    with socketserver.TCPServer(("", PORT), CustomHTTPRequestHandler) as httpd:
        print(f"Server running at http://localhost:{PORT}/")
        print(f"Serving from: {docs_dir}")
        print(f"- Homepage: http://localhost:{PORT}/")
        print(f"- Cool Effects: http://localhost:{PORT}/cool-effects.html")
        print(f"- Canvas Demo: http://localhost:{PORT}/canvas-demo.html")
        print(f"- Test Page: http://localhost:{PORT}/test.html")
        print("\nPress Ctrl+C to stop the server")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
            httpd.shutdown()

if __name__ == "__main__":
    main()
