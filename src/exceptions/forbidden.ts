import { HttpExceptions } from "./root";

export class ForbiddenException extends HttpExceptions {
  constructor(message: string) {
    super(message, 403, null);
  }
}
