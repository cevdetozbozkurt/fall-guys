# Tumble Club

An original 3D browser obstacle racer with ten courses, solo races, a championship, and online rooms for 2–8 friends. Remaining racer slots are filled by bots.

## Play with friends

1. Open the game and choose **Play with friends**.
2. Enter your name and choose **Create a room**.
3. Copy the invitation link or share the eight-character room code.
4. Friends open the link or enter the code with **Join**.
5. The host chooses a course and starts the race. After everyone finishes (or the 150-second clock expires), the host can choose another course.

The host must keep the game tab open and active. Leaving ends that room. Guests who disconnect are replaced by bots. This free setup uses PeerJS public signaling and direct WebRTC data connections; some work/school networks, VPNs, and symmetric NAT configurations can block connections. Try a home network or hotspot if a connection fails. No paid TURN service or paid hosting subscription is configured.

The host runs the fixed 60 Hz simulation and owns countdowns, obstacle state, checkpoints, and finish order. Guests send validated controls, not positions or wins. Snapshots are sent at up to 20 Hz; movement is smoothed in the guest renderer. No camera or microphone access is requested. Names and gameplay state are shared with the room participants; rooms are temporary and records are local to each device.

## Controls

- WASD / arrows: move.
- Space: jump.
- Shift / E: dive once while airborne.
- R: return to your checkpoint.
- Escape: menu. Online races keep running while menus are open.
- Touchscreen: drag the left pad; tap Jump and Dive on the right.

## Develop and publish

Requires Node 22.13+ and pnpm. Run `pnpm install --frozen-lockfile`.

- `pnpm dev:web`: standalone browser development.
- `pnpm build:web`: builds the public game into `web-dist/` with relative asset paths, compatible with GitHub Pages and Vercel.
- `pnpm dev` / `pnpm build`: retained Sites/Vinext development and Worker build.
- `pnpm test`: simulation and multiplayer protocol checks.
- `pnpm exec tsc --noEmit`: TypeScript checking.

The GitHub Pages distribution is in `docs/`. After editing, run `pnpm build:web`, replace `docs/` with the contents of `web-dist/`, retain `docs/.nojekyll`, and commit. Pages serves the main branch's `/docs` folder. The supplied `vercel.json` supports importing the same repository into a Vercel Hobby project using the static build.

A WebGL2-capable browser with hardware acceleration is required. The game contains original courses, toy racers, visuals, and synthesized sounds; it uses no Fall Guys assets, branding, or source code.
