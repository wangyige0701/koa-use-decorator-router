import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Koa from 'koa';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { decorator, ParameterConversionError } from '@/index';

describe('route parameter conversion', () => {
	const controllerDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), './controller');

	function createApp() {
		const app = new Koa();
		const errors: unknown[] = [];
		app.use(async (_ctx, next) => {
			try {
				await next();
			} catch (error) {
				errors.push(error);
				throw error;
			}
		}).use(decorator({ controllerDir, matchFileName: 'ConversionController' }));
		return { app, errors };
	}

	it.each([
		['int', '-12', '-12'],
		['float', '-1.25e2', '-125'],
		['boolean', 'true', 'true'],
		['boolean', 'false', 'false'],
	])('converts a valid %s route parameter', async (type, input, expected) => {
		const { app, errors } = createApp();
		const response = await request(app.callback()).get(`/conversion/${type}/${input}`);

		expect(response.status).toBe(200);
		expect(response.text).toBe(expected);
		expect(errors).toHaveLength(0);
	});

	it.each([
		['int', '12abc', 'int'],
		['int', '1.5', 'int'],
		['int', '9007199254740992', 'int'],
		['float', 'NaN', 'float'],
		['float', 'Infinity', 'float'],
		['boolean', 'TRUE', 'boolean'],
	])('rejects an invalid %s route parameter with HTTP 400', async (route, input, expectedType) => {
		const { app, errors } = createApp();
		const response = await request(app.callback()).get(`/conversion/${route}/${input}`);

		expect(response.status).toBe(400);
		expect(errors).toHaveLength(1);
		expect(errors[0]).toBeInstanceOf(ParameterConversionError);
		expect(errors[0]).toMatchObject({
			status: 400,
			code: 'ERR_ROUTE_PARAMETER_CONVERSION',
			parameterName: 'value',
			expectedType,
		});
	});

	it('rejects a missing parameter referenced by a built-in converter', async () => {
		const { app, errors } = createApp();
		const response = await request(app.callback()).get('/conversion/missing/present');

		expect(response.status).toBe(400);
		expect(errors[0]).toMatchObject({
			status: 400,
			parameterName: 'other',
			expectedType: 'int',
		});
	});

	it('preserves errors thrown by custom conversion functions', async () => {
		const { app, errors } = createApp();

		const valid = await request(app.callback()).get('/conversion/custom/ok');
		expect(valid.status).toBe(200);
		expect(valid.text).toBe('OK');

		const invalid = await request(app.callback()).get('/conversion/custom/no');
		expect(invalid.status).toBe(422);
		expect(errors).toHaveLength(1);
		expect(errors[0]).not.toBeInstanceOf(ParameterConversionError);
		expect(errors[0]).toMatchObject({ status: 422, message: 'custom conversion failed' });
	});
});
