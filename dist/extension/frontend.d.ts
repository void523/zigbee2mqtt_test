import Extension from './extension';
/**
 * This extension servers the frontend
 */
export default class Frontend extends Extension {
    private mqttBaseTopic;
    private host;
    private port;
    private authToken;
    private retainedMessages;
    private server;
    private fileServer;
    private wss;
    constructor(zigbee: Zigbee, mqtt: MQTT, state: State, publishEntityState: PublishEntityState, eventBus: EventBus, enableDisableExtension: (enable: boolean, name: string) => Promise<void>, restartCallback: () => void, addExtension: (extension: Extension) => Promise<void>);
    override: any;
    start(): Promise<void>;
    override: any;
    stop(): Promise<void>;
    private onRequest;
    private authenticate;
    private onUpgrade;
    private onWebSocketConnection;
    private onMQTTPublishMessage;
}
//# sourceMappingURL=frontend.d.ts.map