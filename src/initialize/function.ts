import type { Middleware } from 'koa';
import type { DecoratorOptions } from '@/@types';
import Router from '@koa/router';
import { initialize } from '@/initialize';
import { isBoolean, isString } from '@/utils';
import { ControllerDirRequired } from '@/error';

export function decorator(options: string | DecoratorOptions, router_?: Router): Middleware {
	const router = router_ && router_ instanceof Router ? router_ : new Router();

	if (isString(options)) {
		options = { controllerDir: options };
	}

	const { controllerDir, allowedMethods, prefix, matchFileName, acceptAnyControllerName = false } = options || {};
	if (!controllerDir) {
		throw new Error(ControllerDirRequired);
	}

	const initialization = initialize(router, controllerDir, matchFileName, acceptAnyControllerName).then(
		() => ({ success: true as const }),
		(error: unknown) => ({ success: false as const, error }),
	);

	if (isString(prefix) && prefix) {
		router.prefix(prefix);
	}

	const routesMiddleware = router.routes() as Middleware;
	const allowedMethodsMiddleware = allowedMethods
		? isBoolean(allowedMethods)
			? (router.allowedMethods() as Middleware)
			: (router.allowedMethods(allowedMethods) as Middleware)
		: null;
	return async (ctx, next) => {
		const result = await initialization;

		if (!result.success) {
			throw result.error;
		}

		await routesMiddleware(ctx, async () => {
			if (allowedMethodsMiddleware) {
				await allowedMethodsMiddleware(ctx, next);
			} else {
				await next();
			}
		});
	};
}
