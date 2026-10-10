#!/bin/sh
cd "$(dirname "$0")"
python3 server/serve.py "$@"
