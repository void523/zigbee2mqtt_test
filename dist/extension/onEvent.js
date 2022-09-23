"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const zigbee_herdsman_converters_1 = __importDefault(require("zigbee-herdsman-converters"));
const extension_1 = __importDefault(require("./extension"));
/**
 * This extension calls the zigbee-herdsman-converters onEvent.
 */
class OnEvent extends extension_1.default {
    async start() {
        for (const device of this.zigbee.devices(false)) {
            this.callOnEvent(device, 'start', {});
        }
        this.eventBus.onDeviceMessage(this, (data) => this.callOnEvent(data.device, 'message', this.convertData(data)));
        this.eventBus.onDeviceJoined(this, (data) => this.callOnEvent(data.device, 'deviceJoined', this.convertData(data)));
        this.eventBus.onDeviceInterview(this, (data) => this.callOnEvent(data.device, 'deviceInterview', this.convertData(data)));
        this.eventBus.onDeviceAnnounce(this, (data) => this.callOnEvent(data.device, 'deviceAnnounce', this.convertData(data)));
        this.eventBus.onDeviceNetworkAddressChanged(this, (data) => this.callOnEvent(data.device, 'deviceNetworkAddressChanged', this.convertData(data)));
        this.eventBus.onEntityOptionsChanged(this, (data) => {
            if (data.entity.isDevice()) {
                this.callOnEvent(data.entity, 'deviceOptionsChanged', data)
                    .then(() => this.eventBus.emitDevicesChanged());
            }
        });
    }
    convertData(data) {
        return { ...data, device: data.device.zh };
    }
    async stop() {
        super.stop();
        for (const device of this.zigbee.devices(false)) {
            await this.callOnEvent(device, 'stop', {});
        }
    }
    async callOnEvent(device, type, data) {
        var _a;
        const state = this.state.get(device);
        zigbee_herdsman_converters_1.default.onEvent(type, data, device.zh, device.options, state);
        if ((_a = device.definition) === null || _a === void 0 ? void 0 : _a.onEvent) {
            await device.definition.onEvent(type, data, device.zh, device.options, state);
        }
    }
}
exports.default = OnEvent;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib25FdmVudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi9leHRlbnNpb24vb25FdmVudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQUFBLDRGQUE2QztBQUM3Qyw0REFBb0M7QUFFcEM7O0dBRUc7QUFDSCxNQUFxQixPQUFRLFNBQVEsbUJBQVM7SUFDakMsS0FBSyxDQUFDLEtBQUs7UUFDaEIsS0FBSyxNQUFNLE1BQU0sSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRTtZQUM3QyxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sRUFBRSxPQUFPLEVBQUUsRUFBRSxDQUFDLENBQUM7U0FDekM7UUFFRCxJQUFJLENBQUMsUUFBUSxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxTQUFTLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDaEgsSUFBSSxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUM3QixDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLGNBQWMsRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNyRixJQUFJLENBQUMsUUFBUSxDQUFDLGlCQUFpQixDQUFDLElBQUksRUFDaEMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxpQkFBaUIsRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN4RixJQUFJLENBQUMsUUFBUSxDQUFDLGdCQUFnQixDQUFDLElBQUksRUFDL0IsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxnQkFBZ0IsRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN2RixJQUFJLENBQUMsUUFBUSxDQUFDLDZCQUE2QixDQUFDLElBQUksRUFDNUMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSw2QkFBNkIsRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNwRyxJQUFJLENBQUMsUUFBUSxDQUFDLHNCQUFzQixDQUFDLElBQUksRUFDckMsQ0FBQyxJQUFJLEVBQUUsRUFBRTtZQUNMLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUUsRUFBRTtnQkFDeEIsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLHNCQUFzQixFQUFFLElBQUksQ0FBQztxQkFDdEQsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsa0JBQWtCLEVBQUUsQ0FBQyxDQUFDO2FBQ3ZEO1FBQ0wsQ0FBQyxDQUFDLENBQUM7SUFDWCxDQUFDO0lBRU8sV0FBVyxDQUFDLElBQWM7UUFDOUIsT0FBTyxFQUFDLEdBQUcsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBQyxDQUFDO0lBQzdDLENBQUM7SUFFUSxLQUFLLENBQUMsSUFBSTtRQUNmLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUNiLEtBQUssTUFBTSxNQUFNLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUU7WUFDN0MsTUFBTSxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsRUFBRSxDQUFDLENBQUM7U0FDOUM7SUFDTCxDQUFDO0lBRU8sS0FBSyxDQUFDLFdBQVcsQ0FBQyxNQUFjLEVBQUUsSUFBWSxFQUFFLElBQWM7O1FBQ2xFLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3JDLG9DQUFHLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxJQUFJLEVBQUUsTUFBTSxDQUFDLEVBQUUsRUFBRSxNQUFNLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBRTFELFVBQUksTUFBTSxDQUFDLFVBQVUsMENBQUUsT0FBTyxFQUFFO1lBQzVCLE1BQU0sTUFBTSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxNQUFNLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQyxPQUFPLEVBQUUsS0FBSyxDQUFDLENBQUM7U0FDakY7SUFDTCxDQUFDO0NBQ0o7QUEzQ0QsMEJBMkNDIn0=