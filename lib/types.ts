export type DriveFile = {
  id: string;
  name: string;
  kind: "doc" | "sheet";
  createdBy: string;      // file owner (Drive has no separate "creator" field)
  modifiedTime: string;   // ISO date
  modifiedBy: string;
  webViewLink?: string;   // real Google URL
  canEdit?: boolean;      // can the signed-in account edit this file?
};

// Fixed locale + time zone so server and browser render the same text.
export function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}
