declare class State {
    private state;
    private file;
    private timer;
    private eventBus;
    constructor(eventBus: EventBus);
    start(): void;
    stop(): void;
    private load;
    private save;
    exists(entity: Device | Group): boolean;
    get(entity: Group | Device): KeyValue;
    set(entity: Group | Device, update: KeyValue, reason?: string): KeyValue;
    remove(ID: string | number): void;
}
export default State;
//# sourceMappingURL=state.d.ts.map