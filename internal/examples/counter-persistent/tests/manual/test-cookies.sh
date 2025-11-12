#!/bin/bash

echo "Starting Via..."
GOWORK=off go run . >/dev/null 2>&1 &
VIA_PID=$!
sleep 3

LAN_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -n1)
mkcert -cert-file localhost.pem -key-file localhost-key.pem localhost 127.0.0.1 ::1 ${LAN_IP} 2>/dev/null

echo "Starting Caddy..."
caddy run --config Caddyfile >/dev/null 2>&1 &
CADDY_PID=$!
sleep 3

echo "Testing cookie persistence via HTTPS..."
echo "=== First request (should set cookie) ==="
curl -v -c cookies.txt https://localhost:3443/ 2>&1 | grep -E "(Set-Cookie|via-session)"

echo ""
echo "=== Cookie file content ==="
cat cookies.txt 2>/dev/null || echo "No cookies saved"

echo ""
echo "=== Second request (with cookie) ==="
curl -v -b cookies.txt https://localhost:3443/ 2>&1 | grep -E "(Cookie|via-session)"

echo ""
echo "Cleaning up..."
kill $VIA_PID $CADDY_PID 2>/dev/null || true
rm -f cookies.txt localhost*.pem
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:3443 | xargs kill -9 2>/dev/null || true
