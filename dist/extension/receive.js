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
const debounce_1 = __importDefault(require("debounce"));
const extension_1 = __importDefault(require("./extension"));
const json_stable_stringify_without_jsonify_1 = __importDefault(require("json-stable-stringify-without-jsonify"));
const bind_decorator_1 = __importDefault(require("bind-decorator"));
const utils_1 = __importDefault(require("../util/utils"));
class Receive extends extension_1.default {
    constructor() {
        super(...arguments);
        this.elapsed = {};
        this.debouncers = {};
    }
    async start() {
        this.eventBus.onPublishEntityState(this, this.onPublishEntityState);
        this.eventBus.onDeviceMessage(this, this.onDeviceMessage);
    }
    async onPublishEntityState(data) {
        /**
         * Prevent that outdated properties are being published.
         * In case that e.g. the state is currently held back by a debounce and a new state is published
         * remove it from the to be send debounced message.
         */
        if (data.entity.isDevice() && this.debouncers[data.entity.ieeeAddr] &&
            data.stateChangeReason !== 'publishDebounce' && data.stateChangeReason !== 'lastSeenChanged') {
            for (const key of Object.keys(data.payload)) {
                delete this.debouncers[data.entity.ieeeAddr].payload[key];
            }
        }
    }
    publishDebounce(device, payload, time, debounceIgnore) {
        if (!this.debouncers[device.ieeeAddr]) {
            this.debouncers[device.ieeeAddr] = {
                payload: {},
                publish: debounce_1.default(() => {
                    this.publishEntityState(device, this.debouncers[device.ieeeAddr].payload, 'publishDebounce');
                    this.debouncers[device.ieeeAddr].payload = {};
                }, time * 1000),
            };
        }
        if (this.isPayloadConflicted(payload, this.debouncers[device.ieeeAddr].payload, debounceIgnore)) {
            // publish previous payload immediately
            this.debouncers[device.ieeeAddr].publish.flush();
        }
        // extend debounced payload with current
        this.debouncers[device.ieeeAddr].payload = { ...this.debouncers[device.ieeeAddr].payload, ...payload };
        this.debouncers[device.ieeeAddr].publish();
    }
    // if debounce_ignore are specified (Array of strings)
    // then all newPayload values with key present in debounce_ignore
    // should equal or be undefined in oldPayload
    // otherwise payload is conflicted
    isPayloadConflicted(newPayload, oldPayload, debounceIgnore) {
        let result = false;
        Object.keys(oldPayload)
            .filter((key) => (debounceIgnore || []).includes(key))
            .forEach((key) => {
            if (typeof newPayload[key] !== 'undefined' && newPayload[key] !== oldPayload[key]) {
                result = true;
            }
        });
        return result;
    }
    shouldProcess(data) {
        if (!data.device.definition) {
            if (data.device.zh.interviewing) {
                logger_1.default.debug(`Skipping message, definition is undefined and still interviewing`);
            }
            else {
                logger_1.default.warn(`Received message from unsupported device with Zigbee model '${data.device.zh.modelID}' ` +
                    `and manufacturer name '${data.device.zh.manufacturerName}'`);
                // eslint-disable-next-line max-len
                logger_1.default.warn(`Please see: https://www.zigbee2mqtt.io/advanced/support-new-devices/01_support_new_devices.html`);
            }
            return false;
        }
        return true;
    }
    async onDeviceMessage(data) {
        /* istanbul ignore next */
        if (!data.device)
            return;
        if (!this.shouldProcess(data)) {
            utils_1.default.publishLastSeen({ device: data.device, reason: 'messageEmitted' }, settings.get(), true, this.publishEntityState);
            return;
        }
        const converters = data.device.definition.fromZigbee.filter((c) => {
            const type = Array.isArray(c.type) ? c.type.includes(data.type) : c.type === data.type;
            return c.cluster === data.cluster && type;
        });
        // Check if there is an available converter, genOta messages are not interesting.
        const ignoreClusters = ['genOta', 'genTime', 'genBasic', 'genPollCtrl'];
        if (converters.length == 0 && !ignoreClusters.includes(data.cluster)) {
            logger_1.default.debug(`No converter available for '${data.device.definition.model}' with ` +
                `cluster '${data.cluster}' and type '${data.type}' and data '${json_stable_stringify_without_jsonify_1.default(data.data)}'`);
            utils_1.default.publishLastSeen({ device: data.device, reason: 'messageEmitted' }, settings.get(), true, this.publishEntityState);
            return;
        }
        // Convert this Zigbee message to a MQTT message.
        // Get payload for the message.
        // - If a payload is returned publish it to the MQTT broker
        // - If NO payload is returned do nothing. This is for non-standard behaviour
        //   for e.g. click switches where we need to count number of clicks and detect long presses.
        const publish = (payload) => {
            if (settings.get().advanced.elapsed) {
                const now = Date.now();
                if (this.elapsed[data.device.ieeeAddr]) {
                    payload.elapsed = now - this.elapsed[data.device.ieeeAddr];
                }
                this.elapsed[data.device.ieeeAddr] = now;
            }
            // Check if we have to debounce
            if (data.device.options.debounce) {
                this.publishDebounce(data.device, payload, data.device.options.debounce, data.device.options.debounce_ignore);
            }
            else {
                this.publishEntityState(data.device, payload);
            }
        };
        const meta = { device: data.device.zh, logger: logger_1.default, state: this.state.get(data.device) };
        let payload = {};
        for (const converter of converters) {
            try {
                const converted = await converter.convert(data.device.definition, data, publish, data.device.options, meta);
                if (converted) {
                    payload = { ...payload, ...converted };
                }
            }
            catch (error) /* istanbul ignore next */ {
                logger_1.default.error(`Exception while calling fromZigbee converter: ${error.message}}`);
                logger_1.default.debug(error.stack);
            }
        }
        if (Object.keys(payload).length) {
            publish(payload);
        }
        else {
            utils_1.default.publishLastSeen({ device: data.device, reason: 'messageEmitted' }, settings.get(), true, this.publishEntityState);
        }
    }
}
__decorate([
    bind_decorator_1.default
], Receive.prototype, "onPublishEntityState", null);
__decorate([
    bind_decorator_1.default
], Receive.prototype, "onDeviceMessage", null);
exports.default = Receive;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVjZWl2ZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi9leHRlbnNpb24vcmVjZWl2ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSwyREFBNkM7QUFDN0MsNERBQW9DO0FBQ3BDLHdEQUFnQztBQUNoQyw0REFBb0M7QUFDcEMsa0hBQThEO0FBQzlELG9FQUFrQztBQUNsQywwREFBa0M7QUFJbEMsTUFBcUIsT0FBUSxTQUFRLG1CQUFTO0lBQTlDOztRQUNZLFlBQU8sR0FBMEIsRUFBRSxDQUFDO1FBQ3BDLGVBQVUsR0FBbUUsRUFBRSxDQUFDO0lBb0o1RixDQUFDO0lBbEpHLEtBQUssQ0FBQyxLQUFLO1FBQ1AsSUFBSSxDQUFDLFFBQVEsQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLG9CQUFvQixDQUFDLENBQUM7UUFDcEUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQztJQUM5RCxDQUFDO0lBRUssS0FBSyxDQUFDLG9CQUFvQixDQUFDLElBQWtDO1FBQy9EOzs7O1dBSUc7UUFDSCxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQztZQUMvRCxJQUFJLENBQUMsaUJBQWlCLEtBQUssaUJBQWlCLElBQUksSUFBSSxDQUFDLGlCQUFpQixLQUFLLGlCQUFpQixFQUFFO1lBQzlGLEtBQUssTUFBTSxHQUFHLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUU7Z0JBQ3pDLE9BQU8sSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQzthQUM3RDtTQUNKO0lBQ0wsQ0FB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