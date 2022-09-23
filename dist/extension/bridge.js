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
/* eslint-disable camelcase */
const logger_1 = __importDefault(require("../util/logger"));
const utils_1 = __importDefault(require("../util/utils"));
const settings = __importStar(require("../util/settings"));
const winston_transport_1 = __importDefault(require("winston-transport"));
const bind_decorator_1 = __importDefault(require("bind-decorator"));
const json_stable_stringify_without_jsonify_1 = __importDefault(require("json-stable-stringify-without-jsonify"));
const object_assign_deep_1 = __importDefault(require("object-assign-deep"));
const deep_object_diff_1 = require("deep-object-diff");
const extension_1 = __importDefault(require("./extension"));
const device_1 = __importDefault(require("../model/device"));
const data_1 = __importDefault(require("../util/data"));
const jszip_1 = __importDefault(require("jszip"));
const fs_1 = __importDefault(require("fs"));
const requestRegex = new RegExp(`${settings.get().mqtt.base_topic}/bridge/request/(.*)`);
class Bridge extends extension_1.default {
    constructor() {
        super(...arguments);
        this.restartRequired = false;
    }
    async start() {
        this.requestLookup = {
            'device/options': this.deviceOptions,
            'device/configure_reporting': this.deviceConfigureReporting,
            'device/remove': this.deviceRemove,
            'device/rename': this.deviceRename,
            'group/add': this.groupAdd,
            'group/options': this.groupOptions,
            'group/remove': this.groupRemove,
            'group/rename': this.groupRename,
            'permit_join': this.permitJoin,
            'restart': this.restart,
            'backup': this.backup,
            'touchlink/factory_reset': this.touchlinkFactoryReset,
            'touchlink/identify': this.touchlinkIdentify,
            'touchlink/scan': this.touchlinkScan,
            'health_check': this.healthCheck,
            'options': this.bridgeOptions,
            // Below are deprecated
            'config/last_seen': this.configLastSeen,
            'config/homeassistant': this.configHomeAssistant,
            'config/elapsed': this.configElapsed,
            'config/log_level': this.configLogLevel,
        };
        const mqtt = this.mqtt;
        class EventTransport extends winston_transport_1.default {
            log(info, callback) {
                const payload = json_stable_stringify_without_jsonify_1.default({ message: info.message, level: info.level });
                mqtt.publish(`bridge/logging`, payload, {}, settings.get().mqtt.base_topic, true);
                callback();
            }
        }
        logger_1.default.addTransport(new EventTransport());
        this.zigbee2mqttVersion = await utils_1.default.getZigbee2MQTTVersion();
        this.coordinatorVersion = await this.zigbee.getCoordinatorVersion();
        this.eventBus.onEntityRenamed(this, () => this.publishInfo());
        this.eventBus.onGroupMembersChanged(this, () => this.publishGroups());
        this.eventBus.onDevicesChanged(this, () => this.publishDevices() && this.publishInfo());
        this.eventBus.onPermitJoinChanged(this, () => !this.zigbee.isStopping() && this.publishInfo());
        this.eventBus.onScenesChanged(this, () => {
            this.publishDevices();
            this.publishGroups();
        });
        // Zigbee events
        const publishEvent = (type, data) => this.mqtt.publish('bridge/event', json_stable_stringify_without_jsonify_1.default({ type, data }), { retain: false, qos: 0 });
        this.eventBus.onDeviceJoined(this, (data) => {
            this.lastJoinedDeviceIeeeAddr = data.device.ieeeAddr;
            this.publishDevices();
            publishEvent('device_joined', { friendly_name: data.device.name, ieee_address: data.device.ieeeAddr });
        });
        this.eventBus.onDeviceLeave(this, (data) => {
            this.publishDevices();
            publishEvent('device_leave', { ieee_address: data.ieeeAddr, friendly_name: data.name });
        });
        this.eventBus.onDeviceNetworkAddressChanged(this, () => this.publishDevices());
        this.eventBus.onDeviceInterview(this, (data) => {
            this.publishDevices();
            const payload = { friendly_name: data.device.name, status: data.status, ieee_address: data.device.ieeeAddr };
            if (data.status === 'successful') {
                payload.supported = !!data.device.definition;
                payload.definition = this.getDefinitionPayload(data.device);
            }
            publishEvent('device_interview', payload);
        });
        this.eventBus.onDeviceAnnounce(this, (data) => {
            this.publishDevices();
            publishEvent('device_announce', { friendly_name: data.device.name, ieee_address: data.device.ieeeAddr });
        });
        await this.publishInfo();
        await this.publishDevices();
        await this.publishGroups();
        this.eventBus.onMQTTMessage(this, this.onMQTTMessage);
    }
    async onMQTTMessage(data) {
        var _a;
        const match = data.topic.match(requestRegex);
        const key = (_a = match === null || match === void 0 ? void 0 : match[1]) === null || _a === void 0 ? void 0 : _a.toLowerCase();
        if (key in this.requestLookup) {
            const message = utils_1.default.parseJSON(data.message, data.message);
            try {
                const response = await this.requestLookup[key](message);
                await this.mqtt.publish(`bridge/response/${match[1]}`, json_stable_stringify_without_jsonify_1.default(response));
            }
            catch (error) {
                logger_1.default.error(`Request '${data.topic}' failed with error: '${error.message}'`);
                logger_1.default.debug(error.stack);
                const response = utils_1.default.getResponse(message, {}, error.message);
                await this.mqtt.publish(`bridge/response/${match[1]}`, json_stable_stringify_without_jsonify_1.default(response));
            }
        }
    }
    /**
     * Requests
     */
    async deviceOptions(message) {
        return this.changeEntityOptions('device', message);
    }
    async groupOptions(message) {
        return this.changeEntityOptions('group', message);
    }
    async bridgeOptions(message) {
        if (typeof message !== 'object' || typeof message.options !== 'object') {
            throw new Error(`Invalid payload`);
        }
        const diff = deep_object_diff_1.detailedDiff(settings.get(), message.options);
        // Remove any settings that are in the deleted.diff but not in the passed options
        const cleanupDeleted = (options, deleted) => {
            for (const key of Object.keys(deleted)) {
                if (!(key in options)) {
                    delete deleted[key];
                }
                else if (!Array.isArray(options[key])) {
                    cleanupDeleted(options[key], deleted[key]);
                }
            }
        };
        cleanupDeleted(message.options, diff.deleted);
        const newSettings = object_assign_deep_1.default({}, diff.added, diff.updated, diff.deleted);
        // deep-object-diff converts arrays to objects, set original array back here
        const convertBackArray = (before, after) => {
            for (const [key, afterValue] of Object.entries(after)) {
                const beforeValue = before[key];
                if (Array.isArray(beforeValue)) {
                    after[key] = beforeValue;
                }
                else if (afterValue && typeof beforeValue === 'object') {
                    convertBackArray(beforeValue, afterValue);
                }
            }
        };
        convertBackArray(message.options, newSettings);
        const restartRequired = settings.apply(newSettings);
        if (restartRequired)
            this.restartRequired = true;
        // Apply some settings on-the-fly.
        if (newSettings.hasOwnProperty('permit_join')) {
            await this.zigbee.permitJoin(newSettings.permit_join);
        }
        if (newSettings.hasOwnProperty('homeassistant')) {
            await this.enableDisableExtension(newSettings.homeassistant, 'HomeAssistant');
        }
        if (newSettings.hasOwnProperty('advanced') && newSettings.advanced.hasOwnProperty('log_level')) {
            logger_1.default.setLevel(newSettings.advanced.log_level);
        }
        logger_1.default.info('Succesfully changed options');
        this.publishInfo();
        return utils_1.default.getResponse(message, { restart_required: this.restartRequired }, null);
    }
    async deviceRemove(message) {
        return this.removeEntity('device', message);
    }
    async groupRemove(message) {
        return this.removeEntity('group', message);
    }
    async healthCheck(message) {
        return utils_1.default.getResponse(message, { healthy: true }, null);
    }
    async groupAdd(message) {
        if (typeof message === 'object' && !message.hasOwnProperty('friendly_name')) {
            throw new Error(`Invalid payload`);
        }
        const friendlyName = typeof message === 'object' ? message.friendly_name : message;
        const ID = typeof message === 'object' && message.hasOwnProperty('id') ? message.id : null;
        const group = settings.addGroup(friendlyName, ID);
        this.zigbee.createGroup(group.ID);
        this.publishGroups();
        return utils_1.default.getResponse(message, { friendly_name: group.friendly_name, id: group.ID }, null);
    }
    async deviceRename(message) {
        return this.renameEntity('device', message);
    }
    async groupRename(message) {
        return this.renameEntity('group', message);
    }
    async restart(message) {
        // Wait 500 ms before restarting so response can be send.
        setTimeout(this.restartCallback, 500);
        logger_1.default.info('Restarting Zigbee2MQTT');
        return utils_1.default.getResponse(message, {}, null);
    }
    async backup(message) {
        await this.zigbee.backup();
        const dataPath = data_1.default.getPath();
        const files = utils_1.default.getAllFiles(dataPath).map((f) => [f, f.substring(dataPath.length + 1)])
            .filter((f) => !f[1].startsWith('log'));
        const zip = new jszip_1.default();
        files.forEach((f) => zip.file(f[1], fs_1.default.readFileSync(f[0])));
        const base64Zip = await zip.generateAsync({ type: 'base64' });
        return utils_1.default.getResponse(message, { zip: base64Zip }, null);
    }
    async permitJoin(message) {
        if (typeof message === 'object' && !message.hasOwnProperty('value')) {
            throw new Error('Invalid payload');
        }
        let value;
        let time;
        let device = null;
        if (typeof message === 'object') {
            value = message.value;
            time = message.time;
            if (message.device) {
                const resolved = this.zigbee.resolveEntity(message.device);
                if (resolved instanceof device_1.default) {
                    device = resolved;
                }
                else {
                    throw new Error(`Device '${message.device}' does not exist`);
                }
            }
        }
        else {
            value = message;
        }
        if (typeof value === 'string') {
            value = value.toLowerCase() === 'true';
        }
        await this.zigbee.permitJoin(value, device, time);
        const response = { value };
        if (device && typeof message === 'object')
            response.device = message.device;
        if (time && typeof message === 'object')
            response.time = message.time;
        return utils_1.default.getResponse(message, response, null);
    }
    // Deprecated
    async configLastSeen(message) {
        const allowed = ['disable', 'ISO_8601', 'epoch', 'ISO_8601_local'];
        const value = this.getValue(message);
        if (typeof value !== 'string' || !allowed.includes(value)) {
            throw new Error(`'${value}' is not an allowed value, allowed: ${allowed}`);
        }
        settings.set(['advanced', 'last_seen'], value);
        this.publishInfo();
        return utils_1.default.getResponse(message, { value }, null);
    }
    // Deprecated
    async configHomeAssistant(message) {
        const allowed = [true, false];
        const value = this.getValue(message);
        if (typeof value !== 'boolean' || !allowed.includes(value)) {
            throw new Error(`'${value}' is not an allowed value, allowed: ${allowed}`);
        }
        await this.enableDisableExtension(value, 'HomeAssistant');
        settings.set(['homeassistant'], value);
        this.publishInfo();
        return utils_1.default.getResponse(message, { value }, null);
    }
    // Deprecated
    async configElapsed(message) {
        const allowed = [true, false];
        const value = this.getValue(message);
        if (typeof value !== 'boolean' || !allowed.includes(value)) {
            throw new Error(`'${value}' is not an allowed value, allowed: ${allowed}`);
        }
        settings.set(['advanced', 'elapsed'], value);
        this.publishInfo();
        return utils_1.default.getResponse(message, { value }, null);
    }
    // Deprecated
    async configLogLevel(message) {
        const allowed = ['error', 'warn', 'info', 'debug'];
        const value = this.getValue(message);
        if (typeof value !== 'string' || !allowed.includes(value)) {
            throw new Error(`'${value}' is not an allowed value, allowed: ${allowed}`);
        }
        logger_1.default.setLevel(value);
        this.publishInfo();
        return utils_1.default.getResponse(message, { value }, null);
    }
    async touchlinkIdentify(message) {
        if (typeof message !== 'object' || !message.hasOwnProperty('ieee_address') ||
            !message.hasOwnProperty('channel')) {
            throw new Error('Invalid payload');
        }
        logger_1.default.info(`Start Touchlink identify of '${message.ieee_address}' on channel ${message.channel}`);
        await this.zigbee.touchlinkIdentify(message.ieee_address, message.channel);
        return utils_1.default.getResponse(message, { ieee_address: message.ieee_address, channel: message.channel }, null);
    }
    async touchlinkFactoryReset(message) {
        let result = false;
        const payload = {};
        if (typeof message === 'object' && message.hasOwnProperty('ieee_address') &&
            message.hasOwnProperty('channel')) {
            logger_1.default.info(`Start Touchlink factory reset of '${message.ieee_address}' on channel ${message.channel}`);
            result = await this.zigbee.touchlinkFactoryReset(message.ieee_address, message.channel);
            payload.ieee_address = message.ieee_address;
            payload.channel = message.channel;
        }
        else {
            logger_1.default.info('Start Touchlink factory reset of first found device');
            result = await this.zigbee.touchlinkFactoryResetFirst();
        }
        if (result) {
            logger_1.default.info('Successfully factory reset device through Touchlink');
            return utils_1.default.getResponse(message, payload, null);
        }
        else {
            logger_1.default.error('Failed to factory reset device through Touchlink');
            throw new Error('Failed to factory reset device through Touchlink');
        }
    }
    async touchlinkScan(message) {
        logger_1.default.info('Start Touchlink scan');
        const result = await this.zigbee.touchlinkScan();
        const found = result.map((r) => {
            return { ieee_address: r.ieeeAddr, channel: r.channel };
        });
        logger_1.default.info('Finished Touchlink scan');
        return utils_1.default.getResponse(message, { found }, null);
    }
    /**
     * Utils
     */
    getValue(message) {
        if (typeof message === 'object') {
            if (!message.hasOwnProperty('value')) {
                throw new Error('No value given');
            }
            return message.value;
        }
        else {
            return message;
        }
    }
    async changeEntityOptions(entityType, message) {
        if (typeof message !== 'object' || !message.hasOwnProperty('id') || !message.hasOwnProperty('options')) {
            throw new Error(`Invalid payload`);
        }
        const cleanup = (o) => {
            delete o.friendlyName;
            delete o.friendly_name;
            delete o.ID;
            delete o.type;
            delete o.devices;
            return o;
        };
        const ID = message.id;
        const entity = this.getEntity(entityType, ID);
        const oldOptions = object_assign_deep_1.default({}, cleanup(entity.options));
        settings.changeEntityOptions(ID, message.options);
        const newOptions = cleanup(entity.options);
        await this.publishInfo();
        logger_1.default.info(`Changed config for ${entityType} ${ID}`);
        this.eventBus.emitEntityOptionsChanged({ from: oldOptions, to: newOptions, entity });
        return utils_1.default.getResponse(message, { from: oldOptions, to: newOptions, id: ID }, null);
    }
    async deviceConfigureReporting(message) {
        if (typeof message !== 'object' || !message.hasOwnProperty('id') || !message.hasOwnProperty('cluster') ||
            !message.hasOwnProperty('maximum_report_interval') || !message.hasOwnProperty('minimum_report_interval') ||
            !message.hasOwnProperty('reportable_change') || !message.hasOwnProperty('attribute')) {
            throw new Error(`Invalid payload`);
        }
        const parsedID = utils_1.default.parseEntityID(message.id);
        const endpoint = this.getEntity('device', parsedID.ID).endpoint(parsedID.endpoint);
        const coordinatorEndpoint = this.zigbee.firstCoordinatorEndpoint();
        await endpoint.bind(message.cluster, coordinatorEndpoint);
        await endpoint.configureReporting(message.cluster, [{
                attribute: message.attribute, minimumReportInterval: message.minimum_report_interval,
                maximumReportInterval: message.maximum_report_interval, reportableChange: message.reportable_change,
            }], message.options);
        this.publishDevices();
        logger_1.default.info(`Configured reporting for '${message.id}', '${message.cluster}.${message.attribute}'`);
        return utils_1.default.getResponse(message, {
            id: message.id, cluster: message.cluster, maximum_report_interval: message.maximum_report_interval,
            minimum_report_interval: message.minimum_report_interval, reportable_change: message.reportable_change,
            attribute: message.attribute,
        }, null);
    }
    async renameEntity(entityType, message) {
        const deviceAndHasLast = entityType === 'device' && typeof message === 'object' && message.last === true;
        if (typeof message !== 'object' || (!message.hasOwnProperty('from') && !deviceAndHasLast) ||
            !message.hasOwnProperty('to')) {
            throw new Error(`Invalid payload`);
        }
        if (deviceAndHasLast && !this.lastJoinedDeviceIeeeAddr) {
            throw new Error('No device has joined since start');
        }
        const from = deviceAndHasLast ? this.lastJoinedDeviceIeeeAddr : message.from;
        const to = message.to;
        const homeAssisantRename = message.hasOwnProperty('homeassistant_rename') ?
            message.homeassistant_rename : false;
        const entity = this.getEntity(entityType, from);
        const oldFriendlyName = entity.options.friendly_name;
        settings.changeFriendlyName(from, to);
        // Clear retained messages
        this.mqtt.publish(oldFriendlyName, '', { retain: true });
        this.eventBus.emitEntityRenamed({ entity: entity, homeAssisantRename, from: oldFriendlyName, to });
        if (entity instanceof device_1.default) {
            this.publishDevices();
        }
        else {
            this.publishGroups();
            this.publishInfo();
        }
        // Repulish entity state
        this.publishEntityState(entity, {});
        return utils_1.default.getResponse(message, { from: oldFriendlyName, to, homeassistant_rename: homeAssisantRename }, null);
    }
    async removeEntity(entityType, message) {
        const ID = typeof message === 'object' ? message.id : message.trim();
        const entity = this.getEntity(entityType, ID);
        const friendlyName = entity.name;
        const entityID = entity.ID;
        let block = false;
        let force = false;
        let blockForceLog = '';
        if (entityType === 'device' && typeof message === 'object') {
            block = !!message.block;
            force = !!message.force;
            blockForceLog = ` (block: ${block}, force: ${force})`;
        }
        else if (entityType === 'group' && typeof message === 'object') {
            force = !!message.force;
            blockForceLog = ` (force: ${force})`;
        }
        try {
            logger_1.default.info(`Removing ${entityType} '${entity.name}'${blockForceLog}`);
            const ieeeAddr = entity.isDevice() && entity.ieeeAddr;
            const name = entity.name;
            if (entity instanceof device_1.default) {
                if (block) {
                    settings.blockDevice(entity.ieeeAddr);
                }
                if (force) {
                    await entity.zh.removeFromDatabase();
                }
                else {
                    await entity.zh.removeFromNetwork();
                }
            }
            else {
                if (force) {
                    entity.zh.removeFromDatabase();
                }
                else {
                    await entity.zh.removeFromNetwork();
                }
            }
            // Fire event
            if (entity instanceof device_1.default) {
                this.eventBus.emitDeviceRemoved({ ieeeAddr, name });
            }
            // Remove from configuration.yaml
            if (entity instanceof device_1.default) {
                settings.removeDevice(entityID);
            }
            else {
                settings.removeGroup(entityID);
            }
            // Remove from state
            this.state.remove(entityID);
            // Clear any retained messages
            this.mqtt.publish(friendlyName, '', { retain: true });
            logger_1.default.info(`Successfully removed ${entityType} '${friendlyName}'${blockForceLog}`);
            if (entity instanceof device_1.default) {
                this.publishGroups();
                this.publishDevices();
                return utils_1.default.getResponse(message, { id: ID, block, force }, null);
            }
            else {
                this.publishGroups();
                return utils_1.default.getResponse(message, { id: ID, force: force }, null);
            }
        }
        catch (error) {
            throw new Error(`Failed to remove ${entityType} '${friendlyName}'${blockForceLog} (${error})`);
        }
    }
    getEntity(type, ID) {
        const entity = this.zigbee.resolveEntity(ID);
        if (!entity || entity.constructor.name.toLowerCase() !== type) {
            throw new Error(`${utils_1.default.capitalize(type)} '${ID}' does not exist`);
        }
        return entity;
    }
    async publishInfo() {
        const config = object_assign_deep_1.default({}, settings.get());
        delete config.advanced.network_key;
        delete config.mqtt.password;
        config.frontend && delete config.frontend.auth_token;
        const payload = {
            version: this.zigbee2mqttVersion.version,
            commit: this.zigbee2mqttVersion.commitHash,
            coordinator: {
                ieee_address: this.zigbee.firstCoordinatorEndpoint().getDevice().ieeeAddr,
                ...this.coordinatorVersion,
            },
            network: utils_1.default.toSnakeCase(await this.zigbee.getNetworkParameters()),
            log_level: logger_1.default.getLevel(),
            permit_join: this.zigbee.getPermitJoin(),
            permit_join_timeout: this.zigbee.getPermitJoinTimeout(),
            restart_required: this.restartRequired,
            config,
            config_schema: settings.schema,
        };
        await this.mqtt.publish('bridge/info', json_stable_stringify_without_jsonify_1.default(payload), { retain: true, qos: 0 }, settings.get().mqtt.base_topic, true);
    }
    getScenes(entity) {
        var _a;
        const scenes = {};
        const endpoints = utils_1.default.isEndpoint(entity) ? [entity] : entity.members;
        const groupID = utils_1.default.isEndpoint(entity) ? 0 : entity.groupID;
        for (const endpoint of endpoints) {
            for (const [key, data] of Object.entries(((_a = endpoint.meta) === null || _a === void 0 ? void 0 : _a.scenes) || {})) {
                const split = key.split('_');
                const sceneID = parseInt(split[0], 10);
                const sceneGroupID = parseInt(split[1], 10);
                if (sceneGroupID === groupID) {
                    scenes[sceneID] = { id: sceneID, name: data.name || `Scene ${sceneID}` };
                }
            }
        }
        return Object.values(scenes);
    }
    async publishDevices() {
        const devices = this.zigbee.devices().map((device) => {
            const endpoints = {};
            for (const endpoint of device.zh.endpoints) {
                const data = {
                    scenes: this.getScenes(endpoint),
                    bindings: [],
                    configured_reportings: [],
                    clusters: {
                        input: endpoint.getInputClusters().map((c) => c.name),
                        output: endpoint.getOutputClusters().map((c) => c.name),
                    },
                };
                for (const bind of endpoint.binds) {
                    const target = utils_1.default.isEndpoint(bind.target) ?
                        { type: 'endpoint', ieee_address: bind.target.getDevice().ieeeAddr, endpoint: bind.target.ID } :
                        { type: 'group', id: bind.target.groupID };
                    data.bindings.push({ cluster: bind.cluster.name, target });
                }
                for (const configuredReporting of endpoint.configuredReportings) {
                    data.configured_reportings.push({
                        cluster: configuredReporting.cluster.name,
                        attribute: configuredReporting.attribute.name || configuredReporting.attribute.ID,
                        minimum_report_interval: configuredReporting.minimumReportInterval,
                        maximum_report_interval: configuredReporting.maximumReportInterval,
                        reportable_change: configuredReporting.reportableChange,
                    });
                }
                endpoints[endpoint.ID] = data;
            }
            return {
                ieee_address: device.ieeeAddr,
                type: device.zh.type,
                network_address: device.zh.networkAddress,
                supported: !!device.definition,
                friendly_name: device.name,
                description: device.options.description,
                definition: this.getDefinitionPayload(device),
                power_source: device.zh.powerSource,
                software_build_id: device.zh.softwareBuildID,
                date_code: device.zh.dateCode,
                model_id: device.zh.modelID,
                interviewing: device.zh.interviewing,
                interview_completed: device.zh.interviewCompleted,
                manufacturer: device.zh.manufacturerName,
                endpoints,
            };
        });
        await this.mqtt.publish('bridge/devices', json_stable_stringify_without_jsonify_1.default(devices), { retain: true, qos: 0 }, settings.get().mqtt.base_topic, true);
    }
    async publishGroups() {
        const groups = this.zigbee.groups().map((g) => {
            return {
                id: g.ID,
                friendly_name: g.ID === 901 ? 'default_bind_group' : g.name,
                description: g.options.description,
                scenes: this.getScenes(g.zh),
                members: g.zh.members.map((e) => {
                    return { ieee_address: e.getDevice().ieeeAddr, endpoint: e.ID };
                }),
            };
        });
        await this.mqtt.publish('bridge/groups', json_stable_stringify_without_jsonify_1.default(groups), { retain: true, qos: 0 }, settings.get().mqtt.base_topic, true);
    }
    getDefinitionPayload(device) {
        if (!device.definition)
            return null;
        let icon = device.options.icon ? device.options.icon : device.definition.icon;
        if (icon) {
            icon = icon.replace('${zigbeeModel}', utils_1.default.sanitizeImageParameter(device.zh.modelID));
            icon = icon.replace('${model}', utils_1.default.sanitizeImageParameter(device.definition.model));
        }
        return {
            model: device.definition.model,
            vendor: device.definition.vendor,
            description: device.definition.description,
            exposes: device.exposes(),
            supports_ota: !!device.definition.ota,
            options: device.definition.options,
            icon,
        };
    }
}
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "onMQTTMessage", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "deviceOptions", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "groupOptions", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "bridgeOptions", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "deviceRemove", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "groupRemove", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "healthCheck", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "groupAdd", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "deviceRename", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "groupRename", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "restart", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "backup", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "permitJoin", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "configLastSeen", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "configHomeAssistant", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "configElapsed", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "configLogLevel", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "touchlinkIdentify", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "touchlinkFactoryReset", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "touchlinkScan", null);
__decorate([
    bind_decorator_1.default
], Bridge.prototype, "deviceConfigureReporting", null);
exports.default = Bridge;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnJpZGdlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL2V4dGVuc2lvbi9icmlkZ2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsOEJBQThCO0FBQzlCLDREQUFvQztBQUNwQywwREFBa0M7QUFDbEMsMkRBQTZDO0FBQzdDLDBFQUEwQztBQUMxQyxvRUFBa0M7QUFDbEMsa0hBQThEO0FBQzlELDRFQUFrRDtBQUNsRCx1REFBOEM7QUFDOUMsNERBQW9DO0FBQ3BDLDZEQUFxQztBQUVyQyx3REFBZ0M7QUFDaEMsa0RBQTBCO0FBQzFCLDRDQUFvQjtBQUVwQixNQUFNLFlBQVksR0FBRyxJQUFJLE1BQU0sQ0FBQyxHQUFHLFFBQVEsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsVUFBVSxzQkFBc0IsQ0FBQyxDQUFDO0FBUXpGLE1BQXFCLE1BQU8sU0FBUSxtQkFBUztJQUE3Qzs7UUFHWSxvQkFBZSxHQUFHLEtBQUssQ0FBQztJQW1yQnBDLENBQUM7SUEvcUJZLEtBQUssQ0FBQyxLQUFLO1FBQ2hCLElBQUksQ0FBQyxhQUFhLEdBQUc7WUFDakIsZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLGFBQWE7WUFDcEMsNEJBQTRCLEVBQUUsSUFBSSxDQUFDLHdCQUF3QjtZQUMzRCxlQUFlLEVBQUUsSUFBSSxDQUFDLFlBQVk7WUFDbEMsZUFBZSxFQUFFLElBQUksQ0FBQyxZQUFZO1lBQ2xDLFdBQVcsRUFBRSxJQUFJLENBQUMsUUFBUTtZQUMxQixlQUFlLEVBQUUsSUFBSSxDQUFDLFlBQVk7WUFDbEMsY0FBYyxFQUFFLElBQUksQ0FBQyxXQUFXO1lBQ2hDLGNBQWMsRUFBRSxJQUFJLENBQUMsV0FBVztZQUNoQyxhQUFhLEVBQUUsSUFBSSxDQUFDLFVBQVU7WUFDOUIsU0FBUyxFQUFFLElBQUksQ0FBQyxPQUFPO1lBQ3ZCLFFBQVEsRUFBRSxJQUFJLENBQUMsTUFBTTtZQUNyQix5QkFBeUIsRUFBRSxJ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