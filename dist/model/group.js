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
class Group {
    constructor(group, resolveDevice) {
        this.zh = group;
        this.resolveDevice = resolveDevice;
    }
    get ID() { return this.zh.groupID; }
    get options() { return { ...settings.getGroup(this.ID) }; }
    get name() { var _a; return ((_a = this.options) === null || _a === void 0 ? void 0 : _a.friendly_name) || this.ID.toString(); }
    hasMember(device) {
        return !!device.zh.endpoints.find((e) => this.zh.members.includes(e));
    }
    membersDevices() {
        return this.zh.members.map((e) => this.resolveDevice(e.getDevice().ieeeAddr)).filter((d) => d);
    }
    membersDefinitions() {
        return this.zh.members.map((m) => zigbee_herdsman_converters_1.default.findByDevice(m.getDevice())).filter((d) => d);
    }
    isDevice() { return false; }
    isGroup() { return true; }
}
exports.default = Group;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ3JvdXAuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9saWIvbW9kZWwvZ3JvdXAudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0FBQUEsZ0NBQWdDO0FBQ2hDLDJEQUE2QztBQUM3Qyw0RkFBa0U7QUFFbEUsTUFBcUIsS0FBSztJQVF0QixZQUFZLEtBQWUsRUFBRSxhQUEyQztRQUNwRSxJQUFJLENBQUMsRUFBRSxHQUFHLEtBQUssQ0FBQztRQUNoQixJQUFJLENBQUMsYUFBYSxHQUFHLGFBQWEsQ0FBQztJQUN2QyxDQUFDO0lBUEQsSUFBSSxFQUFFLEtBQVksT0FBTyxJQUFJLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFBLENBQUM7SUFDMUMsSUFBSSxPQUFPLEtBQWtCLE9BQU8sRUFBQyxHQUFHLFFBQVEsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxFQUFDLENBQUMsQ0FBQSxDQUFDO0lBQ3JFLElBQUksSUFBSSxhQUFZLE9BQU8sT0FBQSxJQUFJLENBQUMsT0FBTywwQ0FBRSxhQUFhLEtBQUksSUFBSSxDQUFDLEVBQUUsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFBLENBQUM7SUFPOUUsU0FBUyxDQUFDLE1BQWM7UUFDcEIsT0FBTyxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUMxRSxDQUFDO0lBRUQsY0FBYztRQUNWLE9BQU8sSUFBSSxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDbkcsQ0FBQztJQUVELGtCQUFrQjtRQUNkLE9BQU8sSUFBSSxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FDN0Isb0NBQXdCLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQXFCLENBQUM7SUFDbkcsQ0FBQztJQUVELFFBQVEsS0FBb0IsT0FBTyxLQUFLLENBQUMsQ0FBQSxDQUFDO0lBQzFDLE9BQU8sS0FBbUIsT0FBTyxJQUFJLENBQUMsQ0FBQSxDQUFDO0NBQzFDO0FBNUJELHdCQTRCQyJ9