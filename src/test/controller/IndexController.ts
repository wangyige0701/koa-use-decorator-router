import type Koa from 'koa';
import { HttpMethod, Controller, ControllerBasePathOverride, Singleton } from '@/index';
import { Context, Inject } from '@/index';
import { ResponseHeader } from '@/index';
import { Types } from '@/enum';

@Singleton()
@Controller('/index')
export class IndexController {
	@HttpMethod.Get('/get')
	async get() {
		return 'get';
	}

	@HttpMethod.Post('/post')
	post() {
		return 'post';
	}

	@HttpMethod.Put('/put')
	put() {
		return 'put';
	}

	@HttpMethod.Delete('/delete')
	delete() {
		return 'delete';
	}

	@HttpMethod.Get('/int/:id')
	int(@Inject('id', Types.Int) id: number) {
		return id;
	}

	@HttpMethod.Get('/boolean/:value')
	Boolean(@Inject('value', Types.Boolean) value: boolean) {
		return value === true;
	}

	@HttpMethod.Get('/headers')
	@ResponseHeader('X-Header', 'Value')
	headers() {
		return 'headers';
	}

	@HttpMethod.Get('/query/:key')
	query(@Context() ctx: Koa.Context, @Inject('key', Types.String) key: string) {
		return ctx.query[key];
	}

	@ControllerBasePathOverride()
	@HttpMethod.Get('/overrideBasePath')
	override() {
		return 'override';
	}

	@HttpMethod.Get('/object')
	object() {
		return {
			name: 'test',
			age: 18,
		};
	}
}

@Controller('/')
export class RootController {
	@HttpMethod.Get('/')
	root() {
		return 'root';
	}

	@HttpMethod.Get('/child')
	child() {
		return 'root child';
	}
}

@Controller('///normalized///')
export class NormalizedController {
	@HttpMethod.Get('///child')
	child() {
		return 'normalized child';
	}
}

@Controller('/internal//segment/')
export class InternalSeparatorController {
	@HttpMethod.Get('/child//detail')
	detail() {
		return 'internal separators';
	}
}
