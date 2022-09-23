import Extension from './extension';
import Group from '../model/group';
import Device from '../model/device';
interface ParsedTopic {
    ID: string;
    endpoint: string;
    attribute: string;
    type: 'get' | 'set';
}
export default class Publish extends Extension {
    start(): Promise<void>;
    parseTopic(topic: string): ParsedTopic | null;
    parseMessage(parsedTopic: ParsedTopic, data: eventdata.MQTTMessage): KeyValue | null;
    legacyLog(payload: KeyValue): void;
    legacyRetrieveState(re: Device | Group, converter: zhc.ToZigbeeConverter, result: zhc.ToZigbeeConverterResult, target: zh.Endpoint | zh.Group, key: string, meta: zhc.ToZigbeeConverterGetMeta): void;
    updateMessageHomeAssistant(message: KeyValue, entityState: KeyValue): void;
    onMQTTMessage(data: eventdata.MQTTMessage): Promise<void>;
}
export {};
//# sourceMappingURL=publish.d.ts.map