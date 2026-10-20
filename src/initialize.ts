import type Router from '@koa/router';
import type { Middleware, Context, Next } from 'koa';
import type {
	ControllerMethod,
	CorsReflectMetadata,
	InjectMethodMetadata,
	MatchDirectory,
	ResponseHeaderMetadata,
	RouteMethods,
} from '@/@types';
import vary from 'vary';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
	CONTROLLER,
	INJECT_METHOD,
	RESPONSE_GLOBAL_HEADER,
	RESPONSE_GLOBAL_HEADER_TOP,
	RESPONSE_HEADER,
	RESPONSE_HEADER_TOP,
	ROUTE_CORS,
	ROUTE_MIDDLEWARES,
	ROUTE_NAME,
	ROUTE_OVERRIDE,
	ROUTES,
	SINGLETON,
} from '@/config';
import { ControllerDirNotExist } from '@/error';
import { isArray, isFunction, isRegExp, isString } from '@/utils';
import {
	ACCESS_CONTROL_ALLOW_CREDENTIALS,
	ACCESS_CONTROL_ALLOW_HEADERS,
	ACCESS_CONTROL_ALLOW_METHODS,
	ACCESS_CONTROL_ALLOW_ORIGIN,
	ACCESS_CONTROL_ALLOW_PRIVATE_NETWORK,
	ACCESS_CONTROL_MAX_AGE,
	ACCESS_CONTROL_REQUEST_HEADERS,
	ACCESS_CONTROL_REQUEST_METHOD,
	CROSS_ORIGIN_EMBEDDER_POLICY,
	CROSS_ORIGIN_OPENER_POLICY,
} from './headers';

/**
 * 初始化路由
 * @param route Router 实例
 * @param controllerDir 控制器目录路径
 * @param match 匹配规则
 * @param acceptAnyControllerName 是否允许任何控制器文件名，默认 false
 */
