import http.server, socketserver, os
os.chdir('/Users/rafi/Desktop/Claude-MHC/CKC Recipes /CKC- Recipe Tool')
with socketserver.TCPServer(("", 3000), http.server.SimpleHTTPRequestHandler) as h:
    h.serve_forever()
