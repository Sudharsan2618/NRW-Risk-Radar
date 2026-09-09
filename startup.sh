#!/usr/bin/env bash
# Azure App Service (Linux) startup command for the NRW Wildfire Radar.
# Set the App Service "Startup Command" to either:  startup.sh   (or)   python apps/api/main.py
# The server binds 0.0.0.0 on the port Azure provides ($PORT).
set -e
python apps/api/main.py
