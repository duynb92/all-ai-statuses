#!/bin/sh
set -e

node node_modules/prisma/build/index.js db push

exec node --max-old-space-size="${NODE_MAX_OLD_SPACE_MB:-128}" server.js
