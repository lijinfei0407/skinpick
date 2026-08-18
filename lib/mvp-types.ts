export type SkinType = "dry" | "oily" | "combination" | "normal" | "unknown";
export type SkinConcern = "dryness" | "oiliness" | "breakout" | "sensitivity";
export type BudgetRange = "under_20000" | "20000_29999" | "30000_plus" | "any";
export type TexturePreference = "light_fresh" | "moist_hydrated" | "rich_nourishing" | "low_stickiness" | "any";
export type ProductPriceTier = Exclude<BudgetRange, "any">;
export type ProductTexture = Exclude<TexturePreference, "any">;

export type Product = {
  productId: string;
  brand?: string;
  name: string;
  volume: string;
  listPrice?: string;
  displayedPrice: string;
  priceValue: number;
  priceTier: ProductPriceTier;
  texture: ProductTexture;
  priceCheckedAt?: string;
  feature: string;
  reasons: [string, string];
  caution: string;
  imagePath: string;
  detailUrl?: string;
  purchaseUrl?: string;
  skinTypes: SkinType[];
  skinConcerns: SkinConcern[];
};

export type RejectionReason =
  | "brand"
  | "insufficient_info"
  | "concern_mismatch"
  | "reviews_unavailable"
  | "low_trust"
  | "other";

export type MissingInformation = "price" | "texture" | "ingredients" | "comparison" | "reviews" | "rationale" | "other" | "none";

export type QuizScreen = "landing" | "eligibility" | "ineligible" | "skin" | "concern" | "budget" | "texture" | "result" | "rejection" | "complete" | "feedback" | "finished";

export type QuizState = {
  screen: QuizScreen;
  participantCode: string;
  isUniversityStudent: boolean | null;
  skinType: SkinType | "";
  skinConcern: SkinConcern | "";
  budgetRange: BudgetRange | "";
  texturePreference: TexturePreference | "";
  rejectionReason: RejectionReason | "";
  otherReason: string;
  startedAt: string;
  accepted: boolean | null;
  completedAt: string;
  completionSeconds: number;
  reasonClarityScore: number | null;
  selectionHelpScore: number | null;
  missingInformation: MissingInformation | "";
  purchaseLinkClicked: boolean;
  purchaseLinkClickedAt: string;
};

export type TestRecord = {
  recordId: string;
  mvpVersion: "FINAL";
  timestamp: string;
  participantCode: string;
  isUniversityStudent: boolean | null;
  skinType: SkinType | "";
  skinConcern: SkinConcern | "";
  budgetRange: BudgetRange | "";
  texturePreference: TexturePreference | "";
  recommendedProductId: string;
  alternativeProductId: string;
  recommendedProductPrice: number;
  recommendationViewed: boolean;
  purchaseLinkExposed: boolean;
  purchaseLinkClicked: boolean;
  purchaseLinkClickedAt: string;
  accepted: boolean | null;
  rejectionReason: RejectionReason | "";
  otherReason: string;
  startedAt: string;
  completedAt: string;
  completionSeconds: number;
  reasonClarityScore: number | null;
  selectionHelpScore: number | null;
  missingInformation: MissingInformation | "";
};

export type ParticipantAllocation = {
  participantCode: string;
  startedAt: string;
};
