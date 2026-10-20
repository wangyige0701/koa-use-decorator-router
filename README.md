# koa-use-decorator-router

[简体中文](./README.md) | [English](./README.en.md)

基于 Koa 和 `@koa/router` 的 TypeScript 装饰器路由库，提供控制器、路由参数注入、属性注入、单例、CORS 和路由中间件等能力。

## 特性

- 使用类和方法装饰器声明控制器与路由；
- 支持常用 HTTP 方法以及匹配全部方法的 `All`；
- 支持路由参数、`Koa.Context` 和成员属性注入；
- 支持内置参数转换、自定义异步转换和明确的转换错误；
- 支持类级和方法级响应头、CORS 与路由中间件；
- 支持单例、条件装饰器、命名路由和控制器文件过滤；
- 每个中间件实例只扫描并注册一次路由。

## 安装

```bash
npm install koa-use-decorator-router
```

## 环境要求

- `koa` >= 2.0.0
- `@koa/router` >= 10.0.0
- `reflect-metadata` >= 0.2.0
- 支持 TypeScript 旧版装饰器语义的编译环境

TypeScript 项目需要启用：

```json
{
	"compilerOptions": {
		"experimentalDecorators": true,
		"emitDecoratorMetadata": true
	}
}
```

如果使用 JavaScript，需要由 Babel 等工具生成兼容 TypeScript 旧版装饰器（包括参数装饰器）的代码。

## 快速开始

控制器文件 `controller/HomeController.ts`：

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

应用入口：

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

CommonJS 使用命名导出：

```js
const Koa = require('koa');
const { resolve } = require('node:path');
const { decorator } = require('koa-use-decorator-router');

const app = new Koa();
app.use(decorator({ controllerDir: resolve(__dirname, './controller'), allowedMethods: true }));
```

## 创建路由中间件

### 函数 API

```ts
decorator(options: string | DecoratorOptions, router?: Router): Koa.Middleware
```

可以直接传入控制器目录，也可以使用配置对象：

```ts
import Router from '@koa/router';
import { decorator } from 'koa-use-decorator-router';

const router = new Router();
app.use(decorator(controllerDir, router)).use(router.allowedMethods());
```

`DecoratorOptions`：

| 属性                      | 类型                                                      | 默认值  | 说明                                                               |
| ------------------------- | --------------------------------------------------------- | ------- | ------------------------------------------------------------------ |
| `controllerDir`           | `string`                                                  | 必填    | 控制器目录，建议使用绝对路径                                       |
| `allowedMethods`          | `boolean \| AllowedMethodsOptions`                        | `false` | 为 `true` 或配置对象时，在路由匹配后执行 `router.allowedMethods()` |
| `prefix`                  | `string`                                                  | 无      | 注册路由前设置的路由前缀                                           |
| `matchFileName`           | `string \| RegExp \| Array<string \| RegExp> \| Function` | 无      | 控制器文件过滤规则                                                 |
| `acceptAnyControllerName` | `boolean`                                                 | `false` | 关闭默认的控制器文件名限制                                         |

调用 `decorator()` 时会立即启动一次初始化。该中间件收到的所有请求都会等待同一个初始化结果，不会重复扫描或注册路由。初始化失败时，错误会在请求进入该中间件后抛出，并进入 Koa 错误处理链。

### `Decorator` 类

```ts
import Decorator from 'koa-use-decorator-router';
// 也可以：import { Decorator } from 'koa-use-decorator-router';

const routerDecorator = new Decorator(controllerDir);
routerDecorator.prefix('/api');

app.use(routerDecorator.middleware());
app.use(routerDecorator.allowedMethods());
```

构造函数也接受自定义 `Router`：

```ts
const routerDecorator = new Decorator(controllerDir, router);
```

`Decorator` 会代理内部 `Router` 上不存在于自身的方法。代理方法返回内部 `Router` 时，会替换为当前 `Decorator`，因此可以继续链式调用。请在调用 `middleware()` 之前完成 `prefix()`、`matchFileName()` 和 `acceptAnyControllerName()` 等配置。可通过 `getRouter()` 获取内部路由实例。

## 控制器扫描

扫描规则如下：

- `controllerDir` 必须指向一个存在的目录，建议传入绝对路径；
- 只扫描目录的直接子文件，不递归扫描子目录；
- 只处理 `.js`、`.ts`、`.mjs`、`.mts`、`.cjs` 和 `.cts` 文件，声明文件会被忽略；
- 默认要求文件基名区分大小写地匹配 `^\w+Controller$`；
- `acceptAnyControllerName` 只关闭文件名限制，不改变目录、扩展名和递归规则；
- `matchFileName` 在以上规则之后执行，函数规则接收文件基名和扩展名；
- 模块中只有被 `@Controller` 装饰且基础路径为非空字符串的导出会注册路由；
- 模块导入失败会使初始化失败，并通过 Koa 错误处理链报告。

