"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Extension {
    /**
     * Besides intializing variables, the constructor should do nothing!
     *
     * @param {Zigbee} zigbee Zigbee controller
     * @param {MQTT} mqtt MQTT controller
     * @param {State} state State controller
     * @param {Function} publishEntityState Method to publish device state to MQTT.
     * @param {EventBus} eventBus The event bus
     * @param {enableDisableExtension} enableDisableExtension Enable/disable extension method
     * @param {restartCallback} restartCallback Restart Zigbee2MQTT
     * @param {addExtension} addExtension Add an extension
     */
    constructor(zigbee, mqtt, state, publishEntityState, eventBus, enableDisableExtension, restartCallback, addExtension) {
        this.zigbee = zigbee;
        this.mqtt = mqtt;
        this.state = state;
        this.publishEntityState = publishEntityState;
        this.eventBus = eventBus;
        this.enableDisableExtension = enableDisableExtension;
        this.restartCallback = restartCallback;
        this.addExtension = addExtension;
    }
    /**
     * Is called once the extension has to start
     */
    /* istanbul ignore next */
    async start() { }
    /**
     * Is called once the extension has to stop
     */
    async stop() {
        this.eventBus.removeListeners(this);
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    adjustMessageBeforePublish(entity, message) { }
}
exports.default = Extension;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0ZW5zaW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL2V4dGVuc2lvbi9leHRlbnNpb24udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQSxNQUFlLFNBQVM7SUFVcEI7Ozs7Ozs7Ozs7O09BV0c7SUFDSCxZQUFZLE1BQWMsRUFBRSxJQUFVLEVBQUUsS0FBWSxFQUFFLGtCQUFzQyxFQUN4RixRQUFrQixFQUFFLHNCQUF3RSxFQUM1RixlQUEyQixFQUFFLFlBQXFEO1FBQ2xGLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO1FBQ3JCLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO1FBQ2pCLElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO1FBQ25CLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxrQkFBa0IsQ0FBQztRQUM3QyxJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQztRQUN6QixJQUFJLENBQUMsc0JBQXNCLEdBQUcsc0JBQXNCLENBQUM7UUFDckQsSUFBSSxDQUFDLGVBQWUsR0FBRyxlQUFlLENBQUM7UUFDdkMsSUFBSSxDQUFDLFlBQVksR0FBRyxZQUFZLENBQUM7SUFDckMsQ0FBQztJQUVEOztPQUVHO0lBQ0gsMEJBQTBCO0lBQzFCLEtBQUssQ0FBQyxLQUFLLEtBQW1CLENBQUM7SUFFL0I7O09BRUc7SUFDSCxLQUFLLENBQUMsSUFBSTtRQUNOLElBQUksQ0FBQyxRQUFRLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3hDLENBQUM7SUFFRCw2REFBNkQ7SUFDdEQsMEJBQTBCLENBQUMsTUFBc0IsRUFBRSxPQUFpQixJQUFTLENBQUM7Q0FDeEY7QUFFRCxrQkFBZSxTQUFTLENBQUMifQ==