import type Koa from 'koa';
import type { ControllerMethod, ExposeMethods, InjectMetadata } from '@/@types';
import { INJECT, ROUTE_METHOD, ROUTES } from '@/config';
import { Methods, Types } from '@/enum';
import { ParameterConversionError } from '@/error';
import { isFunction } from '@/utils';

const decimalPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;

const TypeMapFunction: Record<Types, (param: string) => unknown> = {
	[Types.Int]: (param) => {
		if (!/^[+-]?\d+$/.test(param)) {
			throw new TypeError('expected a base-10 integer');
		}
		const value = Number(param);
		if (!Number.isSafeInteger(value)) {
			throw new RangeError('integer is outside the safe range');
		}
		return value;
	},
	[Types.Float]: (param) => {
		if (!decimalPattern.test(param)) {
			throw new TypeError('expected a finite decimal number');
		}
		const value = Number(param);
		if (!Number.isFinite(value)) {
			throw new RangeError('number must be finite');
		}
		return value;
	},
	[Types.String]: (param) => param,
	[Types.Boolean]: (param) => {
		if (param !== 'true' && param !== 'false') {
			throw new TypeError('expected true or false');
		}
		return param === 'true';
	},
};

function convertBuiltInParameter(paramName: string, param: string | undefined, type: Types) {
	const converter = TypeMapFunction[type];
	if (!converter) {
		throw new TypeError(`Unsupported route parameter conversion type: ${String(type)}`);
	}

	try {
		if (param === undefined) {
			throw new TypeError('route parameter is missing');
		}
		return converter(param);
	} catch (cause) {
		throw new ParameterConversionError(paramName, type, { cause });
	}
}

function Action(path: string, method: Methods): MethodDecorator {
	return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
		// 记录路由的方法
		Reflect.defineMetadata(ROUTE_METHOD, method, target.constructor, propertyKey);

		const routes = Reflect.getMetadata(ROUTES, target.constructor) || ([] as ControllerMethod[]);

		const oldValue = descriptor.value;
		descriptor.value = async function (ctx: Koa.Context) {
			const injects = (Reflect.getMetadata(INJECT, target.constructor, propertyKey) || []) as InjectMetadata[];

			// 整理传入参数
			const params = ctx.params;
			const injectParams = [];
			for (const inject of injects) {
				if (inject.isContext) {
					injectParams[inject.parameterIndex] = ctx;
					continue;
				}
				let param = params[inject.paramName] ?? void 0;
				if (typeof inject.type === 'string') {
					param = convertBuiltInParameter(inject.paramName, param, inject.type);
				} else if (isFunction(inject.type)) {
					param = await inject.type(param);
				}
				injectParams[inject.parameterIndex] = param;
			}

			return await oldValue.apply(this, injectParams);
		};

		routes.push({
			path: path,
			method: method,
			handler: propertyKey,
		});

		Reflect.defineMetadata(ROUTES, routes, target.constructor);

		return descriptor;
	};
}

const methods = Object.values(Methods).map(
	(item) => item.slice(0, 1).toUpperCase() + item.slice(1).toLowerCase(),
) as unknown as ExposeMethods[];

type HttpMethodFunc = (path: string) => ReturnType<typeof Action>;

export const HttpMethod = methods.reduce(
	(prev, curr) => {
		prev[curr] = (path: string) => Action(path, Methods[curr.toUpperCase() as keyof typeof Methods]);
		return prev;
	},
	{} as Record<ExposeMethods, HttpMethodFunc>,
);
