# Tumble Club

An original 3D cosmic obstacle racer with **30 courses**, a modular course builder, solo races, a championship, and online rooms for 2–8 friends. Remaining racer slots are filled by bots.

Play at **https://cevdetozbozkurt.github.io/fall-guys/**.

## Play with friends

1. Open the game and choose **Play with friends**.
2. Enter your name and choose **Create a room**.
3. Copy the invitation link or share the eight-character room code.
4. Friends open the link or enter the code with **Join**.
5. The host chooses the first course and starts the race. After everyone finishes (or the 150-second clock expires), the results show a **5-second countdown**. A random new course then starts automatically, with no extra starting delay.

The room code, connected friends and custom course pool persist between races. A guest leaving does not end the host's room, and the host can continue racing with bots. Friends can join a running room. Rotation avoids the current course when another choice exists. The host can select all built-in courses plus room creations, or only room creations.

The host must keep the game tab open and active for smooth gameplay. Leaving or closing the host's game ends that room. A temporarily inactive host tab shows a waiting message instead of destroying the room. Guests who disconnect are replaced by bots. This free setup uses PeerJS public signaling and direct WebRTC data connections; some work/school networks, VPNs, and symmetric NAT configurations can block connections. Try a home network or hotspot if a connection fails. No paid TURN service or paid hosting subscription is configured.

The host runs the fixed 60 Hz simulation and owns countdowns, obstacle state, checkpoints, and finish order. Guests send validated controls, not positions or wins. Snapshots are sent at up to 20 Hz; movement is smoothed in the guest renderer. No camera or microphone access is requested. Names and gameplay state are shared with the room participants; rooms are temporary and records are local to each device.

## Build a course

Open **Course builder**, enter a name and arrange **3–10 sections**. Drag sections or use the up/down buttons, and choose a difficulty for each section. Available sections: open path, spin challenge, cosmic climb, jump across, hammer trap, meteor shower, gravity slide, orbital drop, conveyor dash and vanishing tiles.

Use **Test run** to try the course solo; the draft stays available when you return to the builder. **Save course** stores it on this browser/device (up to 16). Saved courses can be edited, played or deleted. In a friend room, **Add to room** shares the course with everyone and adds it to the random rotation. Each room holds up to 16 custom courses; any member can contribute. The host validates and distributes bounded recipes before a round starts, so everyone races identical geometry. Editing a saved course leaves the active race intact; the edited version can be added separately.

Climb sections have jumpable ledges; ramps support real height changes; drops require controlled landings; slides add speed and reduce steering friction. Meteor landing circles warn before impact. All courses use original neon space visuals inspired by the supplied reference.

## Controls

- WASD / arrows: move.
- Space: jump.
- Shift / E: dive once while airborne.
- R: return to your checkpoint.
- Escape: menu. Online races keep running while menus are open.
- Touchscreen: drag the left pad; tap Jump and Dive on the right.

The host should create a fresh room after everyone reloads this update; its network protocol is separate from the previous release.

## Develop and publish

Requires Node 22.13+ and pnpm. Run `pnpm install --frozen-lockfile`.

- `pnpm dev:web`: standalone browser development.
- `pnpm build:web`: builds the public game into `web-dist/` with relative asset paths, compatible with GitHub Pages and Vercel.
- `pnpm dev` / `pnpm build`: retained Sites/Vinext development and Worker build.
- `pnpm test`: simulation and multiplayer protocol checks.
- `pnpm exec tsc --noEmit`: TypeScript checking.

The GitHub Pages distribution is in `docs/`. After editing, run `pnpm build:web`, replace `docs/` with the contents of `web-dist/`, retain `docs/.nojekyll`, and commit. Pages serves the main branch's `/docs` folder. The supplied `vercel.json` supports importing the same repository into a Vercel Hobby project using the static build.

A WebGL2-capable browser with hardware acceleration is required. The game contains original courses, toy racers, visuals, and synthesized sounds; it uses no Fall Guys assets, branding, or source code.

The cosmic background in `public/cosmos.webp` was generated with the built-in image generation tool, then compressed to WebP. Asset prompt: "Original panoramic cosmic game background; deep navy starfield, delicate teal and purple nebula wisps, peripheral planets and subtle distant neon city glow. Keep central 65% quiet, dark and sparse for separately rendered tracks and UI. Whimsical illustrated neon arcade atmosphere with cyan, violet and pink accents, soft light and fine painterly grain. No text, logos, watermarks, characters, billboards, tracks, platforms, rings, traps, obstacles or foreground props."
