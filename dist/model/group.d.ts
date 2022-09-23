export default class Group {
    zh: zh.Group;
    private resolveDevice;
    get ID(): number;
    get options(): GroupOptions;
    get name(): string;
    constructor(group: zh.Group, resolveDevice: (ieeeAddr: string) => Device);
    hasMember(device: Device): boolean;
    membersDevices(): Device[];
    membersDefinitions(): zhc.Definition[];
    isDevice(): this is Device;
    isGroup(): this is Group;
}
//# sourceMappingURL=group.d.ts.map