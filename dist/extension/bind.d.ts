import Extension from './extension';
export default class Bind extends Extension {
    private pollDebouncers;
    override: any;
    start(): Promise<void>;
    private parseMQTTMessage;
    private onMQTTMessage;
    onGroupMembersChanged(data: eventdata.GroupMembersChanged): Promise<void>;
    getSetupReportingEndpoints(bind: zh.Bind, coordinatorEp: zh.Endpoint): zh.Endpoint[];
    setupReporting(binds: zh.Bind[]): Promise<void>;
    disableUnnecessaryReportings(target: zh.Group | zh.Endpoint): Promise<void>;
    poll(data: eventdata.DeviceMessage): Promise<void>;
}
//# sourceMappingURL=bind.d.ts.map