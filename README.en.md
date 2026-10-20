# koa-use-decorator-router

[简体中文](./README.md) | [English](./README.en.md)

A TypeScript decorator-based routing library for Koa and `@koa/router`, with controllers, route parameter injection, property injection, singletons, CORS, and route middleware.

## Features

- Declare controllers and routes with class and method decorators.
- Support common HTTP methods and `All` for matching every method.
- Inject route parameters, `Koa.Context`, and class properties.
- Use built-in parameter conversion, custom async conversion, and explicit conversion errors.
- Apply response headers, CORS, and route middleware at class or method level.
- Use singletons, conditional decorators, named routes, and controller file filters.
- Scan controllers and register routes once per middleware instance.

## Installation

```bash
npm install koa-use-decorator-router
```

## Requirements

- `koa` >= 2.0.0
- `@koa/router` >= 10.0.0
- `reflect-metadata` >= 0.2.0
- A build environment that supports legacy TypeScript decorator semantics

Enable these TypeScript options:

```json
{
	"compilerOptions": {
		"experimentalDecorators": true,
		"emitDecoratorMetadata": true
	}
}
```

JavaScript projects need a compiler such as Babel that emits TypeScript-compatible legacy decorators, including parameter decorators.

## Quick start

Create `controller/HomeController.ts`:

```ts
import type Koa from 'koa';
import { Context, Controller, HttpMethod } from 'koa-use-decorator-router';

@Controller('/home')
export class HomeController {
	@HttpMethod.Get('/')
	index(@Context() ctx: Koa.Context) {
		return { message: 'Hello World!', query: ctx.query };
	}
}
```

Register the middleware:

```ts
import Koa from 'koa';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decorator } from 'koa-use-decorator-router';

const controllerDir = resolve(dirname(fileURLToPath(import.meta.url)), './controller');
const app = new Koa();

app.use(
	decorator({
		controllerDir,
		allowedMethods: true,
	}),
);

app.listen(3000);
```

Use the named export in CommonJS:

```js
const Koa = require('koa');
const { resolve } = require('node:path');
const { decorator } = require('koa-use-decorator-router');

const app = new Koa();
app.use(decorator({ controllerDir: resolve(__dirname, './controller'), allowedMethods: true }));
```

## Creating the router middleware

### Function API

```ts
decorator(options: string | DecoratorOptions, router?: Router): Koa.Middleware
```

Pass either the controller directory or an options object:

```ts
import Router from '@koa/router';
import { decorator } from 'koa-use-decorator-router';

const router = new Router();
app.use(decorator(controllerDir, router)).use(router.allowedMethods());
```

`DecoratorOptions`:

| Property                  | Type                                                      | Default  | Description                                                                        |
| ------------------------- | --------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------- |
| `controllerDir`           | `string`                                                  | required | Controller directory; an absolute path is recommended                              |
| `allowedMethods`          | `boolean \| AllowedMethodsOptions`                        | `false`  | Runs `router.allowedMethods()` after route matching when true or an options object |
| `prefix`                  | `string`                                                  | none     | Router prefix applied before routes are registered                                 |
| `matchFileName`           | `string \| RegExp \| Array<string \| RegExp> \| Function` | none     | Controller file filter                                                             |
| `acceptAnyControllerName` | `boolean`                                                 | `false`  | Disables the default controller file-name restriction                              |

Calling `decorator()` starts initialization immediately. Every request handled by that middleware waits for the same initialization result, so controllers are not rescanned and routes are not registered again. An initialization failure is thrown when a request enters the middleware and flows through the Koa error chain.

### `Decorator` class

```ts
import Decorator from 'koa-use-decorator-router';
// Alternatively: import { Decorator } from 'koa-use-decorator-router';

const routerDecorator = new Decorator(controllerDir);
routerDecorator.prefix('/api');

app.use(routerDecorator.middleware());
app.use(routerDecorator.allowedMethods());
```

The constructor also accepts a custom `Router`:

```ts
const routerDecorator = new Decorator(controllerDir, router);
```

`Decorator` proxies members that exist on its internal `Router` but not on the wrapper itself. When a proxied method returns the internal `Router`, the proxy substitutes the current `Decorator`, preserving method chaining. Configure `prefix()`, `matchFileName()`, and `acceptAnyControllerName()` before calling `middleware()`. Use `getRouter()` to access the internal router directly.

