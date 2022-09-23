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
const http_1 = __importDefault(require("http"));
const connect_gzip_static_1 = __importDefault(require("connect-gzip-static"));
const finalhandler_1 = __importDefault(require("finalhandler"));
const logger_1 = __importDefault(require("../util/logger"));
const zigbee2mqtt_frontend_1 = __importDefault(require("zigbee2mqtt-frontend"));
const ws_1 = __importDefault(require("ws"));
const url_1 = __importDefault(require("url"));
const settings = __importStar(require("../util/settings"));
const utils_1 = __importDefault(require("../util/utils"));
const json_stable_stringify_without_jsonify_1 = __importDefault(require("json-stable-stringify-without-jsonify"));
const extension_1 = __importDefault(require("./extension"));
const bind_decorator_1 = __importDefault(require("bind-decorator"));
/**
 * This extension servers the frontend
 */
class Frontend extends extension_1.default {
    constructor(zigbee, mqtt, state, publishEntityState, eventBus, enableDisableExtension, restartCallback, addExtension) {
        super(zigbee, mqtt, state, publishEntityState, eventBus, enableDisableExtension, restartCallback, addExtension);
        this.mqttBaseTopic = settings.get().mqtt.base_topic;
        this.host = settings.get().frontend.host;
        this.port = settings.get().frontend.port;
        this.authToken = settings.get().frontend.auth_token;
        this.retainedMessages = new Map();
        this.wss = null;
        this.eventBus.onMQTTMessagePublished(this, this.onMQTTPublishMessage);
    }
    async start() {
        this.server = http_1.default.createServer(this.onRequest);
        this.server.on('upgrade', this.onUpgrade);
        /* istanbul ignore next */
        const options = {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setHeaders: (res, path) => {
                if (path.endsWith('index.html')) {
                    res.setHeader('Cache-Control', 'no-store');
                }
            },
        };
        this.fileServer = connect_gzip_static_1.default(zigbee2mqtt_frontend_1.default.getPath(), options);
        this.wss = new ws_1.default.Server({ noServer: true });
        this.wss.on('connection', this.onWebSocketConnection);
        this.server.listen(this.port, this.host);
        logger_1.default.info(`Started frontend on port ${this.host}:${this.port}`);
    }
    async stop() {
        super.stop();
        for (const client of this.wss.clients) {
            client.send(json_stable_stringify_without_jsonify_1.default({ topic: 'bridge/state', payload: 'offline' }));
            client.terminate();
        }
        this.wss.close();
        return new Promise((cb) => this.server.close(cb));
    }
    onRequest(request, response) {
        // @ts-ignore
        this.fileServer(request, response, finalhandler_1.default(request, response));
    }
    authenticate(request, cb) {
        const { query } = url_1.default.parse(request.url, true);
        cb(!this.authToken || this.authToken === query.token);
    }
    onUpgrade(request, socket, head) {
        this.wss.handleUpgrade(request, socket, head, (ws) => {
            this.authenticate(request, (isAuthentificated) => {
                if (isAuthentificated) {
                    this.wss.emit('connection', ws, request);
                }
                else {
                    ws.close(4401, 'Unauthorized');
                }
            });
        });
    }
    onWebSocketConnection(ws) {
        ws.on('message', (data, isBinary) => {
            if (!isBinary && data) {
                const message = data.toString();
                const { topic, payload } = JSON.parse(message);
                this.mqtt.onMessage(`${this.mqttBaseTopic}/${topic}`, json_stable_stringify_without_jsonify_1.default(payload));
            }
        });
        for (const [key, value] of this.retainedMessages) {
            ws.send(json_stable_stringify_without_jsonify_1.default({ topic: key, payload: value }));
        }
        for (const device of this.zigbee.devices(false)) {
            const payload = this.state.get(device);
            const lastSeen = settings.get().advanced.last_seen;
            /* istanbul ignore if */
            if (lastSeen !== 'disable') {
                payload.last_seen = utils_1.default.formatDate(device.zh.lastSeen, lastSeen);
            }
            if (device.zh.linkquality !== undefined) {
                payload.linkquality = device.zh.linkquality;
            }
            ws.send(json_stable_stringify_without_jsonify_1.default({ topic: device.name, payload }));
        }
    }
    onMQTTPublishMessage(data) {
        if (data.topic.startsWith(`${this.mqttBaseTopic}/`)) {
            // Send topic without base_topic
            const topic = data.topic.substring(this.mqttBaseTopic.length + 1);
            const payload = utils_1.default.parseJSON(data.payload, data.payload);
            if (data.options.retain) {
                this.retainedMessages.set(topic, payload);
            }
            if (this.wss) {
                for (const client of this.wss.clients) {
                    /* istanbul ignore else */
                    if (client.readyState === ws_1.default.OPEN) {
                        client.send(json_stable_stringify_without_jsonify_1.default({ topic, payload }));
                    }
                }
            }
        }
    }
}
__decorate([
    bind_decorator_1.default
], Frontend.prototype, "onRequest", null);
__decorate([
    bind_decorator_1.default
], Frontend.prototype, "onUpgrade", null);
__decorate([
    bind_decorator_1.default
], Frontend.prototype, "onWebSocketConnection", null);
__decorate([
    bind_decorator_1.default
], Frontend.prototype, "onMQTTPublishMessage", null);
exports.default = Frontend;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZnJvbnRlbmQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9saWIvZXh0ZW5zaW9uL2Zyb250ZW5kLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGdEQUF3QjtBQUN4Qiw4RUFBK0Q7QUFDL0QsZ0VBQXdDO0FBQ3hDLDREQUFvQztBQUNwQyxnRkFBNEM7QUFDNUMsNENBQTJCO0FBRTNCLDhDQUFzQjtBQUN0QiwyREFBNkM7QUFDN0MsMERBQWtDO0FBQ2xDLGtIQUE4RDtBQUM5RCw0REFBb0M7QUFDcEMsb0VBQWtDO0FBRWxDOztHQUVHO0FBQ0gsTUFBcUIsUUFBUyxTQUFRLG1CQUFTO0lBVzNDLFlBQVksTUFBYyxFQUFFLElBQVUsRUFBRSxLQUFZLEVBQUUsa0JBQXNDLEVBQ3hGLFFBQWtCLEVBQUUsc0JBQXdFLEVBQzVGLGVBQTJCLEVBQUUsWUFBcUQ7UUFDbEYsS0FBSyxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLGtCQUFrQixFQUFFLFFBQVEsRUFBRSxzQkFBc0IsRUFBRSxlQUFlLEVBQUUsWUFBWSxDQUFDLENBQUM7UUFiNUcsa0JBQWEsR0FBRyxRQUFRLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQztRQUMvQyxTQUFJLEdBQUcsUUFBUSxDQUFDLEdBQUcsRUFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUM7UUFDcEMsU0FBSSxHQUFHLFFBQVEsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDO1FBQ3BDLGNBQVMsR0FBRyxRQUFRLENBQUMsR0FBRyxFQUFFLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQztRQUMvQyxxQkFBZ0IsR0FBRyxJQUFJLEdBQUcsRUFBRSxDQUFDO1FBSTdCLFFBQUcsR0FBcUIsSUFBSSxDQUFDO1FBTWpDLElBQUksQ0FBQyxRQUFRLENBQUMsc0JBQXNCLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxv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