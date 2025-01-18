import { HttpExceptions } from "./root";

export class ServerException extends HttpExceptions {
    constructor(message: string, error: any = null) {
        super(message, 500, error);
    }
}