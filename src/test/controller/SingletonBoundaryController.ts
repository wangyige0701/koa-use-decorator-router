import { Controller, HttpMethod, Inject, Singleton } from '@/index';
import {
	ConcurrentSingletonService,
	ConfiguredSingletonService,
	SharedSingletonService,
	TransientService,
} from '../service/SingletonBoundaryService';

@Controller('/singleton-boundary')
export class SingletonIdentityController {
	@Inject()
	firstSingleton!: SharedSingletonService;

	@Inject()
	secondSingleton!: SharedSingletonService;

	@Inject()
	firstTransient!: TransientService;

	@Inject()
	secondTransient!: TransientService;

	@Inject()
	configured!: ConfiguredSingletonService;

	@HttpMethod.Get('/identity')
	identity() {
		return {
			sameSingleton: this.firstSingleton === this.secondSingleton,
			sameTransient: this.firstTransient === this.secondTransient,
			singletonId: this.firstSingleton.id,
			configuredValue: this.configured.value,
		};
	}

	@HttpMethod.Get('/increment')
	increment() {
		return this.firstSingleton.increment();
	}
}

@Controller('/singleton-boundary')
export class SingletonConcurrentController {
	@Inject()
	service!: ConcurrentSingletonService;

	@HttpMethod.Get('/concurrent')
	concurrent() {
		return this.service.getConstructions();
	}
}

@Singleton()
@Controller('/singleton-boundary')
export class SingletonStatefulController {
	private calls = 0;

	@HttpMethod.Get('/controller')
	controller() {
		return ++this.calls;
	}
}
