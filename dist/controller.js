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
const mqtt_1 = __importDefault(require("./mqtt"));
const zigbee_1 = __importDefault(require("./zigbee"));
const eventBus_1 = __importDefault(require("./eventBus"));
const state_1 = __importDefault(require("./state"));
const logger_1 = __importDefault(require("./util/logger"));
const settings = __importStar(require("./util/settings"));
const utils_1 = __importDefault(require("./util/utils"));
const json_stable_stringify_without_jsonify_1 = __importDefault(require("json-stable-stringify-without-jsonify"));
const assert_1 = __importDefault(require("assert"));
const bind_decorator_1 = __importDefault(require("bind-decorator"));
// Extensions
const frontend_1 = __importDefault(require("./extension/frontend"));
const publish_1 = __importDefault(require("./extension/publish"));
const receive_1 = __importDefault(require("./extension/receive"));
const networkMap_1 = __importDefault(require("./extension/networkMap"));
const softReset_1 = __importDefault(require("./extension/legacy/softReset"));
const homeassistant_1 = __importDefault(require("./extension/homeassistant"));
const configure_1 = __importDefault(require("./extension/configure"));
const deviceGroupMembership_1 = __importDefault(require("./extension/legacy/deviceGroupMembership"));
const bridgeLegacy_1 = __importDefault(require("./extension/legacy/bridgeLegacy"));
const bridge_1 = __importDefault(require("./extension/bridge"));
const groups_1 = __importDefault(require("./extension/groups"));
const availability_1 = __importDefault(require("./extension/availability"));
const bind_1 = __importDefault(require("./extension/bind"));
const report_1 = __importDefault(require("./extension/legacy/report"));
const onEvent_1 = __importDefault(require("./extension/onEvent"));
const otaUpdate_1 = __importDefault(require("./extension/otaUpdate"));
const externalConverters_1 = __importDefault(require("./extension/externalConverters"));
const externalExtension_1 = __importDefault(require("./extension/externalExtension"));
const AllExtensions = [
    publish_1.default, receive_1.default, networkMap_1.default, softReset_1.default, homeassistant_1.default,
    configure_1.default, deviceGroupMembership_1.default, bridgeLegacy_1.default, bridge_1.default, groups_1.default,
    bind_1.default, report_1.default, onEvent_1.default, otaUpdate_1.default,
    externalConverters_1.default, frontend_1.default, externalExtension_1.default, availability_1.default,
];
class Controller {
    constructor(restartCallback, exitCallback) {
        logger_1.default.init();
        this.eventBus = new eventBus_1.default(/* istanbul ignore next */ (error) => {
            logger_1.default.error(`Error: ${error.message}`);
            logger_1.default.debug(error.stack);
        });
        this.zigbee = new zigbee_1.default(this.eventBus);
        this.mqtt = new mqtt_1.default(this.eventBus);
        this.state = new state_1.default(this.eventBus);
        this.restartCallback = restartCallback;
        this.exitCallback = exitCallback;
        // Initialize extensions.
        this.extensionArgs = [this.zigbee, this.mqtt, this.state, this.publishEntityState, this.eventBus,
            this.enableDisableExtension, this.restartCallback, this.addExtension];
        this.extensions = [
            new bridge_1.default(...this.extensionArgs),
            new publish_1.default(...this.extensionArgs),
            new receive_1.default(...this.extensionArgs),
            new deviceGroupMembership_1.default(...this.extensionArgs),
            new configure_1.default(...this.extensionArgs),
            new networkMap_1.default(...this.extensionArgs),
            new groups_1.default(...this.extensionArgs),
            new bind_1.default(...this.extensionArgs),
            new onEvent_1.default(...this.extensionArgs),
            new otaUpdate_1.default(...this.extensionArgs),
            new report_1.default(...this.extensionArgs),
            new externalExtension_1.default(...this.extensionArgs),
            new availability_1.default(...this.extensionArgs),
            settings.get().frontend && new frontend_1.default(...this.extensionArgs),
            settings.get().advanced.legacy_api && new bridgeLegacy_1.default(...this.extensionArgs),
            settings.get().external_converters.length && new externalConverters_1.default(...this.extensionArgs),
            settings.get().homeassistant && new homeassistant_1.default(...this.extensionArgs),
            /* istanbul ignore next */
            settings.get().advanced.soft_reset_timeout !== 0 && new softReset_1.default(...this.extensionArgs),
        ].filter((n) => n);
    }
    async start() {
        this.state.start();
        logger_1.default.logOutput();
        const info = await utils_1.default.getZigbee2MQTTVersion();
        logger_1.default.info(`Starting Zigbee2MQTT version ${info.version} (commit #${info.commitHash})`);
        // Start zigbee
        let startResult;
        try {
            startResult = await this.zigbee.start();
            this.eventBus.onAdapterDisconnected(this, this.onZigbeeAdapterDisconnected);
        }
        catch (error) {
            logger_1.default.error('Failed to start zigbee');
            logger_1.default.error('Check https://www.zigbee2mqtt.io/guide/installation/20_zigbee2mqtt-fails-to-start.html for possible solutions'); /* eslint-disable-line max-len */
            logger_1.default.error('Exiting...');
            logger_1.default.error(error.stack);
            await this.exit(1);
        }
        // Disable some legacy options on new network creation
        if (startResult === 'reset') {
            settings.set(['advanced', 'homeassistant_legacy_entity_attributes'], false);
            settings.set(['advanced', 'legacy_api'], false);
            settings.set(['advanced', 'legacy_availability_payload'], false);
            settings.set(['device_options', 'legacy'], false);
            this.enableDisableExtension(false, 'BridgeLegacy');
        }
        // Log zigbee clients on startup
        const devices = this.zigbee.devices(false);
        logger_1.default.info(`Currently ${devices.length} devices are joined:`);
        for (const device of devices) {
            const model = device.definition ?
                `${device.definition.model} - ${device.definition.vendor} ${device.definition.description}` :
                'Not supported';
            logger_1.default.info(`${device.name} (${device.ieeeAddr}): ${model} (${device.zh.type})`);
        }
        // Enable zigbee join
        try {
            if (settings.get().permit_join) {
                logger_1.default.warn('`permit_join` set to  `true` in configuration.yaml.');
                logger_1.default.warn('Allowing new devices to join.');
                logger_1.default.warn('Set `permit_join` to `false` once you joined all devices.');
            }
            await this.zigbee.permitJoin(settings.get().permit_join);
        }
        catch (error) {
            logger_1.default.error(`Failed to set permit join to ${settings.get().permit_join}`);
        }
        // MQTT
        try {
            await this.mqtt.connect();
        }
        catch (error) {
            logger_1.default.error(`MQTT failed to connect: ${error.message}`);
            logger_1.default.error('Exiting...');
            await this.zigbee.stop();
            await this.exit(1);
        }
        // Call extensions
        await this.callExtensions('start', [...this.extensions]);
        // Send all cached states.
        if (settings.get().advanced.cache_state_send_on_startup && settings.get().advanced.cache_state) {
            for (const entity of [...devices, ...this.zigbee.groups()]) {
                if (this.state.exists(entity)) {
                    this.publishEntityState(entity, this.state.get(entity), 'publishCached');
                }
            }
        }
        this.eventBus.onLastSeenChanged(this, (data) => utils_1.default.publishLastSeen(data, settings.get(), false, this.publishEntityState));
    }
    async enableDisableExtension(enable, name) {
        if (!enable) {
            const extension = this.extensions.find((e) => e.constructor.name === name);
            if (extension) {
                await this.callExtensions('stop', [extension]);
                this.extensions.splice(this.extensions.indexOf(extension), 1);
            }
        }
        else {
            const Extension = AllExtensions.find((e) => e.name === name);
            assert_1.default(Extension, `Extension '${name}' does not exist`);
            const extension = new Extension(...this.extensionArgs);
            this.extensions.push(extension);
            await this.callExtensions('start', [extension]);
        }
    }
    async addExtension(extension) {
        this.extensions.push(extension);
        await this.callExtensions('start', [extension]);
    }
    async stop(restart = false) {
        // Call extensions
        await this.callExtensions('stop', this.extensions);
        this.eventBus.removeListeners(this);
        // Wrap-up
        this.state.stop();
        await this.mqtt.disconnect();
        try {
            await this.zigbee.stop();
            logger_1.default.info('Stopped Zigbee2MQTT');
            await this.exit(0, restart);
        }
        catch (error) {
            logger_1.default.error('Failed to stop Zigbee2MQTT');
            await this.exit(1, restart);
        }
    }
    async exit(code, restart = false) {
        await logger_1.default.end();
        this.exitCallback(code, restart);
    }
    async onZigbeeAdapterDisconnected() {
        logger_1.default.error('Adapter disconnected, stopping');
        await this.stop();
    }
    async publishEntityState(entity, payload, stateChangeReason) {
        var _a;
        let message = { ...payload };
        // Update state cache with new state.
        const newState = this.state.set(entity, payload, stateChangeReason);
        if (settings.get().advanced.cache_state) {
            // Add cached state to payload
            message = newState;
        }
        const options = {
            retain: utils_1.default.getObjectProperty(entity.options, 'retain', false),
            qos: utils_1.default.getObjectProperty(entity.options, 'qos', 0),
        };
        const retention = utils_1.default.getObjectProperty(entity.options, 'retention', false);
        if (retention !== false) {
            options.properties = { messageExpiryInterval: retention };
        }
        if (entity.isDevice() && settings.get().mqtt.include_device_information) {
            message.device = {
                friendlyName: entity.name, model: entity.definition ? entity.definition.model : 'unknown',
                ieeeAddr: entity.ieeeAddr, networkAddress: entity.zh.networkAddress, type: entity.zh.type,
                manufacturerID: entity.zh.manufacturerID, manufacturerName: entity.zh.manufacturerName,
                powerSource: entity.zh.powerSource, applicationVersion: entity.zh.applicationVersion,
                stackVersion: entity.zh.stackVersion, zclVersion: entity.zh.zclVersion,
                hardwareVersion: entity.zh.hardwareVersion, dateCode: entity.zh.dateCode,
                softwareBuildID: entity.zh.softwareBuildID,
            };
        }
        // Add lastseen
        const lastSeen = settings.get().advanced.last_seen;
        if (entity.isDevice() && lastSeen !== 'disable' && entity.zh.lastSeen) {
            message.last_seen = utils_1.default.formatDate(entity.zh.lastSeen, lastSeen);
        }
        // Add device linkquality.
        if (entity.isDevice() && entity.zh.linkquality !== undefined) {
            message.linkquality = entity.zh.linkquality;
        }
        for (const extension of this.extensions) {
            (_a = extension.adjustMessageBeforePublish) === null || _a === void 0 ? void 0 : _a.call(extension, entity, message);
        }
        // Filter mqtt message attributes
        utils_1.default.filterProperties(entity.options.filtered_attributes, message);
        if (Object.entries(message).length) {
            const output = settings.get().advanced.output;
            if (output === 'attribute_and_json' || output === 'json') {
                await this.mqtt.publish(entity.name, json_stable_stringify_without_jsonify_1.default(message), options);
            }
            if (output === 'attribute_and_json' || output === 'attribute') {
                await this.iteratePayloadAttributeOutput(`${entity.name}/`, message, options);
            }
        }
        this.eventBus.emitPublishEntityState({ entity, message, stateChangeReason, payload });
    }
    async iteratePayloadAttributeOutput(topicRoot, payload, options) {
        for (const [key, value] of Object.entries(payload)) {
            let subPayload = value;
            let message = null;
            // Special cases
            if (key === 'color' && utils_1.default.objectHasProperties(subPayload, ['r', 'g', 'b'])) {
                subPayload = [subPayload.r, subPayload.g, subPayload.b];
            }
            // Check Array first, since it is also an Object
            if (subPayload === null || subPayload === undefined) {
                message = '';
            }
            else if (Array.isArray(subPayload)) {
                message = subPayload.map((x) => `${x}`).join(',');
            }
            else if (typeof subPayload === 'object') {
                await this.iteratePayloadAttributeOutput(`${topicRoot}${key}-`, subPayload, options);
            }
            else {
                message = typeof subPayload === 'string' ? subPayload : json_stable_stringify_without_jsonify_1.default(subPayload);
            }
            if (message !== null) {
                await this.mqtt.publish(`${topicRoot}${key}`, message, options);
            }
        }
    }
    async callExtensions(method, extensions) {
        var _a;
        for (const extension of extensions) {
            try {
                await ((_a = extension[method]) === null || _a === void 0 ? void 0 : _a.call(extension));
            }
            catch (error) {
                /* istanbul ignore next */
                logger_1.default.error(`Failed to call '${extension.constructor.name}' '${method}' (${error.stack})`);
            }
        }
    }
}
__decorate([
    bind_decorator_1.default
], Controller.prototype, "enableDisableExtension", null);
__decorate([
    bind_decorator_1.default
], Controller.prototype, "addExtension", null);
__decorate([
    bind_decorator_1.default
], Controller.prototype, "onZigbeeAdapterDisconnected", null);
__decorate([
    bind_decorator_1.default
], Controller.prototype, "publishEntityState", null);
module.exports = Controller;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udHJvbGxlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL2xpYi9jb250cm9sbGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGtEQUEwQjtBQUMxQixzREFBOEI7QUFDOUIsMERBQWtDO0FBQ2xDLG9EQUE0QjtBQUM1QiwyREFBbUM7QUFDbkMsMERBQTRDO0FBQzVDLHlEQUFpQztBQUNqQyxrSEFBOEQ7QUFDOUQsb0RBQTRCO0FBQzVCLG9FQUFrQztBQUVsQyxhQUFhO0FBQ2Isb0VBQXFEO0FBQ3JELGtFQUFtRDtBQUNuRCxrRUFBbUQ7QUFDbkQsd0VBQXlEO0FBQ3pELDZFQUE4RDtBQUM5RCw4RUFBK0Q7QUFDL0Qsc0VBQXVEO0FBQ3ZELHFHQUFzRjtBQUN0RixtRkFBb0U7QUFDcEUsZ0VBQWlEO0FBQ2pELGdFQUFpRDtBQUNqRCw0RUFBNkQ7QUFDN0QsNERBQTZDO0FBQzdDLHVFQUF3RDtBQUN4RCxrRUFBbUQ7QUFDbkQsc0VBQXVEO0FBQ3ZELHdGQUF5RTtBQUN6RSxzRkFBdUU7QUFFdkUsTUFBTSxhQUFhLEdBQUc7SUFDbEIsaUJBQWdCLEVBQUUsaUJBQWdCLEVBQUUsb0JBQW1CLEVBQUUsbUJBQWtCLEVBQUUsdUJBQXNCO0lBQ25HLG1CQUFrQixFQUFFLCtCQUE4QixFQUFFLHNCQUFxQixFQUFFLGdCQUFlLEVBQUUsZ0JBQWU7SUFDM0csY0FBYSxFQUFFLGdCQUFlLEVBQUUsaUJBQWdCLEVBQUUsbUJBQWtCO0lBQ3BFLDRCQUEyQixFQUFFLGtCQUFpQixFQUFFLDJCQUEwQixFQUFFLHNCQUFxQjtDQUNwRyxDQUFDO0FBS0YsTUFBTSxVQUFVO0lBVVosWUFBWSxlQUEyQixFQUFFLFlBQW9DO1FBQ3pFLGdCQUFNLENBQUMsSUFBSSxFQUFFLENBQUM7UUFDZCxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksa0JBQVEsQ0FBRSwwQkFBMEIsQ0FBQyxDQUFDLEtBQUssRUFBRSxFQUFFO1lBQy9E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