## Controller scanning

The scanner follows these rules:

- `controllerDir` must point to an existing directory; an absolute path is recommended.
- Only direct child files are scanned; subdirectories are not scanned recursively.
- Only `.js`, `.ts`, `.mjs`, `.mts`, `.cjs`, and `.cts` files are considered; declaration files are ignored.
- By default, the file base name must match `^\w+Controller$`, case-sensitively.
- `acceptAnyControllerName` disables only the file-name restriction; it does not alter directory, extension, or recursion rules.
- `matchFileName` runs after those rules. A function rule receives the file base name and extension.
- Only module exports decorated with `@Controller` and a non-empty string base path register routes.
- A module import failure fails initialization and is forwarded through the Koa error chain.

Filter examples:

```ts
app.use(
	decorator({
		controllerDir,
		matchFileName: ['IndexController', /^Admin/],
	}),
);

app.use(
	decorator({
		controllerDir,
		matchFileName: (fileName, extension) => fileName.startsWith('Api') && extension === '.ts',
	}),
);
```

With `Decorator`, string, regular expression, and array rules are appended; a function rule replaces the previous rules:

```ts
routerDecorator.matchFileName('IndexController').matchFileName(/^Admin/);
routerDecorator.matchFileName((fileName) => fileName !== 'SkipController');
routerDecorator.acceptAnyControllerName();
```

## Controllers and routes

`@Controller(basePath)` declares the controller base path. `HttpMethod` exposes `All`, `Get`, `Post`, `Put`, `Delete`, `Options`, `Head`, and `Patch` method decorators. The return value or resolved promise from a controller method is assigned to `ctx.body`.

By default, each request creates a new controller instance. A controller is reused across requests only when decorated with `@Singleton`. Only values supplied by parameter decorators are passed to a controller method; undecorated parameter positions receive `undefined`.

```ts
import { Controller, HttpMethod } from 'koa-use-decorator-router';

@Controller('/users')
export class UserController {
	@HttpMethod.Get('/:id')
	findOne() {
		return { id: 1 };
	}
}
```

### Path normalization

- Controller base paths and method paths may omit the leading `/`.
- Redundant leading and trailing slashes around the controller path and leading slashes on the method path are removed at the join boundary.
- A method path of `/` or an empty string denotes the controller root.
- Repeated slashes inside either path are preserved.
- `ControllerBasePathOverride` discards the controller path and normalizes only the beginning of the method path.

For example, `@Controller('///users///')` with `@HttpMethod.Get('///:id')` registers `/users/:id`.

## Parameter injection

### Route parameters

`@Inject(name, type?)` reads a value from `ctx.params`. Without `type`, it preserves the original string and passes `undefined` when the named parameter is absent.

```ts
import { Controller, HttpMethod, Inject, Types } from 'koa-use-decorator-router';

@Controller('/users')
export class UserController {
	@HttpMethod.Get('/name/:name')
	name(@Inject('name') name: string) {
		return name;
	}

	@HttpMethod.Get('/id/:id')
	id(@Inject('id', Types.Int) id: number) {
		return id;
	}

	@HttpMethod.Get('/decode/:value')
	decode(@Inject('value', decodeURIComponent) value: string) {
		return value;
	}
}
```

Built-in conversions:

| Type            | Accepted input                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------ |
| `Types.Int`     | A complete base-10 integer string whose result is a JavaScript safe integer                      |
| `Types.Float`   | A finite decimal or scientific notation; rejects `NaN`, `Infinity`, hexadecimal, and mixed input |
| `Types.Boolean` | The case-sensitive string `true` or `false`                                                      |
| `Types.String`  | The original route parameter string                                                              |

A missing or invalid parameter requested with a built-in converter throws `ParameterConversionError`. Its `status` and `statusCode` are `400`, and its `code` is `ERR_ROUTE_PARAMETER_CONVERSION`. Custom converters may return promises; they own validation of their return values, and thrown errors or rejection reasons propagate unchanged.

Register error-handling middleware before the router middleware if you want to normalize conversion error responses:

```ts
import { ParameterConversionError } from 'koa-use-decorator-router';

app.use(async (ctx, next) => {
	try {
		await next();
	} catch (error) {
		if (error instanceof ParameterConversionError) {
			ctx.status = error.status;
			ctx.body = { code: error.code, parameter: error.parameterName };
			return;
		}
		throw error;
	}
});
```

