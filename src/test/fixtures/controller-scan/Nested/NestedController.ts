import { Controller, HttpMethod } from '@/index';

@Controller('/scan-nested')
export class NestedController {
	@HttpMethod.Get('/')
	index() {
		return 'nested';
	}
}
