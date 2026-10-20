import { Controller, HttpMethod } from '@/index';

@Controller('/scan-any-name')
export class AnyName {
	@HttpMethod.Get('/')
	index() {
		return 'any name';
	}
}
