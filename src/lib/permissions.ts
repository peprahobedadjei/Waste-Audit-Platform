import { EMPTY_SCOPE, type ManagerScope, type Role } from "@/lib/types";

/*
  Access model.

  - admin   : the system administrator. Sees everything, owns Settings,
              Branding, Managers and the activity log.
  - manager : a sub-admin. Sees only the districts and auditors assigned to
              them, and cannot reach Settings or Branding.

  Scope resolution lives here rather than in each page so there is exactly one
  definition of "what can this person see". Every query and every API route
  goes through it.
*/

export type Scope =
  | { kind: "all" }
  | { kind: "scoped"; districtIds: string[]; auditorIds: string[] };

export type Principal = {
  uid: string;
  role: Role;
  scope?: ManagerScope | null;
};

export function scopeFor(user: Principal): Scope {
  if (user.role === "admin") return { kind: "all" };
  const scope = user.scope ?? EMPTY_SCOPE;
  return {
    kind: "scoped",
    districtIds: scope.districtIds ?? [],
    auditorIds: scope.auditorIds ?? [],
  };
}

export function isAdmin(user: Principal): boolean {
  return user.role === "admin";
}

/** Settings and Branding change what every user and device sees. Admin only. */
export function canEditSystemConfig(user: Principal): boolean {
  return user.role === "admin";
}

/** Only the system administrator provisions other dashboard accounts. */
export function canManageManagers(user: Principal): boolean {
  return user.role === "admin";
}

export function canSeeActivityLog(user: Principal): boolean {
  return user.role === "admin";
}

export function canSeeDistrict(scope: Scope, districtId: string): boolean {
  return scope.kind === "all" || scope.districtIds.includes(districtId);
}

export function canSeeAuditor(scope: Scope, auditorId: string): boolean {
  return scope.kind === "all" || scope.auditorIds.includes(auditorId);
}

/**
 * A manager with no assignment yet sees nothing rather than everything.
 * Failing closed matters here - the alternative leaks the whole dataset to a
 * freshly invited account.
 */
export function hasAnyScope(scope: Scope): boolean {
  if (scope.kind === "all") return true;
  return scope.districtIds.length > 0 || scope.auditorIds.length > 0;
}

export function filterByDistrict<T extends { districtId: string }>(
  scope: Scope,
  rows: T[],
): T[] {
  if (scope.kind === "all") return rows;
  return rows.filter((row) => scope.districtIds.includes(row.districtId));
}

export function filterByAuditor<T extends { auditorId: string }>(
  scope: Scope,
  rows: T[],
): T[] {
  if (scope.kind === "all") return rows;
  return rows.filter((row) => scope.auditorIds.includes(row.auditorId));
}
