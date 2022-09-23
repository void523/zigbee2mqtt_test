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
const extension_1 = __importDefault(require("./extension"));
const logger_1 = __importDefault(require("../util/logger"));
const utils_1 = __importDefault(require("../util/utils"));
const settings = __importStar(require("../util/settings"));
const debounce_1 = __importDefault(require("debounce"));
const bind_decorator_1 = __importDefault(require("bind-decorator"));
const retrieveOnReconnect = [
    { keys: ['state'] },
    { keys: ['brightness'], condition: (state) => state.state === 'ON' },
    { keys: ['color', 'color_temp'], condition: (state) => state.state === 'ON' },
];
class Availability extends extension_1.default {
    constructor() {
        super(...arguments);
        this.timers = {};
        this.availabilityCache = {};
        this.retrieveStateDebouncers = {};
        this.pingQueue = [];
        this.pingQueueExecuting = false;
    }
    getTimeout(device) {
        var _a, _b, _c;
        if (typeof device.options.availability === 'object' && ((_a = device.options.availability) === null || _a === void 0 ? void 0 : _a.timeout) != null) {
            return utils_1.default.minutes(device.options.availability.timeout);
        }
        const key = this.isActiveDevice(device) ? 'active' : 'passive';
        let value = (_c = (_b = settings.get().availability) === null || _b === void 0 ? void 0 : _b[key]) === null || _c === void 0 ? void 0 : _c.timeout;
        if (value == null)
            value = key == 'active' ? 10 : 1500;
        return utils_1.default.minutes(value);
    }
    isActiveDevice(device) {
        return (device.zh.type === 'Router' && device.zh.powerSource !== 'Battery') ||
            device.zh.powerSource === 'Mains (single phase)';
    }
    isAvailable(entity) {
        if (entity.isDevice()) {
            const ago = Date.now() - entity.zh.lastSeen;
            return ago < this.getTimeout(entity);
        }
        else {
            return entity.membersDevices().length === 0 ||
                entity.membersDevices().map((d) => this.availabilityCache[d.ieeeAddr]).includes(true);
        }
    }
    resetTimer(device) {
        clearTimeout(this.timers[device.ieeeAddr]);
        // If the timer triggers, the device is not avaiable anymore otherwise resetTimer already have been called
        if (this.isActiveDevice(device)) {
            // If device did not check in, ping it, if that fails it will be marked as offline
            this.timers[device.ieeeAddr] = setTimeout(() => this.addToPingQueue(device), this.getTimeout(device) + utils_1.default.seconds(1));
        }
        else {
            this.timers[device.ieeeAddr] = setTimeout(() => this.publishAvailability(device, true), this.getTimeout(device) + utils_1.default.seconds(1));
        }
    }
    addToPingQueue(device) {
        this.pingQueue.push(device);
        this.pingQueueExecuteNext();
    }
    removeFromPingQueue(device) {
        const index = this.pingQueue.findIndex((d) => d.ieeeAddr === device.ieeeAddr);
        index != -1 && this.pingQueue.splice(index, 1);
    }
    async pingQueueExecuteNext() {
        if (this.pingQueue.length === 0 || this.pingQueueExecuting)
            return;
        this.pingQueueExecuting = true;
        const device = this.pingQueue[0];
        let pingedSuccessfully = false;
        const available = this.availabilityCache[device.ieeeAddr] || this.isAvailable(device);
        const attempts = available ? 2 : 1;
        for (let i = 0; i < attempts; i++) {
            try {
                // Enable recovery if device is marked as available and first ping fails.
                const disableRecovery = !(i == 1 && available);
                await device.zh.ping(disableRecovery);
                pingedSuccessfully = true;
                logger_1.default.debug(`Succesfully pinged '${device.name}' (attempt ${i + 1}/${attempts})`);
                break;
            }
            catch (error) {
                logger_1.default.warn(`Failed to ping '${device.name}' (attempt ${i + 1}/${attempts}, ${error.message})`);
                // Try again in 3 seconds.
                const lastAttempt = i - 1 === attempts;
                !lastAttempt && await utils_1.default.sleep(3);
            }
        }
        this.publishAvailability(device, !pingedSuccessfully);
        this.resetTimer(device);
        this.removeFromPingQueue(device);
        // Sleep 2 seconds before executing next ping
        await utils_1.default.sleep(2);
        this.pingQueueExecuting = false;
        this.pingQueueExecuteNext();
    }
    async start() {
        this.eventBus.onEntityRenamed(this, (data) => {
            if (utils_1.default.isAvailabilityEnabledForEntity(data.entity, settings.get())) {
                this.mqtt.publish(`${data.from}/availability`, null, { retain: true, qos: 0 });
                this.publishAvailability(data.entity, false, true);
            }
        });
        this.eventBus.onDeviceRemoved(this, (data) => clearTimeout(this.timers[data.ieeeAddr]));
        this.eventBus.onDeviceLeave(this, (data) => clearTimeout(this.timers[data.ieeeAddr]));
        this.eventBus.onDeviceAnnounce(this, (data) => this.retrieveState(data.device));
        this.eventBus.onLastSeenChanged(this, this.onLastSeenChanged);
        this.eventBus.onPublishAvailability(this, this.publishAvailabilityForAllEntities);
        this.eventBus.onGroupMembersChanged(this, (data) => this.publishAvailability(data.group, false));
        this.publishAvailabilityForAllEntities();
    }
    publishAvailabilityForAllEntities() {
        for (const entity of [...this.zigbee.devices(false), ...this.zigbee.groups()]) {
            if (utils_1.default.isAvailabilityEnabledForEntity(entity, settings.get())) {
                // Publish initial availablility
                this.publishAvailability(entity, true, false, true);
                if (entity.isDevice()) {
                    this.resetTimer(entity);
                    // If an active device is initially unavailable, ping it.
                    if (this.isActiveDevice(entity) && !this.isAvailable(entity)) {
                        this.addToPingQueue(entity);
                    }
                }
            }
        }
    }
    publishAvailability(entity, logLastSeen, forcePublish = false, skipGroups = false) {
        if (logLastSeen && entity.isDevice()) {
            const ago = Date.now() - entity.zh.lastSeen;
            if (this.isActiveDevice(entity)) {
                logger_1.default.debug(`Active device '${entity.name}' was last seen ` +
                    `'${(ago / utils_1.default.minutes(1)).toFixed(2)}' minutes ago.`);
            }
            else {
                logger_1.default.debug(`Passive device '${entity.name}' was last seen '${(ago / utils_1.default.hours(1)).toFixed(2)}' hours ago.`);
            }
        }
        const available = this.isAvailable(entity);
        if (!forcePublish && this.availabilityCache[entity.ID] == available) {
            return;
        }
        if (entity.isDevice() && entity.ieeeAddr in this.availabilityCache && available &&
            this.availabilityCache[entity.ieeeAddr] === false) {
            logger_1.default.debug(`Device '${entity.name}' reconnected`);
            this.retrieveState(entity);
        }
        const topic = `${entity.name}/availability`;
        const payload = utils_1.default.availabilityPayload(available ? 'online' : 'offline', settings.get());
        this.availabilityCache[entity.ID] = available;
        this.mqtt.publish(topic, payload, { retain: true, qos: 0 });
        if (!skipGroups && entity.isDevice()) {
            this.zigbee.groups().filter((g) => g.hasMember(entity))
                .filter((g) => utils_1.default.isAvailabilityEnabledForEntity(g, settings.get()))
                .forEach((g) => this.publishAvailability(g, false, forcePublish));
        }
    }
    onLastSeenChanged(data) {
        if (utils_1.default.isAvailabilityEnabledForEntity(data.device, settings.get())) {
            // Remove from ping queue, not necessary anymore since we know the device is online.
            this.removeFromPingQueue(data.device);
            this.resetTimer(data.device);
            this.publishAvailability(data.device, false);
        }
    }
    async stop() {
        Object.values(this.timers).forEach((t) => clearTimeout(t));
        super.stop();
    }
    retrieveState(device) {
        var _a, _b;
        /**
         * Retrieve state of a device in a debounced manner, this function is called on a 'deviceAnnounce' which a
         * device can send multiple times after each other.
         */
        if (device.definition && !device.zh.interviewing && !this.retrieveStateDebouncers[device.ieeeAddr]) {
            this.retrieveStateDebouncers[device.ieeeAddr] = debounce_1.default(async () => {
                var _a;
                logger_1.default.debug(`Retrieving state of '${device.name}' after reconnect`);
                // Color and color temperature converters do both, only needs to be called once.
                for (const item of retrieveOnReconnect) {
                    if (item.condition && this.state.get(device) && !item.condition(this.state.get(device)))
                        continue;
                    const converter = device.definition.toZigbee.find((c) => c.key.find((k) => item.keys.includes(k)));
                    await ((_a = converter === null || converter === void 0 ? void 0 : converter.convertGet) === null || _a === void 0 ? void 0 : _a.call(converter, device.endpoint(), item.keys[0], { message: this.state.get(device), mapped: device.definition }).catch((e) => {
                        logger_1.default.error(`Failed to read state of '${device.name}' after reconnect (${e.message})`);
                    }));
                    await utils_1.default.sleep(500);
                }
            }, utils_1.default.seconds(2));
        }
        (_b = (_a = this.retrieveStateDebouncers)[device.ieeeAddr]) === null || _b === void 0 ? void 0 : _b.call(_a);
    }
}
__decorate([
    bind_decorator_1.default
], Availability.prototype, "publishAvailabilityForAllEntities", null);
__decorate([
    bind_decorator_1.default
], Availability.prototype, "onLastSeenChanged", null);
exports.default = Availability;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXZhaWxhYmlsaXR5LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL2V4dGVuc2lvbi9hdmFpbGFiaWxpdHkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsNERBQW9DO0FBQ3BDLDREQUFvQztBQUNwQywwREFBa0M7QUFDbEMsMkRBQTZDO0FBQzdDLHdEQUFnQztBQUNoQyxvRUFBa0M7QUFFbEMsTUFBTSxtQkFBbUIsR0FBRztJQUN4QixFQUFDLElBQUksRUFBRSxDQUFDLE9BQU8sQ0FBQyxFQUFDO0lBQ2pCLEVBQUMsSUFBSSxFQUFFLENBQUMsWUFBWSxDQUFDLEVBQUUsU0FBUyxFQUFFLENBQUMsS0FBZSxFQUFXLEVBQUUsQ0FBQyxLQUFLLENBQUMsS0FBSyxLQUFLLElBQUksRUFBQztJQUNyRixFQUFDLElBQUksRUFBRSxDQUFDLE9BQU8sRUFBRSxZQUFZLENBQUMsRUFBRSxTQUFTLEVBQUUsQ0FBQyxLQUFlLEVBQVcsRUFBRSxDQUFDLEtBQUssQ0FBQyxLQUFLLEtBQUssSUFBSSxFQUFDO0NBQ2pHLENBQUM7QUFFRixNQUFxQixZQUFhLFNBQVEsbUJBQVM7SUFBbkQ7O1FBQ1ksV0FBTSxHQUFrQyxFQUFFLENBQUM7UUFDM0Msc0JBQWlCLEdBQTJCLEVBQUUsQ0FBQztRQUMvQyw0QkFBdUIsR0FBOEIsRUFBRSxDQUFDO1FBQ3hELGNBQVMsR0FBYSxFQUFFLENBQUM7UUFDekIsdUJBQWtCLEdBQUcsS0FBSyxDQUFDO0lBbU12QyxDQUFDO0lBak1XLFVBQVUsQ0FBQyxNQUFjOztRQUM3QixJQUFJLE9BQU8sTUFBTSxDQUFDLE9BQU8sQ0FBQyxZQUFZLEtBQUssUUFBUSxJQUFJLE9BQUEsTUFBTSxDQUFDLE9BQU8sQ0FBQyxZQUFZLDBDQUFFLE9BQU8sS0FBSSxJQUFJLEVBQUU7WUFDakcsT0FBTyxlQUFLLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDLE9B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