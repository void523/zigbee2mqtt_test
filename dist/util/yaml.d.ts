declare function read(file: string): KeyValue;
declare function readIfExists(file: string, default_?: KeyValue): KeyValue;
declare function writeIfChanged(file: string, content: KeyValue): void;
declare function updateIfChanged(file: string, key: string, value: KeyValue): void;
declare const _default: {
    read: typeof read;
    readIfExists: typeof readIfExists;
    updateIfChanged: typeof updateIfChanged;
    writeIfChanged: typeof writeIfChanged;
};
export default _default;
//# sourceMappingURL=yaml.d.ts.map