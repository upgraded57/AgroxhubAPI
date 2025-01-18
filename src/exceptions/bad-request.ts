import { HttpExceptions } from "./root";

export class BadRequestException extends HttpExceptions {

    constructor(message: string) {
        super(message, 400, null);
    }
}