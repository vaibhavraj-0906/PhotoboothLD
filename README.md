# PhotoboothLD

A tiny webapp for long-distance couples: both partners open it, connect peer-to-peer, and build a 4-photo vertical photobooth strip together — one partner poses, the other layers their live feed over a translucent "ghost" of that pose and captures the match. No photo or personal data ever touches a server; images travel directly between the two browsers over WebRTC and each partner downloads the finished strip locally.

## Running locally

This is a static site — no build step, no dependencies to install. Any local static server works, e.g.:

```bash
npx serve .
```

or just open `index.html` directly in a browser (camera access via `getUserMedia` requires either `https://` or `localhost`/`file://`, so plain double-click works for local testing but a real deployment needs HTTPS).

To test the full two-person flow, open the app in two browser tabs (or two devices), create a room in one, and join with the code in the other.

## Deployment

Deployed on [Vercel](https://vercel.com) as a static site — no build command, no environment variables, no backend. Any other static host (Netlify, GitHub Pages) works the same way.

## How it works

- **Connection**: [PeerJS](https://peerjs.com/) over WebRTC, using PeerJS's free public signaling broker. The broker only helps the two browsers find each other (offer/answer/ICE exchange) — it never sees any photo data. Photos travel exclusively over the resulting WebRTC DataChannel, directly between the two browsers.
- **Pairing**: one partner creates a room and gets a short code (and shareable link); the other joins with it.
- **Capture flow**: each of the 4 rounds, one partner poses first ("base") and sends a still; the other partner ("overlay") sees it as a translucent ghost over their own live webcam, aligns, and captures — baking a 50%-blend double-exposure composite. Roles alternate each round.
- **Privacy**: nothing is ever uploaded or stored server-side. The finished strip is assembled and downloaded locally, independently, by each partner's own browser.

## Known limitation

There is no TURN server configured (a paid/hosted relay some WebRTC connections need to punch through strict firewalls). Connections rely on public STUN servers only, which works for the vast majority of home and mobile networks, but may fail to connect on some restrictive corporate/campus networks. If a connection won't establish, try a different network (e.g. a mobile hotspot).
