#!/bin/bash

IFS='-' read -ra parts <<< "$(basename "$0")"
if test "${parts[1]+SET}" == SET
then
  env="${parts[0]}"
  target="${parts[1]}"
elif test "${1+SET}" != SET
then
  echo No environment specified. >&2
  exit 1
else
  env="$1"
  target="$(basename "$0")"
  shift
fi
project_name="$(./project-name)"
