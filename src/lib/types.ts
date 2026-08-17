/*
  Shared domain types. These mirror the Firestore collections described in the
  project description - keep them in step with any schema change.
*/

export type Role = "admin" | "manager";

export type AuditorStatus = "invited" | "active" | "inactive";

export type District = {
  id: string;
  name: string;
  centerLat: number | null;
  centerLng: number | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Auditor = {
  id: string;
  name: string;
  phone: string;
  email: string;
  districtId: string;
  status: AuditorStatus;
  invitedAt: string | null;
  activatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AuditSettings = {
  /** Flag a visit when it lands further than this from the house reference. */
  toleranceMeters: number;
  /** Block submission until the device reports at least this accuracy. */
  minGpsAccuracy: number;
  /** Seconds after which submission unlocks despite poor accuracy. */
  accuracyOverrideSeconds: number;
  /** 0 = Sunday ... 6 = Saturday */
  collectionDays: number[];
  auditDays: number[];
  cleanlinessWeights: {
    collection: number;
    cleanliness: number;
    satisfaction: number;
  };
};

export const DEFAULT_SETTINGS: AuditSettings = {
  toleranceMeters: 50,
  minGpsAccuracy: 25,
  accuracyOverrideSeconds: 45,
  collectionDays: [6, 4], // Saturday, Thursday
  auditDays: [0, 5], // Sunday, Friday
  cleanlinessWeights: {
    collection: 50,
    cleanliness: 30,
    satisfaction: 20,
  },
};

export type House = {
  id: string;
  serialNumber: string;
  districtId: string;
  /** Reference location - set by whichever auditor visits first, then fixed. */
  refLat: number;
  refLng: number;
  refAccuracy: number | null;
  refSetBy: string;
  refSetAt: string;
  registeredBy: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

export type ReviewStatus = "pending" | "accepted" | "rejected";

export type Visit = {
  id: string;
  houseId: string;
  serialNumber: string;
  auditorId: string;
  districtId: string;
  cycleId: string | null;
  lat: number;
  lng: number;
  gpsAccuracy: number | null;
  photoUrl: string | null;
  photoPublicId: string | null;
  collected: boolean;
  satisfied: boolean;
  note: string;
  cleanlinessRating: number;
  /** Metres from the house reference. Null on the visit that sets it. */
  distanceFromRef: number | null;
  flagged: boolean;
  isFirstVisit: boolean;
  reviewStatus: ReviewStatus | null;
  reviewedBy: string | null;
  reviewReason: string | null;
  reviewedAt: string | null;
  /** Device clock at capture, and server clock at receipt. */
  capturedAt: string;
  receivedAt: string;
  clientId: string | null;
};

export type MessageAudience =
  | { type: "all" }
  | { type: "district"; districtId: string }
  | { type: "auditors"; auditorIds: string[] };

export type Message = {
  id: string;
  title: string;
  body: string;
  audience: MessageAudience;
  recipientCount: number;
  alsoEmail: boolean;
  sentBy: string;
  sentByName: string;
  createdAt: string;
};

export type Notification = {
  id: string;
  auditorId: string;
  messageId: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;