过滤示例：

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

使用 `Decorator` 时，字符串、正则表达式和数组规则会追加；函数规则会替换之前的规则：

```ts
routerDecorator.matchFileName('IndexController').matchFileName(/^Admin/);
routerDecorator.matchFileName((fileName) => fileName !== 'SkipController');
routerDecorator.acceptAnyControllerName();
```

## 控制器与路由

`@Controller(basePath)` 声明控制器基础路径。`HttpMethod` 提供 `All`、`Get`、`Post`、`Put`、`Delete`、`Options`、`Head` 和 `Patch` 方法装饰器。控制器方法的返回值或 Promise 结果会写入 `ctx.body`。

默认情况下，每次请求都会创建新的控制器实例；使用 `@Singleton` 装饰控制器后才会跨请求复用同一实例。只有通过参数装饰器注入的值会传给控制器方法，未装饰的参数位置为 `undefined`。

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

### 路径规范化

- 控制器基础路径和方法路径都可以省略开头的 `/`；
- 控制器路径首尾以及方法路径开头多余的 `/` 会在连接处移除；
- 方法路径 `/` 或空字符串表示控制器根路径；
- 控制器路径或方法路径内部的重复 `/` 不会被折叠；
- `ControllerBasePathOverride` 会忽略控制器路径，仅规范化方法路径开头。

例如，`@Controller('///users///')` 与 `@HttpMethod.Get('///:id')` 会注册为 `/users/:id`。

## 参数注入

### 路由参数

`@Inject(name, type?)` 从 `ctx.params` 读取指定参数。省略 `type` 时保留原始字符串；找不到参数时传入 `undefined`。

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

内置转换规则：

| 类型            | 接受的输入                                                             |
| --------------- | ---------------------------------------------------------------------- |
| `Types.Int`     | 完整的十进制整数字符串，且结果必须是 JavaScript 安全整数               |
| `Types.Float`   | 有限的十进制数或科学计数法；拒绝 `NaN`、`Infinity`、十六进制和混合字符 |
| `Types.Boolean` | 区分大小写的 `true` 或 `false`                                         |
| `Types.String`  | 原始路由参数字符串                                                     |

使用内置转换时，参数缺失或格式无效会抛出 `ParameterConversionError`。该错误的 `status` 和 `statusCode` 为 `400`，`code` 为 `ERR_ROUTE_PARAMETER_CONVERSION`。自定义转换函数可以返回 Promise；其返回值由函数自行校验，抛出的错误或拒绝原因会原样传播。

如果需要统一转换错误响应，请在路由中间件之前注册错误处理中间件：

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

### 上下文参数

`@Context()` 注入当前 `Koa.Context`。同一方法只会记录一个上下文参数。

### 成员属性注入

无参 `@Inject()` 依赖 TypeScript 编译或打包工具为成员属性正确生成 `design:type` 元数据。即使启用了 `experimentalDecorators` 和 `emitDecoratorMetadata`，部分工具链仍可能不支持或移除该元数据；遇到这种情况请勿使用类型推断，直接通过 `@Inject(Constructor)` 传入构造函数。使用类型推断时，成员类型还必须作为运行时值导入，不能使用 `import type`。

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

未使用 `@Singleton` 的注入类型会在控制器实例执行注入时创建新实例；默认的非单例控制器因此会在每个请求中得到新的依赖。单例控制器只在首次使用时完成属性注入，之后复用已注入的属性。

## 单例

`@Singleton(...constructorArgs)` 为被装饰的类维护一个共享实例，并在首次创建时传入构造参数。单例以类为作用域，同一进程中注入该类的不同控制器和不同 `decorator()` 实例都会复用它。控制器本身也可以使用 `@Singleton`，从而在请求之间保留实例状态。

```ts
import { Singleton } from 'koa-use-decorator-router';

@Singleton('primary')
export class UserService {
	constructor(readonly source: string) {}
}
```

## 响应头

`@ResponseHeader(name, value, top?)` 可以用于控制器类或方法。方法级同名响应头优先于类级响应头。

- `top = false`（默认）：在控制器方法执行前设置；如果路由中间件提前结束或抛错，该响应头可能不会写入；
- `top = true`：在路由中间件之前设置，即使后续中间件抛错也会保留。

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

`@Cors` 可以用于控制器类或路由方法，并会为相应路由注册 `OPTIONS` 预检处理。`Cross` 是已废弃的兼容别名。

