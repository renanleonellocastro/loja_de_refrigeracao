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
  const form: MultipartForm = { files: [], fields: {} };
  for await (const part of request.parts()) {
    if (part.type === 'file') {
      form.files.push(await part.toBuffer());
    } else {
      form.fields[part.fieldname] = String(part.value);
    }
  }
  if (form.files.length > maxFiles) {
    throw unprocessable('too-many-files', 'Fotos demais', `Envie no máximo ${maxFiles} fotos.`);
  }
  return form;
}
