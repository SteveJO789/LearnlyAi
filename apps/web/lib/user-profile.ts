"use client";

import type { User } from "@supabase/supabase-js";

import { getSupabaseClient } from "./supabase";

export type AppUserProfile = {
  id: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
};

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
      email: authProfile.email,
      displayName: authProfile.displayName,
      avatarUrl: authProfile.avatarUrl,
      updatedAt: new Date().toISOString(),
    })
    .select("id,email,displayName,avatarUrl")
    .single();

  if (error) throw error;
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
      updatedAt: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select("id,email,displayName,avatarUrl")
    .single();

  if (error) throw error;
  return data as AppUserProfile;
}
