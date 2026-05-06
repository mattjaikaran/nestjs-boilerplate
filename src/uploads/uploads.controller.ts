import { BadRequestException, Controller, Post, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { ErrorResponseDto, UploadedFileResponseDto } from '../common/dto/swagger.dto';
import { UploadsService } from './uploads.service';

@ApiTags('Uploads')
@ApiBearerAuth()
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('avatar')
  @ApiOperation({ summary: 'Upload user avatar (image only)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Avatar uploaded', type: UploadedFileResponseDto })
  @ApiResponse({
    status: 400,
    description: 'No file, invalid type, or file too large',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
  async uploadAvatar(@Req() req: FastifyRequest) {
    const file = await req.file();
    if (!file) throw new BadRequestException('No file provided');
    return this.uploadsService.saveFile(file, 'avatars');
  }

  @Post()
  @ApiOperation({ summary: 'Upload a file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'File uploaded', type: UploadedFileResponseDto })
  @ApiResponse({
    status: 400,
    description: 'No file, invalid type, or file too large',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
  async uploadFile(@Req() req: FastifyRequest) {
    const file = await req.file();
    if (!file) throw new BadRequestException('No file provided');
    return this.uploadsService.saveFile(file);
  }

  @Post('multiple')
  @ApiOperation({ summary: 'Upload multiple files (max 5)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Files uploaded', type: [UploadedFileResponseDto] })
  @ApiResponse({
    status: 400,
    description: 'No files, invalid type, or file too large',
    type: ErrorResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
  async uploadMultiple(@Req() req: FastifyRequest) {
    const parts = req.files({ limits: { files: 5 } });
    const results = [];

    for await (const file of parts) {
      results.push(await this.uploadsService.saveFile(file));
    }

    if (results.length === 0) throw new BadRequestException('No files provided');
    return results;
  }
}
