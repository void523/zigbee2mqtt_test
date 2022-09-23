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
const zigbee_herdsman_1 = require("zigbee-herdsman");
const logger_1 = __importDefault(require("./util/logger"));
const settings = __importStar(require("./util/settings"));
const data_1 = __importDefault(require("./util/data"));
const utils_1 = __importDefault(require("./util/utils"));
const object_assign_deep_1 = __importDefault(require("object-assign-deep"));
const json_stable_stringify_without_jsonify_1 = __importDefault(require("json-stable-stringify-without-jsonify"));
const device_1 = __importDefault(require("./model/device"));
const group_1 = __importDefault(require("./model/group"));
const bind_decorator_1 = __importDefault(require("bind-decorator"));
class Zigbee {
    constructor(eventBus) {
        this.groupLookup = {};
        this.deviceLookup = {};
        this.eventBus = eventBus;
    }
    async start() {
        const infoHerdsman = await utils_1.default.getDependencyVersion('zigbee-herdsman');
        logger_1.default.info(`Starting zigbee-herdsman (${infoHerdsman.version})`);
        const herdsmanSettings = {
            network: {
                panID: settings.get().advanced.pan_id === 'GENERATE' ?
                    this.generatePanID() : settings.get().advanced.pan_id,
                extendedPanID: settings.get().advanced.ext_pan_id,
                channelList: [settings.get().advanced.channel],
                networkKey: settings.get().advanced.network_key === 'GENERATE' ?
                    this.generateNetworkKey() : settings.get().advanced.network_key,
            },
            databasePath: data_1.default.joinPath('database.db'),
            databaseBackupPath: data_1.default.joinPath('database.db.backup'),
            backupPath: data_1.default.joinPath('coordinator_backup.json'),
            serialPort: {
                baudRate: settings.get().serial.baudrate,
                rtscts: settings.get().serial.rtscts,
                path: settings.get().serial.port,
                adapter: settings.get().serial.adapter,
            },
            adapter: {
                concurrent: settings.get().advanced.adapter_concurrent,
                delay: settings.get().advanced.adapter_delay,
                disableLED: settings.get().serial.disable_led,
            },
            acceptJoiningDeviceHandler: this.acceptJoiningDeviceHandler,
        };
        const herdsmanSettingsLog = object_assign_deep_1.default({}, herdsmanSettings, { network: { networkKey: 'HIDDEN' } });
        logger_1.default.debug(`Using zigbee-herdsman with settings: '${json_stable_stringify_without_jsonify_1.default(herdsmanSettingsLog)}'`);
        let startResult;
        try {
            this.herdsman = new zigbee_herdsman_1.Controller(herdsmanSettings, logger_1.default);
            startResult = await this.herdsman.start();
        }
        catch (error) {
            logger_1.default.error(`Error while starting zigbee-herdsman`);
            throw error;
        }
        this.herdsman.on('adapterDisconnected', () => this.eventBus.emitAdapterDisconnected());
        this.herdsman.on('lastSeenChanged', (data) => {
            this.eventBus.emitLastSeenChanged({ device: this.resolveDevice(data.device.ieeeAddr), reason: data.reason });
        });
        this.herdsman.on('permitJoinChanged', (data) => {
            this.eventBus.emitPermitJoinChanged(data);
        });
        this.herdsman.on('deviceNetworkAddressChanged', (data) => {
            const device = this.resolveDevice(data.device.ieeeAddr);
            logger_1.default.debug(`Device '${device.name}' changed network address`);
            this.eventBus.emitDeviceNetworkAddressChanged({ device });
        });
        this.herdsman.on('deviceAnnounce', (data) => {
            const device = this.resolveDevice(data.device.ieeeAddr);
            logger_1.default.debug(`Device '${device.name}' announced itself`);
            this.eventBus.emitDeviceAnnounce({ device });
        });
        this.herdsman.on('deviceInterview', (data) => {
            const device = this.resolveDevice(data.device.ieeeAddr);
            /* istanbul ignore if */ if (!device)
                return; // Prevent potential race
            const d = { device, status: data.status };
            this.logDeviceInterview(d);
            this.eventBus.emitDeviceInterview(d);
        });
        this.herdsman.on('deviceJoined', (data) => {
            const device = this.resolveDevice(data.device.ieeeAddr);
            /* istanbul ignore if */ if (!device)
                return; // Prevent potential race
            logger_1.default.info(`Device '${device.name}' joined`);
            this.eventBus.emitDeviceJoined({ device });
        });
        this.herdsman.on('deviceLeave', (data) => {
            var _a;
            const name = ((_a = settings.getDevice(data.ieeeAddr)) === null || _a === void 0 ? void 0 : _a.friendly_name) || data.ieeeAddr;
            logger_1.default.warn(`Device '${name}' left the network`);
            this.eventBus.emitDeviceLeave({ ieeeAddr: data.ieeeAddr, name });
        });
        this.herdsman.on('message', (data) => {
            const device = this.resolveDevice(data.device.ieeeAddr);
            logger_1.default.debug(`Received Zigbee message from '${device.name}', type '${data.type}', ` +
                `cluster '${data.cluster}', data '${json_stable_stringify_without_jsonify_1.default(data.data)}' from endpoint ${data.endpoint.ID}` +
                (data.hasOwnProperty('groupID') ? ` with groupID ${data.groupID}` : ``) +
                (device.zh.type === 'Coordinator' ? `, ignoring since it is from coordinator` : ``));
            if (device.zh.type === 'Coordinator')
                return;
            this.eventBus.emitDeviceMessage({ ...data, device });
        });
        logger_1.default.info(`zigbee-herdsman started (${startResult})`);
        logger_1.default.info(`Coordinator firmware version: '${json_stable_stringify_without_jsonify_1.default(await this.getCoordinatorVersion())}'`);
        logger_1.default.debug(`Zigbee network parameters: ${json_stable_stringify_without_jsonify_1.default(await this.herdsman.getNetworkParameters())}`);
        for (const device of this.devices(false)) {
            // If a passlist is used, all other device will be removed from the network.
            const passlist = settings.get().passlist;
            const blocklist = settings.get().blocklist;
            const remove = async (device) => {
                try {
                    await device.zh.removeFromNetwork();
                }
                catch (error) {
                    logger_1.default.error(`Failed to remove '${device.ieeeAddr}' (${error.message})`);
                }
            };
            if (passlist.length > 0) {
                if (!passlist.includes(device.ieeeAddr)) {
                    logger_1.default.warn(`Device which is not on passlist connected (${device.ieeeAddr}), removing...`);
                    await remove(device);
                }
            }
            else if (blocklist.includes(device.ieeeAddr)) {
                logger_1.default.warn(`Device on blocklist is connected (${device.ieeeAddr}), removing...`);
                await remove(device);
            }
        }
        // Check if we have to set a transmit power
        if (settings.get().advanced.hasOwnProperty('transmit_power')) {
            const transmitPower = settings.get().advanced.transmit_power;
            await this.herdsman.setTransmitPower(transmitPower);
            logger_1.default.info(`Set transmit power to '${transmitPower}'`);
        }
        return startResult;
    }
    logDeviceInterview(data) {
        const name = data.device.name;
        if (data.status === 'successful') {
            logger_1.default.info(`Successfully interviewed '${name}', device has successfully been paired`);
            if (data.device.definition) {
                const { vendor, description, model } = data.device.definition;
                logger_1.default.info(`Device '${name}' is supported, identified as: ${vendor} ${description} (${model})`);
            }
            else {
                logger_1.default.warn(`Device '${name}' with Zigbee model '${data.device.zh.modelID}' and manufacturer name ` +
                    `'${data.device.zh.manufacturerName}' is NOT supported, ` +
                    // eslint-disable-next-line max-len
                    `please follow https://www.zigbee2mqtt.io/advanced/support-new-devices/01_support_new_devices.html`);
            }
        }
        else if (data.status === 'failed') {
            logger_1.default.error(`Failed to interview '${name}', device has not successfully been paired`);
        }
        else { // data.status === 'started'
            logger_1.default.info(`Starting interview of '${name}'`);
        }
    }
    generateNetworkKey() {
        const key = Array.from({ length: 16 }, () => Math.floor(Math.random() * 255));
        settings.set(['advanced', 'network_key'], key);
        return key;
    }
    generatePanID() {
        const panID = Math.floor(Math.random() * (0xFFFF - 2)) + 1;
        settings.set(['advanced', 'pan_id'], panID);
        return panID;
    }
    async getCoordinatorVersion() {
        return this.herdsman.getCoordinatorVersion();
    }
    isStopping() {
        return this.herdsman.isStopping();
    }
    async backup() {
        return this.herdsman.backup();
    }
    async getNetworkParameters() {
        return this.herdsman.getNetworkParameters();
    }
    async reset(type) {
        await this.herdsman.reset(type);
    }
    async stop() {
        logger_1.default.info('Stopping zigbee-herdsman...');
        await this.herdsman.stop();
        logger_1.default.info('Stopped zigbee-herdsman');
    }
    getPermitJoin() {
        return this.herdsman.getPermitJoin();
    }
    getPermitJoinTimeout() {
        return this.herdsman.getPermitJoinTimeout();
    }
    async permitJoin(permit, device, time = undefined) {
        if (permit) {
            logger_1.default.info(`Zigbee: allowing new devices to join${device ? ` via ${device.name}` : ''}.`);
        }
        else {
            logger_1.default.info('Zigbee: disabling joining new devices.');
        }
        if (device && permit) {
            await this.herdsman.permitJoin(permit, device.zh, time);
        }
        else {
            await this.herdsman.permitJoin(permit, undefined, time);
        }
    }
    resolveDevice(ieeeAddr) {
        if (!this.deviceLookup[ieeeAddr]) {
            const device = this.herdsman.getDeviceByIeeeAddr(ieeeAddr);
            device && (this.deviceLookup[ieeeAddr] = new device_1.default(device));
        }
        const device = this.deviceLookup[ieeeAddr];
        if (device && !device.zh.isDeleted) {
            device.ensureInSettings();
            return device;
        }
    }
    resolveGroup(groupID) {
        const group = this.herdsman.getGroupByID(Number(groupID));
        if (group && !this.groupLookup[groupID]) {
            this.groupLookup[groupID] = new group_1.default(group, this.resolveDevice);
        }
        return this.groupLookup[groupID];
    }
    resolveEntity(key) {
        if (typeof key === 'object') {
            return this.resolveDevice(key.ieeeAddr);
        }
        else if (typeof key === 'string' && key.toLowerCase() === 'coordinator') {
            return this.resolveDevice(this.herdsman.getDevicesByType('Coordinator')[0].ieeeAddr);
        }
        else {
            const settingsDevice = settings.getDevice(key.toString());
            if (settingsDevice)
                return this.resolveDevice(settingsDevice.ID);
            const groupSettings = settings.getGroup(key);
            if (groupSettings) {
                const group = this.resolveGroup(groupSettings.ID);
                // If group does not exist, create it (since it's already in configuration.yaml)
                return group ? group : this.createGroup(groupSettings.ID);
            }
        }
    }
    firstCoordinatorEndpoint() {
        return this.herdsman.getDevicesByType('Coordinator')[0].endpoints[0];
    }
    groups() {
        return this.herdsman.getGroups().map((g) => this.resolveGroup(g.groupID));
    }
    devices(includeCoordinator = true) {
        return this.herdsman.getDevices()
            .map((d) => this.resolveDevice(d.ieeeAddr))
            .filter((d) => includeCoordinator || d.zh.type !== 'Coordinator');
    }
    async acceptJoiningDeviceHandler(ieeeAddr) {
        // If passlist is set, all devices not on passlist will be rejected to join the network
        const passlist = settings.get().passlist;
        const blocklist = settings.get().blocklist;
        if (passlist.length > 0) {
            if (passlist.includes(ieeeAddr)) {
                logger_1.default.info(`Accepting joining device which is on passlist '${ieeeAddr}'`);
                return true;
            }
            else {
                logger_1.default.info(`Rejecting joining not in passlist device '${ieeeAddr}'`);
                return false;
            }
        }
        else if (blocklist.length > 0) {
            if (blocklist.includes(ieeeAddr)) {
                logger_1.default.info(`Rejecting joining device which is on blocklist '${ieeeAddr}'`);
                return false;
            }
            else {
                logger_1.default.info(`Accepting joining not in blocklist device '${ieeeAddr}'`);
                return true;
            }
        }
        else {
            return true;
        }
    }
    async touchlinkFactoryResetFirst() {
        return this.herdsman.touchlinkFactoryResetFirst();
    }
    async touchlinkFactoryReset(ieeeAddr, channel) {
        return this.herdsman.touchlinkFactoryReset(ieeeAddr, channel);
    }
    async touchlinkIdentify(ieeeAddr, channel) {
        await this.herdsman.touchlinkIdentify(ieeeAddr, channel);
    }
    async touchlinkScan() {
        return this.herdsman.touchlinkScan();
    }
    createGroup(ID) {
        this.herdsman.createGroup(ID);
        return this.resolveGroup(ID);
    }
    deviceByNetworkAddress(networkAddress) {
        const device = this.herdsman.getDeviceByNetworkAddress(networkAddress);
        return device && this.resolveDevice(device.ieeeAddr);
    }
    groupByID(ID) {
        return this.resolveGroup(ID);
    }
}
__decorate([
    bind_decorator_1.default
], Zigbee.prototype, "resolveDevice", null);
__decorate([
    bind_decorator_1.default
], Zigbee.prototype, "acceptJoiningDeviceHandler", null);
exports.default = Zigbee;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiemlnYmVlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vbGliL3ppZ2JlZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxxREFBMkM7QUFDM0MsMkRBQW1DO0FBQ25DLDBEQUE0QztBQUM1Qyx1REFBK0I7QUFDL0IseURBQWlDO0FBQ2pDLDRFQUFrRDtBQUNsRCxrSEFBOEQ7QUFDOUQsNERBQW9DO0FBQ3BDLDBEQUFrQztBQUVsQyxvRUFBa0M7QUFFbEMsTUFBcUIsTUFBTTtJQU12QixZQUFZLFFBQWtCO1FBSHRCLGdCQUFXLEdBQXlCLEVBQUUsQ0FBQztRQUN2QyxpQkFBWSxHQUEwQixFQUFFLENBQUM7UUFHN0MsSUFBSSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7SUFDN0IsQ0FBQztJQUVELEtBQUssQ0FBQyxLQUFLO1FBQ1AsTUFBTSxZQUFZLEdBQUcsTUFBTSxlQUFLLENBQUMsb0JBQW9CLENBQUMsaUJBQWlCLENBQUMsQ0FBQztRQUN6RSxnQkFBTSxDQUFDLElBQUksQ0FBQyw2QkFBNkIsWUFBWSxDQUFDLE9BQU8sR0FBRyxDQUFDLENBQUM7UUFDbEUsTUFBTSxnQkFBZ0IsR0FBRztZQUNyQixPQUFPLEVBQUU7Z0JBQ0wsS0FBSyxFQUFFLFFBQVEsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxRQUFRLENBQUMsTUFBTSxLQUFLLFVBQVUsQ0FBQyxDQUFDO29CQUNsRCxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxRQUFRLENBQUMsTUFBZ0I7Z0JBQ25FLGFBQWEsRUFBRSxRQUFRLENBQUMsR0FBRyxFQUFFLENBQUMsUUFBUSxDQUFDLFVBQVU7Z0JBQ2pELFdBQVcsRUFBRSxDQUFDLFFBQVEsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDO2dCQUM5QyxVQUFVLEVBQUUsUUFBUSxDQUFDLEdBQUcsRUFBRSxDQUFDLFFB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