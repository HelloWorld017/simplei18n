declare type StringInterpolation = {
    name: 'StringInterpolation';
    content: string;
};
declare type Tag = {
    name: 'Tag';
    tagName: string;
    content: Atom[];
};
declare type Atom = string | StringInterpolation | Tag;
declare type ParsedI18n = {
    [Key in string]: Atom[] | ParsedI18n;
};
export declare const parse: (text: string) => ParsedI18n;
export declare const load: (text: string) => string;
export {};
