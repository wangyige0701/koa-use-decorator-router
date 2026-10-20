import { Controller } from '@/decorators/controller';
import { HttpMethod, Cors, Cross, RouteMiddleware } from '@/index';
import { Methods } from '@/index';

@Controller('/cors')
export class CorsController {
	@Cors()
	@HttpMethod.Get('/')
	index() {
		return 'ok';
	}

	// method level, using Cross alias
	@Cross()
	@HttpMethod.Get('/cross')
	cross() {
		return 'ok2';
	}

	// custom cors params on method
	@Cors('https://example.com', ['X-Test-Header', 'Authorization'])
	@HttpMethod.Get('/custom')
	custom() {
		return 'custom';
	}

	// object form of Cors metadata
	@Cors({ origin: 'https://obj.example.com', headers: ['X-Obj-Header'] })
	@HttpMethod.Get('/obj')
	obj() {
		return 'obj';
	}

	// method-level POST with additional cors options to test credentials/maxAge/secureContext/privateNetworkAccess
	@Cors({
		origin: 'https://post.example.com',
		headers: ['X-Post-Header'],
		credentials: true,
		maxAge: 600,
		secureContext: true,
		privateNetworkAccess: true,
	})
	@HttpMethod.Post('/post')
	post() {
		return 'posted';
	}

	// method-level with wildcard origin and credentials true to test origin echo
	@Cors({ origin: '*', credentials: true })
	@HttpMethod.Get('/credentials')
	credentials() {
		return 'cred';
	}

	// origin as array
	@Cors(['https://a.example.com', 'https://b.example.com'])
	@HttpMethod.Get('/origin-array')
	originArray() {
		return 'origin-array';
	}

	@Cors({ origin: 'https://error.example.com', credentials: true })
	@RouteMiddleware((ctx) => {
		ctx.throw(418, 'cors middleware error');
	})
	@HttpMethod.Get('/error')
	error() {
		return 'handler should not run';
	}

	// route without cors to test OPTIONS passthrough
	@HttpMethod.Get('/nocors')
	nocors() {
		return 'nocors';
	}
}

// also include a class-level CORS controller in the same file to avoid extra files
@Controller('/class-cors')
@Cors({
	origin: 'https://class.example.com',
	headers: ['X-Class-Header'],
	methods: [Methods.GET, Methods.POST],
	credentials: true,
	maxAge: 3600,
	secureContext: true,
	privateNetworkAccess: true,
})
export class ClassCorsController {
	@HttpMethod.Get('/')
	index() {
		return 'class';
	}
}
