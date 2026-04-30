#!/bin/sh
set -e

node node_modules/prisma/build/index.js db push

exec node server.js
