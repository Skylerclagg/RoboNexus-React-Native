/**
 * Game Manual Types
 *
 * Type definitions for the enhanced game manual system with quick reference rules,
 * favorites, and PDF deep linking support.
 */

export type RuleSeverity = 'minor' | 'major' | 'info';

export interface Rule {
  id: string;                      // Unique identifier (e.g., "v5rc_sg1")
  rule: string;                    // Rule code with brackets (e.g., "<SG1>")
  title: string;                   // Short title (e.g., "Starting a Match")
  description: string;             // One-line description
  fullText?: string;               // Main rule text with formatting markers (without violation notes)
  completeText?: string;           // Complete text with formatting markers including all sections
  severity?: RuleSeverity;         // Violation severity (optional, may not be accurate)
  pdfPage?: number;                // Page number in official PDF
  pdfSection?: string;             // Section number (e.g., "7.3.1")
  category: string;                // Category (e.g., "Game Rules")
  tags?: string[];                 // Searchable tags (optional, not used in new scraped data)
  vexLink?: string;                // Link to VEX's official rule HTML page
  relatedRules?: string[];         // IDs of related rules
  icon?: string;                   // Optional icon path
  imageUrls?: string[];            // URLs of images associated with the rule
}

export interface RuleGroup {
  name: string;                    // Group name (e.g., "Specific Game Rules")
  programs: string[];              // Programs this group applies to
  rules: Rule[];                   // Rules in this group
}

export interface GameManual {
  program: string;                 // Program short name (e.g., "V5RC")
  season: string;                  // Season (e.g., "2024-2025")
  title: string;                   // Game name (e.g., "High Stakes")
  pdfUrl: string;                  // URL to official PDF
  pdfVersion?: string;             // PDF version number
  qnaUrl?: string;                 // URL to official Q&A
  version?: string;                // Manual version (YYYYMMDD format for comparison)
  ruleGroups: RuleGroup[];         // Organized rule groups
}

export interface FavoriteRuleStorage {
  [programSeason: string]: string[]; // program_season -> array of rule IDs
}
