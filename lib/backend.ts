import {
  createClient,
  type Session,
  type SupabaseClient,
} from '@supabase/supabase-js';
import { parseRecipe, type CourseRecipe } from './course-builder.ts';
import { normalizeCosmetics, type Cosmetics } from './cosmetics.ts';
import { parseProgression, type Progression } from './progression.ts';
import { installRewards } from './course-rewards.ts';
export {
  normalizeCosmetics,
  DEFAULT_COSMETICS,
  OUTFIT_COLORS,
  type Cosmetics,
} from './cosmetics.ts';
export type AccountRole = 'player' | 'designer' | 'owner';
export type Profile = {
  userId: string;
  username: string;
  cosmetics: Cosmetics;
};
export type Account = {
  userId: string;
  profile: Profile | null;
  role: AccountRole;
};
export type SavedRecipe = {
  id: string;
  recipe: CourseRecipe;
  updatedAt: string;
};
export type PublishedLevel = SavedRecipe & {
  revision: number;
  retiredAt: string | null;
  courseNumber: number;
  releaseVersion: string;
  description: string;
  sourceId: string | null;
};
export type ReleaseEntry = {
  recipe: CourseRecipe;
  sourceId: string | null;
  id?: string;
  revision?: number;
  description: string;
};
export type StaffUser = {
  userId: string;
  username: string | null;
  email: string;
  role: AccountRole;
};
export type MatchMember = {
  userId: string;
  slot: number;
  username: string;
  cosmetics: Cosmetics;
  accepted: boolean;
};
export type MatchAssignment = {
  state: 'matched';
  matchId: string;
  roomCode: string;
  hostUserId: string;
  hostPeerId: string;
  phase: 'connecting' | 'playing';
  userId: string;
  slot: number;
  ticket: string;
  expiresAt: string;
  members: MatchMember[];
};
export type QueueStatus =
  | { state: 'idle'; target: 5 }
  | { state: 'searching'; target: 5; players: number }
  | MatchAssignment;
export type BackendConfig = {
  url?: string;
  anonKey?: string;
  googleEnabled?: boolean;
  appleEnabled?: boolean;
  emailEnabled?: boolean;
};

const env =
  (import.meta as ImportMeta & { env?: Record<string, string | undefined> })
    .env ?? {};
