module.exports = function (server, grace) {
  if (grace === void 0) {
    grace = Infinity
  }

  var sockets = Object.create(null)
  var id = 0
  var stopped = false

  server.on('connection', onConnection)
  server.on('secureConnection', onConnection)
  server.on('request', onRequest)
  server.stop = stop
  server._pendingSockets = 0
  return server

  function onConnection (socket) {
    server._pendingSockets++
    id++
    socket._stoppableId = id
    sockets[id] = socket
    socket._stoppableReqs = 0
    socket.once('close', function () {
      server._pendingSockets--
    })
  }

  function onRequest (req, res) {
    req.socket._stoppableReqs++
    res.once('finish', function () {
      var pending = --req.socket._stoppableReqs
      if (stopped && pending === 0) {
        req.socket.end()
      }
    })
  }

  function stop (callback) {
    // allow request handlers to update state before we act on that state
    setImmediate(function () {
      stopped = true
      if (grace < Infinity) {
        setTimeout(destroyAll, grace).unref()
      }
      server.close(callback)
      for (var key in sockets) {
        endIfIdle(sockets[key])
      }
    })
  }

  function endIfIdle (socket) {
    if (socket._stoppableReqs === 0) socket.end()
  }

  function destroyAll () {
    for (var key in sockets) {
      sockets[key].end()
    }
    setImmediate(function () {
      for (var key in sockets) {
        sockets[key].destroy()
      }
    })
  }
}
