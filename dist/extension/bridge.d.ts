import Extension from './extension';
import Device from '../model/device';
import Group from '../model/group';
declare type DefinitionPayload = {
    model: string;
    vendor: string;
    description: string;
    exposes: zhc.DefinitionExpose[];
    supports_ota: boolean;
    icon: string;
    options: zhc.DefinitionExpose[];
};
export default class Bridge extends Extension {
    private zigbee2mqttVersion;
    private coordinatorVersion;
    private restartRequired;
    private lastJoinedDeviceIeeeAddr;
    private requestLookup;
    override: any;
    start(): Promise<void>;
    onMQTTMessage(data: eventdata.MQTTMessage): Promise<void>;
    /**
     * Requests
     */
    deviceOptions(message: KeyValue | string): Promise<MQTTResponse>;
    groupOptions(message: KeyValue | string): Promise<MQTTResponse>;
    bridgeOptions(message: KeyValue | string): Promise<MQTTResponse>;
    deviceRemove(message: string | KeyValue): Promise<MQTTResponse>;
    groupRemove(message: string | KeyValue): Promise<MQTTResponse>;
    healthCheck(message: string | KeyValue): Promise<MQTTResponse>;
    groupAdd(message: string | KeyValue): Promise<MQTTResponse>;
    deviceRename(message: string | KeyValue): Promise<MQTTResponse>;
    groupRename(message: string | KeyValue): Promise<MQTTResponse>;
    restart(message: string | KeyValue): Promise<MQTTResponse>;
    backup(message: string | KeyValue): Promise<MQTTResponse>;
    permitJoin(message: KeyValue | string): Promise<MQTTResponse>;
    configLastSeen(message: KeyValue | string): Promise<MQTTResponse>;
    configHomeAssistant(message: string | KeyValue): Promise<MQTTResponse>;
    configElapsed(message: KeyValue | string): Promise<MQTTResponse>;
    configLogLevel(message: KeyValue | string): Promise<MQTTResponse>;
    touchlinkIdentify(message: KeyValue | string): Promise<MQTTResponse>;
    touchlinkFactoryReset(message: KeyValue | string): Promise<MQTTResponse>;
    touchlinkScan(message: KeyValue | string): Promise<MQTTResponse>;
    /**
     * Utils
     */
    getValue(message: KeyValue | string): string | boolean | number;
    changeEntityOptions(entityType: 'device' | 'group', message: KeyValue | string): Promise<MQTTResponse>;
    deviceConfigureReporting(message: string | KeyValue): Promise<MQTTResponse>;
    renameEntity(entityType: 'group' | 'device', message: string | KeyValue): Promise<MQTTResponse>;
    removeEntity(entityType: 'group' | 'device', message: string | KeyValue): Promise<MQTTResponse>;
    getEntity(type: 'group' | 'device', ID: string): Device | Group;
    publishInfo(): Promise<void>;
    private getScenes;
    publishDevices(): Promise<void>;
    publishGroups(): Promise<void>;
    getDefinitionPayload(device: Device): DefinitionPayload;
}
export {};
//# sourceMappingURL=bridge.d.ts.map