import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { config } from "./config.js";

const passwordIterations = 120_000;
const teacherTokenPrefix = "teacher";
const studentTokenPrefix = "student";

export interface TeacherPrincipal {
  id: string;
  username: string;
  display_name: string;
  role: string;
}

export interface StudentPrincipal {
  id: string;
  username: string;
  nickname: string;
  student_no?: string | null;
}

function base64UrlEncode(value: Buffer | string) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return createHmac("sha256", config.authSecret).update(value).digest("base64url");
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, passwordIterations, 32, "sha256").toString("hex");
  return `pbkdf2$${passwordIterations}$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [scheme, iterationsText, salt, expectedHash] = storedHash.split("$");
  if (scheme !== "pbkdf2" || !iterationsText || !salt || !expectedHash) return false;
  const iterations = Number(iterationsText);
  if (!Number.isInteger(iterations) || iterations < 10_000) return false;
  const actual = pbkdf2Sync(password, salt, iterations, 32, "sha256");
  const expected = Buffer.from(expectedHash, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function issueTeacherToken(teacher: TeacherPrincipal) {
  const expiresAt = Math.floor(Date.now() / 1000) + config.authTokenExpiresSeconds;
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: teacher.id,
      username: teacher.username,
      display_name: teacher.display_name,
      role: teacher.role,
      exp: expiresAt
    })
  );
  const signature = sign(`${teacherTokenPrefix}.${payload}`);
  return {
    token: `${teacherTokenPrefix}.${payload}.${signature}`,
    expires_in: config.authTokenExpiresSeconds,
    teacher
  };
}

export function verifyTeacherToken(token: string): TeacherPrincipal | null {
  const [prefix, payload, signature] = token.split(".");
  if (prefix !== teacherTokenPrefix || !payload || !signature) return null;
  const expected = sign(`${prefix}.${payload}`);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const data = JSON.parse(base64UrlDecode(payload)) as {
      sub?: string;
      username?: string;
      display_name?: string;
      role?: string;
      exp?: number;
    };
    if (!data.sub || !data.username || !data.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
    return {
      id: data.sub,
      username: data.username,
      display_name: data.display_name ?? data.username,
      role: data.role ?? "TEACHER"
    };
  } catch {
    return null;
  }
}

export function issueStudentToken(student: StudentPrincipal) {
  const expiresAt = Math.floor(Date.now() / 1000) + config.authTokenExpiresSeconds;
  const payload = base64UrlEncode(
    JSON.stringify({
      sub: student.id,
      username: student.username,
      nickname: student.nickname,
      student_no: student.student_no ?? null,
      exp: expiresAt
    })
  );
  const signature = sign(`${studentTokenPrefix}.${payload}`);
  return {
    token: `${studentTokenPrefix}.${payload}.${signature}`,
    expires_in: config.authTokenExpiresSeconds,
    student
  };
}

export function verifyStudentToken(token: string): StudentPrincipal | null {
  const [prefix, payload, signature] = token.split(".");
  if (prefix !== studentTokenPrefix || !payload || !signature) return null;
  const expected = sign(`${prefix}.${payload}`);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length || !timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const data = JSON.parse(base64UrlDecode(payload)) as {
      sub?: string;
      username?: string;
      nickname?: string;
      student_no?: string | null;
      exp?: number;
    };
    if (!data.sub || !data.username || !data.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
    return {
      id: data.sub,
      username: data.username,
      nickname: data.nickname ?? data.username,
      student_no: data.student_no ?? null
    };
  } catch {
    return null;
  }
}
