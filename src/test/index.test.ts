import { describe, expect, it } from 'vitest';
import request from 'supertest';
import Koa from 'koa';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decorator } from '@/index';

describe('Controller', () => {
	const app = new Koa();
	app.use(
		decorator({
			controllerDir: path.resolve(path.dirname(fileURLToPath(import.meta.url)), './controller'),
			allowedMethods: true,
		}),
	);

	it('should return get', async () => {
		const res = await request(app.callback()).get('/index/get');
		expect(res.text).toBe('get');
		expect(res.status).toBe(200);
	});

	it('should return post', async () => {
		const res = await request(app.callback()).post('/index/post');
		expect(res.text).toBe('post');
		expect(res.status).toBe(200);
	});

	it('should return put', async () => {
		const res = await request(app.callback()).put('/index/put');
		expect(res.text).toBe('put');
		expect(res.status).toBe(200);
	});

	it('should return delete', async () => {
		const res = await request(app.callback()).delete('/index/delete');
		expect(res.text).toBe('delete');
		expect(res.status).toBe(200);
	});

	it('should return int', async () => {
		const res = await request(app.callback()).get('/index/int/123');
		expect(res.text).toBe('123');
		expect(res.status).toBe(200);
	});

	it('should return boolean', async () => {
		const res = await request(app.callback()).get('/index/boolean/true');
		expect(res.text).toBe('true');
		expect(res.status).toBe(200);
	});

	it('should return headers', async () => {
		const res = await request(app.callback()).get('/index/headers');
		expect(res.text).toBe('headers');
		expect(res.status).toBe(200);
		expect(res.headers['x-header']).toBe('Value');
	});

	it('should return query', async () => {
		const res = await request(app.callback()).get('/index/query/key?key=123');
		expect(res.text).toBe('123');
		expect(res.status).toBe(200);
	});

	it('should return override', async () => {
		const res = await request(app.callback()).get('/index/overrideBasePath');
		expect(res.status).toBe(404);
		const res2 = await request(app.callback()).get('/overrideBasePath');
		expect(res2.text).toBe('override');
		expect(res2.status).toBe(200);
	});

	it('should normalize root and missing path separators', async () => {
		const root = await request(app.callback()).get('/');
		expect(root.status).toBe(200);
		expect(root.text).toBe('root');

		const rootChild = await request(app.callback()).get('/child');
		expect(rootChild.status).toBe(200);
		expect(rootChild.text).toBe('root child');

		const normalized = await request(app.callback()).get('/normalized/child');
		expect(normalized.status).toBe(200);
		expect(normalized.text).toBe('normalized child');
	});

	it('should preserve repeated separators inside controller and method paths', async () => {
		const response = await request(app.callback()).get('/internal//segment/child//detail');

		expect(response.status).toBe(200);
		expect(response.text).toBe('internal separators');
	});

	it('should return object', async () => {
		const res = await request(app.callback()).get('/index/object');
		expect(res.body).toEqual({
			name: 'test',
			age: 18,
		});
		expect(res.status).toBe(200);
	});
});
