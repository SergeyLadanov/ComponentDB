#!/usr/bin/env python
try:
    from cheroot.wsgi import Server as WSGIServer, PathInfoDispatcher
except ImportError:
    from cherrypy.wsgiserver import CherryPyWSGIServer as WSGIServer, WSGIPathInfoDispatcher as PathInfoDispatcher

from web import app
from web import HTTP_HOST
from web import HTTP_PORT



d = PathInfoDispatcher({'/': app})
server = WSGIServer((HTTP_HOST, HTTP_PORT), d)

if __name__ == '__main__':
   try:
      server.start()
   except KeyboardInterrupt:
      server.stop()