### Context parameter

`@Context()` injects the current `Koa.Context`. Only one context parameter is recorded per method.

### Property injection

`@Inject()` without an argument relies on the TypeScript compiler or bundler to emit correct `design:type` metadata for the property. Some toolchains do not support this metadata or remove it even when `experimentalDecorators` and `emitDecoratorMetadata` are enabled. In that case, do not use type inference; pass the constructor explicitly with `@Inject(Constructor)`. Inferred types must also be imported as runtime values, not with `import type`.

```ts
import { Controller, HttpMethod, Inject } from 'koa-use-decorator-router';
import { UserService } from './UserService';

@Controller('/users')
export class UserController {
	@Inject()
	service!: UserService;

	@HttpMethod.Get('/')
	list() {
		return this.service.list();
	}
}
```

An injected class without `@Singleton` receives a new instance when properties are injected into a controller instance. A default, non-singleton controller therefore receives new dependencies on each request. A singleton controller performs property injection only on first use and then reuses those injected properties.

## Singletons

`@Singleton(...constructorArgs)` maintains one shared instance for the decorated class and passes the constructor arguments on first creation. The singleton is scoped to the class: controllers and `decorator()` instances in the same process reuse it when injecting that class. A controller can also use `@Singleton` to retain instance state across requests.

```ts
import { Singleton } from 'koa-use-decorator-router';

@Singleton('primary')
export class UserService {
	constructor(readonly source: string) {}
}
```

## Response headers

`@ResponseHeader(name, value, top?)` can decorate a controller class or method. A method-level header takes precedence over a class-level header with the same name.

- `top = false` (default): sets the header immediately before the controller method; the header may be absent when route middleware short-circuits or throws.
- `top = true`: sets the header before route middleware, preserving it when later middleware throws.

```ts
import { Controller, HttpMethod, ResponseHeader } from 'koa-use-decorator-router';

@ResponseHeader('X-Controller', 'yes')
@Controller('/headers')
export class HeaderController {
	@ResponseHeader('Cache-Control', 'no-store', true)
	@HttpMethod.Get('/')
	index() {
		return 'ok';
	}
}
```

## CORS

`@Cors` can decorate a controller class or route method and registers an `OPTIONS` preflight handler for the corresponding route. `Cross` is a deprecated compatibility alias.

| Option                 | Type                   | Response header                                              | Default                             |
| ---------------------- | ---------------------- | ------------------------------------------------------------ | ----------------------------------- |
| `origin`               | `string \| string[]`   | `Access-Control-Allow-Origin`                                | `'*'`                               |
| `methods`              | `Methods \| Methods[]` | `Access-Control-Allow-Methods`                               | GET, POST, PUT, DELETE, PATCH, HEAD |
| `headers`              | `string \| string[]`   | `Access-Control-Allow-Headers`                               | empty                               |
| `credentials`          | `boolean`              | `Access-Control-Allow-Credentials`                           | `false`                             |
| `secureContext`        | `boolean`              | `Cross-Origin-Opener-Policy`, `Cross-Origin-Embedder-Policy` | `false`                             |
| `maxAge`               | `number`               | `Access-Control-Max-Age`                                     | empty                               |
| `privateNetworkAccess` | `boolean`              | `Access-Control-Allow-Private-Network`                       | `false`                             |

The object form is recommended. The compatibility overload `Cors(origin?, headers?, methods?)` supports only the first three options. Array values are joined with commas. When `headers` is omitted, preflight requests echo `Access-Control-Request-Headers`. `maxAge` and `privateNetworkAccess` apply only to preflight responses.

Every registered route adds `Vary: Origin`. When `credentials: true` is combined with `origin: '*'`, actual and preflight responses replace `Access-Control-Allow-Origin` with the current request origin. When multiple origins are supplied, the current implementation joins them with commas and writes the result directly; it does not dynamically select one origin based on the request.

```ts
import { Controller, Cors, HttpMethod, Methods } from 'koa-use-decorator-router';

@Cors({
	origin: 'https://example.com',
	headers: ['Content-Type', 'Authorization'],
	methods: [Methods.GET, Methods.POST],
	credentials: true,
	maxAge: 3600,
	secureContext: true,
	privateNetworkAccess: false,
})
@Controller('/cors')
export class CorsController {
	@Cors({ origin: 'https://api.example.com' })
	@HttpMethod.Get('/detail')
	detail() {
		return 'ok';
	}
}
```

