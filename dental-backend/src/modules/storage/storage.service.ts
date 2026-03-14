import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';
import * as fs from 'fs';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private storage: Storage | null = null;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    const keyPath =
      this.configService.get<string>('GCP_SERVICE_ACCOUNT_KEY_PATH') ||
      'gcp-key.json';
    const projectId = this.configService.get<string>('GCP_PROJECT_ID');

    this.bucketName =
      this.configService.get<string>('GCP_BUCKET_NAME') ||
      'dental-saas-uploads';

    if (fs.existsSync(keyPath)) {
      this.storage = new Storage({ keyFilename: keyPath, projectId });
    } else {
      this.logger.warn(
        `GCP key file not found at ${keyPath}. StorageService is running in mock mode.`,
      );
    }
  }

  /**
   * Upload file buffer to GCS at path: {tenantId}/{folder}/{timestamp}-{fileName}
   */
  async uploadFile(
    tenantId: string,
    folder: string,
    fileName: string,
    mimeType: string,
    buffer: Buffer,
  ): Promise<string> {
    const timestamp = Date.now();
    const filePath = `${tenantId}/${folder}/${timestamp}-${fileName}`;

    if (!this.storage) {
      this.logger.warn(`Local storage mode: generating Base64 URI for ${filePath}`);
      
      // On Vercel, writing to disk causes EROFS (Read-only file system) error.
      // Since GCP is not configured, we return a Data URI so the image still
      // works instantly on the frontend without needing a real cloud bucket!
      const base64Data = buffer.toString('base64');
      return `data:${mimeType};base64,${base64Data}`;
    }

    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(filePath);

    try {
      await file.save(buffer, {
        contentType: mimeType,
        resumable: false,
      });
      this.logger.log(`Uploaded file: ${filePath}`);
      return `https://storage.googleapis.com/${this.bucketName}/${filePath}`;
    } catch (err) {
      this.logger.error(`GCS upload failed: ${(err as Error).message}`);
      throw new InternalServerErrorException('File upload failed');
    }
  }

  /**
   * Generate a signed URL for temporary secure access (default 60 min)
   */
  async getSignedUrl(filePath: string, expiresInMinutes = 60): Promise<string> {
    if (!this.storage) {
      return `https://mock-storage.local/signed/${filePath}`;
    }

    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(filePath);

    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + expiresInMinutes * 60 * 1000,
    });
    return url;
  }

  /**
   * Delete a file from GCS by its full path
   */
  async deleteFile(filePath: string): Promise<void> {
    if (!this.storage) {
      this.logger.log(`Mock deleted file: ${filePath}`);
      return;
    }

    const bucket = this.storage.bucket(this.bucketName);
    await bucket.file(filePath).delete({ ignoreNotFound: true });
    this.logger.log(`Deleted file: ${filePath}`);
  }

  /**
   * Upload a generated PDF invoice buffer to GCS
   */
  async uploadInvoicePDF(
    tenantId: string,
    invoiceId: string,
    pdfBuffer: Buffer,
  ): Promise<string> {
    return this.uploadFile(
      tenantId,
      'invoices',
      `invoice-${invoiceId}.pdf`,
      'application/pdf',
      pdfBuffer,
    );
  }
}
