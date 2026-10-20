# 一个基于装饰器的 Koa 路由封装，提供控制器抽象、参数注入和单例管理

## A decorator-driven Koa routing framework with controller abstraction, parameter injection, and singleton support.

> 依赖 `koa`、`@koa/router`、`reflect-metadata`

> Requires `koa`, `@koa/router`, and `reflect-metadata`.

> 此插件使用的装饰器是 TypeScript 的功能，如果使用 JavaScript，需要确保能正确编译为 TypeScript 风格的装饰器产物（如 Babel），包括参数装饰器。

> This plugin relies on TypeScript decorators. If you are using JavaScript, you must ensure your build toolchain (e.g., Babel) supports legacy/TypeScript-style decorators, including parameter decorators.

### 提供基于 Koa 的装饰器路由，使路由定义更简洁以及更易读。

### Provides decorator-based routing for Koa, making route definitions cleaner and more readable.

## 安装 / Install

```bash
npm install koa-use-decorator-router
```

## 依赖要求 / Requirements

- `koa` >=2.0.0
- `@koa/router` >=10.0.0
- `reflect-metadata` >=0.2.0

> tsconfig.json:

- `"experimentalDecorators": true`
- `"emitDecoratorMetadata": true`

## 使用 / Usage

> 目录下的控制器文件名必须以 `Controller` 结尾。可以通过 `acceptAnyControllerName` 允许任何控制器文件名。

> The controller file name must end with `Controller`. You can allow any controller file name by setting `acceptAnyControllerName: true`

> 目录下的控制器文件必须导出一个被 `@Controller` 装饰器装饰的类。

> The controller file must export a class decorated with `@Controller`.

> 每个 `decorator()` 中间件实例只会扫描一次控制器目录并注册一次路由。初始化在创建中间件时启动，请求会等待初始化完成；初始化失败时，错误会进入 Koa 中间件错误处理链。

> Each `decorator()` middleware instance scans the controller directory and registers routes only once. Initialization starts when the middleware is created, requests wait for it to finish, and initialization failures are forwarded through Koa's middleware error chain.

- ### 声明 / Declaration

ESM Module

```ts
import Koa from 'koa';
import { decorator } from 'koa-use-decorator-router';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = new Koa();
app.use(
	decorator({
		controllerDir: resolve(dirname(fileURLToPath(import.meta.url)), './controller'),
		allowedMethods: true,
	}),
);
```

CommonJS Module

```ts
const Koa = require('koa');
const decorator = require('koa-use-decorator-router');
const { dirname, resolve } = require('node:path');
const { fileURLToPath } = require('node:url');

const app = new Koa();
app.use(
	decorator({
		controllerDir: resolve(__dirname, './controller'),
		allowedMethods: true,
	}),
);
```

函数创建中间件 / Create Middleware via Function

> 扩展传参方式 / Extended parameter options

```ts
import Koa from 'koa';
import Router from '@koa/router';
import { decorator } from 'koa-use-decorator-router';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = resolve(dirname(fileURLToPath(import.meta.url)), './controller');

const app = new Koa();
const router = new Router();
// 可以传递 router 实例，来自定义插件内部的路由实例
// You can pass a router instance to customize the internal router instance.
app.use(decorator(dir, router)).use(router.allowedMethods());
```

构造函数创建中间件 / Create Middleware via Constructor

> `Decorator` 实例可以直接调用 `Router` 实例的方法，内部通过代理模式实现。

> You can directly call methods of `Router` instance on `Decorator` instance. The methods are proxied internally.

```ts
import Koa from 'koa';
import Router from '@koa/router';

import { Decorator } from 'koa-use-decorator-router';
// ======= or =======
import Decorator from 'koa-use-decorator-router';

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = resolve(dirname(fileURLToPath(import.meta.url)), './controller');

const app = new Koa();

const decorator = new Decorator(dir);
// 可以直接使用 `Router` 实例中的 `prefix` 方法
// You can directly call `prefix` method of `Router` instance on `Decorator` instance.
decorator.prefix('/api');
app.use(decorator.middleware()).use(decorator.allowedMethods());

// 自定义路由实例 / Customize Router Instance
const router = new Router();
const decorator = new Decorator(dir, router);
app.use(decorator.middleware()).use(decorator.allowedMethods());
```

- ### 基本声明示例 / Basic Declaration Example

成员函数返回的数据会作为响应体返回。

成员函数可以使用 `@Context` 注入 `Koa.Context` 类型的参数。

The return value of the member function will be used as the response body.

