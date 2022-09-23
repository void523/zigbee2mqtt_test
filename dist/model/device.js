"use strict";
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
/* eslint-disable brace-style */
const settings = __importStar(require("../util/settings"));
const zigbee_herdsman_converters_1 = __importDefault(require("zigbee-herdsman-converters"));
class Device {
    constructor(device) {
        this.zh = device;
    }
    get ieeeAddr() { return this.zh.ieeeAddr; }
    get ID() { return this.zh.ieeeAddr; }
    get options() { return { ...settings.get().device_options, ...settings.getDevice(this.ieeeAddr) }; }
    get name() {
        var _a;
        return this.zh.type === 'Coordinator' ? 'Coordinator' : ((_a = this.options) === null || _a === void 0 ? void 0 : _a.friendly_name) || this.ieeeAddr;
    }
    get definition() {
        // Some devices can change modelID, reconsider the definition in that case.
        // https://github.com/Koenkk/zigbee-herdsman-converters/issues/3016
        if (!this.zh.interviewing && (!this._definition || this._definitionModelID !== this.zh.modelID)) {
            this._definition = zigbee_herdsman_converters_1.default.findByDevice(this.zh);
            this._definitionModelID = this.zh.modelID;
        }
        return this._definition;
    }
    exposes() {
        /* istanbul ignore if */
        if (typeof this.definition.exposes == 'function') {
            return this.definition.exposes(this.zh, this.options);
        }
        else {
            return this.definition.exposes;
        }
    }
    ensureInSettings() {
        if (this.zh.type !== 'Coordinator' && !settings.getDevice(this.zh.ieeeAddr)) {
            settings.addDevice(this.zh.ieeeAddr);
        }
    }
    endpoint(key) {
        var _a, _b, _c;
        let endpoint;
        if (key == null || key == '')
            key = 'default';
        if (!isNaN(Number(key))) {
            endpoint = this.zh.getEndpoint(Number(key));
        }
        else if ((_a = this.definition) === null || _a === void 0 ? void 0 : _a.endpoint) {
            const ID = (_c = (_b = this.definition) === null || _b === void 0 ? void 0 : _b.endpoint) === null || _c === void 0 ? void 0 : _c.call(_b, this.zh)[key];
            if (ID)
                endpoint = this.zh.getEndpoint(ID);
            else if (key === 'default')
                endpoint = this.zh.endpoints[0];
            else
                return null;
        }
        else {
            /* istanbul ignore next */
            if (key !== 'default')
                return null;
            endpoint = this.zh.endpoints[0];
        }
        return endpoint;
    }
    endpointName(endpoint) {
        var _a, _b;
        let name = null;
        if ((_a = this.definition) === null || _a === void 0 ? void 0 : _a.endpoint) {
            name = Object.entries((_b = this.definition) === null || _b === void 0 ? void 0 : _b.endpoint(this.zh)).find((e) => e[1] == endpoint.ID)[0];
        }
        /* istanbul ignore next */
        return name === 'default' ? null : name;
    }
    isIkeaTradfri() { return this.zh.manufacturerID === 4476; }
    isDevice() { return true; }
    /* istanbul ignore next */
    isGroup() { return false; }
}
exports.default = Device;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGV2aWNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL21vZGVsL2RldmljZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7QUFBQSxnQ0FBZ0M7QUFDaEMsMkRBQTZDO0FBQzdDLDRGQUFrRTtBQUVsRSxNQUFxQixNQUFNO0lBcUJ2QixZQUFZLE1BQWlCO1FBQ3pCLElBQUksQ0FBQyxFQUFFLEdBQUcsTUFBTSxDQUFDO0lBQ3JCLENBQUM7SUFsQkQsSUFBSSxRQUFRLEtBQVksT0FBTyxJQUFJLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxDQUFBLENBQUM7SUFDakQsSUFBSSxFQUFFLEtBQVksT0FBTyxJQUFJLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxDQUFBLENBQUM7SUFDM0MsSUFBSSxPQUFPLEtBQW1CLE9BQU8sRUFBQyxHQUFHLFFBQVEsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxjQUFjLEVBQUUsR0FBRyxRQUFRLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsRUFBQyxDQUFDLENBQUEsQ0FBQztJQUMvRyxJQUFJLElBQUk7O1FBQ0osT0FBTyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksS0FBSyxhQUFhLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsT0FBQSxJQUFJLENBQUMsT0FBTywwQ0FBRSxhQUFhLEtBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQztJQUN6RyxDQUFDO0lBQ0QsSUFBSSxVQUFVO1FBQ1YsMkVBQTJFO1FBQzNFLG1FQUFtRTtRQUNuRSxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxZQUFZLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLElBQUksSUFBSSxDQUFDLGtCQUFrQixLQUFLLElBQUksQ0FBQyxFQUFFLENBQUMsT0FBTyxDQUFDLEVBQUU7WUFDN0YsSUFBSSxDQUFDLFdBQVcsR0FBRyxvQ0FBd0IsQ0FBQyxZQUFZLENBQUMsSUFB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