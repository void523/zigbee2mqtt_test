import Extension from '../extension';
export default class Report extends Extension {
    private queue;
    private failed;
    private enabled;
    shouldIgnoreClusterForDevice(cluster: string, definition: zhc.Definition): boolean;
    setupReporting(device: Device): Promise<void>;
    shouldSetupReporting(device: Device, messageType: string): boolean;
    override: any;
    start(): Promise<void>;
    onZigbeeEvent_(type: string, device: Device): Promise<void>;
}
//# sourceMappingURL=report.d.ts.map