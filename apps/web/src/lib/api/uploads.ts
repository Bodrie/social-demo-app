import { type UploadKind, type UploadResponse, uploadResponseSchema } from '@the-mesh/shared';
import { api } from './client';

/** Sends one image as multipart; the API re-encodes it and answers with the storage key. */
export function uploadImage(kind: UploadKind, file: File, signal?: AbortSignal): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file, file.name);
  return api.post(`/uploads?kind=${kind}`, undefined, { schema: uploadResponseSchema, formData, signal });
}
