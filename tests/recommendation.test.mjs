import assert from "node:assert/strict";
import test from "node:test";
import { getRecommendation, getRecommendations, products } from "../lib/recommendation.ts";

const skinTypes = ["dry", "oily", "combination", "normal", "unknown"];
const concerns = ["dryness", "oiliness", "breakout", "sensitivity"];
const budgets = ["under_20000", "20000_29999", "30000_plus", "any"];
const textures = ["light_fresh", "moist_hydrated", "rich_nourishing", "low_stickiness", "any"];

function expectedTier(priceValue) {
  if (priceValue < 20000) return "under_20000";
  if (priceValue < 30000) return "20000_29999";
  return "30000_plus";
}

function isWithinBudget(product, budget) {
  if (budget === "under_20000") return product.priceValue < 20000;
  if (budget === "20000_29999") return product.priceValue < 30000;
  return true;
}

test("keeps displayed prices, numeric prices, and price tiers aligned", () => {
  const allowedTextures = new Set(textures.slice(0, -1));
  for (const product of products) {
    const displayedPriceValue = Number(product.displayedPrice.replace(/[^0-9]/g, ""));
    assert.equal(product.priceValue, displayedPriceValue, `${product.productId} 표시 가격과 숫자 가격이 같아야 합니다.`);
    assert.equal(product.priceTier, expectedTier(product.priceValue), `${product.productId} 가격 구간이 표시 가격과 맞아야 합니다.`);
    assert.ok(allowedTextures.has(product.texture), `${product.productId} 사용감 값이 설문 선택지와 맞아야 합니다.`);
  }
});

test("always respects the selected budget and uses texture as a tiebreaker", () => {
  for (const skinType of skinTypes) {
    for (const concern of concerns) {
      for (const budget of budgets) {
        for (const texture of textures) {
          const recommendation = getRecommendation(skinType, concern, budget, texture);
          assert.ok(isWithinBudget(recommendation, budget), `${skinType}/${concern}/${budget}/${texture} 예산을 벗어나면 안 됩니다.`);

          const exactTextureCandidateExists = texture !== "any" && products.some((product) =>
            isWithinBudget(product, budget)
            && product.skinTypes.includes(skinType)
            && product.skinConcerns.includes(concern)
            && product.texture === texture
          );
          if (exactTextureCandidateExists) assert.equal(recommendation.texture, texture, `${skinType}/${concern}/${budget}/${texture} 사용감을 우선해야 합니다.`);
        }
      }
    }
  }
});

test("returns distinct first, second, and third products for every condition", () => {
  for (const skinType of skinTypes) {
    for (const concern of concerns) {
      for (const budget of budgets) {
        for (const texture of textures) {
          const { primary, alternative, third } = getRecommendations(skinType, concern, budget, texture);
          assert.notEqual(primary.productId, alternative.productId);
          assert.notEqual(primary.productId, third.productId);
          assert.notEqual(alternative.productId, third.productId);
          assert.ok(isWithinBudget(primary, budget));
          assert.ok(isWithinBudget(alternative, budget));
          assert.ok(isWithinBudget(third, budget));
        }
      }
    }
  }
});
