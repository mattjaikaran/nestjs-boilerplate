export class DeleteTodoCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
  ) {}
}
