"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const mqtt_1 = __importDefault(require("mqtt"));
const logger_1 = __importDefault(require("./util/logger"));
const settings = __importStar(require("./util/settings"));
const utils_1 = __importDefault(require("./util/utils"));
const fs_1 = __importDefault(require("fs"));
const bind_decorator_1 = __importDefault(require("bind-decorator"));
class MQTT {
    constructor(eventBus) {
        this.publishedTopics = new Set();
        this.initialConnect = true;
        this.retainedMessages = {};
        this.eventBus = eventBus;
    }
    async connect() {
        const mqttSettings = settings.get().mqtt;
        logger_1.default.info(`Connecting to MQTT server at ${mqttSettings.server}`);
        const options = {
            will: {
                topic: `${settings.get().mqtt.base_topic}/bridge/state`,
                payload: utils_1.default.availabilityPayload('offline', settings.get()),
                retain: settings.get().mqtt.force_disable_retain ? false : true,
                qos: 1,
            },
        };
        if (mqttSettings.version) {
            options.protocolVersion = mqttSettings.version;
        }
        if (mqttSettings.keepalive) {
            logger_1.default.debug(`Using MQTT keepalive: ${mqttSettings.keepalive}`);
            options.keepalive = mqttSettings.keepalive;
        }
        if (mqttSettings.ca) {
            logger_1.default.debug(`MQTT SSL/TLS: Path to CA certificate = ${mqttSettings.ca}`);
            options.ca = fs_1.default.readFileSync(mqttSettings.ca);
        }
        if (mqttSettings.key && mqttSettings.cert) {
            logger_1.default.debug(`MQTT SSL/TLS: Path to client key = ${mqttSettings.key}`);
            logger_1.default.debug(`MQTT SSL/TLS: Path to client certificate = ${mqttSettings.cert}`);
            options.key = fs_1.default.readFileSync(mqttSettings.key);
            options.cert = fs_1.default.readFileSync(mqttSettings.cert);
        }
        if (mqttSettings.user && mqttSettings.password) {
            logger_1.default.debug(`Using MQTT login with username: ${mqttSettings.user}`);
            options.username = mqttSettings.user;
            options.password = mqttSettings.password;
        }
        else {
            logger_1.default.debug(`Using MQTT anonymous login`);
        }
        if (mqttSettings.client_id) {
            logger_1.default.debug(`Using MQTT client ID: '${mqttSettings.client_id}'`);
            options.clientId = mqttSettings.client_id;
        }
        if (mqttSettings.hasOwnProperty('reject_unauthorized') && !mqttSettings.reject_unauthorized) {
            logger_1.default.debug(`MQTT reject_unauthorized set false, ignoring certificate warnings.`);
            options.rejectUnauthorized = false;
        }
        return new Promise((resolve, reject) => {
            this.client = mqtt_1.default.connect(mqttSettings.server, options);
            // @ts-ignore https://github.com/Koenkk/zigbee2mqtt/issues/9822
            this.client.stream.setMaxListeners(0);
            this.eventBus.onPublishAvailability(this, () => this.publishStateOnline());
            const onConnect = this.onConnect;
            this.client.on('connect', async () => {
                await onConnect();
                resolve();
            });
            this.client.on('error', (err) => reject(err));
            this.client.on('message', this.onMessage);
        });
    }
    async onConnect() {
        // Set timer at interval to check if connected to MQTT server.
        clearTimeout(this.connectionTimer);
        this.connectionTimer = setInterval(() => {
            if (this.client.reconnecting) {
                logger_1.default.error('Not connected to MQTT server!');
            }
        }, utils_1.default.seconds(10));
        logger_1.default.info('Connected to MQTT server');
        await this.publishStateOnline();
        if (!this.initialConnect) {
            this.republishRetainedTimer = setTimeout(() => {
                // Republish retained messages in case MQTT broker does not persist them.
                // https://github.com/Koenkk/zigbee2mqtt/issues/9629
                Object.values(this.retainedMessages).forEach((e) => this.publish(e.topic, e.payload, e.options, e.base, e.skipLog, e.skipReceive));
            }, 2000);
        }
        this.initialConnect = false;
        this.subscribe(`${settings.get().mqtt.base_topic}/#`);
    }
    async publishStateOnline() {
        await this.publish('bridge/state', utils_1.default.availabilityPayload('online', settings.get()), { retain: true, qos: 0 });
    }
    async disconnect() {
        clearTimeout(this.connectionTimer);
        await this.publish('bridge/state', utils_1.default.availabilityPayload('offline', settings.get()), { retain: true, qos: 0 });
        this.eventBus.removeListeners(this);
        logger_1.default.info('Disconnecting from MQTT server');
        this.client.end();
    }
    subscribe(topic) {
        this.client.subscribe(topic);
    }
    onMessage(topic, message) {
        // Since we subscribe to zigbee2mqtt/# we also receive the message we send ourselves, skip these.
        if (!this.publishedTopics.has(topic)) {
            logger_1.default.debug(`Received MQTT message on '${topic}' with data '${message}'`);
            this.eventBus.emitMQTTMessage({ topic, message: message + '' });
        }
        if (this.republishRetainedTimer && topic == `${settings.get().mqtt.base_topic}/bridge/state`) {
            clearTimeout(this.republishRetainedTimer);
            this.republishRetainedTimer = null;
        }
    }
    isConnected() {
        return this.client && !this.client.reconnecting;
    }
    async publish(topic, payload, options = {}, base = settings.get().mqtt.base_topic, skipLog = false, skipReceive = true) {
        const defaultOptions = { qos: 0, retain: false };
        topic = `${base}/${topic}`;
        if (skipReceive) {
            this.publishedTopics.add(topic);
        }
        if (options.retain) {
            if (payload) {
                this.retainedMessages[topic] =
                    { payload, options, skipReceive, skipLog, topic: topic.substring(base.length + 1), base };
            }
            else {
                delete this.retainedMessages[topic];
            }
        }
        this.eventBus.emitMQTTMessagePublished({ topic, payload, options: { ...defaultOptions, ...options } });
        if (!this.isConnected()) {
            if (!skipLog) {
                logger_1.default.error(`Not connected to MQTT server!`);
                logger_1.default.error(`Cannot send message: topic: '${topic}', payload: '${payload}`);
            }
            return;
        }
        if (!skipLog) {
            logger_1.default.info(`MQTT publish: topic '${topic}', payload '${payload}'`);
        }
        const actualOptions = { ...defaultOptions, ...options };
        if (settings.get().mqtt.force_disable_retain) {
            actualOptions.retain = false;
        }
        return new Promise((resolve) => {
            this.client.publish(topic, payload, actualOptions, () => resolve());
        });
    }
}
__decorate([
    bind_decorator_1.default
], MQTT.prototype, "onConnect", null);
__decorate([
    bind_decorator_1.default
], MQTT.prototype, "onMessage", null);
exports.default = MQTT;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibXF0dC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL2xpYi9tcXR0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGdEQUF3QjtBQUN4QiwyREFBbUM7QUFDbkMsMERBQTRDO0FBQzVDLHlEQUFpQztBQUNqQyw0Q0FBb0I7QUFDcEIsb0VBQWtDO0FBRWxDLE1BQXFCLElBQUk7SUFVckIsWUFBWSxRQUFrQjtRQVR0QixvQkFBZSxHQUFnQixJQUFJLEdBQUcsRUFBRSxDQUFDO1FBSXpDLG1CQUFjLEdBQUcsSUFBSSxDQUFDO1FBRXRCLHFCQUFnQixHQUNvRCxFQUFFLENBQUM7UUFHM0UsSUFBSSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7SUFDN0IsQ0FBQztJQUVELEtBQUssQ0FBQyxPQUFPO1FBQ1QsTUFBTSxZQUFZLEdBQUcsUUFBUSxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQztRQUN6QyxnQkFBTSxDQUFDLElBQUksQ0FBQyxnQ0FBZ0MsWUFBWSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7UUFFbkUsTUFBTSxPQUFPLEdBQXdCO1lBQ2pDLElBQUksRUFBRTtnQkFDRixLQUFLLEVBQUUsR0FBRyxRQUFRLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLFVBQVUsZUFBZTtnQkFDdkQsT0FBTyxFQUFFLGVBQUssQ0FBQyxtQkFBbUIsQ0FBQyxTQUFTLEVBQUUsUUFBUSxDQUFDLEdBQUcsRUFBRSxDQUFDO2dCQUM3RCxNQUFNLEVBQUUsUUFBUSxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJO2dCQUMvRCxHQUFHLEVBQUUsQ0FBQzthQUNUO1NBQ0osQ0FBQztRQUVGLElBQUksWUFBWSxDQUFDLE9BQU8sRUFBRTtZQUN0QixPQUFPLENBQUMsZUFBZSxHQUFHLFlBQVksQ0FBQyxPQUFPLENBQUM7U0FD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