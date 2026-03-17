#!/bin/bash
NODE_ENV=development npx tsx backend/_core/index.ts &
npm run dev --prefix frontend &
wait
