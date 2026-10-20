import { Controller, HttpMethod, Inject, Types } from '@/index';

function customConversion(value: string) {
	if (value !== 'ok') {
		throw Object.assign(new Error('custom conversion failed'), { status: 422, expose: true });
	}
	return value.toUpperCase();
}

@Controller('/conversion')
export class ConversionController {
	@HttpMethod.Get('/int/:value')
	int(@Inject('value', Types.Int) value: number) {
		return String(value);
	}

	@HttpMethod.Get('/float/:value')
	float(@Inject('value', Types.Float) value: number) {
		return String(value);
	}

	@HttpMethod.Get('/boolean/:value')
	boolean(@Inject('value', Types.Boolean) value: boolean) {
		return String(value);
	}

	@HttpMethod.Get('/missing/:value')
	missing(@Inject('other', Types.Int) value: number) {
		return String(value);
	}

	@HttpMethod.Get('/custom/:value')
	custom(@Inject('value', customConversion) value: string) {
		return value;
	}
}
