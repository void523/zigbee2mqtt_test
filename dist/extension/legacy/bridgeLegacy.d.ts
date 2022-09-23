import Extension from '../extension';
export default class BridgeLegacy extends Extension {
    private lastJoinedDeviceName;
    private supportedOptions;
    override: any;
    start(): Promise<void>;
    whitelist(topic: string, message: string): void;
    deviceOptions(topic: string, message: string): void;
    permitJoin(topic: string, message: string): Promise<void>;
    reset(): Promise<void>;
    lastSeen(topic: string, message: string): void;
    elapsed(topic: string, message: string): void;
    logLevel(topic: string, message: string): void;
    devices(topic: string): Promise<void>;
    groups(): void;
    rename(topic: string, message: string): void;
    renameLast(topic: string, message: string): void;
    _renameInternal(from: string, to: string): void;
    addGroup(topic: string, message: string): void;
    removeGroup(topic: string, message: string): void;
    forceRemove(topic: string, message: string): Promise<void>;
    remove(topic: string, message: string): Promise<void>;
    ban(topic: string, message: string): Promise<void>;
    removeForceRemoveOrBan(action: string, message: string): Promise<void>;
    onMQTTMessage(data: eventdata.MQTTMessage): Promise<void>;
    publish(): Promise<void>;
    onZigbeeEvent_(type: string, data: KeyValue, resolvedEntity: Device): void;
    touchlinkFactoryReset(): Promise<void>;
}
//# sourceMappingURL=bridgeLegacy.d.ts.map