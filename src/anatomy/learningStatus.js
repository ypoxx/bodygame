export const RUNTIME_LEARNING_STATUSES = Object.freeze([
  "source_verified_mvp",
  "published",
]);

export function isRuntimeLearningStatus(status) {
  return RUNTIME_LEARNING_STATUSES.includes(status);
}

export function isRenderableLearning(learning) {
  if (!learning || typeof learning !== "object" || !isRuntimeLearningStatus(learning.status)) {
    return false;
  }
  const state = learning.reviewedState;
  if (!state || typeof state !== "object") return false;
  if (learning.status === "published") {
    return state.verificationTier === "human_reviewed" &&
      state.meshMappingStatus === "human_verified";
  }
  return state.verificationTier === "source_verified_mvp" &&
    state.meshMappingStatus === "source_verified";
}
