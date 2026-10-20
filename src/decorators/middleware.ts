import type { Middleware } from 'koa';
import { ROUTE_MIDDLEWARES } from '@/config';

/**
 * 创建一个中间件装饰器工厂
 *
 * Create a middleware decorator factory.
 *
 * @param middlewares 中间件函数 / middleware functions
 */
export function createMiddlewareDecorator(...middlewares: Middleware[]) {
	// TODO 保留支持传参的中间件装饰器工厂
	return () => {
		return (target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) => {
			if (!propertyKey) {
				const middlewaresList = (Reflect.getMetadata(ROUTE_MIDDLEWARES, target) || []) as Middleware[];
				middlewaresList.unshift(...middlewares);
				Reflect.defineMetadata(ROUTE_MIDDLEWARES, middlewaresList, target);
				return target;
			}

			const middlewaresList = (Reflect.getMetadata(ROUTE_MIDDLEWARES, target.constructor, propertyKey) ||
				[]) as Middleware[];
			middlewaresList.unshift(...middlewares);
			Reflect.defineMetadata(ROUTE_MIDDLEWARES, middlewaresList, target.constructor, propertyKey);
			return descriptor;
		};
	};
}

/**
 * 路由中间件装饰器
 *
 * Route middleware decorator.
 *
 * @param middlewares 中间件函数 / middleware functions
 */
export function RouteMiddleware(...middlewares: Middleware[]) {
	return createMiddlewareDecorator(...middlewares)();
}
