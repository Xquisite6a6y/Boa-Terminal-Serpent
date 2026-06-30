"use strict";

const http = require("http");

const server = http.createServer((req, res) => {
  let body = "";

  req.on("data", chunk => body += chunk);

  req.on("end", () => {
    if (req.method === "POST" && req.url === "/api/daemon/heartbeat") {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({
        ok: true,
        message: "BOA daemon heartbeat received",
        time: new Date().toISOString(),
        received: body ? JSON.parse(body) : {}
      }));
    }

    if (req.method === "GET" && req.url === "/") {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({
        ok: true,
        name: "BOA Terminal Serpent API",
        routes: ["/api/daemon/heartbeat"]
      }));
    }

    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "Route not found" }));
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`BOA API listening on port ${PORT}`);
});
