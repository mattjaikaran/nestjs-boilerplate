import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getInfo() {
    return {
      name: 'nestjs-boilerplate',
      version: '0.1.0',
      description: 'Production-ready NestJS API with comprehensive auth',
      docs: '/docs',
    };
  }
}
