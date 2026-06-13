export const CLASSROOM_BASE = (import.meta.env.BASE_URL || "/").replace(/\/+$/, "/");

function stripLeadingSlash(path: string) {
  return path.replace(/^\/+/, "");
}

export function classroomPath(path = "") {
  const normalized = stripLeadingSlash(path);
  return `${CLASSROOM_BASE}${normalized}`;
}

export function classroomRoute(path = "") {
  const normalized = stripLeadingSlash(path);
  return normalized ? `/${normalized}` : "/";
}

export function isClassroomRoute(pathname: string, route: string) {
  return pathname === classroomRoute(route) || pathname.startsWith(classroomPath(route));
}
