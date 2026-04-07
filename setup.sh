#!/bin/bash
# CMET WorldView — Quick Setup Script
# Run this from the project root after cloning the repo

set -e
echo "========================================="
echo "  CMET WorldView — Project Setup"
echo "========================================="

# Backend setup
echo ""
echo "[1/4] Setting up Python backend..."
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
echo "  Backend ready. Edit backend/.env with your keys."

# Frontend setup
echo ""
echo "[2/4] Setting up Next.js frontend..."
cd ../frontend
npx create-next-app@14 . --typescript --tailwind --app --no-git --use-npm <<EOF
y
EOF
npm install cesium resium zustand
cp .env.example .env.local
echo "  Frontend ready. Add your Cesium token to frontend/.env.local"

# Move TacticalMap into components
echo ""
echo "[3/4] Setting up components..."
mkdir -p components
mv TacticalMap.jsx components/TacticalMap.jsx 2>/dev/null || true
echo "  TacticalMap.jsx moved to components/"

# Summary
echo ""
echo "[4/4] Done!"
echo ""
echo "========================================="
echo "  TO RUN:"
echo ""
echo "  Terminal 1 (Backend):"
echo "    cd backend"
echo "    source venv/bin/activate"
echo "    uvicorn app.main:app --reload --port 8000"
echo ""
echo "  Terminal 2 (Frontend):"
echo "    cd frontend"
echo "    npm run dev"
echo ""
echo "  Then open http://localhost:3000"
echo "========================================="
