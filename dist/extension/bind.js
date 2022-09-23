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
const utils_1 = __importDefault(require("../util/utils"));
const extension_1 = __importDefault(require("./extension"));
const json_stable_stringify_without_jsonify_1 = __importDefault(require("json-stable-stringify-without-jsonify"));
const debounce_1 = __importDefault(require("debounce"));
const zigbeeHersdman = __importStar(require("zigbee-herdsman/dist"));
const bind_decorator_1 = __importDefault(require("bind-decorator"));
const device_1 = __importDefault(require("../model/device"));
const group_1 = __importDefault(require("../model/group"));
const legacyApi = settings.get().advanced.legacy_api;
const legacyTopicRegex = new RegExp(`^${settings.get().mqtt.base_topic}/bridge/(bind|unbind)/.+$`);
const topicRegex = new RegExp(`^${settings.get().mqtt.base_topic}/bridge/request/device/(bind|unbind)`);
const clusterCandidates = ['genScenes', 'genOnOff', 'genLevelCtrl', 'lightingColorCtrl', 'closuresWindowCovering',
    'hvacThermostat', 'msIlluminanceMeasurement', 'msTemperatureMeasurement', 'msRelativeHumidity',
    'msSoilMoisture', 'msCO2'];
// See zigbee-herdsman-converters
const defaultBindGroup = { type: 'group_number', ID: 901, name: 'default_bind_group' };
const defaultReportConfiguration = {
    minimumReportInterval: 5, maximumReportInterval: 3600, reportableChange: 1,
};
const getColorCapabilities = async (endpoint) => {
    if (endpoint.getClusterAttributeValue('lightingColorCtrl', 'colorCapabilities') == null) {
        await endpoint.read('lightingColorCtrl', ['colorCapabilities']);
    }
    const value = endpoint.getClusterAttributeValue('lightingColorCtrl', 'colorCapabilities');
    return {
        colorTemperature: (value & 1 << 4) > 0,
        colorXY: (value & 1 << 3) > 0,
    };
};
const reportClusters = {
    'genOnOff': [
        { attribute: 'onOff', ...defaultReportConfiguration, minimumReportInterval: 0, reportableChange: 0 },
    ],
    'genLevelCtrl': [
        { attribute: 'currentLevel', ...defaultReportConfiguration },
    ],
    'lightingColorCtrl': [
        {
            attribute: 'colorTemperature', ...defaultReportConfiguration,
            condition: async (endpoint) => (await getColorCapabilities(endpoint)).colorTemperature,
        },
        {
            attribute: 'currentX', ...defaultReportConfiguration,
            condition: async (endpoint) => (await getColorCapabilities(endpoint)).colorXY,
        },
        {
            attribute: 'currentY', ...defaultReportConfiguration,
            condition: async (endpoint) => (await getColorCapabilities(endpoint)).colorXY,
        },
    ],
    'closuresWindowCovering': [
        { attribute: 'currentPositionLiftPercentage', ...defaultReportConfiguration },
        { attribute: 'currentPositionTiltPercentage', ...defaultReportConfiguration },
    ],
};
const pollOnMessage = [
    {
        // On messages that have the cluster and type of below
        cluster: {
            manuSpecificPhilips: [
                { type: 'commandHueNotification', data: { button: 2 } },
                { type: 'commandHueNotification', data: { button: 3 } },
            ],
            genLevelCtrl: [
                { type: 'commandStep', data: {} },
                { type: 'commandStepWithOnOff', data: {} },
                { type: 'commandStop', data: {} },
                { type: 'commandMoveWithOnOff', data: {} },
                { type: 'commandStopWithOnOff', data: {} },
                { type: 'commandMove', data: {} },
                { type: 'commandMoveToLevelWithOnOff', data: {} },
            ],
            genScenes: [
                { type: 'commandRecall', data: {} },
            ],
        },
        // Read the following attributes
        read: { cluster: 'genLevelCtrl', attributes: ['currentLevel'] },
        // When the bound devices/members of group have the following manufacturerIDs
        manufacturerIDs: [
            zigbeeHersdman.Zcl.ManufacturerCode.Philips,
            zigbeeHersdman.Zcl.ManufacturerCode.ATMEL,
            zigbeeHersdman.Zcl.ManufacturerCode.GLEDOPTO_CO_LTD,
            zigbeeHersdman.Zcl.ManufacturerCode.MUELLER_LICHT_INT,
            zigbeeHersdman.Zcl.ManufacturerCode.TELINK,
        ],
    },
    {
        cluster: {
            genLevelCtrl: [
                { type: 'commandStepWithOnOff', data: {} },
                { type: 'commandMoveWithOnOff', data: {} },
                { type: 'commandStopWithOnOff', data: {} },
                { type: 'commandMoveToLevelWithOnOff', data: {} },
            ],
            genOnOff: [
                { type: 'commandOn', data: {} },
                { type: 'commandOff', data: {} },
                { type: 'commandOffWithEffect', data: {} },
                { type: 'commandToggle', data: {} },
            ],
            genScenes: [
                { type: 'commandRecall', data: {} },
            ],
            manuSpecificPhilips: [
                { type: 'commandHueNotification', data: { button: 1 } },
                { type: 'commandHueNotification', data: { button: 4 } },
            ],
        },
        read: { cluster: 'genOnOff', attributes: ['onOff'] },
        manufacturerIDs: [
            zigbeeHersdman.Zcl.ManufacturerCode.Philips,
            zigbeeHersdman.Zcl.ManufacturerCode.ATMEL,
            zigbeeHersdman.Zcl.ManufacturerCode.GLEDOPTO_CO_LTD,
            zigbeeHersdman.Zcl.ManufacturerCode.MUELLER_LICHT_INT,
            zigbeeHersdman.Zcl.ManufacturerCode.TELINK,
        ],
    },
    {
        cluster: {
            genScenes: [
                { type: 'commandRecall', data: {} },
            ],
        },
        read: {
            cluster: 'lightingColorCtrl',
            attributes: [],
            // Since not all devices support the same attributes they need to be calculated dynamically
            // depending on the capabilities of the endpoint.
            attributesForEndpoint: async (endpoint) => {
                const supportedAttrs = await getColorCapabilities(endpoint);
                const readAttrs = [];
                supportedAttrs.colorXY && readAttrs.push('currentX', 'currentY');
                supportedAttrs.colorTemperature && readAttrs.push('colorTemperature');
                return readAttrs;
            },
        },
        manufacturerIDs: [
            zigbeeHersdman.Zcl.ManufacturerCode.Philips,
            zigbeeHersdman.Zcl.ManufacturerCode.ATMEL,
            zigbeeHersdman.Zcl.ManufacturerCode.GLEDOPTO_CO_LTD,
            zigbeeHersdman.Zcl.ManufacturerCode.MUELLER_LICHT_INT,
            zigbeeHersdman.Zcl.ManufacturerCode.TELINK,
        ],
    },
];
class Bind extends extension_1.default {
    constructor() {
        super(...arguments);
        this.pollDebouncers = {};
    }
    async start() {
        this.eventBus.onDeviceMessage(this, this.poll);
        this.eventBus.onMQTTMessage(this, this.onMQTTMessage);
        this.eventBus.onGroupMembersChanged(this, this.onGroupMembersChanged);
    }
    parseMQTTMessage(data) {
        let type = null;
        let sourceKey = null;
        let targetKey = null;
        let clusters = null;
        let skipDisableReporting = false;
        if (legacyApi && data.topic.match(legacyTopicRegex)) {
            const topic = data.topic.replace(`${settings.get().mqtt.base_topic}/bridge/`, '');
            type = topic.split('/')[0];
            sourceKey = topic.replace(`${type}/`, '');
            targetKey = data.message;
        }
        else if (data.topic.match(topicRegex)) {
            type = data.topic.endsWith('unbind') ? 'unbind' : 'bind';
            const message = JSON.parse(data.message);
            sourceKey = message.from;
            targetKey = message.to;
            clusters = message.clusters;
            skipDisableReporting = 'skip_disable_reporting' in message ? message.skip_disable_reporting : false;
        }
        return { type, sourceKey, targetKey, clusters, skipDisableReporting };
    }
    async onMQTTMessage(data) {
        const { type, sourceKey, targetKey, clusters, skipDisableReporting } = this.parseMQTTMessage(data);
        if (!type)
            return null;
        const message = utils_1.default.parseJSON(data.message, data.message);
        let error = null;
        const parsedSource = utils_1.default.parseEntityID(sourceKey);
        const parsedTarget = utils_1.default.parseEntityID(targetKey);
        const source = this.zigbee.resolveEntity(parsedSource.ID);
        const target = targetKey === 'default_bind_group' ?
            defaultBindGroup : this.zigbee.resolveEntity(parsedTarget.ID);
        const responseData = { from: sourceKey, to: targetKey };
        if (!source || !(source instanceof device_1.default)) {
            error = `Source device '${sourceKey}' does not exist`;
        }
        else if (!target) {
            error = `Target device or group '${targetKey}' does not exist`;
        }
        else {
            const successfulClusters = [];
            const failedClusters = [];
            const attemptedClusters = [];
            const bindSource = source.endpoint(parsedSource.endpoint);
            let bindTarget = null;
            if (target instanceof device_1.default)
                bindTarget = target.endpoint(parsedTarget.endpoint);
            else if (target instanceof group_1.default)
                bindTarget = target.zh;
            else
                bindTarget = Number(target.ID);
            // Find which clusters are supported by both the source and target.
            // Groups are assumed to support all clusters.
            for (const cluster of clusterCandidates) {
                if (clusters && !clusters.includes(cluster))
                    continue;
                let matchingClusters = false;
                const anyClusterValid = utils_1.default.isZHGroup(bindTarget) || typeof bindTarget === 'number' ||
                    target.zh.type === 'Coordinator';
                if (!anyClusterValid && utils_1.default.isEndpoint(bindTarget)) {
                    matchingClusters = ((bindTarget.supportsInputCluster(cluster) &&
                        bindSource.supportsOutputCluster(cluster)) ||
                        (bindSource.supportsInputCluster(cluster) &&
                            bindTarget.supportsOutputCluster(cluster)));
                }
                const sourceValid = bindSource.supportsInputCluster(cluster) ||
                    bindSource.supportsOutputCluster(cluster);
                if (sourceValid && (anyClusterValid || matchingClusters)) {
                    logger_1.default.debug(`${type}ing cluster '${cluster}' from '${source.name}' to '${target.name}'`);
                    attemptedClusters.push(cluster);
                    try {
                        if (type === 'bind') {
                            await bindSource.bind(cluster, bindTarget);
                        }
                        else {
                            await bindSource.unbind(cluster, bindTarget);
                        }
                        successfulClusters.push(cluster);
                        logger_1.default.info(`Successfully ${type === 'bind' ? 'bound' : 'unbound'} cluster '${cluster}' from ` +
                            `'${source.name}' to '${target.name}'`);
                        /* istanbul ignore else */
                        if (settings.get().advanced.legacy_api) {
                            this.mqtt.publish('bridge/log', json_stable_stringify_without_jsonify_1.default({ type: `device_${type}`,
                                message: { from: source.name, to: target.name, cluster } }));
                        }
                    }
                    catch (error) {
                        failedClusters.push(cluster);
                        logger_1.default.error(`Failed to ${type} cluster '${cluster}' from '${source.name}' to ` +
                            `'${target.name}' (${error})`);
                        /* istanbul ignore else */
                        if (settings.get().advanced.legacy_api) {
                            this.mqtt.publish('bridge/log', json_stable_stringify_without_jsonify_1.default({ type: `device_${type}_failed`,
                                message: { from: source.name, to: target.name, cluster } }));
                        }
                    }
                }
            }
            if (attemptedClusters.length === 0) {
                logger_1.default.error(`Nothing to ${type} from '${source.name}' to '${target.name}'`);
                error = `Nothing to ${type}`;
                /* istanbul ignore else */
                if (settings.get().advanced.legacy_api) {
                    this.mqtt.publish('bridge/log', json_stable_stringify_without_jsonify_1.default({ type: `device_${type}_failed`, message: { from: source.name, to: target.name } }));
                }
            }
            else if (failedClusters.length === attemptedClusters.length) {
                error = `Failed to ${type}`;
            }
            responseData[`clusters`] = successfulClusters;
            responseData[`failed`] = failedClusters;
            if (successfulClusters.length !== 0) {
                if (type === 'bind') {
                    await this.setupReporting(bindSource.binds.filter((b) => successfulClusters.includes(b.cluster.name) && b.target === bindTarget));
                }
                else if ((typeof bindTarget !== 'number') && !skipDisableReporting) {
                    await this.disableUnnecessaryReportings(bindTarget);
                }
            }
        }
        const triggeredViaLegacyApi = data.topic.match(legacyTopicRegex);
        if (!triggeredViaLegacyApi) {
            const response = utils_1.default.getResponse(message, responseData, error);
            await this.mqtt.publish(`bridge/response/device/${type}`, json_stable_stringify_without_jsonify_1.default(response));
        }
        if (error) {
            logger_1.default.error(error);
        }
        else {
            this.eventBus.emitDevicesChanged();
        }
    }
    async onGroupMembersChanged(data) {
        if (data.action === 'add') {
            const bindsToGroup = this.zigbee.devices(false).map((c) => c.zh.endpoints)
                .reduce((a, v) => a.concat(v)).map((e) => e.binds)
                .reduce((a, v) => a.concat(v)).filter((b) => b.target === data.group.zh);
            await this.setupReporting(bindsToGroup);
        }
        else { // action === remove/remove_all
            if (!data.skipDisableReporting) {
                await this.disableUnnecessaryReportings(data.endpoint);
            }
        }
    }
    getSetupReportingEndpoints(bind, coordinatorEp) {
        const endpoints = utils_1.default.isEndpoint(bind.target) ? [bind.target] : bind.target.members;
        return endpoints.filter((e) => {
            const supportsInputCluster = e.supportsInputCluster(bind.cluster.name);
            const hasConfiguredReporting = !!e.configuredReportings.find((c) => c.cluster.name === bind.cluster.name);
            const hasBind = !!e.binds.find((b) => b.cluster.name === bind.cluster.name && b.target === coordinatorEp);
            return supportsInputCluster && !(hasBind && hasConfiguredReporting);
        });
    }
    async setupReporting(binds) {
        const coordinatorEndpoint = this.zigbee.firstCoordinatorEndpoint();
        for (const bind of binds.filter((b) => b.cluster.name in reportClusters)) {
            for (const endpoint of this.getSetupReportingEndpoints(bind, coordinatorEndpoint)) {
                const entity = `${this.zigbee.resolveEntity(endpoint.getDevice()).name}/${endpoint.ID}`;
                try {
                    await endpoint.bind(bind.cluster.name, coordinatorEndpoint);
                    const items = [];
                    for (const c of reportClusters[bind.cluster.name]) {
                        /* istanbul ignore else */
                        if (!c.condition || await c.condition(endpoint)) {
                            const i = { ...c };
                            delete i.condition;
                            items.push(i);
                        }
                    }
                    await endpoint.configureReporting(bind.cluster.name, items);
                    logger_1.default.info(`Succesfully setup reporting for '${entity}' cluster '${bind.cluster.name}'`);
                }
                catch (error) {
                    logger_1.default.warn(`Failed to setup reporting for '${entity}' cluster '${bind.cluster.name}'`);
                }
            }
        }
        this.eventBus.emitDevicesChanged();
    }
    async disableUnnecessaryReportings(target) {
        const coordinator = this.zigbee.firstCoordinatorEndpoint();
        const endpoints = utils_1.default.isEndpoint(target) ? [target] : target.members;
        for (const endpoint of endpoints) {
            const device = this.zigbee.resolveEntity(endpoint.getDevice());
            const entity = `${device.name}/${endpoint.ID}`;
            const boundClusters = endpoint.binds.filter((b) => b.target === coordinator)
                .map((b) => b.cluster.name);
            const requiredClusters = this.zigbee.devices(false).map((c) => c.zh.endpoints)
                .reduce((a, v) => a.concat(v))
                .map((e) => e.binds).reduce((a, v) => a.concat(v)).filter((bind) => {
                if (utils_1.default.isEndpoint(bind.target)) {
                    return bind.target === endpoint;
                }
                else {
                    return bind.target.members.includes(endpoint);
                }
            }).map((b) => b.cluster.name).filter((v, i, a) => a.indexOf(v) === i);
            for (const cluster of boundClusters.filter((c) => !requiredClusters.includes(c) && c in reportClusters)) {
                try {
                    await endpoint.unbind(cluster, coordinator);
                    const items = [];
                    for (const item of reportClusters[cluster]) {
                        /* istanbul ignore else */
                        if (!item.condition || await item.condition(endpoint)) {
                            const i = { ...item };
                            delete i.condition;
                            items.push({ ...i, maximumReportInterval: 0xFFFF });
                        }
                    }
                    await endpoint.configureReporting(cluster, items);
                    logger_1.default.info(`Succesfully disabled reporting for '${entity}' cluster '${cluster}'`);
                }
                catch (error) {
                    logger_1.default.warn(`Failed to disable reporting for '${entity}' cluster '${cluster}'`);
                }
            }
            this.eventBus.emitReconfigure({ device });
        }
    }
    async poll(data) {
        /**
         * This method poll bound endpoints and group members for state changes.
         *
         * A use case is e.g. a Hue Dimmer switch bound to a Hue bulb.
         * Hue bulbs only report their on/off state.
         * When dimming the bulb via the dimmer switch the state is therefore not reported.
         * When we receive a message from a Hue dimmer we read the brightness from the bulb (if bound).
         */
        const polls = pollOnMessage.filter((p) => { var _a; return (_a = p.cluster[data.cluster]) === null || _a === void 0 ? void 0 : _a.find((c) => c.type === data.type && utils_1.default.equalsPartial(data.data, c.data)); });
        if (polls.length) {
            const toPoll = new Set();
            // Add bound devices
            for (const endpoint of data.device.zh.endpoints) {
                for (const bind of endpoint.binds) {
                    if (utils_1.default.isEndpoint(bind.target) && bind.target.getDevice().type !== 'Coordinator') {
                        toPoll.add(bind.target);
                    }
                }
            }
            // If message is published to a group, add members of the group
            const group = data.groupID && data.groupID !== 0 && this.zigbee.groupByID(data.groupID);
            if (group) {
                group.zh.members.forEach((m) => toPoll.add(m));
            }
            for (const endpoint of toPoll) {
                for (const poll of polls) {
                    if (!poll.manufacturerIDs.includes(endpoint.getDevice().manufacturerID) ||
                        !endpoint.supportsInputCluster(poll.read.cluster)) {
                        continue;
                    }
                    let readAttrs = poll.read.attributes;
                    if (poll.read.attributesForEndpoint) {
                        const attrsForEndpoint = await poll.read.attributesForEndpoint(endpoint);
                        readAttrs = [...poll.read.attributes, ...attrsForEndpoint];
                    }
                    const key = `${endpoint.getDevice().ieeeAddr}_${endpoint.ID}_${pollOnMessage.indexOf(poll)}`;
                    if (!this.pollDebouncers[key]) {
                        this.pollDebouncers[key] = debounce_1.default(async () => {
                            try {
                                await endpoint.read(poll.read.cluster, readAttrs);
                            }
                            catch (error) {
                                logger_1.default.error(`Failed to poll ${readAttrs} from ` +
                                    `${this.zigbee.resolveEntity(endpoint.getDevice()).name}`);
                            }
                        }, 1000);
                    }
                    this.pollDebouncers[key]();
                }
            }
        }
    }
}
__decorate([
    bind_decorator_1.default
], Bind.prototype, "onMQTTMessage", null);
__decorate([
    bind_decorator_1.default
], Bind.prototype, "onGroupMembersChanged", null);
__decorate([
    bind_decorator_1.default
], Bind.prototype, "poll", null);
exports.default = Bind;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmluZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi9leHRlbnNpb24vYmluZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSwyREFBNkM7QUFDN0MsNERBQW9DO0FBQ3BDLDBEQUFrQztBQUNsQyw0REFBb0M7QUFDcEMsa0hBQThEO0FBQzlELHdEQUFnQztBQUNoQyxxRUFBdUQ7QUFDdkQsb0VBQWtDO0FBQ2xDLDZEQUFxQztBQUNyQywyREFBbUM7QUFFbkMsTUFBTSxTQUFTLEdBQUcsUUFBUSxDQUFDLEdBQUcsRUFBRSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUM7QUFDckQsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLE1BQU0sQ0FBQyxJQUFJLFFBQVEsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsVUFBVSwyQkFBMkIsQ0FBQyxDQUFDO0FBQ25HLE1BQU0sVUFBVSxHQUFHLElBQUksTUFBTSxDQUFDLElBQUksUUFBUSxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxVQUFVLHNDQUFzQyxDQUFDLENBQUM7QUFDeEcsTUFBTSxpQkFBaUIsR0FBRyxDQUFDLFdBQVcsRUFBRSxVQUFVLEVBQUUsY0FBYyxFQUFFLG1CQUFtQixFQUFFLHdCQUF3QjtJQUM3RyxnQkFBZ0IsRUFBRSwwQkFBMEIsRUFBRSwwQkFBMEIsRUFBRSxvQkFBb0I7SUFDOUYsZ0JBQWdCLEVBQUUsT0FBTyxDQUFDLENBQUM7QUFFL0IsaUNBQWlDO0FBQ2pDLE1BQU0sZ0JBQWdCLEdBQUcsRUFBQyxJQUFJLEVBQUUsY0FBYyxFQUFFLEVBQUUsRUFBRSxHQUFHLEVBQUUsSUFBSSxFQUFFLG9CQUFvQixFQUFDLENBQUM7QUFFckYsTUFBTSwwQkFBMEIsR0FBRztJQUMvQixxQkFBcUIsRUFBRSxDQUFDLEVBQUUscUJBQXFCLEVBQUUsSUFBSSxFQUFFLGdCQUFnQixFQUFFLENBQUM7Q0FDN0UsQ0FBQztBQUVGLE1BQU0s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