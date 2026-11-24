import { api } from "@/lib/api-client";
import type { User } from "@/types/auth";

/** Largest profile photo the API accepts (`POST /users/me/picture`). */
export const PROFILE_PHOTO_MAX_BYTES = 1024 * 1024;
export const PROFILE_PHOTO_TYPES = ["image/png", "image/jpeg"];

/**
 * Updates the signed-in user's profile. `image: null` removes the photo
 * (an uploaded one included).
 */
export async function updateMe(data: {
  name?: string;
  image?: string | null;
}): Promise<User> {
  const res = await api.patch<User>("/users/me", data);
  return res.data;
}

/** Uploads (or replaces) the signed-in user's profile photo. */
export async function uploadMyPicture(file: File): Promise<User> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await api.post<User>("/users/me/picture", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}