The member function can use `@Context` to inject a `Koa.Context` object.

```ts
import type Koa from 'koa';
import { Controller, HttpMethod, Context } from 'koa-use-decorator-router';

@Controller('/home')
export class HomeController {
	@HttpMethod.Get('/')
	async index(@Context() ctx: Koa.Context) {
		console.log(ctx.query);
		return 'Hello World!';
	}
}
```

控制器基础路径和方法路径可以省略开头的 `/`。注册路由时会移除控制器路径首尾以及方法路径开头多余的 `/`，然后使用一个 `/` 连接两部分；方法路径 `/` 表示控制器根路径。路径内部的重复 `/` 不会被折叠。使用 `ControllerBasePathOverride` 时会完全忽略控制器路径，仅规范化方法路径开头。

Controller base paths and method paths may omit the leading `/`. During registration, redundant leading and trailing slashes around the controller path and leading slashes on the method path are removed, then the two parts are joined with one `/`. A method path of `/` denotes the controller root. Repeated slashes inside either path are preserved. `ControllerBasePathOverride` discards the controller path and normalizes only the beginning of the method path.

- ### 单例 / Singleton

单例装饰器不会修改或重写类的构造函数，而是为被装饰的类维护一个共享实例。注入同一构造函数的多个控制器和 `decorator()` 实例都会复用该实例。

非控制器目录下的其它类也可以使用 `@Singleton` 装饰器。

The `@Singleton` decorator does not modify or override the class constructor. Instead, it maintains one shared instance for the decorated class. Controllers and `decorator()` instances that inject the same constructor reuse that instance.

Classes outside the controller directory can also use the `@Singleton` decorator.

```ts
import { Singleton, Controller, HttpMethod } from 'koa-use-decorator-router';

@Singleton()
@Controller('/home')
export class HomeController {
	@HttpMethod.Get('/')
	async index() {
		return 'Hello World!';
	}
}

// HomeService.ts
import { Singleton } from 'koa-use-decorator-router';

@Singleton()
export class HomeService {
	async index() {
		return 'Hello World!';
	}
}
```

- ### 参数注入示例 / Parameter Injection Example

`@Inject` 装饰器第二个参数可以是一个枚举值，也可以是一个函数。

> - 预定义枚举值（如 `Types.Int`）用于内置类型转换
> - 自定义函数用于转换参数值

`@Inject` decorator second parameter can be an enum value or a function.

> - a predefined enum (e.g., `Types.Int`) for built-in type conversion
> - a custom function for transforming the value

内置转换遵循以下校验规则：

- `Types.Int` 只接受完整的十进制整数字符串，并且结果必须是 JavaScript 安全整数；
- `Types.Float` 接受有限的十进制数及科学计数法，不接受 `NaN`、`Infinity`、十六进制或混合字符；
- `Types.Boolean` 只接受区分大小写的 `true` 和 `false`；
- `Types.String` 保留原始路由参数字符串。

使用内置转换时，如果指定名称的路由参数不存在或值不合法，会抛出导出的 `ParameterConversionError`。该错误的 `status` 和 `statusCode` 均为 `400`，`code` 为 `ERR_ROUTE_PARAMETER_CONVERSION`，可以由 Koa 错误处理中间件捕获。未指定转换类型时保留原值，包括 `undefined`。自定义转换函数负责自身的返回值校验；函数抛出的错误或 Promise 拒绝原因会保持原样向上传播。

Built-in conversions use the following validation rules:

- `Types.Int` accepts only a complete base-10 integer string whose result is a JavaScript safe integer;
- `Types.Float` accepts finite decimal and scientific notation, but rejects `NaN`, `Infinity`, hexadecimal, and mixed input;
- `Types.Boolean` accepts only the case-sensitive strings `true` and `false`;
- `Types.String` preserves the original route parameter string.

When a built-in conversion is requested, a missing or invalid route parameter throws the exported `ParameterConversionError`. Its `status` and `statusCode` are `400`, and its `code` is `ERR_ROUTE_PARAMETER_CONVERSION`, so Koa error middleware can identify it. Without a conversion type, the original value is preserved, including `undefined`. Custom conversion functions own validation of their return value; thrown errors and Promise rejection reasons propagate unchanged.

```ts
import { Controller, HttpMethod, Inject, Types } from 'koa-use-decorator-router';

@Controller('/home')
export class HomeController {
	@HttpMethod.Get('/:name')
	async string(@Inject('name') name: string) {
		return `Hello ${name}`;
	}

	@HttpMethod.Get('/:id')
	async int(@Inject('id', Types.Int) id: number) {
		return `Hello ${id}`;
	}

	@HttpMethod.Get('/:path')
	async custom(@Inject('path', decodeURIComponent) path: string) {
		return `Hello ${path}`;
	}
}
```

