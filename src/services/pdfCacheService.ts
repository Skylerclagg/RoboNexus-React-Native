/**
 * PDF Cache Service
 *
 * Handles downloading and caching PDF files for offline access
 * Used for game manual judging resources and other downloadable PDFs
 */

import * as FileSystem from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { createLogger } from '../utils/logger';
import { storage } from '../utils/webCompatibility';

const logger = createLogger('pdfCacheService');

// Directory for cached PDFs
const PDF_CACHE_DIR = `${LegacyFileSystem.documentDirectory}pdf_cache/`;

export interface CachedPDF {
  url: string;
  localPath: string;
  fileName: string;
  downloadedAt: number;
  fileSize: number;
}

export interface PDFDownloadProgress {
  totalBytes: number;
  downloadedBytes: number;
  progress: number; // 0-1
}

class PDFCacheService {
  private downloadCache: Map<string, CachedPDF> = new Map();
  private downloadInProgress: Map<string, boolean> = new Map();

  constructor() {
    this.initializeCache();
  }

  /**
   * Initialize the cache directory and load existing cached PDFs
   */
  private async initializeCache() {
    try {
      // Create cache directory if it doesn't exist
      const dirInfo = await LegacyFileSystem.getInfoAsync(PDF_CACHE_DIR);
      if (!dirInfo.exists) {
        await LegacyFileSystem.makeDirectoryAsync(PDF_CACHE_DIR, { intermediates: true });
        logger.debug('Created PDF cache directory:', PDF_CACHE_DIR);
      }

      // Load cached PDF metadata from storage
      const cachedData = await storage.getItem('pdf_cache_metadata');
      if (cachedData) {
        const parsed: CachedPDF[] = JSON.parse(cachedData);
        parsed.forEach(pdf => {
          this.downloadCache.set(pdf.url, pdf);
        });
        logger.debug('Loaded', parsed.length, 'cached PDFs from storage');
      }
    } catch (error) {
      logger.error('Failed to initialize PDF cache:', error);
    }
  }

  /**
   * Save cache metadata to storage
   */
  private async saveCacheMetadata() {
    try {
      const cacheArray = Array.from(this.downloadCache.values());
      await storage.setItem('pdf_cache_metadata', JSON.stringify(cacheArray));
    } catch (error) {
      logger.error('Failed to save cache metadata:', error);
    }
  }

  /**
   * Generate a safe file name from a URL
   */
  private generateFileName(url: string): string {
    // Extract filename from URL or generate from hash
    const urlParts = url.split('/');
    const lastPart = urlParts[urlParts.length - 1];

    // If the last part looks like a filename with extension, use it
    if (lastPart.includes('.')) {
      // Clean up any query parameters
      const cleanName = lastPart.split('?')[0];
      return cleanName;
    }

    // Otherwise, generate a unique name from the URL
    const hash = this.simpleHash(url);
    return `pdf_${hash}.pdf`;
  }

  /**
   * Simple hash function for generating unique file names
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Check if a PDF is already cached
   */
  public isCached(url: string): boolean {
    return this.downloadCache.has(url);
  }

  /**
   * Get cached PDF info
   */
  public getCachedPDF(url: string): CachedPDF | undefined {
    return this.downloadCache.get(url);
  }

  /**
   * Check if a download is currently in progress
   */
  public isDownloading(url: string): boolean {
    return this.downloadInProgress.get(url) || false;
  }

  /**
   * Download a PDF and cache it locally
   */
  public async downloadPDF(
    url: string,
    onProgress?: (progress: PDFDownloadProgress) => void
  ): Promise<CachedPDF> {
    try {
      // Check if already cached
      if (this.isCached(url)) {
        logger.debug('PDF already cached:', url);
        return this.downloadCache.get(url)!;
      }

      // Check if download is already in progress
      if (this.isDownloading(url)) {
        throw new Error('Download already in progress');
      }

      this.downloadInProgress.set(url, true);
      logger.debug('Starting PDF download:', url);

      const fileName = this.generateFileName(url);
      const localPath = `${PDF_CACHE_DIR}${fileName}`;

      // Create download resumable
      const downloadResumable = LegacyFileSystem.createDownloadResumable(
        url,
        localPath,
        {},
        (downloadProgress) => {
          if (onProgress) {
            const progress: PDFDownloadProgress = {
              totalBytes: downloadProgress.totalBytesExpectedToWrite,
              downloadedBytes: downloadProgress.totalBytesWritten,
              progress: downloadProgress.totalBytesExpectedToWrite > 0
                ? downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite
                : 0,
            };
            onProgress(progress);
          }
        }
      );

      const result = await downloadResumable.downloadAsync();

      if (!result) {
        throw new Error('Download failed - no result returned');
      }

      // Get file info to store size
      const fileInfo = await LegacyFileSystem.getInfoAsync(result.uri);
      const fileSize = fileInfo.exists && 'size' in fileInfo ? fileInfo.size : 0;

      const cachedPDF: CachedPDF = {
        url,
        localPath: result.uri,
        fileName,
        downloadedAt: Date.now(),
        fileSize,
      };

      this.downloadCache.set(url, cachedPDF);
      await this.saveCacheMetadata();

      logger.debug('PDF downloaded successfully:', fileName, `(${fileSize} bytes)`);
      return cachedPDF;
    } catch (error) {
      logger.error('Failed to download PDF:', error);
      throw error;
    } finally {
      this.downloadInProgress.delete(url);
    }
  }

  /**
   * Delete a cached PDF
   */
  public async deleteCachedPDF(url: string): Promise<void> {
    try {
      const cached = this.downloadCache.get(url);
      if (!cached) {
        logger.debug('PDF not cached, nothing to delete:', url);
        return;
      }

      // Delete the file
      const fileInfo = await LegacyFileSystem.getInfoAsync(cached.localPath);
      if (fileInfo.exists) {
        await LegacyFileSystem.deleteAsync(cached.localPath);
        logger.debug('Deleted cached PDF file:', cached.fileName);
      }

      // Remove from cache
      this.downloadCache.delete(url);
      await this.saveCacheMetadata();
    } catch (error) {
      logger.error('Failed to delete cached PDF:', error);
      throw error;
    }
  }

  /**
   * Get total cache size in bytes
   */
  public getTotalCacheSize(): number {
    let totalSize = 0;
    this.downloadCache.forEach(pdf => {
      totalSize += pdf.fileSize;
    });
    return totalSize;
  }

  /**
   * Get all cached PDFs
   */
  public getAllCachedPDFs(): CachedPDF[] {
    return Array.from(this.downloadCache.values());
  }

  /**
   * Clear all cached PDFs
   */
  public async clearAllCache(): Promise<void> {
    try {
      const cachedPDFs = this.getAllCachedPDFs();

      for (const pdf of cachedPDFs) {
        const fileInfo = await LegacyFileSystem.getInfoAsync(pdf.localPath);
        if (fileInfo.exists) {
          await LegacyFileSystem.deleteAsync(pdf.localPath);
        }
      }

      this.downloadCache.clear();
      await this.saveCacheMetadata();

      logger.debug('Cleared all cached PDFs');
    } catch (error) {
      logger.error('Failed to clear PDF cache:', error);
      throw error;
    }
  }

  /**
   * Format file size for display
   */
  public static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}

// Export singleton instance
export const pdfCacheService = new PDFCacheService();
