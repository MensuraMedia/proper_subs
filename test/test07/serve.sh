#!/bin/bash
# Serve test07 via HTTP so the main extension's content script injects.
# Open http://localhost:8080 in Chrome with Proper Subs extension installed.
echo ""
echo "Serving test07 at http://localhost:8080"
echo "Open this URL in Chrome with the Proper Subs extension installed."
echo "Press Ctrl+C to stop."
echo ""
cd "$(dirname "$0")"
python3 -m http.server 8080
