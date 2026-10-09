"use client";

import type { User } from "@supabase/supabase-js";

import { getSupabaseClient } from "./supabase";

export type AppearanceMode = "light" | "dark";

export type ColorTheme =
  | "default"
  | "theme-ruby"
  | "theme-peach"
  | "theme-sky"
  | "theme-gold"
  | "theme-slate"
  | "theme-teal";

export type UserThemePreferences = {
  appearanceMode: AppearanceMode;
  colorTheme: ColorTheme;
};

const DEFAULT_THEME_PREFERENCES: UserThemePreferences = {
  appearanceMode: "light",
  colorTheme: "default",
};

const THEME_METADATA_KEY = "learnlyThemePreferences";

const isAppearanceMode = (value: unknown): value is AppearanceMode =>
  value === "light" || value === "dark";

const isColorTheme = (value: unknown): value is ColorTheme =>
  value === "default" ||
  value === "theme-ruby" ||
  value === "theme-peach" ||
  value === "theme-sky" ||
  value === "theme-gold" ||
  value === "theme-slate" ||
  value === "theme-teal";

function parseThemePreferences(value: unknown): UserThemePreferences | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Record<string, unknown>;

  if (!isAppearanceMode(candidate.appearanceMode)) return null;
  if (!isColorTheme(candidate.colorTheme)) return null;

  return {
    appearanceMode: candidate.appearanceMode,
    colorTheme: candidate.colorTheme,
  };
}

function profileFromAuthUser(user: User): AppUserProfile {
  const metadata = user.user_metadata ?? {};
  const emailName = user.email?.split("@")[0] ?? "User";

  return {
    id: user.id,
    email: user.email ?? null,
    displayName:
      metadata.username ??
      metadata.full_name ??
      metadata.name ??
      emailName,
    avatarUrl: metadata.avatar_url ?? metadata.picture ?? null,
  };
}

export type AppUserProfile = {
  id: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
};

export async function syncCurrentUserProfile(): Promise<AppUserProfile> {
  const supabase = getSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error("No authenticated user.");

  const authProfile = profileFromAuthUser(user);

  const { data: existing, error: selectError } = await supabase
    .from("User")
    .select("id,email,displayName,avatarUrl")
    .eq("id", user.id)
    .maybeSingle();

  if (selectError) throw selectError;

  if (existing) {
    const updates = {
      email: user.email ?? existing.email,
      avatarUrl: existing.avatarUrl ?? authProfile.avatarUrl,
      updatedAt: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("User")
      .update(updates)
      .eq("id", user.id)
      .select("id,email,displayName,avatarUrl")
      .single();

    if (error) throw error;
    return data as AppUserProfile;
  }

  const { data, error } = await supabase
    .from("User")
    .insert({
      id: authProfile.id,
      authUserId: user.id,
      email: authProfile.email,
      displayName: authProfile.displayName,
      avatarUrl: authProfile.avatarUrl,
      updatedAt: new Date().toISOString(),
    })
    .select("id,email,displayName,avatarUrl")
    .single();

  if (error) throw error;

  // New accounts always start from the requested neutral Default palette
  // and Light appearance. Existing accounts are migrated separately below.
  const metadata = user.user_metadata ?? {};
  if (!parseThemePreferences(metadata[THEME_METADATA_KEY])) {
    const nextMetadata = {
      ...metadata,
      [THEME_METADATA_KEY]: DEFAULT_THEME_PREFERENCES,
    };

    const { error: metadataError } = await supabase.auth.updateUser({
      data: nextMetadata,
    });

    if (metadataError) throw metadataError;
  }

  return data as AppUserProfile;
}

export async function getCurrentUserProfile(): Promise<AppUserProfile | null> {
  const supabase = getSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) return null;

  const { data, error } = await supabase
    .from("User")
    .select("id,email,displayName,avatarUrl")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data as AppUserProfile | null;
}

export async function updateCurrentUserProfile(input: {
  displayName: string;
  avatarUrl?: string | null;
}): Promise<AppUserProfile> {
  const supabase = getSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error("No authenticated user.");

  const { data, error } = await supabase
    .from("User")
    .update({
      displayName: input.displayName.trim(),
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      updatedAt: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select("id,email,displayName,avatarUrl")
    .single();

  if (error) throw error;
  return data as AppUserProfile;
}

export async function getCurrentUserThemePreferences(): Promise<UserThemePreferences> {
  const supabase = getSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error("No authenticated user.");

  const metadata = user.user_metadata ?? {};
  const savedPreferences = parseThemePreferences(metadata[THEME_METADATA_KEY]);

  if (savedPreferences) {
    return savedPreferences;
  }

  // Existing accounts created before theme preferences were persisted do not
  // lose their current browser setting. Migrate it once into the account.
  const { data: existing, error: selectError } = await supabase
    .from("User")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (selectError) throw selectError;

  if (existing && typeof window !== "undefined") {
    const legacyAppearance = localStorage.getItem("theme");
    const legacyColorTheme = localStorage.getItem("app-color-theme");

    const migratedPreferences: UserThemePreferences = {
      appearanceMode:
        legacyAppearance === "dark" ? "dark" : DEFAULT_THEME_PREFERENCES.appearanceMode,
      colorTheme: isColorTheme(legacyColorTheme)
        ? legacyColorTheme
        : DEFAULT_THEME_PREFERENCES.colorTheme,
    };

    await updateCurrentUserThemePreferences(migratedPreferences);
    return migratedPreferences;
  }

  return DEFAULT_THEME_PREFERENCES;
}

export async function updateCurrentUserThemePreferences(
  preferences: UserThemePreferences,
): Promise<UserThemePreferences> {
  const supabase = getSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error("No authenticated user.");

  const metadata = user.user_metadata ?? {};

  const { error } = await supabase.auth.updateUser({
    data: {
      ...metadata,
      [THEME_METADATA_KEY]: preferences,
    },
  });

  if (error) throw error;

  return preferences;
}
