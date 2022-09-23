import Extension from './extension';
export default class Availability extends Extension {
    private timers;
    private availabilityCache;
    private retrieveStateDebouncers;
    private pingQueue;
    private pingQueueExecuting;
    private getTimeout;
    private isActiveDevice;
    private isAvailable;
    private resetTimer;
    private addToPingQueue;
    private removeFromPingQueue;
    private pingQueueExecuteNext;
    override: any;
    start(): Promise<void>;
    private publishAvailabilityForAllEntities;
    private publishAvailability;
    private onLastSeenChanged;
    override: any;
    stop(): Promise<void>;
    private retrieveState;
}
//# sourceMappingURL=availability.d.ts.map