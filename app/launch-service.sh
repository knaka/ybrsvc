#!/bin/bash
set -o nounset -o errexit -o pipefail

if test "${DATABASE_URL+SET}" == SET
then
  DATABASE_URL="$(node scr/resolve-url-srv.js "$DATABASE_URL")"
  export DATABASE_URL
fi

exec npx blitz start
