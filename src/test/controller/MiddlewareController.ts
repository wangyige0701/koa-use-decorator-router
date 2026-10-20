import { Controller } from '@/index';
import { Context, createMiddlewareDecorator, RouteMiddleware } from '@/index';
import { HttpMethod } from '@/index';
import type Koa from 'koa';

type TraceState = {
	trace?: string[];
};

const Test = createMiddlewareDecorator((ctx, next) => {
	ctx.set('x-test', 'test');
	return next();
});

const First = createMiddlewareDecorator(async (ctx, next) => {
	const state = ctx.state as TraceState;
	state.trace = state.trace || [];
	state.trace.push('first-before');
	await next();
	state.trace.push('first-after');
	ctx.set('x-created-order', state.trace.join(','));
});

const Second = createMiddlewareDecorator(async (ctx, next) => {
	const state = ctx.state as TraceState;
	state.trace = state.trace || [];
	state.trace.push('second-before');
	await next();
	state.trace.push('second-after');
});

@RouteMiddleware(async (ctx, next) => {
	ctx.set('x-class', '1');
	const state = ctx.state as TraceState;
	state.trace = state.trace || [];
	state.trace.push('class-before');
	await next();
	state.trace.push('class-after');
	ctx.set('x-order', state.trace.join(','));
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

	@RouteMiddleware(
		async (ctx, next) => {
			const trace = (ctx.state as TraceState).trace!;
			trace.push('method-1-before');
			await next();
			trace.push('method-1-after');
		},
		async (ctx, next) => {
			const trace = (ctx.state as TraceState).trace!;
			trace.push('method-2-before');
			await next();
			trace.push('method-2-after');
		},
	)
	@HttpMethod.Get('/order')
	order(@Context() ctx: Koa.Context) {
		(ctx.state as TraceState).trace!.push('handler');
		return 'ordered';
	}

	@First()
	@Second()
	@HttpMethod.Get('/created-order')
	createdOrder(@Context() ctx: Koa.Context) {
		(ctx.state as TraceState).trace!.push('handler');
		return 'created order';
	}

	@RouteMiddleware((ctx) => {
		ctx.status = 202;
		ctx.body = 'short-circuited';
	})
	@HttpMethod.Get('/short-circuit')
	shortCircuit() {
		return 'handler should not run';
	}

	@RouteMiddleware((ctx) => {
		ctx.throw(418, 'middleware error');
	})
	@HttpMethod.Get('/error')
	error() {
		return 'handler should not run';
	}
}

@First()
@Second()
@Controller('/mw-created-class-order')
export class CreatedMiddlewareOrderController {
	@HttpMethod.Get('/')
	index(@Context() ctx: Koa.Context) {
		(ctx.state as TraceState).trace!.push('handler');
		return 'created class order';
	}
}
