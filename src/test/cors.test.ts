import { describe, expect, it } from 'vitest';
import request from 'supertest';
import Koa from 'koa';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decorator } from '@/initialize/function';
import { ControllerDirNotExist } from '@/error';

describe('Cors / Cross decorators', () => {
	const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), './controller');

	function createApp() {
		const app = new Koa();
		app.use(
			decorator({
				controllerDir: dir,
				allowedMethods: true,
				// 保证加载测试用的 Controller 文件
				matchFileName: /CorsController$/,
			}),
		);
		return app;
	}

	it('GET routes should include CORS headers (method-level Cors)', async () => {
		const app = createApp();
		const res = await request(app.callback()).get('/cors/');
		expect(res.status).toBe(200);
		expect(res.text).toBe('ok');
		expect(res.headers['access-control-allow-origin']).toBe('*');
		// method-level default does not set allow-headers (empty by default)
		expect(res.headers['access-control-allow-headers']).toBeUndefined();
		// method-level Cors writes the current route method as allowed method
		expect(res.headers['access-control-allow-methods']).toBe('GET');
		expect(res.headers.vary).toContain('Origin');
	});

	it('OPTIONS preflight should return 204 and echo request headers when no configured headers', async () => {
		const app = createApp();
		const res = await request(app.callback())
			.options('/cors/')
			.set('Access-Control-Request-Method', 'GET')
			.set('Access-Control-Request-Headers', 'X-Custom-Header');
		expect(res.status).toBe(204);
		expect(res.headers['access-control-allow-origin']).toBe('*');
		// 当没有显式配置允许的 headers 时，预检应回显请求头
		expect(res.headers['access-control-allow-headers']).toBe('X-Custom-Header');
		expect(res.headers['access-control-allow-methods']).toMatch(/GET/);
	});

	it('Cross alias should behave like Cors (method-level)', async () => {
		const app = createApp();
		const res = await request(app.callback()).get('/cors/cross');
		expect(res.status).toBe(200);
		expect(res.text).toBe('ok2');
		expect(res.headers['access-control-allow-origin']).toBe('*');
		expect(res.headers['access-control-allow-headers']).toBeUndefined();
		expect(res.headers['access-control-allow-methods']).toBe('GET');
	});

	it('custom Cors params should be applied for GET and OPTIONS', async () => {
		const app = createApp();

		const getRes = await request(app.callback()).get('/cors/custom');
		expect(getRes.status).toBe(200);
		expect(getRes.text).toBe('custom');
		expect(getRes.headers['access-control-allow-origin']).toBe('https://example.com');
		expect(getRes.headers['access-control-allow-headers']).toBe('X-Test-Header,Authorization');
		expect(getRes.headers['access-control-allow-methods']).toBe('GET');

		const optionsRes = await request(app.callback())
			.options('/cors/custom')
			.set('Access-Control-Request-Method', 'GET')
			.set('Access-Control-Request-Headers', 'X-Test-Header,Authorization');
		expect(optionsRes.status).toBe(204);
		expect(optionsRes.headers['access-control-allow-origin']).toBe('https://example.com');
		expect(optionsRes.headers['access-control-allow-headers']).toBe('X-Test-Header,Authorization');
		expect(optionsRes.headers['access-control-allow-methods']).toBe('GET');
	});

	it('object-form Cors metadata should be applied', async () => {
		const app = createApp();
		const res = await request(app.callback()).get('/cors/obj');
		expect(res.status).toBe(200);
		expect(res.text).toBe('obj');
		expect(res.headers['access-control-allow-origin']).toBe('https://obj.example.com');
		expect(res.headers['access-control-allow-headers']).toBe('X-Obj-Header');
		expect(res.headers['access-control-allow-methods']).toBe('GET');
	});

	it('method-level POST Cors should apply and preflight should return credentials and related headers', async () => {
		const app = createApp();

		const res = await request(app.callback()).post('/cors/post');
		expect(res.status).toBe(200);
		expect(res.text).toBe('posted');
		expect(res.headers['access-control-allow-origin']).toBe('https://post.example.com');
		expect(res.headers['access-control-allow-headers']).toBe('X-Post-Header');
		expect(res.headers['access-control-allow-methods']).toBe('POST');
		expect(res.headers['access-control-allow-credentials']).toBe('true');
		expect(res.headers['cross-origin-opener-policy']).toBe('same-origin');
		expect(res.headers['cross-origin-embedder-policy']).toBe('require-corp');

		const pre = await request(app.callback())
			.options('/cors/post')
			.set('Access-Control-Request-Method', 'POST')
			.set('Access-Control-Request-Headers', 'X-Post-Header');
		expect(pre.status).toBe(204);
		expect(pre.headers['access-control-allow-origin']).toBe('https://post.example.com');
		expect(pre.headers['access-control-allow-headers']).toBe('X-Post-Header');
		expect(pre.headers['access-control-allow-methods']).toBe('POST');
		expect(pre.headers['access-control-allow-credentials']).toBe('true');
		expect(pre.headers['access-control-max-age']).toBe('600');
		expect(pre.headers['cross-origin-opener-policy']).toBe('same-origin');
		expect(pre.headers['cross-origin-embedder-policy']).toBe('require-corp');
		expect(pre.headers['access-control-allow-private-network']).toBe('true');
	});

	it('preserves CORS headers when route middleware throws', async () => {
		const app = createApp();
		const res = await request(app.callback()).get('/cors/error').set('Origin', 'https://client.example.com');

		expect(res.status).toBe(418);
		expect(res.headers['access-control-allow-origin']).toBe('https://error.example.com');
		expect(res.headers['access-control-allow-credentials']).toBe('true');
		expect(res.headers['access-control-allow-methods']).toBe('GET');
		expect(res.headers.vary).toContain('Origin');
	});

	it('wildcard origin with credentials true should echo request origin on GET and OPTIONS', async () => {
		const app = createApp();

		const res = await request(app.callback()).get('/cors/credentials').set('Origin', 'https://example-client.com');
		expect(res.status).toBe(200);
		expect(res.text).toBe('cred');
		// since credentials=true and origin='*', initialize will echo the request origin
		expect(res.headers['access-control-allow-origin']).toBe('https://example-client.com');
		expect(res.headers['access-control-allow-credentials']).toBe('true');

		const pre = await request(app.callback())
			.options('/cors/credentials')
			.set('Origin', 'https://example-client.com')
			.set('Access-Control-Request-Method', 'GET');
		expect(pre.status).toBe(204);
		expect(pre.headers['access-control-allow-origin']).toBe('https://example-client.com');
		expect(pre.headers['access-control-allow-credentials']).toBe('true');
	});

	it('class-level Cors should apply to controller root', async () => {
		const app = createApp();
		const res = await request(app.callback()).get('/class-cors/');
		expect(res.status).toBe(200);
		expect(res.text).toBe('class');
		expect(res.headers['access-control-allow-origin']).toBe('https://class.example.com');
		expect(res.headers['access-control-allow-headers']).toBe('X-Class-Header');
		expect(res.headers['access-control-allow-methods']).toBe('GET,POST');
	});

	it('class-level preflight should include credentials, maxAge, secure context and private network headers', async () => {
		const app = createApp();
		const res = await request(app.callback())
			.options('/class-cors/')
			.set('Access-Control-Request-Method', 'GET')
			.set('Access-Control-Request-Headers', 'X-Class-Header');
		expect(res.status).toBe(204);
		expect(res.headers['access-control-allow-origin']).toBe('https://class.example.com');
		expect(res.headers['access-control-allow-headers']).toBe('X-Class-Header');
		expect(res.headers['access-control-allow-methods']).toBe('GET,POST');
		expect(res.headers['access-control-allow-credentials']).toBe('true');
		expect(res.headers['access-control-max-age']).toBe('3600');
		expect(res.headers['cross-origin-opener-policy']).toBe('same-origin');
		expect(res.headers['cross-origin-embedder-policy']).toBe('require-corp');
		expect(res.headers['access-control-allow-private-network']).toBe('true');
	});

	it('origin array should be joined and returned as allow-origin', async () => {
		const app = createApp();
		const res = await request(app.callback()).get('/cors/origin-array');
		expect(res.status).toBe(200);
		expect(res.text).toBe('origin-array');
		// origin array joined by comma
		expect(res.headers['access-control-allow-origin']).toBe('https://a.example.com,https://b.example.com');
	});

	it('OPTIONS without Access-Control-Request-Method should call next (no CORS response)', async () => {
		const app = createApp();
		const res = await request(app.callback()).options('/cors/');
		// no AC-Request-Method -> middleware should call next -> no CORS headers set
		// depending on router, this will likely be 404 or 405; assert no CORS headers
		expect(res.headers['access-control-allow-origin']).toBeUndefined();
	});

	it('OPTIONS to route without CORS should not set CORS headers', async () => {
		const app = new Koa();
		app.use(
			decorator({
				controllerDir: dir,
				allowedMethods: false,
				// 保证加载测试用的 Controller 文件
				matchFileName: /CorsController$/,
			}),
		);
		const res = await request(app.callback()).options('/cors/nocors');
		expect(res.status === 404 || res.status === 405).toBeTruthy();
		expect(res.headers['access-control-allow-origin']).toBeUndefined();
	});

	it('decorator should throw when controllerDir does not exist', async () => {
		// use decorator middleware with invalid dir and expect it to throw when middleware runs
		const app = new Koa();
		let error = '';
		app.use(async (ctx, next) => {
			try {
				await next();
			} catch (err: any) {
				error = err?.message || '';
				throw err;
			}
		}).use(
			decorator({
				controllerDir: 'this/path/does/not/exist',
				allowedMethods: false,
			}),
		);

		const res = await request(app.callback()).get('/');
		expect(error).toEqual(ControllerDirNotExist('this/path/does/not/exist'));
		// middleware should error; Koa will return 500 for thrown errors
		expect(res.status).toBe(500);
	});
});
