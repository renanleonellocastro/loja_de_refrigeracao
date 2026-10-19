import { conflict, notFound, unprocessable } from '../../shared/errors.js';
import { MAX_IMAGES_PER_PRODUCT } from './schemas.js';

/** The `errors` extension that points the form at the field to fix. */
const fieldError = (path: string, message: string) => ({ errors: [{ path, message }] });

export const productNotFound = () => notFound('Produto não encontrado.');

export const categoryNotFound = () => notFound('Categoria não encontrada.');

export const imageNotFound = () => notFound('Foto não encontrada.');

export const categoryNameTaken = (takenName: string) =>
  conflict(
    'category-name-taken',
    'Categoria já existe',
    `Já existe a categoria "${takenName}".`,
    fieldError('name', 'Já existe uma categoria com este nome.'),
  );

export const categoryInUse = (productCount: number) =>
  conflict(
    'category-in-use',
    'Categoria com produtos',
    `A categoria tem ${productCount} produto(s). Mova os produtos para outra categoria antes de excluir.`,
    { productCount },
  );

export const invalidTargetCategory = () =>
  unprocessable(
    'invalid-target-category',
    'Categoria de destino inválida',
    'Escolha outra categoria.',
    fieldError('moveTo', 'Escolha outra categoria existente.'),
  );

const ALL_CATEGORIES_ONCE = 'Envie todas as categorias, cada uma uma única vez.';

export const invalidCategoryOrder = () =>
  unprocessable(
    'invalid-category-order',
    'Ordem inválida',
    ALL_CATEGORIES_ONCE,
    fieldError('ids', ALL_CATEGORIES_ONCE),
  );

const CHOOSE_EXISTING_CATEGORY = 'Escolha uma categoria existente.';

export const invalidCategory = () =>
  unprocessable(
    'invalid-category',
    'Categoria inválida',
    CHOOSE_EXISTING_CATEGORY,
    fieldError('categoryId', CHOOSE_EXISTING_CATEGORY),
  );

export const imageRequired = () =>
  unprocessable('image-required', 'Nenhuma foto enviada', 'Escolha ao menos uma foto.');

/** `room` is how many photos the product can still take. */
export const tooManyImages = (room: number) =>
  unprocessable(
    'too-many-images',
    'Fotos demais',
    room > 0
      ? `Cada produto pode ter até ${MAX_IMAGES_PER_PRODUCT} fotos. Envie no máximo mais ${room}.`
      : `Este produto já tem ${MAX_IMAGES_PER_PRODUCT} fotos. Remova alguma antes de enviar outra.`,
  );

const ALL_IMAGES_ONCE = 'Envie todas as fotos do produto, cada uma uma única vez.';

export const invalidImageOrder = () =>
  unprocessable(
    'invalid-image-order',
    'Ordem inválida',
    ALL_IMAGES_ONCE,
    fieldError('imageIds', ALL_IMAGES_ONCE),
  );

const COVER_MUST_BE_PRODUCT_IMAGE = 'A capa deve ser uma das fotos do produto.';

export const invalidCover = () =>
  unprocessable(
    'invalid-cover',
    'Capa inválida',
    COVER_MUST_BE_PRODUCT_IMAGE,
    fieldError('coverId', COVER_MUST_BE_PRODUCT_IMAGE),
  );
