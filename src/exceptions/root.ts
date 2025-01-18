export class HttpExceptions extends Error {
    public statusCode: number;
    public errors: any;

    constructor(message: string, statusCode: number, errors: any = null) {
        super(message);
        this.message = message;
        this.statusCode = statusCode;
        this.errors = errors;

        Object.setPrototypeOf(this, HttpExceptions.prototype);
    }

}