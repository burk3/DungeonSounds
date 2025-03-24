#!/bin/bash
# Script to provide npm-like scripts for the project

command=$1
shift

case $command in
  "test")
    echo "Running D&D Soundboard test suite..."
    node run-tests.js
    ;;
  "makeAdmin")
    if [ $# -eq 0 ]; then
      echo "Usage: ./npm_scripts.sh makeAdmin email@example.com"
      exit 1
    fi
    echo "Creating admin user with email: $1"
    tsx server/makeAdminUser.ts "$1"
    ;;
  *)
    echo "Unknown command: $command"
    echo "Available commands:"
    echo "  test - Run the test suite"
    echo "  makeAdmin <email> - Create an admin user with the specified email"
    exit 1
    ;;
esac