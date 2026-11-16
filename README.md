<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/b5c8fea1-15ca-479c-80da-b20daf9c036d

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`


## Tabletop ESP32 prototype

The active hardware prototype uses two ESP32-WROOM-32 nodes:
- **Node 1 (Recharge line):** YF-S201 flow sensor + HC-SR04 ultrasonic sensor measuring tabletop tank water level in cm (not groundwater depth).
- **Node 2 (Extraction line):** YF-S201 flow sensor on the pump extraction hose.
- **Manual pump:** Switched manually for demonstration. No pump control, relay automation, or claim of measuring pump status.
- **Data boundaries:** Tabletop flow and tank level only; not aquifer depth, water balance, or credit awards.

See [the Two-Node Backend & Dashboard Setup Guide](docs/TWO_NODE_BACKEND_SETUP.md) for GPIO/voltage notes, calibration, local Firebase Admin configuration, rules/indexes deployment, run commands, and troubleshooting. Start the backend with `npm run server:dev`, the frontend with `npm run dev`, and run `npm run test:backend` for automated API checks.
