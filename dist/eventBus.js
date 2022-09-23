"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = __importDefault(require("events"));
events_1.default.captureRejections = true;
class EventBus {
    constructor(onError) {
        this.callbacksByExtension = {};
        this.emitter = new events_1.default.EventEmitter();
        this.emitter.setMaxListeners(100);
        this.emitter.on('error', onError);
    }
    emitAdapterDisconnected() {
        this.emitter.emit('adapterDisconnected');
    }
    onAdapterDisconnected(key, callback) {
        this.on('adapterDisconnected', callback, key);
    }
    emitPermitJoinChanged(data) {
        this.emitter.emit('permitJoinChanged', data);
    }
    onPermitJoinChanged(key, callback) {
        this.on('permitJoinChanged', callback, key);
    }
    emitPublishAvailability() {
        this.emitter.emit('publishAvailability');
    }
    onPublishAvailability(key, callback) {
        this.on('publishAvailability', callback, key);
    }
    emitEntityRenamed(data) {
        this.emitter.emit('deviceRenamed', data);
    }
    onEntityRenamed(key, callback) {
        this.on('deviceRenamed', callback, key);
    }
    emitDeviceRemoved(data) {
        this.emitter.emit('deviceRemoved', data);
    }
    onDeviceRemoved(key, callback) {
        this.on('deviceRemoved', callback, key);
    }
    emitLastSeenChanged(data) {
        this.emitter.emit('lastSeenChanged', data);
    }
    onLastSeenChanged(key, callback) {
        this.on('lastSeenChanged', callback, key);
    }
    emitDeviceNetworkAddressChanged(data) {
        this.emitter.emit('deviceNetworkAddressChanged', data);
    }
    onDeviceNetworkAddressChanged(key, callback) {
        this.on('deviceNetworkAddressChanged', callback, key);
    }
    emitDeviceAnnounce(data) {
        this.emitter.emit('deviceAnnounce', data);
    }
    onDeviceAnnounce(key, callback) {
        this.on('deviceAnnounce', callback, key);
    }
    emitDeviceInterview(data) {
        this.emitter.emit('deviceInterview', data);
    }
    onDeviceInterview(key, callback) {
        this.on('deviceInterview', callback, key);
    }
    emitDeviceJoined(data) {
        this.emitter.emit('deviceJoined', data);
    }
    onDeviceJoined(key, callback) {
        this.on('deviceJoined', callback, key);
    }
    emitEntityOptionsChanged(data) {
        this.emitter.emit('entityOptionsChanged', data);
    }
    onEntityOptionsChanged(key, callback) {
        this.on('entityOptionsChanged', callback, key);
    }
    emitDeviceLeave(data) {
        this.emitter.emit('deviceLeave', data);
    }
    onDeviceLeave(key, callback) {
        this.on('deviceLeave', callback, key);
    }
    emitDeviceMessage(data) {
        this.emitter.emit('deviceMessage', data);
    }
    onDeviceMessage(key, callback) {
        this.on('deviceMessage', callback, key);
    }
    emitMQTTMessage(data) {
        this.emitter.emit('mqttMessage', data);
    }
    onMQTTMessage(key, callback) {
        this.on('mqttMessage', callback, key);
    }
    emitMQTTMessagePublished(data) {
        this.emitter.emit('mqttMessagePublished', data);
    }
    onMQTTMessagePublished(key, callback) {
        this.on('mqttMessagePublished', callback, key);
    }
    emitPublishEntityState(data) {
        this.emitter.emit('publishEntityState', data);
    }
    onPublishEntityState(key, callback) {
        this.on('publishEntityState', callback, key);
    }
    emitGroupMembersChanged(data) {
        this.emitter.emit('groupMembersChanged', data);
    }
    onGroupMembersChanged(key, callback) {
        this.on('groupMembersChanged', callback, key);
    }
    emitDevicesChanged() {
        this.emitter.emit('devicesChanged');
    }
    onDevicesChanged(key, callback) {
        this.on('devicesChanged', callback, key);
    }
    emitScenesChanged() {
        this.emitter.emit('scenesChanged');
    }
    onScenesChanged(key, callback) {
        this.on('scenesChanged', callback, key);
    }
    emitReconfigure(data) {
        this.emitter.emit('reconfigure', data);
    }
    onReconfigure(key, callback) {
        this.on('reconfigure', callback, key);
    }
    emitStateChange(data) {
        this.emitter.emit('stateChange', data);
    }
    onStateChange(key, callback) {
        this.on('stateChange', callback, key);
    }
    on(event, callback, key) {
        if (!this.callbacksByExtension[key.constructor.name])
            this.callbacksByExtension[key.constructor.name] = [];
        this.callbacksByExtension[key.constructor.name].push({ event, callback });
        this.emitter.on(event, callback);
    }
    removeListeners(key) {
        var _a;
        (_a = this.callbacksByExtension[key.constructor.name]) === null || _a === void 0 ? void 0 : _a.forEach((e) => this.emitter.removeListener(e.event, e.callback));
    }
}
exports.default = EventBus;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXZlbnRCdXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9saWIvZXZlbnRCdXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxvREFBNEI7QUFDNUIsZ0JBQU0sQ0FBQyxpQkFBaUIsR0FBRyxJQUFJLENBQUM7QUFLaEMsTUFBcUIsUUFBUTtJQUl6QixZQUFZLE9BQStCO1FBSG5DLHlCQUFvQixHQUFpRixFQUFFLENBQUM7UUFDeEcsWUFBTyxHQUFHLElBQUksZ0JBQU0sQ0FBQyxZQUFZLEVBQUUsQ0FBQztRQUd4QyxJQUFJLENBQUMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUNsQyxJQUFJLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDdEMsQ0FBQztJQUVNLHVCQUF1QjtRQUMxQixJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO0lBQzdDLENBQUM7SUFDTSxxQkFBcUIsQ0FBQyxHQUFnQixFQUFFLFFBQW9CO1FBQy9ELElBQUksQ0FBQyxFQUFFLENBQUMscUJBQXFCLEVBQUUsUUFBUSxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBQ2xELENBQUM7SUFFTSxxQkFBcUIsQ0FBQyxJQUFpQztRQUMxRCxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUNqRCxDQUFDO0lBQ00sbUJBQW1CLENBQUMsR0FBZ0IsRUFBRSxRQUFxRDtRQUM5RixJQUFJLENBQUMsRUFBRSxDQUFDLG1CQUFtQixFQUFFLFFBQVEsRUFBRSxHQUFHLENBQUMsQ0FBQztJQUNoRCxDQUFDO0lBRU0sdUJBQXVCO1FBQzFCLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLENBQUM7SUFDN0MsQ0FBQztJQUNNLHFCQUFxQixDQUFDLEdBQWdCLEVBQUUsUUFBb0I7UUFDL0Qs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