export async function initialize(
	router: Router,
	controllerDir: string,
	match?: MatchDirectory,
	acceptAnyControllerName: boolean = false,
) {
	if (!fs.existsSync(controllerDir) || !fs.statSync(controllerDir).isDirectory()) {
		throw new Error(ControllerDirNotExist(controllerDir));
	}

	const matchRule = handleMatchRules(match);
	const files = fs.readdirSync(controllerDir);
	for (const file of files) {
		if (!acceptAnyControllerName && !/^[\w]+Controller\.(m|c)?(js|ts)$/.test(file)) {
			continue;
		}

		// 筛选文件名
		if (isFunction(matchRule) && !matchRule(path.basename(file, path.extname(file)), path.extname(file))) {
			continue;
		}

		const fileUrl = pathToFileURL(path.resolve(controllerDir, file)).href;
		const controller = (await import(fileUrl)) as Record<string, any>;
		for (const controllerClass of Object.values(controller)) {
			// 过滤非法类型，确保是类或函数
			if (!isTarget(controllerClass)) {
				continue;
			}

			// 一定要包含 Controller 装饰器声明
			const controllerPath = Reflect.getMetadata(CONTROLLER, controllerClass) as string;
			if (!isString(controllerPath) || !controllerPath) {
				continue;
			}

			// 是否覆写控制器基础路径
			const routes = (Reflect.getMetadata(ROUTES, controllerClass) || []) as ControllerMethod[];
			for (const routeItem of routes) {
				const handler = routeItem.handler;
				const isOverrideControllerPath = Reflect.getMetadata(ROUTE_OVERRIDE, controllerClass, handler) || false;
				// 只在设置 route 时重写一次函数体，避免嵌套过多
				const _path = getRoutePath(routeItem);
				// 路径规则整理，确保路径以 / 开头，避免重复
				const path = mergePath(controllerPath, _path, isOverrideControllerPath);
				const method = routeItem.method.toLowerCase() as RouteMethods;

				const strParams = [path] as [path: string];
				if (Reflect.hasMetadata(ROUTE_NAME, controllerClass, handler)) {
					// 插入路由名称
					const name = Reflect.getMetadata(ROUTE_NAME, controllerClass, handler) as string;
					name && strParams.unshift(name);
				}

				// 合并自定义中间件
				const middlewares = [
					...((Reflect.getMetadata(ROUTE_MIDDLEWARES, controllerClass) || []) as Middleware[]),
					...((Reflect.getMetadata(ROUTE_MIDDLEWARES, controllerClass, handler) || []) as Middleware[]),
				];

				// 判断有没有跨域配置
				const corsConfig = (Reflect.getMetadata(ROUTE_CORS, controllerClass, handler) ||
					Reflect.getMetadata(ROUTE_CORS, controllerClass)) as CorsReflectMetadata | undefined;

				// 创建路由
				router[method](
					...strParams,
					commonPrependMiddleware({ target: controllerClass, propertyKey: handler, corsConfig }),
					...middlewares,
					async (ctx) => {
						const responseHeaders = (Reflect.getMetadata(RESPONSE_HEADER, controllerClass, handler) ||
							[]) as ResponseHeaderMetadata[];
						const responseHeaderGlobal = (Reflect.getMetadata(RESPONSE_GLOBAL_HEADER, controllerClass) ||
							[]) as ResponseHeaderMetadata[];

						for (const header of mergeHeaders(responseHeaders, responseHeaderGlobal)) {
							ctx.set(header.header, header.value);
						}

						// 单例判断
						const instance = toInjectMethodMetadata<any>(controllerClass, getSingleton(controllerClass));
						ctx.body = await instance[handler].call(instance, ctx);
					},
				);

				if (corsConfig) {
					// 跨域路由创建对应的预检请求
					router.options(path, commonPrependMiddleware({ corsConfig }), async (ctx, next) => {
						if (!ctx.get(ACCESS_CONTROL_REQUEST_METHOD)) {
							return await next();
						}

						ctx.set(ACCESS_CONTROL_ALLOW_ORIGIN, corsConfig.origin);

						if (corsConfig.credentials) {
							ctx.set(ACCESS_CONTROL_ALLOW_CREDENTIALS, 'true');
						}

						if (corsConfig.maxAge) {
							ctx.set(ACCESS_CONTROL_MAX_AGE, corsConfig.maxAge);
						}

						if (corsConfig.methods) {
							ctx.set(ACCESS_CONTROL_ALLOW_METHODS, corsConfig.methods);
						}

						if (corsConfig.secureContext) {
							ctx.set(CROSS_ORIGIN_OPENER_POLICY, 'same-origin');
							ctx.set(CROSS_ORIGIN_EMBEDDER_POLICY, 'require-corp');
						}

						if (corsConfig.privateNetworkAccess) {
							ctx.set(ACCESS_CONTROL_ALLOW_PRIVATE_NETWORK, 'true');
						}

						const allowHeaders = corsConfig.headers || ctx.get(ACCESS_CONTROL_REQUEST_HEADERS);
						if (allowHeaders) {
							ctx.set(ACCESS_CONTROL_ALLOW_HEADERS, allowHeaders);
						}

						ctx.status = 204;
					});
				}
			}
		}
	}
}

function mergePath(controllerPath: string, routePath: string, isOverrideControllerPath: boolean) {
	const normalizedRoutePath = routePath === '/' ? '/' : `/${routePath.replace(/^\/+/, '')}`;
	if (isOverrideControllerPath) {
		return normalizedRoutePath;
	}

	const normalizedControllerPath = controllerPath.replace(/^\/+|\/+$/g, '');
	const base = normalizedControllerPath ? `/${normalizedControllerPath}` : '';
	return normalizedRoutePath === '/' ? base || '/' : base + normalizedRoutePath;
}

function getRoutePath(routeItem: ControllerMethod) {
	return isString(routeItem.path) && routeItem.path
		? routeItem.path.startsWith('/')
			? routeItem.path
			: `/${routeItem.path}`
		: '/';
}

function isTarget(val: any): val is Function {
	return typeof val === 'object' ? val !== null : typeof val === 'function';
}

/**
 * 所有路由的前置公用中间件
 */
