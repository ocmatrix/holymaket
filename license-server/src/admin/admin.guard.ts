import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';

    const validToken = process.env.LICENSE_ADMIN_TOKEN;

    if (!validToken) {
      throw new UnauthorizedException('License admin token not configured');
    }

    const provided = Buffer.from(bearerToken);
    const expected = Buffer.from(validToken);
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      throw new UnauthorizedException('Invalid admin token');
    }

    return true;
  }
}
