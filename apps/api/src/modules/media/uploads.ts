import type { Multipart } from '@fastify/multipart';
import type { FastifyRequest } from 'fastify';
import { unprocessable } from '../../shared/errors.js';

export interface MultipartForm {
  files: Buffer[];
  fields: Record<string, string>;
}

const tooManyFiles = (maxFiles: number) =>
  unprocessable('too-many-files', 'Fotos demais', `Envie no máximo ${maxFiles} fotos.`);

function assertMultipart(request: FastifyRequest): void {
  if (!request.isMultipart()) {
    throw unprocessable('multipart-required', 'Formato inválido', 'Envie os dados como multipart/form-data.');
  }
}

async function addPart(form: MultipartForm, part: Multipart): Promise<void> {
  if (part.type === 'file') {
    form.files.push(await part.toBuffer());
  } else {
    form.fields[part.fieldname] = String(part.value);
  }
}

async function collectParts(request: FastifyRequest): Promise<MultipartForm> {
  const form: MultipartForm = { files: [], fields: {} };
  for await (const part of request.parts()) await addPart(form, part);
  return form;
}

/** Turns a parser failure into the answer the client understands. */
function rethrowReadError(request: FastifyRequest, error: unknown, maxFiles: number): never {
  // More files than the plugin accepts per request (app.ts) is the same mistake as above maxFiles.
  if (error instanceof request.server.multipartErrors.FilesLimitError) throw tooManyFiles(maxFiles);
  // Size limits carry their own status; anything else is a body the parser cannot read (no boundary, cut off).
  if ((error as { statusCode?: number }).statusCode) throw error;
  throw unprocessable('multipart-invalid', 'Formato inválido', 'Não foi possível ler as fotos enviadas.');
}

/** Reads a multipart request into memory: image files plus plain text fields. */
export async function readMultipart(request: FastifyRequest, maxFiles: number): Promise<MultipartForm> {
  assertMultipart(request);
  const form = await collectParts(request).catch((error: unknown) =>
    rethrowReadError(request, error, maxFiles),
  );
  if (form.files.length > maxFiles) throw tooManyFiles(maxFiles);
  return form;
}