- ### 响应头示例 / Response Header Example

`@ResponseHeader` 装饰器用于设置响应头，第一个参数是响应头名称，第二个参数是响应头值。

The `@ResponseHeader` decorator is used to set response headers. The first parameter specifies the header name, and the second parameter specifies the header value.

```ts
import { Controller, HttpMethod, ResponseHeader, Methods } from 'koa-use-decorator-router';

@Controller('/home')
export class HomeController {
	@HttpMethod.Get('/')
	@ResponseHeader('Content-Type', 'text/plain')
	async index() {
		return 'Hello World!';
	}
}
```

- ### 跨域 / CORS

该库提供一个 `@Cors` 装饰器用于处理跨域（CORS）配置，可作用在控制器类（class-level）或成员方法（method-level）上。

> 装饰器的行为参考并借鉴了 `@koa/cors` 的实现，但本项目会自动为配置了 `@Cors` 的路由创建对应的 `OPTIONS` 预检路由，并返回相应的 CORS 响应头。
> 如果在成员方法上使用 `@Cors`，则 `Access-Control-Allow-Methods` 将会强制设置为当前路由方法，因此在方法级别传递 `methods` 参数是无效的。

This library provides a `@Cors` decorator for handling Cross-Origin Resource Sharing (CORS) configurations, which can be applied at the controller class level or the individual method level.

> The behavior of this decorator is inspired by the implementation of `@koa/cors`. However, this project automatically creates the corresponding `OPTIONS` preflight route for any route configured with `@Cors` and returns the appropriate CORS response headers.
> When `@Cors` is applied at the method level, the `Access-Control-Allow-Methods` header is forcibly set to the current route’s method. Therefore, passing a `methods` parameter at the method level has no effect.

参数 / Options

- origin: `Access-Control-Allow-Origin` - default `'*'`
- methods: `Access-Control-Allow-Methods` - default `['GET','POST','PUT','DELETE','PATCH','HEAD']`
- headers: `Access-Control-Allow-Headers`
- credentials: `Access-Control-Allow-Credentials` - default `false`
- secureContext: `Cross-Origin-Opener/Embedder-Policy` - default `false`
- maxAge: `Access-Control-Max-Age`
- privateNetworkAccess: `Access-Control-Allow-Private-Network` - default `false`

示例 / Examples

```ts
import { Controller, HttpMethod, Cors, Methods } from 'koa-use-decorator-router';

@Controller('/cors')
@Cors({
	origin: 'https://example.com',
	headers: ['Content-Type','Authorization'],
	methods: [Methods.GET, Methods.POST],
	credentials: true,
	maxAge: 3600,
	secureContext: true,
	privateNetworkAccess: false,
})
export class CorsController { ... }

@Controller('/cors')
@Cors('*', ['Content-Type','Authorization'], [Methods.GET, Methods.POST])
export class CorsController { ... }

@Controller('/cors')
@Cors()
export class CorsController { ... }
```

```ts
@Controller('/cors')
export class CorsController {
	@Cors({ origin: '*', headers: ['X-My-Header'], credentials: true })
	@HttpMethod.Get('/')
	index() {
		return 'ok';
	}

	@HttpMethod.Get('/index2')
	@Cors('*', ['Content-Type', 'Authorization'])
	index2() {
		return 'ok';
	}

	@HttpMethod.Get('/index3')
	@Cors()
	index3() {
		return 'ok';
	}
}
```

- ### 条件装饰器 / Conditional Decorator

`@IF` 装饰器可以根据条件判断应用不同的装饰器，必须要链式调用 `ENDIF` 结束。

The `@IF` decorator allows applying different decorators based on a condition, and must be concluded by chaining a call to `ENDIF`.

```ts
import { Controller, HttpMethod, IF } from 'koa-use-decorator-router';

@(IF(process.env.SOME_ENV, Controller('/if-not'))
	.ELIF(process.env.SOME_ENV, Controller('/elif'))
	.ELSE(Controller('/else'))
	.ENDIF())
export class HomeController {
	@HttpMethod.Get('/')
	async index() {
		return 'Hello World!';
	}
}
```

- ### 成员属性注入 / Property Injection

可以通过传递构造函数给 `@Inject` 装饰器来注入成员属性，或者在 ts 中通过类型反射来注入。如果使用的 ts 运行时环境不支持实时注入元数据（如 `design:type`），则一定需要在装饰器工厂函数中传入构造函数。

