import Extension from '../extension';
export default class DeviceGroupMembership extends Extension {
    override: any;
    start(): Promise<void>;
    onMQTTMessage(data: eventdata.MQTTMessage): Promise<void>;
}
//# sourceMappingURL=deviceGroupMembership.d.ts.map