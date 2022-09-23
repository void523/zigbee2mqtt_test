export default class Device {
    zh: zh.Device;
    private _definition;
    private _definitionModelID;
    get ieeeAddr(): string;
    get ID(): string;
    get options(): DeviceOptions;
    get name(): string;
    get definition(): zhc.Definition;
    constructor(device: zh.Device);
    exposes(): zhc.DefinitionExpose[];
    ensureInSettings(): void;
    endpoint(key?: string | number): zh.Endpoint;
    endpointName(endpoint: zh.Endpoint): string;
    isIkeaTradfri(): boolean;
    isDevice(): this is Device;
    isGroup(): this is Group;
}
//# sourceMappingURL=device.d.ts.map