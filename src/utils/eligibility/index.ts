// Main exports for the eligibility system
export * from './types';
export * from './common';
export * from './eligibilityCalculator';

// Re-export old interfaces for backward compatibility
export type { EligibilityResult } from './types';
export { calculateEligibility as calculateAllAroundEligibility } from './eligibilityCalculator';
export { calculateEligibility as calculateExcellenceEligibility } from './eligibilityCalculator';
export { getProgramRequirements as getAllAroundRequirements } from './eligibilityCalculator';
export { getProgramRequirements as getExcellenceRequirements } from './eligibilityCalculator';