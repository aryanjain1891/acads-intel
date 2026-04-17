import { apiDelete } from "@/lib/api";

export async function deleteExam(id: string) {
  return apiDelete(`/api/exams/${id}`);
}
export async function deleteScore(id: string) {
  return apiDelete(`/api/scores/${id}`);
}
export async function deleteResource(id: string) {
  return apiDelete(`/api/resources/${id}`);
}
export async function deleteHandout(id: string) {
  return apiDelete(`/api/handouts/${id}`);
}
export async function deleteDeadline(id: string) {
  return apiDelete(`/api/deadlines/${id}`);
}

export function isPreviewable(fileType: string | null, url: string) {
  if (!fileType && !url) return false;
  const ft = (fileType || "").toLowerCase();
  const ext = url.split(".").pop()?.toLowerCase() || "";
  return ft.startsWith("image/") || ft === "application/pdf" || ["pdf", "jpg", "jpeg", "png", "gif", "webp", "md"].includes(ext);
}

export function isMdFile(url: string) {
  return url.split(".").pop()?.toLowerCase() === "md";
}
