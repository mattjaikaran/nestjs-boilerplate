import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

function toPascalCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
}

function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

function mkdirP(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function writeFile(filePath: string, content: string) {
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`  Created: ${filePath}`);
}

async function generate() {
  console.log('\nNestJS Module Generator\n');

  const rawName = await ask('Module name (e.g. "products" or "blog-posts"): ');
  const name = rawName.trim();

  if (!name) {
    console.error('Module name is required.');
    rl.close();
    process.exit(1);
  }

  const kebab = toKebabCase(name);
  const pascal = toPascalCase(name);
  const camel = toCamelCase(name);
  // Singularize naively (strip trailing 's')
  const singular = pascal.endsWith('ies')
    ? `${pascal.slice(0, -3)}y`
    : pascal.endsWith('s')
      ? pascal.slice(0, -1)
      : pascal;

  const baseDir = path.join(process.cwd(), 'src', kebab);
  mkdirP(path.join(baseDir, 'dto'));
  mkdirP(path.join(baseDir, 'entities'));

  // entity
  writeFile(
    path.join(baseDir, 'entities', `${kebab}.entity.ts`),
    `import { Entity, Column } from 'typeorm';
import { AuditableEntity } from '../../database/base.entity';

@Entity('${kebab}')
export class ${singular} extends AuditableEntity {
  @Column({ length: 255 })
  name: string;

  // TODO: add columns
}
`,
  );

  // create DTO
  writeFile(
    path.join(baseDir, 'dto', `create-${kebab}.dto.ts`),
    `import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class Create${singular}Dto {
  @ApiProperty({ example: 'My ${singular}' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;
}
`,
  );

  // update DTO
  writeFile(
    path.join(baseDir, 'dto', `update-${kebab}.dto.ts`),
    `import { PartialType } from '@nestjs/swagger';
import { Create${singular}Dto } from './create-${kebab}.dto';

export class Update${singular}Dto extends PartialType(Create${singular}Dto) {}
`,
  );

  // service
  writeFile(
    path.join(baseDir, `${kebab}.service.ts`),
    `import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ${singular} } from './entities/${kebab}.entity';
import { Create${singular}Dto } from './dto/create-${kebab}.dto';
import { Update${singular}Dto } from './dto/update-${kebab}.dto';
import type { PaginatedResponse, PaginationDto } from '../common/dto/pagination.dto';

@Injectable()
export class ${pascal}Service {
  constructor(
    @InjectRepository(${singular})
    private repo: Repository<${singular}>,
  ) {}

  async create(dto: Create${singular}Dto): Promise<${singular}> {
    const entity = this.repo.create(dto);
    return this.repo.save(entity);
  }

  async findAll(query: PaginationDto): Promise<PaginatedResponse<${singular}>> {
    const { page = 1, limit = 20 } = query;
    const [data, total] = await this.repo.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });
    const totalPages = Math.ceil(total / limit);
    return {
      data,
      meta: { page, limit, total, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 },
    };
  }

  async findOne(id: string): Promise<${singular}> {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) throw new NotFoundException('${singular} not found');
    return entity;
  }

  async update(id: string, dto: Update${singular}Dto): Promise<${singular}> {
    const entity = await this.findOne(id);
    Object.assign(entity, dto);
    return this.repo.save(entity);
  }

  async remove(id: string): Promise<void> {
    const entity = await this.findOne(id);
    await this.repo.softDelete(entity.id);
  }
}
`,
  );

  // controller
  writeFile(
    path.join(baseDir, `${kebab}.controller.ts`),
    `import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ${pascal}Service } from './${kebab}.service';
import { Create${singular}Dto } from './dto/create-${kebab}.dto';
import { Update${singular}Dto } from './dto/update-${kebab}.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@ApiTags('${pascal}')
@ApiBearerAuth()
@Controller('${kebab}')
export class ${pascal}Controller {
  constructor(private readonly ${camel}Service: ${pascal}Service) {}

  @Post()
  @ApiOperation({ summary: 'Create a ${singular.toLowerCase()}' })
  create(@Body() dto: Create${singular}Dto) {
    return this.${camel}Service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List ${pascal} with pagination' })
  findAll(@Query() query: PaginationDto) {
    return this.${camel}Service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get ${singular.toLowerCase()} by ID' })
  findOne(@Param('id') id: string) {
    return this.${camel}Service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update ${singular.toLowerCase()}' })
  update(@Param('id') id: string, @Body() dto: Update${singular}Dto) {
    return this.${camel}Service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete ${singular.toLowerCase()}' })
  async remove(@Param('id') id: string) {
    await this.${camel}Service.remove(id);
  }
}
`,
  );

  // module
  writeFile(
    path.join(baseDir, `${kebab}.module.ts`),
    `import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ${pascal}Controller } from './${kebab}.controller';
import { ${pascal}Service } from './${kebab}.service';
import { ${singular} } from './entities/${kebab}.entity';

@Module({
  imports: [TypeOrmModule.forFeature([${singular}])],
  controllers: [${pascal}Controller],
  providers: [${pascal}Service],
  exports: [${pascal}Service],
})
export class ${pascal}Module {}
`,
  );

  console.log(`
Module "${pascal}" generated at src/${kebab}/

Next steps:
  1. Add ${singular} entity to src/database/database.module.ts entities array
  2. Import ${pascal}Module in src/app.module.ts
  3. Customize the entity and DTOs
`);

  rl.close();
}

generate().catch((err) => {
  console.error(err);
  rl.close();
  process.exit(1);
});
