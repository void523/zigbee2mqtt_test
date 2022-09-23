"use strict";
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
const zigbee_herdsman_converters_1 = __importDefault(require("zigbee-herdsman-converters"));
const logger_1 = __importDefault(require("../../util/logger"));
const settings = __importStar(require("../../util/settings"));
const extension_1 = __importDefault(require("../extension"));
const defaultConfiguration = {
    minimumReportInterval: 3, maximumReportInterval: 300, reportableChange: 1,
};
const ZNLDP12LM = zigbee_herdsman_converters_1.default.definitions.find((d) => d.model === 'ZNLDP12LM');
const devicesNotSupportingReporting = [
    zigbee_herdsman_converters_1.default.definitions.find((d) => d.model === 'CC2530.ROUTER'),
    zigbee_herdsman_converters_1.default.definitions.find((d) => d.model === 'BASICZBR3'),
    zigbee_herdsman_converters_1.default.definitions.find((d) => d.model === 'ZM-CSW032-D'),
    zigbee_herdsman_converters_1.default.definitions.find((d) => d.model === 'TS0001'),
    zigbee_herdsman_converters_1.default.definitions.find((d) => d.model === 'TS0115'),
];
const reportKey = 1;
const getColorCapabilities = async (endpoint) => {
    if (endpoint.getClusterAttributeValue('lightingColorCtrl', 'colorCapabilities') === undefined) {
        await endpoint.read('lightingColorCtrl', ['colorCapabilities']);
    }
    const value = endpoint.getClusterAttributeValue('lightingColorCtrl', 'colorCapabilities');
    return {
        colorTemperature: (value & 1 << 4) > 0,
        colorXY: (value & 1 << 3) > 0,
    };
};
const clusters = {
    'genOnOff': [
        { attribute: 'onOff', ...defaultConfiguration, minimumReportInterval: 0, reportableChange: 0 },
    ],
    'genLevelCtrl': [
        { attribute: 'currentLevel', ...defaultConfiguration },
    ],
    'lightingColorCtrl': [
        {
            attribute: 'colorTemperature', ...defaultConfiguration,
            condition: async (endpoint) => (await getColorCapabilities(endpoint)).colorTemperature,
        },
        {
            attribute: 'currentX', ...defaultConfiguration,
            condition: async (endpoint) => (await getColorCapabilities(endpoint)).colorXY,
        },
        {
            attribute: 'currentY', ...defaultConfiguration,
            condition: async (endpoint) => (await getColorCapabilities(endpoint)).colorXY,
        },
    ],
    'closuresWindowCovering': [
        { attribute: 'currentPositionLiftPercentage', ...defaultConfiguration },
        { attribute: 'currentPositionTiltPercentage', ...defaultConfiguration },
    ],
};
class Report extends extension_1.default {
    constructor() {
        super(...arguments);
        this.queue = new Set();
        this.failed = new Set();
        this.enabled = settings.get().advanced.report;
    }
    shouldIgnoreClusterForDevice(cluster, definition) {
        if (definition === ZNLDP12LM && cluster === 'closuresWindowCovering') {
            // Device announces it but doesn't support it
            // https://github.com/Koenkk/zigbee2mqtt/issues/2611
            return true;
        }
        return false;
    }
    async setupReporting(device) {
        if (this.queue.has(device.ieeeAddr) || this.failed.has(device.ieeeAddr))
            return;
        this.queue.add(device.ieeeAddr);
        const term1 = this.enabled ? 'Setup' : 'Disable';
        const term2 = this.enabled ? 'setup' : 'disabled';
        try {
            for (const ep of device.zh.endpoints) {
                for (const [cluster, configuration] of Object.entries(clusters)) {
                    if (ep.supportsInputCluster(cluster) &&
                        !this.shouldIgnoreClusterForDevice(cluster, device.definition)) {
                        logger_1.default.debug(`${term1} reporting for '${device.ieeeAddr}' - ${ep.ID} - ${cluster}`);
                        const items = [];
                        for (const entry of configuration) {
                            if (!entry.hasOwnProperty('condition') || (await entry.condition(ep))) {
                                const toAdd = { ...entry };
                                if (!this.enabled)
                                    toAdd.maximumReportInterval = 0xFFFF;
                                items.push(toAdd);
                                delete items[items.length - 1].condition;
                            }
                        }
                        this.enabled ?
                            await ep.bind(cluster, this.zigbee.firstCoordinatorEndpoint()) :
                            await ep.unbind(cluster, this.zigbee.firstCoordinatorEndpoint());
                        await ep.configureReporting(cluster, items);
                        logger_1.default.info(`Successfully ${term2} reporting for '${device.ieeeAddr}' - ${ep.ID} - ${cluster}`);
                    }
                }
            }
            if (this.enabled) {
                device.zh.meta.reporting = reportKey;
            }
            else {
                delete device.zh.meta.reporting;
                this.eventBus.emitReconfigure({ device });
            }
            this.eventBus.emitDevicesChanged();
        }
        catch (error) {
            logger_1.default.error(`Failed to ${term1.toLowerCase()} reporting for '${device.ieeeAddr}' - ${error.stack}`);
            this.failed.add(device.ieeeAddr);
        }
        device.zh.save();
        this.queue.delete(device.ieeeAddr);
    }
    shouldSetupReporting(device, messageType) {
        if (!device || !device.zh || !device.definition)
            return false;
        // Handle messages of type endDeviceAnnce and devIncoming.
        // This message is typically send when a device comes online after being powered off
        // Ikea TRADFRI tend to forget their reporting after powered off.
        // Re-setup reporting.
        // Only resetup reporting if configuredReportings was not populated yet,
        // else reconfigure is done in zigbee-herdsman-converters ikea.js/bulbOnEvent
        // configuredReportings are saved since Zigbee2MQTT 1.17.0
        // https://github.com/Koenkk/zigbee2mqtt/issues/966
        if (this.enabled && messageType === 'deviceAnnounce' && device.isIkeaTradfri() &&
            device.zh.endpoints.filter((e) => e.configuredReportings.length === 0).length ===
                device.zh.endpoints.length) {
            return true;
        }
        // These do not support reproting.
        // https://github.com/Koenkk/zigbee-herdsman/issues/110
        const philipsIgnoreSw = ['5.127.1.26581', '5.130.1.30000'];
        if (device.zh.manufacturerName === 'Philips' &&
            philipsIgnoreSw.includes(device.zh.softwareBuildID))
            return false;
        if (device.zh.interviewing === true)
            return false;
        if (device.zh.type !== 'Router' || device.zh.powerSource === 'Battery')
            return false;
        // Gledopto devices don't support reporting.
        if (devicesNotSupportingReporting.includes(device.definition) ||
            device.definition.vendor === 'Gledopto')
            return false;
        if (this.enabled && device.zh.meta.hasOwnProperty('reporting') &&
            device.zh.meta.reporting === reportKey) {
            return false;
        }
        if (!this.enabled && !device.zh.meta.hasOwnProperty('reporting')) {
            return false;
        }
        return true;
    }
    async start() {
        for (const device of this.zigbee.devices(false)) {
            if (this.shouldSetupReporting(device, null)) {
                await this.setupReporting(device);
            }
        }
        this.eventBus.onDeviceAnnounce(this, (data) => this.onZigbeeEvent_('deviceAnnounce', data.device));
        this.eventBus.onDeviceMessage(this, (data) => this.onZigbeeEvent_('dummy', data.device));
        this.eventBus.onDeviceJoined(this, (data) => this.onZigbeeEvent_('dummy', data.device));
        this.eventBus.onDeviceNetworkAddressChanged(this, (data) => this.onZigbeeEvent_('dummy', data.device));
    }
    async onZigbeeEvent_(type, device) {
        if (this.shouldSetupReporting(device, type)) {
            await this.setupReporting(device);
        }
    }
}
exports.default = Report;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVwb3J0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbGliL2V4dGVuc2lvbi9sZWdhY3kvcmVwb3J0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQUFBLDRGQUFrRTtBQUNsRSwrREFBdUM7QUFDdkMsOERBQWdEO0FBQ2hELDZEQUFxQztBQUVyQyxNQUFNLG9CQUFvQixHQUFHO0lBQ3pCLHFCQUFxQixFQUFFLENBQUMsRUFBRSxxQkFBcUIsRUFBRSxHQUFHLEVBQUUsZ0JBQWdCLEVBQUUsQ0FBQztDQUM1RSxDQUFDO0FBRUYsTUFBTSxTQUFTLEdBQUcsb0NBQXdCLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssS0FBSyxXQUFXLENBQUMsQ0FBQztBQUU1RixNQUFNLDZCQUE2QixHQUFHO0lBQ2xDLG9DQUF3QixDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLEtBQUssZUFBZSxDQUFDO0lBQzdFLG9DQUF3QixDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLEtBQUssV0FBVyxDQUFDO0lBQ3pFLG9DQUF3QixDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLEtBQUssYUFBYSxDQUFDO0lBQzNFLG9DQUF3QixDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLEtBQUssUUFBUSxDQUFDO0lBQ3RFLG9DQUF3QixDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLEtBQUssUUFBUSxDQUFDO0NBQ3pFLENBQUM7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