import Extension from './extension';
/**
 * This extensions handles integration with HomeAssistant
 */
export default class HomeAssistant extends Extension {
    private discovered;
    private discoveredTriggers;
    private discoveryTopic;
    private statusTopic;
    private entityAttributes;
    private zigbee2MQTTVersion;
    constructor(zigbee: Zigbee, mqtt: MQTT, state: State, publishEntityState: PublishEntityState, eventBus: EventBus, enableDisableExtension: (enable: boolean, name: string) => Promise<void>, restartCallback: () => void, addExtension: (extension: Extension) => Promise<void>);
    override: any;
    start(): Promise<void>;
    private exposeToConfig;
    onDeviceRemoved(data: eventdata.DeviceRemoved): void;
    onGroupMembersChanged(data: eventdata.GroupMembersChanged): void;
    onPublishEntityState(data: eventdata.PublishEntityState): Promise<void>;
    onEntityRenamed(data: eventdata.EntityRenamed): Promise<void>;
    private getConfigs;
    private getDiscoverKey;
    private discover;
    private onMQTTMessage;
    onZigbeeEvent(data: {
        device: Device;
    }): void;
    private getDevicePayload;
    override: any;
    adjustMessageBeforePublish(entity: Device | Group, message: KeyValue): void;
    private getEncodedBaseTopic;
    private getDiscoveryTopic;
    private publishDeviceTriggerDiscover;
    _clearDiscoveredTrigger(): void;
}
//# sourceMappingURL=homeassistant.d.ts.map