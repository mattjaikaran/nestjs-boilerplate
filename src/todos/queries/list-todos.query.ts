import type { PaginationDto } from '../../common/dto/pagination.dto';

export class ListTodosQuery {
  constructor(
    public readonly userId: string,
    public readonly pagination: PaginationDto,
  ) {}
}