export const backendConfig: BackendConfig = {
  url: env.VITE_SUPABASE_URL,
  anonKey: env.VITE_SUPABASE_ANON_KEY,
  googleEnabled: env.VITE_GOOGLE_AUTH_ENABLED === 'true',
  appleEnabled: env.VITE_APPLE_AUTH_ENABLED === 'true',
  emailEnabled: env.VITE_EMAIL_AUTH_ENABLED === 'true',
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function string(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
function uuid(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new Error(
      'The online service returned an invalid response. Please try again.',
    );
  return value;
}
function role(value: unknown): AccountRole {
  return value === 'owner' || value === 'designer' ? value : 'player';
}
function parseProfile(value: unknown): Profile | null {
  if (!value) return null;
  const v = record(value);
  if (!/^[A-Za-z0-9_]{3,24}$/.test(string(v.username)))
    throw new Error('Your player profile could not be loaded.');
  return {
    userId: uuid(v.user_id),
    username: string(v.username),
    cosmetics: normalizeCosmetics(v.cosmetics),
  };
}
function parseSaved(value: unknown): SavedRecipe {
  const v = record(value),
    recipe = parseRecipe(v.recipe);
  if (!recipe) throw new Error('A saved course could not be loaded.');
  return { id: uuid(v.id), recipe, updatedAt: string(v.updated_at) };
}
function parsePublished(value: unknown): PublishedLevel {
  const v = record(value),
    saved = parseSaved(value);
  if (!Number.isSafeInteger(v.revision) || Number(v.revision) < 1)
    throw new Error('A published course could not be loaded.');
  return {
    ...saved,
    revision: Number(v.revision),
    retiredAt: v.retired_at === null ? null : string(v.retired_at),
    courseNumber: Number(v.course_number) || 0,
    releaseVersion: string(v.release_version),
    description: string(v.description),
    sourceId: typeof v.source_id === 'string' ? uuid(v.source_id) : null,
  };
}
export function parseQueueStatus(value: unknown): QueueStatus {
  const v = record(value);
  if (v.state === 'idle') return { state: 'idle', target: 5 };
  if (
    v.state === 'searching' &&
    Number.isInteger(v.players) &&
    Number(v.players) >= 0 &&
    Number(v.players) <= 5
  )
    return { state: 'searching', target: 5, players: Number(v.players) };
  if (
    v.state !== 'matched' ||
    !Array.isArray(v.members) ||
    v.members.length > 5 ||
    !Number.isInteger(v.slot) ||
    Number(v.slot) < 0 ||
    Number(v.slot) > 4 ||
    !/^[A-Z0-9]{6,20}$/.test(string(v.room_code)) ||
    !/^[A-Za-z0-9_-]{1,100}$/.test(string(v.host_peer_id)) ||
    !['connecting', 'playing'].includes(string(v.phase))
  )
    throw new Error('The matchmaking response was invalid. Please try again.');
  const members: MatchMember[] = v.members.map((entry) => {
    const m = record(entry);
    if (
      !Number.isInteger(m.slot) ||
      Number(m.slot) < 0 ||
      Number(m.slot) > 4 ||
      !/^[A-Za-z0-9_]{3,24}$/.test(string(m.username))
    )
      throw new Error('The matchmaking roster was invalid. Please try again.');
    return {
      userId: uuid(m.user_id),
      slot: Number(m.slot),
      username: string(m.username),
      cosmetics: normalizeCosmetics(m.cosmetics),
      accepted: m.accepted === true,
    };
  });
  if (
    new Set(members.map((m) => m.slot)).size !== members.length ||
    new Set(members.map((m) => m.userId)).size !== members.length
  )
    throw new Error('The matchmaking roster was invalid. Please try again.');
  return {
    state: 'matched',
    matchId: uuid(v.match_id),
    roomCode: string(v.room_code),
    hostUserId: uuid(v.host_id),
    hostPeerId: string(v.host_peer_id),
    phase: v.phase as 'connecting' | 'playing',
    userId: uuid(v.user_id),
    slot: Number(v.slot),
    ticket: uuid(v.join_ticket),
    expiresAt: string(v.expires_at),
    members,
  };
}

export function backendMessage(error: unknown): string {
  const v = record(error),
    message = error instanceof Error ? error.message : string(v.message);
  if (v.code === '23505')
    return 'That username is already taken. Try another one.';
  if (v.code === '40001')
    return 'This course changed while you were editing. Refresh it before publishing again.';
  if (/invalid login credentials/i.test(message))
    return 'The email or password is incorrect.';
  if (/email not confirmed/i.test(message))
    return 'Confirm your email before signing in.';
  if (
    /rate.limit|too many requests|over_email_send_rate_limit/i.test(message) ||
    v.status === 429
  )
    return 'Please wait a moment before trying again.';
  if (/failed to fetch|networkerror|load failed/i.test(message))
    return 'Unable to reach the online service. Check your connection and retry.';
  return message || 'Something went wrong. Please try again.';
}
function canonicalRecipe(value: CourseRecipe): CourseRecipe {
  const parsed = parseRecipe(value);
  if (!parsed)
    throw new Error(
      'Add a course name and between 3 and 10 valid sections first.',
    );
  return parsed;
}

export class GameBackend {
  catalogVersion = 'v0.0.0';
  readonly client: SupabaseClient | null;
  readonly providers: { google: boolean; apple: boolean; email: boolean };
  constructor(config: BackendConfig = backendConfig) {
    let valid = false;
    try {
      const url = new URL(config.url ?? '');
      valid = url.protocol === 'https:' && !!config.anonKey;
    } catch {
      /* Configuration is optional for offline play. */
    }
    this.client = valid
      ? createClient(config.url!, config.anonKey!, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            flowType: 'pkce',
          },
        })
      : null;
    this.providers = {
      google: valid && config.googleEnabled === true,
      apple: valid && config.appleEnabled === true,
      email: valid && config.emailEnabled === true,
    };
  }
  get configured(): boolean {
    return !!this.client;
  }
  private required(): SupabaseClient {
    if (!this.client)
      throw new Error(
        'Online accounts are not available yet. You can still play solo or invite friends with a room code.',
      );
    return this.client;
  }
  private redirect(): string {
    const url = new URL(window.location.pathname, window.location.origin);

    return url.href;
  }
  private async rpc(
    name: string,
    args?: Record<string, unknown>,
  ): Promise<unknown> {
    const { data, error } = await this.required()
      .rpc(name, args)
      .abortSignal(AbortSignal.timeout(20000));
    if (error) throw error;
    return data;
  }
  async getSession(): Promise<Session | null> {
    if (!this.client) return null;
    const { data, error } = await this.client.auth.getSession();
    if (error) throw error;
    return data.session;
  }
  subscribe(
    callback: (session: Session | null, recovery: boolean) => void,
  ): () => void {
    if (!this.client) return () => {};
    const { data } = this.client.auth.onAuthStateChange((event, session) =>
      callback(session, event === 'PASSWORD_RECOVERY'),
    );
    return () => data.subscription.unsubscribe();
  }
  async account(): Promise<Account> {
    const v = record(await this.rpc('tc_account'));
    return {
      userId: uuid(v.user_id),
      profile: parseProfile(v.profile),
      role: role(v.role),
    };
  }
  async register(
    email: string,
    password: string,
    username: string,
  ): Promise<{ confirmed: boolean }> {
    const { data, error } = await this.required().auth.signUp({
      email: email.trim(),
      password,
      options: { data: { username }, emailRedirectTo: this.redirect() },
    });
    if (error) throw error;
    return { confirmed: !!data.session };
  }
  async signIn(email: string, password: string): Promise<void> {
    const { error } = await this.required().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw error;
  }
  async signInProvider(provider: 'google' | 'apple'): Promise<void> {
    if (!this.providers[provider])
      throw new Error('This sign-in option is not available yet.');
    const { error } = await this.required().auth.signInWithOAuth({
      provider,
      options: { redirectTo: this.redirect() },
    });
    if (error) throw error;
  }
  async resetPassword(email: string): Promise<void> {
    const { error } = await this.required().auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: this.redirect() },
    );
    if (error) throw error;
  }
  async updatePassword(password: string): Promise<void> {
    const { error } = await this.required().auth.updateUser({ password });
    if (error) throw error;
  }
  async signOut(): Promise<void> {
    const { error } = await this.required().auth.signOut({ scope: 'local' });
    if (error) throw error;
  }
  async saveProfile(username: string, cosmetics: Cosmetics): Promise<Profile> {
    const profile = parseProfile(
      await this.rpc('tc_profile_save', {
        p_username: username.trim(),
        p_cosmetics: normalizeCosmetics(cosmetics),
      }),
    );
    if (!profile) throw new Error('Your player profile could not be saved.');
    return profile;
  }
  async savedRecipes(): Promise<SavedRecipe[]> {
    const { data, error } = await this.required()
      .from('tc_saved_recipes')
      .select('id,recipe,updated_at')
      .order('updated_at', { ascending: false })
      .limit(16);
    if (error) throw error;
    return (data ?? []).map(parseSaved);
  }
  async saveRecipe(
    recipe: CourseRecipe,
    id: string | null = null,
  ): Promise<SavedRecipe> {
    return parseSaved(
      await this.rpc('tc_recipe_save', {
        p_recipe: canonicalRecipe(recipe),
        p_id: id,
      }),
    );
  }
  async deleteRecipe(id: string): Promise<void> {
    await this.rpc('tc_recipe_delete', { p_id: uuid(id) });
  }
  async publishedLevels(): Promise<PublishedLevel[]> {
    if (!this.client) return [];
    const data = record(await this.rpc('tc_course_catalog'));
    if (!Array.isArray(data.levels))
      throw new Error('The course catalog could not be loaded.');
    installRewards(data.targets);
    this.catalogVersion =
      typeof data.version === 'string' ? data.version : 'v0.0.0';
    try {
      localStorage.setItem('tumble-catalog-v1', JSON.stringify(data));
    } catch {
      /* Optional offline catalog. */
    }
    return data.levels.map(parsePublished);
  }
  cachedLevels(): PublishedLevel[] {
    try {
      const data = record(
        JSON.parse(localStorage.getItem('tumble-catalog-v1') ?? 'null'),
      );
      installRewards(data.targets);
      this.catalogVersion =
        typeof data.version === 'string' ? data.version : 'v0.0.0';
      return Array.isArray(data.levels) ? data.levels.map(parsePublished) : [];
    } catch {
      return [];
    }
  }
  async staffCatalog(): Promise<PublishedLevel[]> {
    const data = await this.rpc('tc_staff_catalog');
    if (!Array.isArray(data))
      throw new Error('The course catalog could not be loaded.');
    return data.map(parsePublished);
  }
  async publishRelease(
    comment: string,
    entries: ReleaseEntry[],
    requestId: string,
  ): Promise<{ version: string; levels: PublishedLevel[] }> {
    const data = record(
      await this.rpc('tc_release_publish', {
        p_comment: comment.trim(),
        p_request_id: uuid(requestId),
        p_entries: entries.map((e) => ({
          recipe: canonicalRecipe(e.recipe),
          source_id: e.sourceId,
          id: e.id ?? null,
          revision: e.revision ?? null,
          description: e.description.trim(),
        })),
      }),
    );
    if (!Array.isArray(data.levels))
      throw new Error('The course release could not be loaded.');
    return {
      version: string(data.version),
      levels: data.levels.map(parsePublished),
    };
  }
  async publish(
    recipe: CourseRecipe,
    existing?: Pick<PublishedLevel, 'id' | 'revision'>,
  ): Promise<PublishedLevel> {
    return parsePublished(
      await this.rpc('tc_level_publish', {
        p_recipe: canonicalRecipe(recipe),
        p_id: existing?.id ?? null,
        p_expected_revision: existing?.revision ?? null,
      }),
    );
  }
  async retire(level: Pick<PublishedLevel, 'id' | 'revision'>): Promise<void> {
    await this.rpc('tc_level_retire', {
      p_id: uuid(level.id),
      p_expected_revision: level.revision,
    });
  }
  async searchStaff(query: string): Promise<StaffUser[]> {
    const data = await this.rpc('tc_staff_search', { p_query: query.trim() });
    if (!Array.isArray(data)) throw new Error('Player search is unavailable.');
    return data.map((entry) => {
      const v = record(entry);
      return {
        userId: uuid(v.user_id),
        username: typeof v.username === 'string' ? v.username : null,
        email: string(v.email),
        role: role(v.role),
      };
    });
  }
  async setDesigner(userId: string, enabled: boolean): Promise<void> {
    await this.rpc('tc_staff_set_designer', {
      p_user_id: uuid(userId),
      p_enabled: enabled,
    });
  }
  async queueTick(peerId: string, join = false): Promise<QueueStatus> {
    return parseQueueStatus(
      await this.rpc('tc_queue_tick', { p_peer_id: peerId, p_join: join }),
    );
  }
  async progression(): Promise<Progression> {
    return parseProgression(await this.rpc('tc_progress'));
  }
  async recordFinish(course: number, time: number): Promise<Progression> {
    return parseProgression(
      await this.rpc('tc_course_finish', { p_course: course, p_time: time }),
    );
  }
  async buyCosmetic(item: string): Promise<Progression> {
    return parseProgression(await this.rpc('tc_shop_buy', { p_item: item }));
  }
  async cancelQueue(): Promise<QueueStatus> {
    return parseQueueStatus(await this.rpc('tc_queue_cancel'));
  }
  async leaveMatch(matchId: string): Promise<QueueStatus> {
    return parseQueueStatus(
      await this.rpc('tc_match_leave', { p_match_id: uuid(matchId) }),
    );
  }
  async startMatch(matchId: string): Promise<MatchAssignment> {
    const status = parseQueueStatus(
      await this.rpc('tc_match_start', { p_match_id: uuid(matchId) }),
    );
    if (status.state !== 'matched')
      throw new Error('This match is no longer available.');
    return status;
  }
  async validateJoin(
    matchId: string,
    userId: string,
    ticket: string,
    actualPeerId: string,
  ): Promise<{ accepted: boolean; userId?: string; slot?: number }> {
    const v = record(
      await this.rpc('tc_match_validate_join', {
        p_match_id: uuid(matchId),
        p_user_id: uuid(userId),
        p_ticket: uuid(ticket),
        p_peer_id: actualPeerId,
      }),
    );
    if (v.accepted !== true) return { accepted: false };
    if (!Number.isInteger(v.slot) || Number(v.slot) < 1 || Number(v.slot) > 4)
      return { accepted: false };
    return { accepted: true, userId: uuid(v.user_id), slot: Number(v.slot) };
  }
}

export const gameBackend = new GameBackend();
