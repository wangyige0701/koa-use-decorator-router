import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Koa from 'koa';
import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import Decorator, { decorator } from '@/index';

describe('Match', () => {
	const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), './controller');
	const scanDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), './fixtures/controller-scan');

	it('use string match IndexController', async () => {
		vi.resetModules();
		const app = new Koa();
		app.use(decorator({ controllerDir: dir, matchFileName: 'IndexController', allowedMethods: true }));

		const res = await request(app.callback()).get('/index/get');
		expect(res.text).toBe('get');
		expect(res.status).toBe(200);

		const res2 = await request(app.callback()).get('/inject/service');
		expect(res2.status).toBe(404);
	});

	it('use regexp match IndexController', async () => {
		vi.resetModules();
		const app = new Koa();
		app.use(decorator({ controllerDir: dir, matchFileName: /^IndexController$/, allowedMethods: true }));

		const res = await request(app.callback()).get('/index/get');
		expect(res.text).toBe('get');
		expect(res.status).toBe(200);

		const res2 = await request(app.callback()).get('/inject/service');
		expect(res2.status).toBe(404);
	});

	it('use function match IndexController', async () => {
		vi.resetModules();
		const app = new Koa();
		app.use(
			decorator({
				controllerDir: dir,
				matchFileName: (fileName) => fileName === 'IndexController',
				allowedMethods: true,
			}),
		);

		const res = await request(app.callback()).get('/index/get');
		expect(res.text).toBe('get');
		expect(res.status).toBe(200);

		const res2 = await request(app.callback()).get('/inject/service');
		expect(res2.status).toBe(404);
	});

	it('use constructor match IndexController', async () => {
		vi.resetModules();
		const app = new Koa();
		const decoratorIns = new Decorator(dir);
		decoratorIns.matchFileName('IndexController').allowedMethods();
		app.use(decoratorIns.middleware());

		const res = await request(app.callback()).get('/index/get');
		expect(res.text).toBe('get');
		expect(res.status).toBe(200);

		const res2 = await request(app.callback()).get('/inject/service');
		expect(res2.status).toBe(404);
	});

	it('use constructor with array match IndexController', async () => {
		vi.resetModules();
		const app = new Koa();
		const decoratorIns = new Decorator(dir);
		decoratorIns.matchFileName(['IndexController', 'InjectController']).allowedMethods();
		app.use(decoratorIns.middleware());

		const res = await request(app.callback()).get('/index/get');
		expect(res.text).toBe('get');
		expect(res.status).toBe(200);

		const res2 = await request(app.callback()).get('/inject/service');
		expect(res2.text).toBe('inject service');
		expect(res2.status).toBe(200);

		const res3 = await request(app.callback()).get('/singleton/count');
		expect(res3.status).toBe(404);
	});

	it('scans only supported controller files in the immediate directory by default', async () => {
		const app = new Koa();
		app.use(decorator(scanDir));

		const loaded = await request(app.callback()).get('/scan-loaded/');
		const anyName = await request(app.callback()).get('/scan-any-name/');
		const nested = await request(app.callback()).get('/scan-nested/');

		expect(loaded.status).toBe(200);
		expect(loaded.text).toBe('loaded');
		expect(anyName.status).toBe(404);
		expect(nested.status).toBe(404);
	});

	it('acceptAnyControllerName disables only the default file-name restriction', async () => {
		const app = new Koa();
		app.use(decorator({ controllerDir: scanDir, acceptAnyControllerName: true }));

		const loaded = await request(app.callback()).get('/scan-loaded/');
		const anyName = await request(app.callback()).get('/scan-any-name/');
		const nested = await request(app.callback()).get('/scan-nested/');

		expect(loaded.status).toBe(200);
		expect(anyName.status).toBe(200);
		expect(anyName.text).toBe('any name');
		expect(nested.status).toBe(404);
	});
});
