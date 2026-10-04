import type { FastifyRequest } from 'fastify';
import { unprocessable } from '../../shared/errors.js';

export interface MultipartForm {
  files: Buffer[];
  fields: Record<string, string>;
}

/** Reads a multipart request into memory: image files plus plain text fields. */
export async function readMultipart(request: FastifyRequest, maxFiles: number): Promise<MultipartForm> {
  if (!request.isMultipart()) {
    throw unprocessable('multipart-required', 'Formato inválido', 'Envie os dados como multipart/form-data.');
  }
  const tooManyFiles = () =>
    unprocessable('too-many-files', 'Fotos demais', `Envie no máximo ${maxFiles} fotos.`);
  const form: MultipartForm = { files: [], fields: {} };
  try {
    for await (const part of request.parts()) {
      if (part.type === 'file') {
        form.files.push(await part.toBuffer());
      } else {
        form.fields[part.fieldname] = String(part.value);
      }
    }
  } catch (error) {
    // More files than the plugin accepts per request (app.ts) is the same mistake as above maxFiles.
    if (error instanceof request.server.multipartErrors.FilesLimitError) throw tooManyFiles();
    throw error;
  }
  if (form.files.length > maxFiles) throw tooManyFiles();
  return form;
}
