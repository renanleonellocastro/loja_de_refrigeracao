import type {
  ContextConfigDefault,
  FastifyContextConfig,
  FastifySchema,
  HTTPMethods,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault,
  RouteGenericInterface,
  RouteHandlerMethod,
} from 'fastify';
import type { FastifyPluginAsyncZod, ZodTypeProvider } from 'fastify-type-provider-zod';
import type { AppContext } from '../context.js';

type ZodHandler<Schema extends FastifySchema> = RouteHandlerMethod<
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  RouteGenericInterface,
  ContextConfigDefault,
  Schema,
  ZodTypeProvider
>;

type ZodApp = Parameters<FastifyPluginAsyncZod>[0];

/** What a route handler receives: the application context plus the request and reply typed by its schema. */
export interface RouteCall<Schema extends FastifySchema> {
  readonly ctx: AppContext;
  readonly request: Parameters<ZodHandler<Schema>>[0];
  readonly reply: Parameters<ZodHandler<Schema>>[1];
}

/**
 * A route as data: modules list their routes in a table instead of registering them one by one
 * inside a plugin closure, so each handler stays a small function of its own.
 */
export interface Route<Schema extends FastifySchema> {
  readonly method: HTTPMethods;
  readonly url: string;
  readonly config: FastifyContextConfig;
  readonly schema: Schema;
  // Method syntax keeps routes with different schemas assignable to one table.
  handle(call: RouteCall<Schema>): ReturnType<ZodHandler<Schema>>;
}

/** Infers the schema of a route so its handler gets typed params, query, body and reply. */
export function defineRoute<Schema extends FastifySchema>(route: Route<Schema>): Route<Schema> {
  return route;
}

/** Registers the routes in table order, which is also the order of the OpenAPI document. */
export function registerRoutes(app: ZodApp, ctx: AppContext, routes: readonly Route<FastifySchema>[]): void {
  for (const { handle, ...options } of routes) {
    app.route({ ...options, handler: (request, reply) => handle({ ctx, request, reply }) });
  }
}
