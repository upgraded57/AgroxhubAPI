import { HttpExceptions } from "./root";

export class UnauthorizedException extends HttpExceptions {
    constructor(message: string) {
        super(message, 401, null);
    }
}