A method-level `@Cors` must appear above `@HttpMethod` so it can read the route method when applied. Its `Access-Control-Allow-Methods` value is always the current route method, so a method-level `methods` option has no effect. An `OPTIONS` request without `Access-Control-Request-Method` continues to downstream middleware.

## Route middleware

`@RouteMiddleware(...middlewares)` decorates a controller class or method. `createMiddlewareDecorator(...middlewares)` creates a reusable zero-argument decorator factory.

```ts
import { Controller, createMiddlewareDecorator, HttpMethod, RouteMiddleware } from 'koa-use-decorator-router';

const Auth = createMiddlewareDecorator(async (ctx, next) => {
	if (!ctx.get('Authorization')) ctx.throw(401);
	await next();
});

@RouteMiddleware(async (ctx, next) => {
	ctx.state.startedAt = Date.now();
	await next();
})
@Controller('/admin')
export class AdminController {
	@Auth()
	@HttpMethod.Get('/')
	index() {
		return 'ok';
	}
}
```

Execution order follows these rules:

- Class-level middleware runs before method-level middleware.
- Middleware passed to one decorator runs in argument order.
- Stacked decorators created by `createMiddlewareDecorator` enter the chain from top to bottom as written.
- Koa's onion model exits in reverse order. Omitting `next()` prevents later middleware and the controller method from running.

## Conditional decorators

`IF(condition, decorator)` selects a decorator by condition. Chain `ELIF` and `ELSE` as needed, and always finish with `ENDIF()`. It can wrap class, method, property, or parameter decorators, but decorators in one conditional chain should have the same kind. Conditions are evaluated when the module loads and decorators are applied, not once per request.

```ts
import { Controller, IF } from 'koa-use-decorator-router';

@(IF(process.env.APP_ENV === 'production', Controller('/api'))
	.ELSE(Controller('/debug'))
	.ENDIF())
export class ConditionalController {}
```

## Controller base-path override

`@ControllerBasePathOverride()` makes the current method ignore its controller base path completely.

```ts
import { Controller, ControllerBasePathOverride, HttpMethod } from 'koa-use-decorator-router';

@Controller('/users')
export class UserController {
	@ControllerBasePathOverride()
	@HttpMethod.Get('/health')
	health() {
		return 'ok';
	}
}
```

This route is registered as `/health`, not `/users/health`. An overridden method path of `/` denotes the application root.

## Named routes

`@NamedRoute(name)` names a route. After initialization completes, use the internal `Router` to generate a URL.

```ts
import { Controller, Decorator, HttpMethod, Inject, NamedRoute, Types } from 'koa-use-decorator-router';

@Controller('/users')
export class UserController {
	@NamedRoute('users.detail')
	@HttpMethod.Get('/:id')
	detail(@Inject('id', Types.Int) id: number) {
		return id;
	}
}

const routerDecorator = new Decorator(controllerDir);
app.use(routerDecorator.middleware());

// Call after initialization; for example, after the first request has completed.
routerDecorator.getRouter().url('users.detail', { id: '123' });
// => /users/123
```

## Public API index

| Export                                         | Purpose                                                    |
| ---------------------------------------------- | ---------------------------------------------------------- |
| `decorator`                                    | Creates the Koa router middleware                          |
| `Decorator` (default and named export)         | Creates a configuration wrapper that proxies `@koa/router` |
| `Controller`, `HttpMethod`                     | Declare controllers and HTTP routes                        |
| `Inject`, `Context`, `Types`                   | Property/parameter injection and built-in conversions      |
| `Singleton`                                    | Declares one shared instance for a class                   |
| `ResponseHeader`                               | Declares response headers                                  |
| `Cors`, `Cross`                                | Declare CORS; `Cross` is deprecated                        |
| `RouteMiddleware`, `createMiddlewareDecorator` | Declare or create route middleware decorators              |
| `IF`                                           | Selects a decorator from a load-time condition             |
| `ControllerBasePathOverride`                   | Removes the controller base path from one route            |
| `NamedRoute`                                   | Declares a named route                                     |
| `Methods`                                      | HTTP method enum used by CORS and related options          |
| `ParameterConversionError`                     | Identifies built-in route parameter conversion failures    |

## License

[MIT](./LICENSE)
