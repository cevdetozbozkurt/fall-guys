# Tumble Club

An original 3D cosmic obstacle racer with **50 built-in courses**, public five-player matchmaking, private friend rooms, a course builder, player accounts, a private design studio, and customizable toy racers. Play at [Tumble Club](https://cevdetozbozkurt.github.io/fall-guys/).

## Playing

Choose a solo quick race or a 50-round championship. Courses include actual left/right turns, switchbacks, climbing ledges, ramps, slides, gaps, spinning arms, hammers, falling meteors, conveyors, and vanishing tiles. Forks offer a narrow left shortcut and a longer, wider right route. The camera follows the route smoothly; steer through bends rather than holding forward throughout.

Bends use continuous road surfaces and rails. Fork and slalom corners share rounded paths with their collision geometry, while shortcut gaps remain open. Diving and sliding lean in the racer's current direction, including after turning or releasing the steering input.

- Computer: WASD/arrows to steer, Space to jump, Shift/E to dive in the air, R to respawn, Escape for the menu.
- Phone/tablet: left touch pad to steer; right Jump/Dive buttons.
- Install from a supporting browser's app menu. On iPhone/iPad use Safari → Share → Add to Home Screen. Solo play is available offline after the game finishes downloading. Accounts and online play require internet.
- Outfits include three body shapes, caps, crowns, mohawks, glasses, sunglasses and six colors. All use the same physics and hitbox. Signed-in profiles sync across devices; guests retain device preferences.

A WebGL2-capable browser with hardware acceleration is required. This is an installable web game, not an App Store or Google Play binary.

## Online games

**Find a game:** sign in, save a player name, then Search. The server groups the oldest five available real players atomically. The host validates each assigned player's single-match ticket against their actual network connection before starting. Cancel search releases your place. Failed connections expire and surviving players can be regrouped. Public players share their saved name and outfit, never their email or login tokens.

**Play with friends:** create a room and share its eight-character code or invite link. Private rooms accept 2–8 humans, with bots filling the remaining slots up to 12. No account is needed for private rooms. Friends can join during a race.

The host runs a fixed 60 Hz simulation; guests send controls rather than claimed positions or wins. Both modes keep the same lobby through rounds. Once all humans finish, or the 150-second race clock expires, the next randomly selected course begins after **exactly five seconds**. Guest departure does not dissolve an active lobby. The host must keep the game tab open and active. A closed/disconnected host ends the room; a temporarily inactive private host displays a waiting message.

Hosting uses GitHub Pages, Supabase for accounts/match allocation, and PeerJS signaling with direct WebRTC connections. No microphone/camera permission is used. Some restrictive networks or symmetric NATs may need a TURN relay, which is not configured. Free-service quotas apply; no paid hosting or relay subscription was enabled.

## Builder and private design studio

Arrange 3–10 sections from 14 module types; reorder with drag or accessible up/down controls; set each section's difficulty. The route map shows actual turns and branches. Every section begins at a checkpoint. Test run preserves the draft. Save up to 16 courses per account (or per browser as a guest). Any private-room member can add recipes to the room's 16-course rotation; edits never change an already running course.

The single owner sees **Manage the club** inside their player account. Authorized designers see **Design studio**. Staff publish new levels or revisions directly to the shared Courses list, and can retire courses while preserving history. The owner alone can find verified users by username prefix or exact email and grant/revoke designer access. Role checks run on the server for every action; hiding the entry point is not the security boundary. No client-side admin password or first-user promotion exists.

## Accounts and deployment setup

The deployed game connects to the supplied Supabase project. Google login is enabled and has been verified with the owner's account. Email/password forms and recovery are implemented; general email delivery requires a configured SMTP provider. Apple login is implemented behind a configuration flag and requires the operator's Apple Developer enrollment and provider configuration before enabling it.

1. Create `.env.local` at the repository root with:

   ```dotenv
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_KEY
   VITE_GOOGLE_AUTH_ENABLED=true
   VITE_APPLE_AUTH_ENABLED=false
   VITE_EMAIL_AUTH_ENABLED=false
   ```

   The publishable/anon key is intentionally included in the browser build. Never put service-role keys, database passwords, or OAuth secrets in VITE variables or this repository.
2. Apply `backend/001-platform.sql` followed by `backend/002-status-snapshot.sql` in the target database. The `tumble_private` schema must not be exposed through the Data API. Tables use RLS; mutations go through narrowly granted RPCs.
3. Configure Supabase Site URL and allowed redirects for the exact deployment root (including trailing slash) and local development URL. Configure Google/Apple secrets directly in the provider dashboard. Use the Supabase `/auth/v1/callback` URL as the provider callback. Email verification remains enabled. Enable `VITE_EMAIL_AUTH_ENABLED` only after SMTP delivery is configured and tested; the current release clearly offers Google registration/login and does not expose email forms that cannot send confirmation or reset emails.
4. Assign the one owner only through the trusted database operator after confirming the intended user's verified identity. The account-specific bootstrap stays outside this public repository. `tumble_private.roles` enforces one owner; ordinary users cannot promote themselves. Use the studio for subsequent designer grants.

Authentication uses managed Supabase sessions, PKCE redirects, email confirmation, password recovery, and local sign-out. Private profiles and saved recipes are readable only by their owner. Only the club owner can look up account emails. Published recipes are public. The service worker caches game assets only, never Supabase requests or private account responses.

## Development and verification

Requires Node 22.13+ and pnpm. Run `pnpm install --frozen-lockfile`.

- `pnpm dev:web`: standalone development (use `--port 3000` for the configured local redirect).
- `pnpm build:web`: optimized static game and complete offline asset package in `web-dist/`.
- `pnpm test:pwa`: after building, verify the complete offline package, cache upgrades, and authentication-request exclusions.
- `pnpm test`: 50-course completion, two controlled racers taking opposite branches, every builder module/difficulty, movement, checkpoints, network validation, five-player admission/retry, persistent lobby/rotation, and real PostgreSQL-compatible SQL/RLS scenarios through PGlite.
- `pnpm exec tsc --noEmit` and `pnpm exec oxlint app lib tests scripts`: types and static checks.
- `pnpm dev` / `pnpm build`: retained Sites/Vinext development and Worker build.

The automated public-party test uses an in-memory transport. SQL tests execute the actual migrations with isolated authenticated roles in PGlite. They do not substitute for load testing concurrent native PostgreSQL sessions, five separate devices, or restrictive-network testing. Live browser checks cover Google login, owner access, profile/cloud saves, staff search, publish/update/retire, matchmaking search/cancel, and responsive layouts. Browser emulation is not physical phone testing.

GitHub Pages serves the main branch's `/docs` directory. Build, replace the contents of `docs/` with `web-dist/`, retain `docs/.nojekyll`, and commit. The included `vercel.json` also supports a Vercel static deployment; set the same public environment values there before building. Refresh all players after this release: protocol 3 uses a new private-room prefix.

The game uses original courses, toy racers, visuals and synthesized sounds, with no Fall Guys assets, branding or source code. The original cosmic background was generated for this project, inspired by the user's neon space reference.