You can inject member properties by passing the class constructor to the `@Inject` decorator, or by using TypeScript's type reflection. If the TypeScript runtime environment does not support runtime injection of metadata (like `design:type`), you must pass the constructor function to the decorator factory function.

```ts
// HomeController.ts
import type { HomeService } from '@/service/HomeService';
import { Controller, HttpMethod, Inject } from 'koa-use-decorator-router';
import { HomeService2, HomeService3 } from '@/service/HomeService';

@Controller('/home')
export class HomeController {
	// 如果不用非空断言 (!)，则 `tsconfig.json` 中必须关闭 `strictPropertyInitialization`
	// If you do not use the non-null assertion operator (!), you must disable `strictPropertyInitialization` in `tsconfig.json`.
	@Inject()
	service!: HomeService;

	@Inject(HomeService2)
	service2!: HomeService2;

	// 当将类的构造函数作为参数传入 `@Inject` 装饰器时，TypeScript 类型也可以使用 `any`
	// This means that when passing a class constructor to the `@Inject` decorator, the TypeScript type can be specified as `any`.
	@Inject(HomeService3)
	service3: any;

	@HttpMethod.Get('/')
	async index() {
		return this.service.show();
	}

	@HttpMethod.Get('/service2')
	async index2() {
		return this.service2.show();
	}

	@HttpMethod.Get('/service3')
	async index3() {
		return this.service3.show();
	}
}

// HomeService.ts
export class HomeService {
	show() {
		return 'Hello World!';
	}
}

export class HomeService2 {
	show() {
		return 'Hello World 2!';
	}
}

export class HomeService3 {
	show() {
		return 'Hello World 3!';
	}
}
```

- ### 控制器基础路径覆盖 / Controller Base Path Override

```ts
import { Controller, HttpMethod, ControllerBasePathOverride } from 'koa-use-decorator-router';

@Controller('/home')
export class HomeController {
	@ControllerBasePathOverride()
	@HttpMethod.Get('/home2/:name')
	async string(@Inject('name') name: string) {
		return `Hello ${name}`;
	}
}
```

`ControllerBasePathOverride` 会完全移除当前方法的控制器基础路径；覆盖后的 `/` 方法路径仍表示应用根路径。

`ControllerBasePathOverride` completely removes the controller base path for the decorated method, and an overridden method path of `/` still represents the application root.

- ### 路由实例方法代理 / Router Method Proxying

```ts
import Koa from 'koa';
import Decorator from 'koa-use-decorator-router';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = resolve(dirname(fileURLToPath(import.meta.url)), './controller');

const app = new Koa();

const decorator = new Decorator(dir);
decorator.prefix('/api').param('user', (id, ctx, next) => {
	ctx.user = users[id];
	if (!ctx.user) return (ctx.status = 404);
	return next();
});
app.use(decorator.middleware()).use(decorator.allowedMethods());
```

- ### 控制器文件过滤 / Controller File Filter

控制器扫描规则：

- `controllerDir` 必须指向一个存在的目录，建议传入绝对路径；
- 只扫描该目录的直接子文件，不递归扫描子目录；
- 只处理 `.js`、`.ts`、`.mjs`、`.mts`、`.cjs` 和 `.cts` 文件，并忽略声明文件；
- 默认要求文件基名匹配 `^\w+Controller$`，匹配区分大小写；
- `acceptAnyControllerName` 只关闭文件名限制，不会放开目录、文件类型或递归规则；
- `matchFileName` 在上述扫描规则之后执行，接收不含扩展名的文件基名及扩展名；
- 模块中只有带有 `@Controller` 且基础路径为非空字符串的导出会注册路由，其他导出会被忽略；模块导入失败会导致初始化失败，并进入 Koa 错误处理链。

Controller scanning rules:

- `controllerDir` must point to an existing directory; an absolute path is recommended;
- only direct child files are scanned; subdirectories are not scanned recursively;
- only `.js`, `.ts`, `.mjs`, `.mts`, `.cjs`, and `.cts` files are considered, and declaration files are ignored;
- by default, the file base name must match `^\w+Controller$`, case-sensitively;
- `acceptAnyControllerName` disables only the file-name restriction; it does not enable directories, other file types, or recursive scanning;
- `matchFileName` runs after these scanning rules and receives the base name without its extension plus the extension;
- only exports decorated with `@Controller` whose base path is a non-empty string register routes; other exports are ignored. A module import failure fails initialization and is forwarded through the Koa error chain.

