import Extension from './extension';
export default class Receive extends Extension {
    private elapsed;
    private debouncers;
    start(): Promise<void>;
    onPublishEntityState(data: eventdata.PublishEntityState): Promise<void>;
    publishDebounce(device: Device, payload: KeyValue, time: number, debounceIgnore: string[]): void;
    isPayloadConflicted(newPayload: KeyValue, oldPayload: KeyValue, debounceIgnore: string[] | null): boolean;
    shouldProcess(data: eventdata.DeviceMessage): boolean;
    onDeviceMessage(data: eventdata.DeviceMessage): Promise<void>;
}
//# sourceMappingURL=receive.d.ts.map