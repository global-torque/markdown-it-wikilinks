interface UrlParts {
    scheme?: string;
    host?: string;
    root?: '/' | null;
    dirs?: string[];
    file?: string;
    hash?: string;
}
export declare class Url {
    readonly scheme?: string;
    readonly host?: string;
    readonly root?: '/' | null;
    readonly dirs?: string[];
    readonly file?: string;
    readonly hash?: string;
    constructor(input?: string | UrlParts);
    set(patch: UrlParts): Url;
    toString(): string;
}
export default Url;
//# sourceMappingURL=url.d.ts.map