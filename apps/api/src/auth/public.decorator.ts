import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_ROUTE = 'veyra:is-public-route';
export const Public = () => SetMetadata(IS_PUBLIC_ROUTE, true);
