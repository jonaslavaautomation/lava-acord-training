import * as tus from 'tus-js-client';
import { supabase, SUPABASE_URL } from './supabase';

export interface ResumableUploadOptions {
  bucket: string;
  path: string;
  file: File | Blob;
  contentType: string;
  onProgress?: (percent: number, bytesUploaded: number, bytesTotal: number) => void;
}

export interface ResumableUploadHandle {
  promise: Promise<void>;
  abort: () => void;
}

/**
 * Upload a file to Supabase Storage using the TUS resumable protocol.
 * - Real byte-level progress
 * - Automatic retries; an interrupted upload resumes from the last completed chunk
 * - Required for large training videos (standard uploads are capped at ~50 MB per request)
 *
 * Supabase requires a chunk size of exactly 6 MB for resumable uploads.
 */
export function uploadResumable(opts: ResumableUploadOptions): ResumableUploadHandle {
  let upload: tus.Upload | null = null;
  let aborted = false;
  let rejectPending: ((e: Error) => void) | null = null;

  const promise = (async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('You must be signed in to upload files.');

    await new Promise<void>((resolve, reject) => {
      rejectPending = reject;
      upload = new tus.Upload(opts.file, {
        endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
        retryDelays: [0, 2000, 5000, 10000, 20000],
        headers: {
          authorization: `Bearer ${token}`,
          'x-upsert': 'false',
        },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        metadata: {
          bucketName: opts.bucket,
          objectName: opts.path,
          contentType: opts.contentType,
          cacheControl: '3600',
        },
        chunkSize: 6 * 1024 * 1024,
        onError: (err) => {
          const res = (err as tus.DetailedError).originalResponse;
          const body = res?.getBody?.();
          let msg = err.message;
          if (body) {
            try {
              const parsed = JSON.parse(body) as { message?: string; error?: string };
              msg = parsed.message || parsed.error || msg;
            } catch {
              msg = body.slice(0, 200);
            }
          }
          if (/row-level security|unauthorized|403/i.test(msg)) {
            msg = 'Permission denied — only trainers and administrators can upload training materials.';
          } else if (/maximum allowed size|Payload too large|413/i.test(msg)) {
            msg = 'File exceeds the storage size limit configured in Supabase (Storage → Settings → Upload file size limit).';
          }
          reject(new Error(msg));
        },
        onProgress: (sent, total) => {
          opts.onProgress?.(total ? Math.round((sent / total) * 100) : 0, sent, total);
        },
        onSuccess: () => resolve(),
      });

      if (aborted) {
        reject(new Error('Upload cancelled'));
        return;
      }
      // Resume a previous interrupted upload of the same file if one exists.
      upload.findPreviousUploads().then((previous) => {
        if (previous.length > 0) upload!.resumeFromPreviousUpload(previous[0]);
        upload!.start();
      });
    });
  })();

  return {
    promise,
    abort: () => {
      aborted = true;
      upload?.abort(true).catch(() => undefined);
      rejectPending?.(new Error('Upload cancelled'));
    },
  };
}
