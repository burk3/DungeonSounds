#!/bin/bash
# Script to create an admin user

if [ $# -eq 0 ]; then
  echo "Usage: ./makeAdmin.sh email@example.com"
  exit 1
fi

echo "Creating admin user with email: $1"
tsx server/makeAdminUser.ts "$1"