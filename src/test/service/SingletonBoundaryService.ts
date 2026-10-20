import { Singleton } from '@/index';

@Singleton()
export class SharedSingletonService {
	private static constructions = 0;
	readonly id = ++SharedSingletonService.constructions;
	private calls = 0;

	increment() {
		return ++this.calls;
	}
}

export class TransientService {}

@Singleton('configured')
export class ConfiguredSingletonService {
	constructor(readonly value: string) {}
}

@Singleton()
export class ConcurrentSingletonService {
	private static constructions = 0;

	constructor() {
		ConcurrentSingletonService.constructions++;
	}

	getConstructions() {
		return ConcurrentSingletonService.constructions;
	}
}
