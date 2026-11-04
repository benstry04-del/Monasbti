#!/bin/sh
set -eu
uploads=/app/data/uploads
chown node:node "$uploads"
chmod 700 "$uploads"
exec setpriv --reuid=node --regid=node --clear-groups --no-new-privs node server/app.mjs