function commonPrependMiddleware({
	target,
	propertyKey,
	corsConfig,
}: {
	target?: any;
	propertyKey?: string;
	corsConfig?: CorsReflectMetadata;
}) {
	return async (ctx: Context, next: Next) => {
		// https://github.com/rs/cors/issues/10
		ctx.vary('Origin');

		const headers = {} as Record<string, string>;
		if (target && propertyKey) {
			const responseHeadersTop = (Reflect.getMetadata(RESPONSE_HEADER_TOP, target, propertyKey) ||
				[]) as ResponseHeaderMetadata[];
			const responseHeaderGlobalTop = (Reflect.getMetadata(RESPONSE_GLOBAL_HEADER_TOP, target) ||
				[]) as ResponseHeaderMetadata[];

			for (const header of mergeHeaders(responseHeadersTop, responseHeaderGlobalTop)) {
				ctx.set(header.header, header.value);
				headers[header.header] = header.value;
			}
		}

		try {
			await next();

			/**
			 * 处理跨域请求的 `credentials` 配置
			 * - 当 `Access-Control-Allow-Credentials: true` 时，`Access-Control-Allow-Origin` 不能是 `*`
			 */
			if (corsConfig) {
				if (corsConfig.credentials && corsConfig.origin === '*') {
					ctx.set(ACCESS_CONTROL_ALLOW_ORIGIN, ctx.origin);
				}
			}
		} catch (error: any) {
			const errHeadersSet = error.headers || {};
			const varyWithOrigin = vary.append(errHeadersSet.vary || errHeadersSet.Vary || '', 'Origin');
			delete errHeadersSet.vary;

			error.headers = {
				...errHeadersSet,
				...headers,
				vary: varyWithOrigin,
			};

			if (corsConfig) {
				if (corsConfig.credentials && corsConfig.origin === '*') {
					error.headers[ACCESS_CONTROL_ALLOW_ORIGIN] = ctx.origin;
				}
			}

			throw error;
		}
	};
}

/**
 * 合并全局响应头和方法响应头，会优先使用方法响应头
 * @param headers 方法响应头
 * @param globalHeaders 全局响应头
 */
function mergeHeaders(headers: ResponseHeaderMetadata[], globalHeaders: ResponseHeaderMetadata[]) {
	// 合并全局响应头和方法响应头，去重
	const _global = globalHeaders.filter((item) => !headers.find((header) => header.header === item.header));
	return [..._global, ...headers];
}

/**
 * 处理控制器方法的依赖注入
 *
 * @param cls 控制器类
 * @param instance 实例对象
 */
function toInjectMethodMetadata<T extends Object>(cls: Function, instance: T): T {
	const injections = (Reflect.getMetadata(INJECT_METHOD, cls) || []) as InjectMethodMetadata[];
	if (!injections.length) {
		return instance;
	}

	const isSingleton = Reflect.hasMetadata(SINGLETON, cls);
	if (isSingleton && Reflect.hasMetadata(SINGLETON, instance)) {
		return instance;
	}

	for (const injection of injections) {
		const { propertyKey, inject } = injection;
		if (!isTarget(inject)) {
			continue;
		}
		// 注入的实例判断是否设置了单例装饰器
		instance[propertyKey as keyof typeof instance] = getSingleton(inject);
	}

	if (isSingleton) {
		// 单例构造函数实例在注入完成后设置标识，避免重复注入
		Reflect.defineMetadata(SINGLETON, true, instance);
	}

	return instance;
}

/**
 * 获取单例实例，如果没有设置单例装饰器，则返回新实例
 * @param cls 控制器类
 */
function getSingleton(cls: Function & (new (...args: any[]) => any)) {
	if (Reflect.hasMetadata(SINGLETON, cls)) {
		const singleton = Reflect.getMetadata(SINGLETON, cls);
		if (isFunction(singleton)) {
			return singleton();
		}
	}
	return new cls();
}

/**
 * 处理控制器文件的匹配规则
 */
function handleMatchRules(match?: MatchDirectory) {
	return isFunction(match)
		? match
		: (() => {
				if (!match) {
					return false;
				}
				const rules = isArray(match) ? match : [match];
				const useRule = rules
					.filter((item) => isString(item) || isRegExp(item))
					.map((item) => {
						if (isString(item)) {
							return (val: string) => val === item;
						}
						return (val: string) => item.test(val);
					});
				return (val: string, suffix?: string) => useRule.some((item) => item(val));
			})();
}