通过函数创建 / Create a custom filter function

```ts
app.use(
	decorator({
		controllerDir: dir,
		// 仅加载名为 IndexController 的文件（去除扩展名后比较）
		// Only load files with the name IndexController (without extension)
		matchFileName: 'IndexController',
	}),
);

app.use(
	decorator({
		controllerDir: dir,
		// 加载以 Admin 开头的控制器：AdminController、AdminUserController 等
		// Load controllers that start with Admin, such as AdminController, AdminUserController, etc.
		matchFileName: /^Admin/,
	}),
);

app.use(
	decorator({
		controllerDir: dir,
		matchFileName: ['IndexController', /^Admin/],
	}),
);

app.use(
	decorator({
		controllerDir: dir,
		// 自定义函数可以同时访问文件基名 (val) 和扩展名 (suffix)
		// Custom function can access both the file base name (val) and extension (suffix)
		matchFileName: (val, suffix) => {
			return val.startsWith('Index') && suffix === '.ts';
		},
	}),
);
```

通过构造函数创建 / Create a custom filter function

```ts
const decorator = new Decorator(dir);

// 链式添加规则（可以多次调用 matchFileName）
// Chainable rules (can be called multiple times)
decorator
	.matchFileName('IndexController')
	.matchFileName(/^Admin/)
	.matchFileName(['IndexController', /^Admin/]);

// 传递函数时会覆盖之前的所有规则
// Passing a function will override all previous rules
decorator.matchFileName((val, suffix) => val !== 'SkipController');
```

- ### 控制器名称限制 / Controller Naming Convention

默认情况下，控制器文件名需要以 `Controller` 结尾。从 `0.2.0` 版本开始，可以通过配置关闭该限制。

By default, controller file names are expected to end with `Controller`. Starting from version `0.2.0`, this restriction can be disabled via configuration.

```ts
app.use(
	decorator({
		controllerDir: dir,
		acceptAnyControllerName: true,
	}),
);

// or

app.use(decorator.acceptAnyControllerName().middleware());
```

- ### 路由中间件 / Route Middleware (>= 1.1.0)

可以使用 `RouteMiddleware` 在类或方法层添加中间件，也可以通过 `createMiddlewareDecorator` 创建可复用的中间件装饰器。

You can use `RouteMiddleware` to add middleware at the class or method level, or you can create a middleware decorator factory using `createMiddlewareDecorator`.

```ts
import { Controller, HttpMethod, RouteMiddleware, createMiddlewareDecorator } from 'koa-use-decorator-router';

const Test = createMiddlewareDecorator((ctx, next) => {
	ctx.set('x-test', '1');
	return next();
});

@RouteMiddleware((ctx, next) => {
	ctx.set('x-class', '1');
	return next();
})
@Controller('/mw')
export class MiddlewareController {
	@HttpMethod.Get('/class')
	classRoute() {
		return 'ok';
	}

	@RouteMiddleware((ctx, next) => {
		ctx.set('x-method', '2');
		return next();
	})
	@HttpMethod.Get('/method')
	methodRoute() {
		return 'ok2';
	}

	@Test()
	@HttpMethod.Get('/test')
	testRoute() {
		return 'ok3';
	}
}
```

类级中间件会在方法级中间件之前执行。连续声明多个由 `createMiddlewareDecorator` 创建的装饰器时，中间件按照代码中从上到下的顺序执行；同一个装饰器接收的多个中间件按照参数顺序执行。

Class-level middleware executes before method-level middleware. When multiple decorators created by `createMiddlewareDecorator` are stacked, their middleware executes from top to bottom as written; multiple middleware passed to one decorator execute in argument order.

- ### 命名路由 / Named Route (>= 1.1.0)

使用 `NamedRoute('name')` 为路由命名；初始化后的 `Decorator` 实例可以通过内部路由的 `url` 方法生成路径。

Use `NamedRoute('name')` to name routes; the initialized `Decorator` instance can generate paths using the internal router's `url` method.

```ts
import { Controller, HttpMethod, NamedRoute, Inject, Types } from 'koa-use-decorator-router';

@Controller('/named')
export class NamedRouteController {
	@NamedRoute('named.detail')
	@HttpMethod.Get('/detail/:id')
	detail(@Inject('id', Types.Int) id: number) {
		return id;
	}
}
```

生成 URL / Generate URL

```ts
const decorator = new Decorator(dir);
app.use(decorator.middleware());
const url = decorator.getRouter().url('named.detail', { id: '123' });
// => '/named/detail/123'
```
