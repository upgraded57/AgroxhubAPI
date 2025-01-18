import { HttpExceptions } from "./root";

export class NotFoundException extends HttpExceptions {
    constructor(message: string) {
        super(message, 404, null);
    }
}
