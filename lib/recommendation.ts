import productsData from "../data/products.json" with { type: "json" };
import rulesData from "../data/recommendation-rules.json" with { type: "json" };
import type { BudgetRange, Product, SkinConcern, SkinType, TexturePreference } from "./mvp-types";

export const products = productsData as Product[];
const rules = rulesData as Record<SkinType, Record<SkinConcern, string>>;

function scoreProduct(product: Product, skinType: SkinType, concern: SkinConcern, texturePreference: TexturePreference, preferredProductId: string) {
  const skinMatches = product.skinTypes.includes(skinType);
  const concernMatches = product.skinConcerns.includes(concern);
  const textureMatches = texturePreference !== "any" && product.texture === texturePreference;

  return (skinMatches ? 40 : 0)
    + (concernMatches ? 50 : 0)
    + (skinMatches && concernMatches ? 60 : 0)
    + (textureMatches ? 20 : 0)
    + (product.productId === preferredProductId ? 5 : 0);
}

export type RecommendationResult = {
  primary: Product;
  alternative: Product;
  third: Product;
};

function isWithinBudget(product: Product, budgetRange: BudgetRange) {
  if (budgetRange === "under_20000") return product.priceValue < 20000;
  if (budgetRange === "20000_29999") return product.priceValue < 30000;
  return true;
}

export function getRecommendations(skinType: SkinType, concern: SkinConcern, budgetRange: BudgetRange, texturePreference: TexturePreference): RecommendationResult {
  const preferredProductId = rules[skinType]?.[concern] ?? rules.unknown[concern];
  const ranked = products
    .filter((product) => isWithinBudget(product, budgetRange))
    .sort((left, right) => {
      const scoreDifference = scoreProduct(right, skinType, concern, texturePreference, preferredProductId)
        - scoreProduct(left, skinType, concern, texturePreference, preferredProductId);
      return scoreDifference || left.priceValue - right.priceValue || left.productId.localeCompare(right.productId);
    });

  if (ranked.length < 3) {
    throw new Error("선택한 예산 범위에 연결된 추천 제품이 3개 미만입니다.");
  }

  return { primary: ranked[0], alternative: ranked[1], third: ranked[2] };
}

export function getRecommendation(skinType: SkinType, concern: SkinConcern, budgetRange: BudgetRange, texturePreference: TexturePreference): Product {
  return getRecommendations(skinType, concern, budgetRange, texturePreference).primary;
}

export const recommendationRules = rules;
