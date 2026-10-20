export const ControllerDirRequired = '`controllerDir` is required with the absolute path';

export const ControllerDirNotExist = (controllerDir: string) => `Controller directory not found: ${controllerDir}`;

export class ParameterConversionError extends Error {
	readonly status = 400;
	readonly statusCode = 400;
	readonly expose = true;
	readonly code = 'ERR_ROUTE_PARAMETER_CONVERSION';

	constructor(
		readonly parameterName: string,
		readonly expectedType: string,
		options?: ErrorOptions,
	) {
		super(`Invalid route parameter "${parameterName}": expected ${expectedType}`, options);
		this.name = 'ParameterConversionError';
	}
}
