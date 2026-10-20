import { describe, expect, it } from 'vitest';
import request from 'supertest';
import Koa from 'koa';
import path from 'path';
import { fileURLToPath } from 'url';
import { Decorator } from '@/index';

describe('RouteMiddleware', () => {
	const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), './controller');

	it('should apply class and method middlewares', async () => {
		const app = new Koa();
		const decorator = new Decorator(dir);
		decorator.matchFileName('MiddlewareController');
		app.use(decorator.middleware()).use(decorator.allowedMethods());

		const res1 = await request(app.callback()).get('/mw/class');
		expect(res1.text).toBe('ok');
		expect(res1.headers['x-class']).toBe('1');

		const res2 = await request(app.callback()).get('/mw/method');
		expect(res2.text).toBe('ok2');
		expect(res2.headers['x-class']).toBe('1');
		expect(res2.headers['x-method']).toBe('2');

		const res3 = await request(app.callback()).get('/mw/test');
		expect(res3.text).toBe('ok3');
		expect(res3.headers['x-class']).toBe('1');
		expect(res3.headers['x-test']).toBe('test');
	});

	it('should preserve onion order across class and method middlewares', async () => {
		const app = new Koa();
		const decorator = new Decorator(dir);
		decorator.matchFileName('MiddlewareController');
		app.use(decorator.middleware());

		const res = await request(app.callback()).get('/mw/order');
		expect(res.status).toBe(200);
		expect(res.text).toBe('ordered');
		expect(res.headers['x-order']).toBe(
			'class-before,method-1-before,method-2-before,handler,method-2-after,method-1-after,class-after',
		);
	});

	it('should execute stacked method decorators created by createMiddlewareDecorator in declaration order', async () => {
		const app = new Koa();
		const decorator = new Decorator(dir);
		decorator.matchFileName('MiddlewareController');
		app.use(decorator.middleware());

		const res = await request(app.callback()).get('/mw/created-order');
		expect(res.status).toBe(200);
		expect(res.text).toBe('created order');
		expect(res.headers['x-created-order']).toBe(
			'class-before,first-before,second-before,handler,second-after,first-after',
		);
	});

	it('should execute stacked class decorators created by createMiddlewareDecorator in declaration order', async () => {
		const app = new Koa();
		const decorator = new Decorator(dir);
		decorator.matchFileName('MiddlewareController');
		app.use(decorator.middleware());

		const res = await request(app.callback()).get('/mw-created-class-order/');
		expect(res.status).toBe(200);
		expect(res.text).toBe('created class order');
		expect(res.headers['x-created-order']).toBe('first-before,second-before,handler,second-after,first-after');
	});

	it('should allow route middleware to short-circuit the handler', async () => {
		const app = new Koa();
		const decorator = new Decorator(dir);
		decorator.matchFileName('MiddlewareController');
		app.use(decorator.middleware());

		const res = await request(app.callback()).get('/mw/short-circuit');
		expect(res.status).toBe(202);
		expect(res.text).toBe('short-circuited');
		expect(res.headers['x-order']).toBe('class-before,class-after');
	});

	it('should propagate route middleware errors without running the handler', async () => {
		const app = new Koa();
		let error: unknown;
		app.use(async (_ctx, next) => {
			try {
				await next();
			} catch (cause) {
				error = cause;
				throw cause;
			}
		});
		const decorator = new Decorator(dir);
		decorator.matchFileName('MiddlewareController');
		app.use(decorator.middleware());

		const res = await request(app.callback()).get('/mw/error');
		expect(res.status).toBe(418);
		expect(error).toMatchObject({ status: 418, message: 'middleware error' });
		expect(res.headers['x-order']).toBeUndefined();
	});
});