| 选项                   | 类型                   | 对应响应头                                                   | 默认值                              |
| ---------------------- | ---------------------- | ------------------------------------------------------------ | ----------------------------------- |
| `origin`               | `string \| string[]`   | `Access-Control-Allow-Origin`                                | `'*'`                               |
| `methods`              | `Methods \| Methods[]` | `Access-Control-Allow-Methods`                               | GET、POST、PUT、DELETE、PATCH、HEAD |
| `headers`              | `string \| string[]`   | `Access-Control-Allow-Headers`                               | 空                                  |
| `credentials`          | `boolean`              | `Access-Control-Allow-Credentials`                           | `false`                             |
| `secureContext`        | `boolean`              | `Cross-Origin-Opener-Policy`、`Cross-Origin-Embedder-Policy` | `false`                             |
| `maxAge`               | `number`               | `Access-Control-Max-Age`                                     | 空                                  |
| `privateNetworkAccess` | `boolean`              | `Access-Control-Allow-Private-Network`                       | `false`                             |

推荐使用对象配置。兼容重载 `Cors(origin?, headers?, methods?)` 只支持前三个选项。数组值会使用逗号连接；未配置 `headers` 时，预检请求会回显 `Access-Control-Request-Headers`。`maxAge` 和 `privateNetworkAccess` 只用于预检响应。

所有已注册路由都会添加 `Vary: Origin`。当 `credentials: true` 且 `origin: '*'` 时，实际响应和预检响应都会把 `Access-Control-Allow-Origin` 改为当前请求来源。传入多个 `origin` 时，当前实现会将它们以逗号连接后直接写入响应头，不会根据请求来源动态选择其中一项。

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

方法级 `@Cors` 必须写在 `@HttpMethod` 上方，使其应用时能够读取路由方法。方法级配置的 `Access-Control-Allow-Methods` 固定为当前路由方法，因此传入 `methods` 不生效。没有 `Access-Control-Request-Method` 的 `OPTIONS` 请求会继续执行后续中间件。

## 路由中间件

`@RouteMiddleware(...middlewares)` 可以用于控制器类或方法。`createMiddlewareDecorator(...middlewares)` 可以创建可复用的无参装饰器工厂。

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

执行顺序遵循以下规则：

- 类级中间件先于方法级中间件；
- 同一个装饰器中的多个中间件按参数顺序执行；
- 连续声明多个由 `createMiddlewareDecorator` 创建的装饰器时，按源码从上到下进入中间件链；
- Koa 洋葱模型中的退出顺序与进入顺序相反；不调用 `next()` 会阻止后续中间件和控制器方法执行。

## 条件装饰器

`IF(condition, decorator)` 根据条件选择装饰器，可链式调用 `ELIF` 和 `ELSE`，最后必须调用 `ENDIF()`。它可以包装类、方法、属性或参数装饰器，但同一条条件链中的装饰器类型应保持一致。条件在模块加载、装饰器应用时求值，不会针对每个请求重新计算。

```ts
import { Controller, IF } from 'koa-use-decorator-router';

@(IF(process.env.APP_ENV === 'production', Controller('/api'))
	.ELSE(Controller('/debug'))
	.ENDIF())
export class ConditionalController {}
```

## 控制器基础路径覆盖

`@ControllerBasePathOverride()` 使当前方法完全忽略控制器基础路径。

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

以上路由注册为 `/health`，而不是 `/users/health`。覆盖后的方法路径 `/` 表示应用根路径。

## 命名路由

`@NamedRoute(name)` 为路由命名。初始化完成后，可以通过内部 `Router` 生成 URL。

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

// 请在初始化完成后调用；此处可在首个请求处理完成后使用。
routerDecorator.getRouter().url('users.detail', { id: '123' });
// => /users/123
```

## 公开 API 索引

| 导出                                           | 用途                                |
| ---------------------------------------------- | ----------------------------------- |
| `decorator`                                    | 创建 Koa 路由中间件                 |
| `Decorator`（默认导出和命名导出）              | 创建可代理 `@koa/router` 的配置实例 |
| `Controller`、`HttpMethod`                     | 声明控制器和 HTTP 路由              |
| `Inject`、`Context`、`Types`                   | 属性/参数注入和内置类型转换         |
| `Singleton`                                    | 声明类级共享实例                    |
| `ResponseHeader`                               | 声明响应头                          |
| `Cors`、`Cross`                                | 声明 CORS；`Cross` 已废弃           |
| `RouteMiddleware`、`createMiddlewareDecorator` | 声明或创建路由中间件装饰器          |
| `IF`                                           | 根据加载时条件选择装饰器            |
| `ControllerBasePathOverride`                   | 移除单个路由的控制器基础路径        |
| `NamedRoute`                                   | 声明命名路由                        |
| `Methods`                                      | CORS 等配置使用的 HTTP 方法枚举     |
| `ParameterConversionError`                     | 识别内置路由参数转换错误            |

## 许可证

[MIT](./LICENSE)
