"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const settings = __importStar(require("../util/settings"));
const logger_1 = __importDefault(require("../util/logger"));
const json_stable_stringify_without_jsonify_1 = __importDefault(require("json-stable-stringify-without-jsonify"));
const utils_1 = __importDefault(require("../util/utils"));
const tradfri_1 = __importDefault(require("zigbee-herdsman-converters/lib/ota/tradfri"));
const zigbeeOTA_1 = __importDefault(require("zigbee-herdsman-converters/lib/ota/zigbeeOTA"));
const extension_1 = __importDefault(require("./extension"));
const bind_decorator_1 = __importDefault(require("bind-decorator"));
const device_1 = __importDefault(require("../model/device"));
const data_1 = __importDefault(require("../util/data"));
const URI = __importStar(require("uri-js"));
const path_1 = __importDefault(require("path"));
function isValidUrl(url) {
    let parsed;
    try {
        parsed = URI.parse(url);
    }
    catch (_) {
        // istanbul ignore next
        return false;
    }
    return parsed.scheme === 'http' || parsed.scheme === 'https';
}
const legacyTopicRegex = new RegExp(`^${settings.get().mqtt.base_topic}/bridge/ota_update/.+$`);
const topicRegex = new RegExp(`^${settings.get().mqtt.base_topic}/bridge/request/device/ota_update/(update|check)`, 'i');
class OTAUpdate extends extension_1.default {
    constructor() {
        super(...arguments);
        this.inProgress = new Set();
        this.lastChecked = {};
        this.legacyApi = settings.get().advanced.legacy_api;
    }
    async start() {
        this.eventBus.onMQTTMessage(this, this.onMQTTMessage);
        this.eventBus.onDeviceMessage(this, this.onZigbeeEvent);
        if (settings.get().ota.ikea_ota_use_test_url) {
            tradfri_1.default.useTestURL();
        }
        // Let zigbeeOTA module know if the override index file is provided
        let overrideOTAIndex = settings.get().ota.zigbee_ota_override_index_location;
        if (overrideOTAIndex) {
            // If the file name is not a full path, then treat it as a relative to the data directory
            if (!isValidUrl(overrideOTAIndex) && !path_1.default.isAbsolute(overrideOTAIndex)) {
                overrideOTAIndex = data_1.default.joinPath(overrideOTAIndex);
            }
            zigbeeOTA_1.default.useIndexOverride(overrideOTAIndex);
        }
        // In order to support local firmware files we need to let zigbeeOTA know where the data directory is
        zigbeeOTA_1.default.setDataDir(data_1.default.getPath());
        // In case Zigbee2MQTT is restared during an update, progress and remaining values are still in state.
        // remove them.
        for (const device of this.zigbee.devices(false)) {
            this.removeProgressAndRemainingFromState(device);
        }
    }
    removeProgressAndRemainingFromState(device) {
        var _a, _b;
        (_a = this.state.get(device).update) === null || _a === void 0 ? true : delete _a.progress;
        (_b = this.state.get(device).update) === null || _b === void 0 ? true : delete _b.remaining;
    }
    async onZigbeeEvent(data) {
        if (data.type !== 'commandQueryNextImageRequest' || !data.device.definition ||
            this.inProgress.has(data.device.ieeeAddr))
            return;
        logger_1.default.debug(`Device '${data.device.name}' requested OTA`);
        const automaticOTACheckDisabled = settings.get().ota.disable_automatic_update_check;
        let supportsOTA = data.device.definition.hasOwnProperty('ota');
        if (supportsOTA && !automaticOTACheckDisabled) {
            // When a device does a next image request, it will usually do it a few times after each other
            // with only 10 - 60 seconds inbetween. It doesn't make sense to check for a new update
            // each time, so this interval can be set by the user. The default is 1,440 minutes (one day).
            const updateCheckInterval = settings.get().ota.update_check_interval * 1000 * 60;
            const check = this.lastChecked.hasOwnProperty(data.device.ieeeAddr) ?
                (Date.now() - this.lastChecked[data.device.ieeeAddr]) > updateCheckInterval : true;
            if (!check)
                return;
            this.lastChecked[data.device.ieeeAddr] = Date.now();
            let available = false;
            try {
                available = await data.device.definition.ota.isUpdateAvailable(data.device.zh, logger_1.default, data.data);
            }
            catch (e) {
                supportsOTA = false;
                logger_1.default.debug(`Failed to check if update available for '${data.device.name}' (${e.message})`);
            }
            const payload = this.getEntityPublishPayload(available ? 'available' : 'idle');
            this.publishEntityState(data.device, payload);
            if (available) {
                const message = `Update available for '${data.device.name}'`;
                logger_1.default.info(message);
                /* istanbul ignore else */
                if (settings.get().advanced.legacy_api) {
                    const meta = { status: 'available', device: data.device.name };
                    this.mqtt.publish('bridge/log', json_stable_stringify_without_jsonify_1.default({ type: `ota_update`, message, meta }));
                }
            }
        }
        // Respond to the OTA request:
        // - In case we don't support OTA: respond with NO_IMAGE_AVAILABLE (0x98) (so the client stops requesting OTAs)
        // - In case we do support OTA: respond with ABORT (0x95) as we don't want to update now.
        const endpoint = data.device.zh.endpoints.find((e) => e.supportsOutputCluster('genOta'));
        if (endpoint) {
            // Some devices send OTA requests without defining OTA cluster as input cluster.
            await endpoint.commandResponse('genOta', 'queryNextImageResponse', { status: supportsOTA ? 0x95 : 0x98 });
        }
    }
    async readSoftwareBuildIDAndDateCode(device, sendWhen) {
        try {
            const endpoint = device.zh.endpoints.find((e) => e.supportsInputCluster('genBasic'));
            const result = await endpoint.read('genBasic', ['dateCode', 'swBuildId'], { sendWhen });
            return { softwareBuildID: result.swBuildId, dateCode: result.dateCode };
        }
        catch (e) {
            return null;
        }
    }
    getEntityPublishPayload(state, progress = null, remaining = null) {
        const payload = { update: { state } };
        if (progress !== null)
            payload.update.progress = progress;
        if (remaining !== null)
            payload.update.remaining = Math.round(remaining);
        /* istanbul ignore else */
        if (this.legacyApi) {
            payload.update_available = state === 'available';
        }
        return payload;
    }
    async onMQTTMessage(data) {
        if ((!this.legacyApi || !data.topic.match(legacyTopicRegex)) && !data.topic.match(topicRegex)) {
            return null;
        }
        const message = utils_1.default.parseJSON(data.message, data.message);
        const ID = (typeof message === 'object' && message.hasOwnProperty('id') ? message.id : message);
        const device = this.zigbee.resolveEntity(ID);
        const type = data.topic.substring(data.topic.lastIndexOf('/') + 1);
        const responseData = { id: ID };
        let error = null;
        let errorStack = null;
        if (!(device instanceof device_1.default)) {
            error = `Device '${ID}' does not exist`;
        }
        else if (!device.definition || !device.definition.ota) {
            error = `Device '${device.name}' does not support OTA updates`;
            /* istanbul ignore else */
            if (settings.get().advanced.legacy_api) {
                const meta = { status: `not_supported`, device: device.name };
                this.mqtt.publish('bridge/log', json_stable_stringify_without_jsonify_1.default({ type: `ota_update`, message: error, meta }));
            }
        }
        else if (this.inProgress.has(device.ieeeAddr)) {
            error = `Update or check for update already in progress for '${device.name}'`;
        }
        else {
            this.inProgress.add(device.ieeeAddr);
            if (type === 'check') {
                const msg = `Checking if update available for '${device.name}'`;
                logger_1.default.info(msg);
                /* istanbul ignore else */
                if (settings.get().advanced.legacy_api) {
                    const meta = { status: `checking_if_available`, device: device.name };
                    this.mqtt.publish('bridge/log', json_stable_stringify_without_jsonify_1.default({ type: `ota_update`, message: msg, meta }));
                }
                try {
                    const available = await device.definition.ota.isUpdateAvailable(device.zh, logger_1.default);
                    const msg = `${available ? 'Update' : 'No update'} available for '${device.name}'`;
                    logger_1.default.info(msg);
                    /* istanbul ignore else */
                    if (settings.get().advanced.legacy_api) {
                        const meta = { status: available ? 'available' : 'not_available', device: device.name };
                        this.mqtt.publish('bridge/log', json_stable_stringify_without_jsonify_1.default({ type: `ota_update`, message: msg, meta }));
                    }
                    const payload = this.getEntityPublishPayload(available ? 'available' : 'idle');
                    this.publishEntityState(device, payload);
                    this.lastChecked[device.ieeeAddr] = Date.now();
                    responseData.updateAvailable = available;
                }
                catch (e) {
                    error = `Failed to check if update available for '${device.name}' (${e.message})`;
                    errorStack = e.stack;
                    /* istanbul ignore else */
                    if (settings.get().advanced.legacy_api) {
                        const meta = { status: `check_failed`, device: device.name };
                        this.mqtt.publish('bridge/log', json_stable_stringify_without_jsonify_1.default({ type: `ota_update`, message: error, meta }));
                    }
                }
            }
            else { // type === 'update'
                const msg = `Updating '${device.name}' to latest firmware`;
                logger_1.default.info(msg);
                /* istanbul ignore else */
                if (settings.get().advanced.legacy_api) {
                    const meta = { status: `update_in_progress`, device: device.name };
                    this.mqtt.publish('bridge/log', json_stable_stringify_without_jsonify_1.default({ type: `ota_update`, message: msg, meta }));
                }
                try {
                    const onProgress = (progress, remaining) => {
                        let msg = `Update of '${device.name}' at ${progress.toFixed(2)}%`;
                        if (remaining) {
                            msg += `, ≈ ${Math.round(remaining / 60)} minutes remaining`;
                        }
                        logger_1.default.info(msg);
                        const payload = this.getEntityPublishPayload('updating', progress, remaining);
                        this.publishEntityState(device, payload);
                        /* istanbul ignore else */
                        if (settings.get().advanced.legacy_api) {
                            const meta = { status: `update_progress`, device: device.name, progress };
                            this.mqtt.publish('bridge/log', json_stable_stringify_without_jsonify_1.default({ type: `ota_update`, message: msg, meta }));
                        }
                    };
                    const from_ = await this.readSoftwareBuildIDAndDateCode(device, 'immediate');
                    await device.definition.ota.updateToLatest(device.zh, logger_1.default, onProgress);
                    logger_1.default.info(`Finished update of '${device.name}'`);
                    this.eventBus.emitReconfigure({ device });
                    this.removeProgressAndRemainingFromState(device);
                    const payload = this.getEntityPublishPayload('idle');
                    this.publishEntityState(device, payload);
                    const to = await this.readSoftwareBuildIDAndDateCode(device, 'active');
                    const [fromS, toS] = [json_stable_stringify_without_jsonify_1.default(from_), json_stable_stringify_without_jsonify_1.default(to)];
                    logger_1.default.info(`Device '${device.name}' was updated from '${fromS}' to '${toS}'`);
                    responseData.from = from_ ? utils_1.default.toSnakeCase(from_) : null;
                    responseData.to = to ? utils_1.default.toSnakeCase(to) : null;
                    this.eventBus.emitDevicesChanged();
                    /* istanbul ignore else */
                    if (settings.get().advanced.legacy_api) {
                        const meta = { status: `update_succeeded`, device: device.name, from: from_, to };
                        this.mqtt.publish('bridge/log', json_stable_stringify_without_jsonify_1.default({ type: `ota_update`, message, meta }));
                    }
                }
                catch (e) {
                    logger_1.default.debug(`Update of '${device.name}' failed (${e})`);
                    error = `Update of '${device.name}' failed (${e.message})`;
                    errorStack = e.stack;
                    this.removeProgressAndRemainingFromState(device);
                    const payload = this.getEntityPublishPayload('available');
                    this.publishEntityState(device, payload);
                    /* istanbul ignore else */
                    if (settings.get().advanced.legacy_api) {
                        const meta = { status: `update_failed`, device: device.name };
                        this.mqtt.publish('bridge/log', json_stable_stringify_without_jsonify_1.default({ type: `ota_update`, message: error, meta }));
                    }
                }
            }
            this.inProgress.delete(device.ieeeAddr);
        }
        const triggeredViaLegacyApi = data.topic.match(legacyTopicRegex);
        if (!triggeredViaLegacyApi) {
            const response = utils_1.default.getResponse(message, responseData, error);
            await this.mqtt.publish(`bridge/response/device/ota_update/${type}`, json_stable_stringify_without_jsonify_1.default(response));
        }
        if (error) {
            logger_1.default.error(error);
            errorStack && logger_1.default.debug(errorStack);
        }
    }
}
__decorate([
    bind_decorator_1.default
], OTAUpdate.prototype, "onZigbeeEvent", null);
__decorate([
    bind_decorator_1.default
], OTAUpdate.prototype, "onMQTTMessage", null);
exports.default = OTAUpdate;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3RhVXBkYXRlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL2V4dGVuc2lvbi9vdGFVcGRhdGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsMkRBQTZDO0FBQzdDLDREQUFvQztBQUNwQyxrSEFBOEQ7QUFDOUQsMERBQWtDO0FBQ2xDLHlGQUFvRTtBQUNwRSw2RkFBcUU7QUFDckUsNERBQW9DO0FBQ3BDLG9FQUFrQztBQUNsQyw2REFBcUM7QUFDckMsd0RBQW1DO0FBQ25DLDRDQUE4QjtBQUM5QixnREFBd0I7QUFFeEIsU0FBUyxVQUFVLENBQUMsR0FBVztJQUMzQixJQUFJLE1BQU0sQ0FBQztJQUNYLElBQUk7UUFDQSxNQUFNLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztLQUMzQjtJQUFDLE9BQU8sQ0FBQyxFQUFFO1FBQ1IsdUJBQXVCO1FBQ3ZCLE9BQU8sS0FBSyxDQUFDO0tBQ2hCO0lBQ0QsT0FBTyxNQUFNLENBQUMsTUFBTSxLQUFLLE1BQU0sSUFBSSxNQUFNLENBQUMsTUFBTSxLQUFLLE9BQU8sQ0FBQztBQUNqRSxDQUFDO0FBT0QsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLE1BQU0sQ0FBQyxJQUFJLFFBQVEsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsVUFBVSx3QkFBd0IsQ0FBQyxDQUFDO0FBQ2hHLE1BQU0sVUFBVSxHQUNaLElBQUksTUFBTSxDQUFDLElBQUksUUFBUSxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxVQUFVLGtEQUFrRCxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBRTFHLE1BQXFCLFNBQVUsU0FBUSxtQkFBUztJQUFoRDs7UUFDWSxlQUFVLEdBQUcsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUN2QixnQkFBVyxHQUEwQixFQUFFLENBQUM7UUFDeEMsY0FBUyxHQUFHLFFBQVEsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxRQUFRLENB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