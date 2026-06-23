import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtPayload } from '../jwt.service';

export const CurrentUser = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): JwtPayload => {
        const request = ctx.switchToHttp().getRequest();
        if (!request.user?.sub) {
            throw new UnauthorizedException('Authenticated user required');
        }
        return request.user;
    },
);
