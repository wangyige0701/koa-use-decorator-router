import Koa from 'koa';
import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { decorator } from '@/index';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

describe('Singleton', () => {
	const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), './controller');

	it('should return 1', async () => {
		vi.resetModules();
		const app = new Koa();
		app.use(decorator({ controllerDir: dir, matchFileName: 'SingletonController' }));

		const res = await request(app.callback()).get('/singleton/count');
		expect(res.text).toBe('1');
		expect(res.status).toBe(200);

		const res2 = await request(app.callback()).get('/singleton/count');
		expect(res2.text).toBe('1');
		expect(res2.status).toBe(200);
	});

	it('should return 2', async () => {
		vi.resetModules();
		const app = new Koa();
		app.use(decorator({ controllerDir: dir, matchFileName: 'SingletonController' }));

		const res = await request(app.callback()).get('/singleton/count2');
		expect(res.text).toBe('1');
		expect(res.status).toBe(200);

		const res2 = await request(app.callback()).get('/singleton/count2');
		expect(res2.text).toBe('2');
		expect(res2.status).toBe(200);
	});

	it('constructs a singleton dependency once during concurrent first access', async () => {
		const app = new Koa();
		app.use(decorator({ controllerDir: dir, matchFileName: 'SingletonBoundaryController' }));
		const callback = app.callback();

		const responses = await Promise.all([
			request(callback).get('/singleton-boundary/concurrent'),
			request(callback).get('/singleton-boundary/concurrent'),
			request(callback).get('/singleton-boundary/concurrent'),
		]);

		expect(responses.map((response) => response.status)).toEqual([200, 200, 200]);
		expect(responses.map((response) => response.text)).toEqual(['1', '1', '1']);
	});

	it('reuses singleton injections, separates transient injections, and passes constructor arguments', async () => {
		const app = new Koa();
		app.use(decorator({ controllerDir: dir, matchFileName: 'SingletonBoundaryController' }));

		const first = await request(app.callback()).get('/singleton-boundary/identity');
		const second = await request(app.callback()).get('/singleton-boundary/identity');

		expect(first.status).toBe(200);
		expect(first.body).toMatchObject({
			sameSingleton: true,
			sameTransient: false,
			configuredValue: 'configured',
		});
		expect(second.body.singletonId).toBe(first.body.singletonId);
	});

	it('shares a decorated singleton across decorator instances', async () => {
		const firstApp = new Koa();
		const secondApp = new Koa();
		firstApp.use(decorator({ controllerDir: dir, matchFileName: 'SingletonBoundaryController' }));
		secondApp.use(decorator({ controllerDir: dir, matchFileName: 'SingletonBoundaryController' }));

		const first = await request(firstApp.callback()).get('/singleton-boundary/increment');
		const second = await request(secondApp.callback()).get('/singleton-boundary/increment');

		expect(first.status).toBe(200);
		expect(second.status).toBe(200);
		expect(Number(second.text)).toBe(Number(first.text) + 1);
	});

	it('reuses a singleton controller across requests', async () => {
		const app = new Koa();
		app.use(decorator({ controllerDir: dir, matchFileName: 'SingletonBoundaryController' }));

		const first = await request(app.callback()).get('/singleton-boundary/controller');
		const second = await request(app.callback()).get('/singleton-boundary/controller');

		expect(first.text).toBe('1');
		expect(second.text).toBe('2');
	});
});
