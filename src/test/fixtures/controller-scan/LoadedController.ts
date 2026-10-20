import { Controller, HttpMethod } from '@/index';

@Controller('/scan-loaded')
export class LoadedController {
	@HttpMethod.Get('/')
	index() {
		return 'loaded';
	}
}
