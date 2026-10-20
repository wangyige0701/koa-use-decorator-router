import Koa from 'koa';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decorator, Decorator } from '@/index';
import Router from '@koa/router';

describe('initialize', () => {
	const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), './controller');
	const brokenControllerDir = path.resolve(
		path.dirname(fileURLToPath(import.meta.url)),
		'./fixtures/broken-controller',
	);

	it('use constructor', async () => {
		const app = new Koa();
		const decorator = new Decorator(dir);

		app.use(decorator.middleware()).use(decorator.allowedMethods());

		const res = await request(app.callback()).get('/index/get');
		expect(res.text).toBe('get');
		expect(res.status).toBe(200);
	});

	it('use constructor with custom router', async () => {
		const app = new Koa();
		const router = new Router();
		const decorator = new Decorator(dir, router);

		app.use(decorator.middleware()).use(router.allowedMethods());

		const res = await request(app.callback()).get('/index/get');
		expect(res.text).toBe('get');
		expect(res.status).toBe(200);
	});

	it('use function', async () => {
		const app = new Koa();
		app.use(decorator(dir));

		const res = await request(app.callback()).get('/index/get');
		expect(res.text).toBe('get');
		expect(res.status).toBe(200);
	});

	it('use function with custom router', async () => {
		const app = new Koa();
		const router = new Router();
		app.use(decorator(dir, router)).use(router.allowedMethods());

		const res = await request(app.callback()).get('/index/get');
		expect(res.text).toBe('get');
		expect(res.status).toBe(200);
	});

	it('use prefix parameter', async () => {
		const app = new Koa();
		app.use(
			decorator({
				controllerDir: dir,
				prefix: '/api',
			}),
		);

		const res = await request(app.callback()).get('/api/index/get');
		expect(res.text).toBe('get');
		expect(res.status).toBe(200);
	});

	it('use prefix parameter with constructor', async () => {
		const app = new Koa();
		const decorator = new Decorator(dir);
		decorator.prefix('/api');

		app.use(decorator.middleware()).use(decorator.allowedMethods());

		const res = await request(app.callback()).get('/api/index/get');
		expect(res.text).toBe('get');
		expect(res.status).toBe(200);
	});

	it('initializes routes once across sequential and concurrent requests', async () => {
		const app = new Koa();
		const router = new Router();
		app.use(decorator({ controllerDir: dir, matchFileName: 'IndexController' }, router));
		const callback = app.callback();
		const middlewareCount = app.middleware.length;

		const first = await request(callback).get('/index/get');
		expect(first.status).toBe(200);
		const routeCount = router.stack.length;
		expect(routeCount).toBeGreaterThan(0);

		const responses = await Promise.all([
			request(callback).get('/index/get'),
			request(callback).get('/index/get'),
			request(callback).get('/index/get'),
		]);
		expect(responses.every((response) => response.status === 200)).toBe(true);
		expect(router.stack).toHaveLength(routeCount);
		expect(app.middleware).toHaveLength(middlewareCount);
	});

	it('applies allowedMethods after route matching', async () => {
		const app = new Koa();
		app.use(
			decorator({
				controllerDir: dir,
				matchFileName: 'IndexController',
				allowedMethods: true,
			}),
		);

		const methodNotAllowed = await request(app.callback()).patch('/index/get');
		expect(methodNotAllowed.status).toBe(405);
		expect(methodNotAllowed.headers.allow).toContain('GET');

		const options = await request(app.callback()).options('/index/get');
		expect(options.status).toBe(200);
		expect(options.headers.allow).toContain('GET');
	});

	it('does not synthesize method responses when allowedMethods is disabled', async () => {
		const app = new Koa();
		app.use(
			decorator({
				controllerDir: dir,
				matchFileName: 'IndexController',
				allowedMethods: false,
			}),
		).use((ctx) => {
			ctx.status = 202;
			ctx.body = 'method fallback';
		});

		const res = await request(app.callback()).patch('/index/get');
		expect(res.status).toBe(202);
		expect(res.text).toBe('method fallback');
		expect(res.headers.allow).toBeUndefined();
	});

	it('passes unmatched routes to downstream middleware', async () => {
		const app = new Koa();
		app.use(decorator({ controllerDir: dir, matchFileName: 'IndexController' })).use((ctx) => {
			ctx.status = 202;
			ctx.body = 'fallback';
		});

		const res = await request(app.callback()).get('/not-registered');
		expect(res.status).toBe(202);
		expect(res.text).toBe('fallback');
	});

	it('forwards controller import failures through the Koa error chain', async () => {
		const app = new Koa();
		const errors: unknown[] = [];
		app.use(async (_ctx, next) => {
			try {
				await next();
			} catch (cause) {
				errors.push(cause);
				throw cause;
			}
		}).use(decorator(brokenControllerDir));

		const first = await request(app.callback()).get('/');
		const second = await request(app.callback()).get('/');
		expect(first.status).toBe(500);
		expect(second.status).toBe(500);
		expect(errors).toHaveLength(2);
		expect(errors[0]).toBeInstanceOf(Error);
		expect((errors[0] as Error).message).toBe('broken controller import');
		expect(errors[1]).toBe(errors[0]);
	});
});
