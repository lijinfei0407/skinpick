export const csvColumns = [
  "timestamp", "participantCode", "skinType", "skinConcern", "budgetRange", "texturePreference",
  "recommendedProductId", "recommendationViewed", "accepted",
  "rejectionReason", "otherReason", "startedAt", "completedAt", "completionSeconds",
  "reasonClarityScore", "selectionHelpScore", "missingInformation", "isUniversityStudent",
  "mvpVersion", "alternativeProductId", "recommendedProductPrice", "purchaseLinkExposed",
  "purchaseLinkClicked", "purchaseLinkClickedAt",
];

function escapeCsv(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

export function recordsToCsv(records) {
  return [
    csvColumns.join(","),
    ...records.map((record) => csvColumns.map((column) => escapeCsv(record[column])).join(",")),
  ].join("\n");
}
