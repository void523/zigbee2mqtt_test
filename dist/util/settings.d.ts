export declare let schema: {
    type: string;
    properties: {
        homeassistant: {
            title: string;
            requiresRestart: boolean;
            description: string;
            default: boolean;
            oneOf: ({
                type: string;
                title: string;
                properties?: undefined;
            } | {
                type: string;
                title: string;
                properties: {
                    legacy_triggers: {
                        type: string;
                        title: string;
                        description: string;
                        default: boolean;
                    };
                    discovery_topic: {
                        type: string;
                        title: string;
                        description: string;
                        requiresRestart: boolean;
                        examples: string[];
                    };
                    legacy_entity_attributes: {
                        type: string;
                        title: string;
                        description: string;
                        default: boolean;
                    };
                    status_topic: {
                        type: string;
                        title: string;
                        description: string;
                        requiresRestart: boolean;
                        examples: string[];
                    };
                };
            })[];
        };
        permit_join: {
            type: string;
            default: boolean;
            title: string;
            description: string;
        };
        availability: {
            oneOf: ({
                type: string;
                title: string;
                properties?: undefined;
            } | {
                type: string;
                title: string;
                properties: {
                    active: {
                        type: string;
                        title: string;
                        requiresRestart: boolean;
                        description: string;
                        properties: {
                            timeout: {
                                type: string;
                                title: string;
                                requiresRestart: boolean;
                                default: number;
                                description: string;
                            };
                        };
                    };
                    passive: {
                        type: string;
                        title: string;
                        requiresRestart: boolean;
                        description: string;
                        properties: {
                            timeout: {
                                type: string;
                                title: string;
                                requiresRestart: boolean;
                                default: number;
                                description: string;
                            };
                        };
                    };
                };
            })[];
            title: string;
            requiresRestart: boolean;
            description: string;
        };
        external_converters: {
            type: string;
            title: string;
            description: string;
            requiresRestart: boolean;
            items: {
                type: string;
            };
            examples: string[];
        };
        mqtt: {
            type: string;
            title: string;
            properties: {
                base_topic: {
                    type: string;
                    title: string;
                    default: string;
                    requiresRestart: boolean;
                    description: string;
                    examples: string[];
                };
                server: {
                    type: string;
                    title: string;
                    requiresRestart: boolean;
                    description: string;
                    examples: string[];
                };
                keepalive: {
                    type: string;
                    title: string;
                    requiresRestart: boolean;
                    description: string;
                    default: number;
                };
                ca: {
                    type: string;
                    title: string;
                    requiresRestart: boolean;
                    description: string;
                    examples: string[];
                };
                key: {
                    type: string;
                    title: string;
                    requiresRestart: boolean;
                    description: string;
                    examples: string[];
                };
                cert: {
                    type: string;
                    title: string;
                    description: string;
                    requiresRestart: boolean;
                    examples: string[];
                };
                user: {
                    type: string;
                    title: string;
                    requiresRestart: boolean;
                    description: string;
                    examples: string[];
                };
                password: {
                    type: string;
                    title: string;
                    requiresRestart: boolean;
                    description: string;
                    examples: string[];
                };
                client_id: {
                    type: string;
                    title: string;
                    requiresRestart: boolean;
                    description: string;
                    examples: string[];
                };
                reject_unauthorized: {
                    type: string;
                    title: string;
                    requiresRestart: boolean;
                    description: string;
                    default: boolean;
                };
                include_device_information: {
                    type: string;
                    title: string;
                    description: string;
                    default: boolean;
                };
                version: {
                    type: string[];
                    title: string;
                    requiresRestart: boolean;
                    description: string;
                    default: number;
                    examples: number[];
                };
                force_disable_retain: {
                    type: string;
                    title: string;
                    requiresRestart: boolean;
                    description: string;
                    default: boolean;
                };
            };
            required: string[];
        };
        serial: {
            type: string;
            title: string;
            properties: {
                port: {
                    type: string[];
                    title: string;
                    requiresRestart: boolean;
                    description: string;
                    examples: string[];
                };
                disable_led: {
                    type: string;
                    title: string;
                    requiresRestart: boolean;
                    description: string;
                    default: boolean;
                };
                adapter: {
                    type: string[];
                    enum: string[];
                    title: string;
                    default: string;
                    requiresRestart: boolean;
                    description: string;
                };
                baudrate: {
                    type: string;
                    title: string;
                    requiresRestart: boolean;
                    description: string;
                    examples: number[];
                };
                rtscts: {
                    type: string;
                    title: string;
                    requiresRestart: boolean;
                    description: string;
                };
            };
        };
        blocklist: {
            title: string;
            requiresRestart: boolean;
            description: string;
            type: string;
            items: {
                type: string;
            };
        };
        passlist: {
            title: string;
            requiresRestart: boolean;
            description: string;
            type: string;
            items: {
                type: string;
            };
        };
        map_options: {
            type: string;
            title: string;
            properties: {
                graphviz: {
                    type: string;
                    properties: {
                        colors: {
                            type: string;
                            properties: {
                                fill: {
                                    type: string;
                                    properties: {
                                        enddevice: {
                                            type: string;
                                        };
                                        coordinator: {
                                            type: string;
                                        };
                                        router: {
                                            type: string;
                                        };
                                    };
                                };
                                font: {
                                    type: string;
                                    properties: {
                                        enddevice: {
                                            type: string;
                                        };
                                        coordinator: {
                                            type: string;
                                        };
                                        router: {
                                            type: string;
                                        };
                                    };
                                };
                                line: {
                                    type: string;
                                    properties: {
                                        active: {
                                            type: string;
                                        };
                                        inactive: {
                                            type: string;
                                        };
                                    };
                                };
                            };
                        };
                    };
                };
            };
        };
        ota: {
            type: string;
            title: string;
            properties: {
                update_check_interval: {
                    type: string;
                    title: string;
                    description: string;
                    default: number;
                };
                disable_automatic_update_check: {
                    type: string;
                    title: string;
                    description: string;
                    default: boolean;
                };
                ikea_ota_use_test_url: {
                    type: string;
                    title: string;
                    requiresRestart: boolean;
                    description: string;
                    default: boolean;
                };
                zigbee_ota_override_index_location: {
                    type: string;
                    title: string;
                    requiresRestart: boolean;
                    description: string;
                    examples: string[];
                };
            };
        };
        frontend: {
            oneOf: ({
                type: string;
                title: string;
                properties?: undefined;
            } | {
                type: string;
                title: string;
                properties: {
                    port: {
                        type: string;
                        title: string;
                        description: string;
                        default: number;
                        requiresRestart: boolean;
                    };
                    host: {
                        type: string;
                        title: string;
                        description: string;
                        default: string;
                        requiresRestart: boolean;
                    };
                    auth_token: {
                        type: string[];
                        title: string;
                        description: string;
                        requiresRestart: boolean;
                    };
                    url: {
                        type: string[];
                        title: string;
                        description: string;
                        requiresRestart: boolean;
                    };
                };
            })[];
            title: string;
            requiresRestart: boolean;
        };
        devices: {
            type: string;
            propertyNames: {
                pattern: string;
            };
            patternProperties: {
                "^.*$": {
                    $ref: string;
                };
            };
        };
        groups: {
            type: string;
            propertyNames: {
                pattern: string;
            };
            patternProperties: {
                "^.*$": {
                    $ref: string;
                };
            };
        };
        device_options: {
            type: string;
            title: string;
        };
        advanced: {
            type: string;
            title: string;
            properties: {
                legacy_api: {
                    type: string;
                    title: string;
                    requiresRestart: boolean;
                    description: string;
                    default: boolean;
                };
                legacy_availability_payload: {
                    type: string;
                    title: string;
                    requiresRestart: boolean;
                    description: string;
                    default: boolean;
                };
                log_rotation: {
                    type: string;
                    title: string;
                    requiresRestart: boolean;
                    description: string;
                    default: boolean;
                };
                log_symlink_current: {
                    type: string;
                    title: string;
                    requiresRestart: boolean;
                    description: string;
                    default: boolean;
                };
                log_output: {
                    type: string;
                    requiresRestart: boolean;
                    items: {
                        type: string;
                        enum: string[];
                    };
                    title: string;
                    description: string;
                };
                log_directory: {
                    type: string;
                    title: string;
                    requiresRestart: boolean;
                    description: string;
                    examples: string[];
                };
                log_file: {
                    type: string;
                    title: string;
                    requiresRestart: boolean;
                    description: string;
                    examples: string[];
                    default: string;
                };
                log_level: {
                    type: string;
                    enum: string[];
                    title: string;
                    description: string;
                    default: string;
                };
                log_syslog: {
                    type: string;
                    title: string;
                    properties: {
                        host: {
                            type: string;
                            title: string;
                            description: string;
                            default: string;
                        };
                        port: {
                            type: string;
                            title: string;
                            description: string;
                            default: number;
                        };
                        protocol: {
                            type: string;
                            title: string;
                            description: string;
                            default: string;
                            examples: string[];
                        };
                        path: {
                            type: string;
                            title: string;
                            description: string;
                            default: string;
                            examples: string[];
                        };
                        pid: {
                            type: string;
                            title: string;
                            description: string;
                            default: string;
                        };
                        localhost: {
                            type: string;
                            title: string;
                            description: string;
                            default: string;
                        };
                        type: {
                            type: string;
                            title: string;
                            description: string;
                            default: string;
                        };
                        app_name: {
                            type: string;
                            title: string;
                            description: string;
                            default: string;
                        };
                        eol: {
                            type: string;
                            title: string;
                            description: string;
                            default: string;
                        };
                    };
                };
                pan_id: {
                    oneOf: {
                        type: string;
                        title: string;
                    }[];
                    title: string;
                    requiresRestart: boolean;
                    description: string;
                };
                ext_pan_id: {
                    type: string;
                    items: {
                        type: string;
                    };
                    title: string;
                    requiresRestart: boolean;
                    description: string;
                };
                channel: {
                    type: string;
                    minimum: number;
                    maximum: number;
                    default: number;
                    title: string;
                    requiresRestart: boolean;
                    description: string;
                    examples: number[];
                };
                adapter_concurrent: {
                    title: string;
                    requiresRestart: boolean;
                    type: string[];
                    description: string;
                };
                adapter_delay: {
                    type: string[];
                    requiresRestart: boolean;
                    title: string;
                    description: string;
                };
                cache_state: {
                    type: string;
                    title: string;
                    description: string;
                    default: boolean;
                };
                cache_state_persistent: {
                    type: string;
                    title: string;
                    description: string;
                    default: boolean;
                };
                cache_state_send_on_startup: {
                    type: string;
                    title: string;
                    description: string;
                    default: boolean;
                };
                last_seen: {
                    type: string;
                    enum: string[];
                    title: string;
                    description: string;
                    default: string;
                };
                elapsed: {
                    type: string;
                    title: string;
                    description: string;
                    default: boolean;
                };
                network_key: {
                    oneOf: ({
                        type: string;
                        title: string;
                        items?: undefined;
                    } | {
                        type: string;
                        items: {
                            type: string;
                        };
                        title: string;
                    })[];
                    title: string;
                    requiresRestart: boolean;
                    description: string;
                };
                timestamp_format: {
                    type: string;
                    title: string;
                    requiresRestart: boolean;
                    description: string;
                    examples: string[];
                };
                transmit_power: {
                    type: string[];
                    title: string;
                    requiresRestart: boolean;
                    description: string;
                };
                output: {
                    type: string;
                    enum: string[];
                    title: string;
                    description: string;
                };
                homeassistant_discovery_topic: {
                    type: string;
                    title: string;
                    description: string;
                    requiresRestart: boolean;
                    examples: string[];
                };
                homeassistant_legacy_entity_attributes: {
                    type: string;
                    title: string;
                    description: string;
                    default: boolean;
                };
                homeassistant_status_topic: {
                    type: string;
                    title: string;
                    description: string;
                    requiresRestart: boolean;
                    examples: string[];
                };
                homeassistant_legacy_triggers: {
                    type: string;
                    title: string;
                    description: string;
                    default: boolean;
                };
                soft_reset_timeout: {
                    type: string;
                    minimum: number;
                    requiresRestart: boolean;
                    title: string;
                    description: string;
                    readOnly: boolean;
                };
                report: {
                    type: string;
                    title: string;
                    requiresRestart: boolean;
                    readOnly: boolean;
                    description: string;
                };
                baudrate: {
                    type: string;
                    title: string;
                    requiresRestart: boolean;
                    description: string;
                    examples: number[];
                };
                rtscts: {
                    type: string;
                    title: string;
                    requiresRestart: boolean;
                    description: string;
                };
                ikea_ota_use_test_url: {
                    type: string;
                    title: string;
                    requiresRestart: boolean;
                    description: string;
                    default: boolean;
                };
            };
        };
        experimental: {
            type: string;
            title: string;
            properties: {
                transmit_power: {
                    type: string[];
                    title: string;
                    requiresRestart: boolean;
                    description: string;
                };
                output: {
                    type: string;
                    enum: string[];
                    title: string;
                    description: string;
                };
            };
        };
        whitelist: {
            readOnly: boolean;
            type: string;
            requiresRestart: boolean;
            title: string;
            items: {
                type: string;
            };
        };
        ban: {
            readOnly: boolean;
            type: string;
            requiresRestart: boolean;
            title: string;
            items: {
                type: string;
            };
        };
    };
    required: string[];
    definitions: {
        device: {
            type: string;
            properties: {
                friendly_name: {
                    type: string;
                    title: string;
                    description: string;
                    readOnly: boolean;
                };
                retain: {
                    type: string;
                    title: string;
                    description: string;
                };
                retention: {
                    type: string;
                    title: string;
                    description: string;
                };
                qos: {
                    type: string;
                    title: string;
                    description: string;
                };
                debounce: {
                    type: string;
                    title: string;
                    description: string;
                };
                debounce_ignore: {
                    type: string;
                    items: {
                        type: string;
                    };
                    examples: string[];
                    title: string;
                    description: string;
                };
                optimistic: {
                    type: string;
                    title: string;
                    description: string;
                    default: boolean;
                };
                filtered_attributes: {
                    type: string;
                    items: {
                        type: string;
                    };
                    examples: string[];
                    title: string;
                    description: string;
                };
                filtered_cache: {
                    type: string;
                    items: {
                        type: string;
                    };
                    examples: string[];
                    title: string;
                    description: string;
                };
                filtered_optimistic: {
                    type: string;
                    items: {
                        type: string;
                    };
                    examples: string[];
                    title: string;
                    description: string;
                };
                icon: {
                    type: string;
                    title: string;
                    description: string;
                };
                homeassistant: {
                    type: string[];
                    title: string;
                    properties: {
                        name: {
                            type: string;
                            title: string;
                            description: string;
                        };
                    };
                };
            };
            required: string[];
        };
        group: {
            type: string;
            properties: {
                friendly_name: {
                    type: string;
                };
                retain: {
                    type: string;
                };
                devices: {
                    type: string;
                    items: {
                        type: string;
                    };
                };
                optimistic: {
                    type: string;
                };
                qos: {
                    type: string;
                };
                off_state: {
                    type: string[];
                    enum: string[];
                    title: string;
                    default: string;
                    requiresRestart: boolean;
                    description: string;
                };
                filtered_attributes: {
                    type: string;
                    items: {
                        type: string;
                    };
                };
            };
            required: string[];
        };
    };
};
declare function write(): void;
export declare function validate(): string[];
export declare function get(): Settings;
export declare function set(path: string[], value: string | number | boolean | KeyValue): void;
export declare function apply(newSettings: Record<string, unknown>): boolean;
export declare function getGroup(IDorName: string | number): GroupOptions;
export declare function getGroups(): GroupOptions[];
export declare function getDevice(IDorName: string): DeviceOptions;
export declare function addDevice(ID: string): DeviceOptions;
export declare function addDeviceToPasslist(ID: string): void;
export declare function blockDevice(ID: string): void;
export declare function removeDevice(IDorName: string): void;
export declare function addGroup(name: string, ID?: string): GroupOptions;
export declare function addDeviceToGroup(IDorName: string, keys: string[]): void;
export declare function removeDeviceFromGroup(IDorName: string, keys: string[]): void;
export declare function removeGroup(IDorName: string | number): void;
export declare function changeEntityOptions(IDorName: string, newOptions: KeyValue): void;
export declare function changeFriendlyName(IDorName: string, newName: string): void;
export declare function reRead(): void;
export declare const testing: {
    write: typeof write;
    clear: () => void;
    defaults: RecursivePartial<Settings>;
};
export {};
//# sourceMappingURL=settings.d.ts.map