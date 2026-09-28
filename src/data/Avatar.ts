// Avatars are served from the frontend's public folder (Vite base is `/triple-triad/`), the same way card art is
// (see `CardArt.ts`). `Player.AvatarUrl` is null until a player picks one, so every screen that draws an avatar falls
// back to the bundled placeholder — that fallback lives here so the next consumer does not invent its own path.
export const AVATAR_PLACEHOLDER = '/triple-triad/images/avatars/placeholder.svg';

export const avatarUrlFor = (avatarUrl: string | null | undefined) =>
  avatarUrl || AVATAR_PLACEHOLDER;
