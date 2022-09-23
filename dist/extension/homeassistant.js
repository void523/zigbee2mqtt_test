"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
const settings = __importStar(require("../util/settings"));
const logger_1 = __importDefault(require("../util/logger"));
const utils_1 = __importDefault(require("../util/utils"));
const json_stable_stringify_without_jsonify_1 = __importDefault(require("json-stable-stringify-without-jsonify"));
const assert_1 = __importDefault(require("assert"));
const extension_1 = __importDefault(require("./extension"));
const bind_decorator_1 = __importDefault(require("bind-decorator"));
const sensorClick = {
    type: 'sensor',
    object_id: 'click',
    mockProperties: [{ property: 'click', value: null }],
    discovery_payload: {
        icon: 'mdi:toggle-switch',
        value_template: '{{ value_json.click }}',
    },
};
const ACCESS_STATE = 0b001;
const ACCESS_SET = 0b010;
const groupSupportedTypes = ['light', 'switch', 'lock', 'cover'];
const defaultStatusTopic = 'homeassistant/status';
const legacyMapping = [
    {
        models: ['WXKG01LM', 'HS1EB/HS1EB-E', 'ICZB-KPD14S', 'TERNCY-SD01', 'TERNCY-PP01', 'ICZB-KPD18S',
            'E1766', 'ZWallRemote0', 'ptvo.switch', '2AJZ4KPKEY', 'ZGRC-KEY-013', 'HGZB-02S', 'HGZB-045',
            'HGZB-1S', 'AV2010/34', 'IM6001-BTP01', 'WXKG11LM', 'WXKG03LM', 'WXKG02LM_rev1', 'WXKG02LM_rev2',
            'QBKG04LM', 'QBKG03LM', 'QBKG11LM', 'QBKG21LM', 'QBKG22LM', 'WXKG12LM', 'QBKG12LM',
            'E1743'],
        discovery: sensorClick,
    },
    {
        models: ['ICTC-G-1'],
        discovery: {
            type: 'sensor',
            mockProperties: [{ property: 'brightness', value: null }],
            object_id: 'brightness',
            discovery_payload: {
                unit_of_measurement: 'brightness',
                icon: 'mdi:brightness-5',
                value_template: '{{ value_json.brightness }}',
            },
        },
    },
];
const featurePropertyWithoutEndpoint = (feature) => {
    if (feature.endpoint) {
        return feature.property.slice(0, -1 + -1 * feature.endpoint.length);
    }
    else {
        return feature.property;
    }
};
/**
 * This extensions handles integration with HomeAssistant
 */
class HomeAssistant extends extension_1.default {
    constructor(zigbee, mqtt, state, publishEntityState, eventBus, enableDisableExtension, restartCallback, addExtension) {
        super(zigbee, mqtt, state, publishEntityState, eventBus, enableDisableExtension, restartCallback, addExtension);
        this.discovered = {};
        this.discoveredTriggers = {};
        this.discoveryTopic = settings.get().homeassistant.discovery_topic;
        this.statusTopic = settings.get().homeassistant.status_topic;
        this.entityAttributes = settings.get().homeassistant.legacy_entity_attributes;
        if (settings.get().advanced.output === 'attribute') {
            throw new Error('Home Assistant integration is not possible with attribute output!');
        }
    }
    async start() {
        if (!settings.get().advanced.cache_state) {
            logger_1.default.warn('In order for Home Assistant integration to work properly set `cache_state: true');
        }
        this.zigbee2MQTTVersion = (await utils_1.default.getZigbee2MQTTVersion(false)).version;
        this.eventBus.onDeviceRemoved(this, this.onDeviceRemoved);
        this.eventBus.onMQTTMessage(this, this.onMQTTMessage);
        this.eventBus.onEntityRenamed(this, this.onEntityRenamed);
        this.eventBus.onPublishEntityState(this, this.onPublishEntityState);
        this.eventBus.onGroupMembersChanged(this, this.onGroupMembersChanged);
        this.eventBus.onDeviceAnnounce(this, this.onZigbeeEvent);
        this.eventBus.onDeviceJoined(this, this.onZigbeeEvent);
        this.eventBus.onDeviceInterview(this, this.onZigbeeEvent);
        this.eventBus.onDeviceMessage(this, this.onZigbeeEvent);
        this.eventBus.onEntityOptionsChanged(this, (data) => this.discover(data.entity, true));
        this.mqtt.subscribe(this.statusTopic);
        this.mqtt.subscribe(defaultStatusTopic);
        this.mqtt.subscribe(`${this.discoveryTopic}/#`);
        // MQTT discovery of all paired devices on startup.
        for (const entity of [...this.zigbee.devices(false), ...this.zigbee.groups()]) {
            this.discover(entity, true);
        }
        // Send availability messages, this is required if the legacy_availability_payload option has been changed.
        this.eventBus.emitPublishAvailability();
    }
    exposeToConfig(exposes, entityType, definition, definitionExposes) {
        var _a, _b;
        // For groups an array of exposes (of the same type) is passed, this is to determine e.g. what features
        // to use for a bulb (e.g. color_xy/color_temp)
        assert_1.default(entityType === 'group' || exposes.length === 1, 'Multiple exposes for device not allowed');
        const firstExpose = exposes[0];
        assert_1.default(entityType === 'device' || groupSupportedTypes.includes(firstExpose.type), `Unsupported expose type ${firstExpose.type} for group`);
        const discoveryEntries = [];
        const endpoint = entityType === 'device' ? exposes[0].endpoint : undefined;
        const getProperty = (feature) => entityType === 'group' ?
            featurePropertyWithoutEndpoint(feature) : feature.property;
        /* istanbul ignore else */
        if (firstExpose.type === 'light') {
            const hasColorXY = exposes.find((expose) => expose.features.find((e) => e.name === 'color_xy'));
            const hasColorHS = exposes.find((expose) => expose.features.find((e) => e.name === 'color_hs'));
            const hasBrightness = exposes.find((expose) => expose.features.find((e) => e.name === 'brightness'));
            const hasColorTemp = exposes.find((expose) => expose.features.find((e) => e.name === 'color_temp'));
            const state = firstExpose.features.find((f) => f.name === 'state');
            // Prefer HS over XY when at least one of the lights in the group prefers HS over XY.
            // A light prefers HS over XY when HS is earlier in the feature array than HS.
            const preferHS = exposes.map((e) => [e.features.findIndex((ee) => ee.name === 'color_xy'),
                e.features.findIndex((ee) => ee.name === 'color_hs')])
                .filter((d) => d[0] !== -1 && d[1] !== -1 && d[1] < d[0]).length !== 0;
            const discoveryEntry = {
                type: 'light',
                object_id: endpoint ? `light_${endpoint}` : 'light',
                mockProperties: [{ property: state.property, value: null }],
                discovery_payload: {
                    brightness: !!hasBrightness,
                    schema: 'json',
                    command_topic: true,
                    brightness_scale: 254,
                    command_topic_prefix: endpoint,
                    state_topic_postfix: endpoint,
                },
            };
            const colorModes = [
                hasColorXY && !preferHS ? 'xy' : null,
                (!hasColorXY || preferHS) && hasColorHS ? 'hs' : null,
                hasColorTemp ? 'color_temp' : null,
            ].filter((c) => c);
            if (colorModes.length) {
                discoveryEntry.discovery_payload.color_mode = true;
                discoveryEntry.discovery_payload.supported_color_modes = colorModes;
            }
            if (hasColorTemp) {
                const colorTemps = exposes.map((expose) => expose.features.find((e) => e.name === 'color_temp'))
                    .filter((e) => e);
                const max = Math.min(...colorTemps.map((e) => e.value_max));
                const min = Math.max(...colorTemps.map((e) => e.value_min));
                discoveryEntry.discovery_payload.max_mireds = max;
                discoveryEntry.discovery_payload.min_mireds = min;
            }
            const effect = definitionExposes === null || definitionExposes === void 0 ? void 0 : definitionExposes.find((e) => e.type === 'enum' && e.name === 'effect');
            if (effect) {
                discoveryEntry.discovery_payload.effect = true;
                discoveryEntry.discovery_payload.effect_list = effect.values;
            }
            discoveryEntries.push(discoveryEntry);
        }
        else if (firstExpose.type === 'switch') {
            const state = firstExpose.features.find((f) => f.name === 'state');
            const property = getProperty(state);
            const discoveryEntry = {
                type: 'switch',
                object_id: endpoint ? `switch_${endpoint}` : 'switch',
                mockProperties: [{ property: property, value: null }],
                discovery_payload: {
                    payload_off: state.value_off,
                    payload_on: state.value_on,
                    value_template: `{{ value_json.${property} }}`,
                    command_topic: true,
                    command_topic_prefix: endpoint,
                },
            };
            const different = ['valve_detection', 'window_detection', 'auto_lock', 'away_mode'];
            if (different.includes(property)) {
                discoveryEntry.discovery_payload.command_topic_postfix = property;
                discoveryEntry.discovery_payload.state_off = state.value_off;
                discoveryEntry.discovery_payload.state_on = state.value_on;
                discoveryEntry.object_id = property;
                if (property === 'window_detection') {
                    discoveryEntry.discovery_payload.icon = 'mdi:window-open-variant';
                }
            }
            discoveryEntries.push(discoveryEntry);
        }
        else if (firstExpose.type === 'climate') {
            const setpointProperties = ['occupied_heating_setpoint', 'current_heating_setpoint'];
            const setpoint = firstExpose.features.find((f) => setpointProperties.includes(f.name));
            assert_1.default(setpoint, 'No setpoint found');
            const temperature = firstExpose.features.find((f) => f.name === 'local_temperature');
            assert_1.default(temperature, 'No temperature found');
            const discoveryEntry = {
                type: 'climate',
                object_id: endpoint ? `climate_${endpoint}` : 'climate',
                mockProperties: [],
                discovery_payload: {
                    // Static
                    state_topic: false,
                    temperature_unit: 'C',
                    // Setpoint
                    temp_step: setpoint.value_step,
                    min_temp: setpoint.value_min.toString(),
                    max_temp: setpoint.value_max.toString(),
                    // Temperature
                    current_temperature_topic: true,
                    current_temperature_template: `{{ value_json.${temperature.property} }}`,
                    command_topic_prefix: endpoint,
                },
            };
            const mode = firstExpose.features.find((f) => f.name === 'system_mode');
            if (mode) {
                if (mode.values.includes('sleep')) {
                    // 'sleep' is not supported by homeassistent, but is valid according to ZCL
                    // TRV that support sleep (e.g. Viessmann) will have it removed from here,
                    // this allows other expose consumers to still use it, e.g. the frontend.
                    mode.values.splice(mode.values.indexOf('sleep'), 1);
                }
                discoveryEntry.discovery_payload.mode_state_topic = true;
                discoveryEntry.discovery_payload.mode_state_template = `{{ value_json.${mode.property} }}`;
                discoveryEntry.discovery_payload.modes = mode.values;
                discoveryEntry.discovery_payload.mode_command_topic = true;
            }
            const state = firstExpose.features.find((f) => f.name === 'running_state');
            if (state) {
                discoveryEntry.mockProperties.push({ property: state.property, value: null });
                discoveryEntry.discovery_payload.action_topic = true;
                discoveryEntry.discovery_payload.action_template = `{% set values = ` +
                    `{None:None,'idle':'off','heat':'heating','cool':'cooling','fan_only':'fan'}` +
                    ` %}{{ values[value_json.${state.property}] }}`;
            }
            const coolingSetpoint = firstExpose.features.find((f) => f.name === 'occupied_cooling_setpoint');
            if (coolingSetpoint) {
                discoveryEntry.discovery_payload.temperature_low_command_topic = setpoint.name;
                discoveryEntry.discovery_payload.temperature_low_state_template =
                    `{{ value_json.${setpoint.property} }}`;
                discoveryEntry.discovery_payload.temperature_low_state_topic = true;
                discoveryEntry.discovery_payload.temperature_high_command_topic = coolingSetpoint.name;
                discoveryEntry.discovery_payload.temperature_high_state_template =
                    `{{ value_json.${coolingSetpoint.property} }}`;
                discoveryEntry.discovery_payload.temperature_high_state_topic = true;
            }
            else {
                discoveryEntry.discovery_payload.temperature_command_topic = setpoint.name;
                discoveryEntry.discovery_payload.temperature_state_template =
                    `{{ value_json.${setpoint.property} }}`;
                discoveryEntry.discovery_payload.temperature_state_topic = true;
            }
            const fanMode = firstExpose.features.find((f) => f.name === 'fan_mode');
            if (fanMode) {
                discoveryEntry.discovery_payload.fan_modes = fanMode.values;
                discoveryEntry.discovery_payload.fan_mode_command_topic = true;
                discoveryEntry.discovery_payload.fan_mode_state_template =
                    `{{ value_json.${fanMode.property} }}`;
                discoveryEntry.discovery_payload.fan_mode_state_topic = true;
            }
            const preset = firstExpose.features.find((f) => f.name === 'preset');
            if (preset) {
                discoveryEntry.discovery_payload.preset_modes = preset.values;
                discoveryEntry.discovery_payload.preset_mode_command_topic = 'preset';
                discoveryEntry.discovery_payload.preset_mode_value_template =
                    `{{ value_json.${preset.property} }}`;
                discoveryEntry.discovery_payload.preset_mode_state_topic = true;
            }
            const tempCalibration = firstExpose.features.find((f) => f.name === 'local_temperature_calibration');
            if (tempCalibration) {
                const discoveryEntry = {
                    type: 'number',
                    object_id: endpoint ? `${tempCalibration.name}_${endpoint}` : `${tempCalibration.name}`,
                    mockProperties: [{ property: tempCalibration.property, value: null }],
                    discovery_payload: {
                        value_template: `{{ value_json.${tempCalibration.property} }}`,
                        command_topic: true,
                        command_topic_prefix: endpoint,
                        command_topic_postfix: tempCalibration.property,
                        device_class: 'temperature',
                        entity_category: 'config',
                        icon: 'mdi:math-compass',
                        ...(tempCalibration.unit && { unit_of_measurement: tempCalibration.unit }),
                    },
                };
                if (tempCalibration.value_min != null)
                    discoveryEntry.discovery_payload.min = tempCalibration.value_min;
                if (tempCalibration.value_max != null)
                    discoveryEntry.discovery_payload.max = tempCalibration.value_max;
                discoveryEntries.push(discoveryEntry);
            }
            const piHeatingDemand = firstExpose.features.find((f) => f.name === 'pi_heating_demand');
            if (piHeatingDemand) {
                const discoveryEntry = {
                    type: 'sensor',
                    object_id: endpoint ? `${piHeatingDemand.name}_${endpoint}` : `${piHeatingDemand.name}`,
                    mockProperties: [{ property: piHeatingDemand.property, value: null }],
                    discovery_payload: {
                        value_template: `{{ value_json.${piHeatingDemand.property} }}`,
                        ...(piHeatingDemand.unit && { unit_of_measurement: piHeatingDemand.unit }),
                        entity_category: 'diagnostic',
                        icon: 'mdi:radiator',
                    },
                };
                discoveryEntries.push(discoveryEntry);
            }
            discoveryEntries.push(discoveryEntry);
        }
        else if (firstExpose.type === 'lock') {
            assert_1.default(!endpoint, `Endpoint not supported for lock type`);
            const state = firstExpose.features.find((f) => f.name === 'state');
            assert_1.default(state, 'No state found');
            const discoveryEntry = {
                type: 'lock',
                object_id: 'lock',
                mockProperties: [{ property: state.property, value: null }],
                discovery_payload: {
                    command_topic: true,
                    value_template: `{{ value_json.${state.property} }}`,
                },
            };
            if (state.property === 'keypad_lockout') {
                // deprecated: keypad_lockout is messy, but changing is breaking
                discoveryEntry.discovery_payload.payload_lock = state.value_on;
                discoveryEntry.discovery_payload.payload_unlock = state.value_off;
                discoveryEntry.discovery_payload.state_topic = true;
                discoveryEntry.object_id = 'keypad_lock';
            }
            else if (state.property === 'child_lock') {
                // deprecated: child_lock is messy, but changing is breaking
                discoveryEntry.discovery_payload.payload_lock = state.value_on;
                discoveryEntry.discovery_payload.payload_unlock = state.value_off;
                discoveryEntry.discovery_payload.state_locked = 'LOCK';
                discoveryEntry.discovery_payload.state_unlocked = 'UNLOCK';
                discoveryEntry.discovery_payload.state_topic = true;
                discoveryEntry.object_id = 'child_lock';
            }
            else {
                discoveryEntry.discovery_payload.state_locked = state.value_on;
                discoveryEntry.discovery_payload.state_unlocked = state.value_off;
            }
            if (state.property !== 'state') {
                discoveryEntry.discovery_payload.command_topic_postfix = state.property;
            }
            discoveryEntries.push(discoveryEntry);
        }
        else if (firstExpose.type === 'cover') {
            const position = exposes.find((expose) => expose.features.find((e) => e.name === 'position'));
            const tilt = exposes.find((expose) => expose.features.find((e) => e.name === 'tilt'));
            const motorState = definitionExposes === null || definitionExposes === void 0 ? void 0 : definitionExposes.find((e) => e.type === 'enum' && e.name === 'motor_state' &&
                e.access === ACCESS_STATE);
            const running = definitionExposes === null || definitionExposes === void 0 ? void 0 : definitionExposes.find((e) => e.type === 'binary' && e.name === 'running');
            const discoveryEntry = {
                type: 'cover',
                mockProperties: [],
                object_id: endpoint ? `cover_${endpoint}` : 'cover',
                discovery_payload: {
                    command_topic_prefix: endpoint,
                    command_topic: true,
                    state_topic: true,
                },
            };
            // For curtains that have `motor_state` lookup a possible state names and make this
            // available for discovery. If the curtains only support the `running` value,
            // then we use it anyway. The movement direction is calculated (assumed) in this case.
            if (motorState) {
                const openingLookup = ['opening', 'open', 'forward', 'up', 'rising'];
                const closingLookup = ['closing', 'close', 'backward', 'back', 'reverse', 'down', 'declining'];
                const stoppedLookup = ['stopped', 'stop', 'pause', 'paused'];
                const openingState = motorState.values.find((s) => openingLookup.includes(s.toLowerCase()));
                const closingState = motorState.values.find((s) => closingLookup.includes(s.toLowerCase()));
                const stoppedState = motorState.values.find((s) => stoppedLookup.includes(s.toLowerCase()));
                if (openingState && closingState && stoppedState) {
                    discoveryEntry.discovery_payload.state_opening = openingState;
                    discoveryEntry.discovery_payload.state_closing = closingState;
                    discoveryEntry.discovery_payload.state_stopped = stoppedState;
                    discoveryEntry.discovery_payload.value_template = `{% if not value_json.motor_state %} ` +
                        `${stoppedState} {% else %} {{ value_json.motor_state }} {% endif %}`;
                }
            }
            else if (running) {
                discoveryEntry.discovery_payload.value_template = `{% if not value_json.running %} ` +
                    `stopped {% else %} {% if value_json.position > 0 %} closing {% else %} ` +
                    `opening {% endif %} {% endif %}`;
            }
            else {
                discoveryEntry.discovery_payload.value_template = `{{ value_json.state }}`;
                discoveryEntry.discovery_payload.state_open = 'OPEN';
                discoveryEntry.discovery_payload.state_closed = 'CLOSE';
            }
            if (!position && !tilt) {
                discoveryEntry.discovery_payload.optimistic = true;
            }
            if (position) {
                const p = position.features.find((f) => f.name === 'position');
                discoveryEntry.discovery_payload = { ...discoveryEntry.discovery_payload,
                    position_template: `{{ value_json.${getProperty(p)} }}`,
                    set_position_template: `{ "${getProperty(p)}": {{ position }} }`,
                    set_position_topic: true,
                    position_topic: true,
                };
            }
            if (tilt) {
                const t = tilt.features.find((f) => f.name === 'tilt');
                discoveryEntry.discovery_payload = { ...discoveryEntry.discovery_payload,
                    tilt_command_topic: true,
                    tilt_status_topic: true,
                    tilt_status_template: `{{ value_json.${getProperty(t)} }}`,
                };
            }
            discoveryEntries.push(discoveryEntry);
        }
        else if (firstExpose.type === 'fan') {
            assert_1.default(!endpoint, `Endpoint not supported for fan type`);
            const discoveryEntry = {
                type: 'fan',
                object_id: 'fan',
                mockProperties: [{ property: 'fan_state', value: null }],
                discovery_payload: {
                    state_topic: true,
                    state_value_template: '{{ value_json.fan_state }}',
                    command_topic: true,
                    command_topic_postfix: 'fan_state',
                },
            };
            const speed = firstExpose.features.find((e) => e.name === 'mode');
            if (speed) {
                // A fan entity in Home Assistant 2021.3 and above may have a speed,
                // controlled by a percentage from 1 to 100, and/or non-speed presets.
                // The MQTT Fan integration allows the speed percentage to be mapped
                // to a narrower range of speeds (e.g. 1-3), and for these speeds to be
                // translated to and from MQTT messages via templates.
                //
                // For the fixed fan modes in ZCL hvacFanCtrl, we model speeds "low",
                // "medium", and "high" as three speeds covering the full percentage
                // range as done in Home Assistant's zigpy fan integration, plus
                // presets "on", "auto" and "smart" to cover the remaining modes in
                // ZCL. This supports a generic ZCL HVAC Fan Control fan. "Off" is
                // always a valid speed.
                let speeds = ['off'].concat(['low', 'medium', 'high', '1', '2', '3', '4', '5',
                    '6', '7', '8', '9'].filter((s) => speed.values.includes(s)));
                let presets = ['on', 'auto', 'smart'].filter((s) => speed.values.includes(s));
                if (['99432'].includes(definition.model)) {
                    // The Hampton Bay 99432 fan implements 4 speeds using the ZCL
                    // hvacFanCtrl values `low`, `medium`, `high`, and `on`, and
                    // 1 preset called "Comfort Breeze" using the ZCL value `smart`.
                    // ZCL value `auto` is unused.
                    speeds = ['off', 'low', 'medium', 'high', 'on'];
                    presets = ['smart'];
                }
                const allowed = [...speeds, ...presets];
                speed.values.forEach((s) => assert_1.default(allowed.includes(s)));
                const percentValues = speeds.map((s, i) => `'${s}':${i}`).join(', ');
                const percentCommands = speeds.map((s, i) => `${i}:'${s}'`).join(', ');
                const presetList = presets.map((s) => `'${s}'`).join(', ');
                discoveryEntry.discovery_payload.percentage_state_topic = true;
                discoveryEntry.discovery_payload.percentage_command_topic = true;
                discoveryEntry.discovery_payload.percentage_value_template =
                    `{{ {${percentValues}}[value_json.${speed.property}] | default('None') }}`;
                discoveryEntry.discovery_payload.percentage_command_template =
                    `{{ {${percentCommands}}[value] | default('') }}`;
                discoveryEntry.discovery_payload.speed_range_min = 1;
                discoveryEntry.discovery_payload.speed_range_max = speeds.length - 1;
                assert_1.default(presets.length !== 0);
                discoveryEntry.discovery_payload.preset_mode_state_topic = true;
                discoveryEntry.discovery_payload.preset_mode_command_topic = 'fan_mode';
                discoveryEntry.discovery_payload.preset_mode_value_template =
                    `{{ value_json.${speed.property} if value_json.${speed.property} in [${presetList}]` +
                        ` else 'None' | default('None') }}`;
                discoveryEntry.discovery_payload.preset_modes = presets;
            }
            discoveryEntries.push(discoveryEntry);
        }
        else if (firstExpose.type === 'binary') {
            const lookup = {
                battery_low: { entity_category: 'diagnostic', device_class: 'battery' },
                button_lock: { entity_category: 'config', icon: 'mdi:lock' },
                calibration: { entity_category: 'config', icon: 'mdi:progress-wrench' },
                carbon_monoxide: { device_class: 'safety' },
                card: { entity_category: 'config', icon: 'mdi:clipboard-check' },
                child_lock: { entity_category: 'config', icon: 'mdi:account-lock' },
                color_sync: { entity_category: 'config', icon: 'mdi:sync-circle' },
                consumer_connected: { entity_category: 'diagnostic', device_class: 'connectivity' },
                contact: { device_class: 'door' },
                garage_door_contact: { device_class: 'garage_door', payload_on: false, payload_off: true },
                eco_mode: { entity_category: 'config', icon: 'mdi:leaf' },
                expose_pin: { entity_category: 'config', icon: 'mdi:pin' },
                flip_indicator_light: { entity_category: 'config', icon: 'mdi:arrow-left-right' },
                gas: { device_class: 'gas' },
                invert_cover: { entity_category: 'config', icon: 'mdi:arrow-left-right' },
                led_disabled_night: { entity_category: 'config', icon: 'mdi:led-off' },
                led_indication: { entity_category: 'config', icon: 'mdi:led-on' },
                legacy: { entity_category: 'config', icon: 'mdi:cog' },
                motor_reversal: { entity_category: 'config', icon: 'mdi:arrow-left-right' },
                moving: { device_class: 'moving' },
                no_position_support: { entity_category: 'config', icon: 'mdi:minus-circle-outline' },
                occupancy: { device_class: 'motion' },
                power_outage_memory: { entity_category: 'config', icon: 'mdi:memory' },
                presence: { device_class: 'presence' },
                smoke: { device_class: 'smoke' },
                sos: { device_class: 'safety' },
                tamper: { device_class: 'tamper' },
                temperature_scale: { entity_category: 'config', icon: 'mdi:temperature-celsius' },
                test: { entity_category: 'diagnostic', icon: 'mdi:test-tube' },
                vibration: { device_class: 'vibration' },
                water_leak: { device_class: 'moisture' },
            };
            /**
             * If Z2M binary attribute has SET access then expose it as `switch` in HA
             * There is also a check on the values for typeof boolean to prevent invalid values and commands
             * silently failing - commands work fine but some devices won't reject unexpected values.
             * https://github.com/Koenkk/zigbee2mqtt/issues/7740
             */
            if (firstExpose.access & ACCESS_SET) {
                const discoveryEntry = {
                    type: 'switch',
                    mockProperties: [{ property: firstExpose.property, value: null }],
                    object_id: endpoint ?
                        `switch_${firstExpose.name}_${endpoint}` :
                        `switch_${firstExpose.name}`,
                    discovery_payload: {
                        value_template: typeof firstExpose.value_on === 'boolean' ?
                            `{% if value_json.${firstExpose.property} %} true {% else %} false {% endif %}` :
                            `{{ value_json.${firstExpose.property} }}`,
                        payload_on: firstExpose.value_on.toString(),
                        payload_off: firstExpose.value_off.toString(),
                        command_topic: true,
                        command_topic_prefix: endpoint,
                        command_topic_postfix: firstExpose.property,
                        ...(lookup[firstExpose.name] || {}),
                    },
                };
                discoveryEntries.push(discoveryEntry);
            }
            else {
                const discoveryEntry = {
                    type: 'binary_sensor',
                    object_id: endpoint ? `${firstExpose.name}_${endpoint}` : `${firstExpose.name}`,
                    mockProperties: [{ property: firstExpose.property, value: null }],
                    discovery_payload: {
                        value_template: `{{ value_json.${firstExpose.property} }}`,
                        payload_on: firstExpose.value_on,
                        payload_off: firstExpose.value_off,
                        ...(lookup[firstExpose.name] || {}),
                    },
                };
                discoveryEntries.push(discoveryEntry);
            }
        }
        else if (firstExpose.type === 'numeric') {
            const lookup = {
                ac_frequency: { device_class: 'frequency', enabled_by_default: false, entity_category: 'diagnostic',
                    state_class: 'measurement' },
                alarm_humidity_max: { device_class: 'humidity', icon: 'mdi:water-plus' },
                alarm_humidity_min: { device_class: 'humidity', icon: 'mdi:water-minus' },
                alarm_temperature_max: { device_class: 'temperature', icon: 'mdi:thermometer-high' },
                alarm_temperature_min: { device_class: 'temperature', icon: 'mdi:thermometer-low' },
                angle: { icon: 'angle-acute' },
                angle_axis: { icon: 'angle-acute' },
                aqi: { device_class: 'aqi', state_class: 'measurement' },
                auto_relock_time: { entity_category: 'config', icon: 'mdi:timer' },
                away_preset_days: { entity_category: 'config', icon: 'mdi:timer' },
                away_preset_temperature: { entity_category: 'config', icon: 'mdi:thermometer' },
                battery: { device_class: 'battery', entity_category: 'diagnostic', state_class: 'measurement' },
                battery2: { device_class: 'battery', entity_category: 'diagnostic', state_class: 'measurement' },
                battery_voltage: { device_class: 'voltage', entity_category: 'diagnostic', state_class: 'measurement' },
                boost_time: { entity_category: 'config', icon: 'mdi:timer' },
                calibration: { entity_category: 'config', icon: 'mdi:wrench-clock' },
                calibration_time: { entity_category: 'config', icon: 'mdi:wrench-clock' },
                co2: { device_class: 'carbon_dioxide', state_class: 'measurement' },
                comfort_temperature: { entity_category: 'config', icon: 'mdi:thermometer' },
                cpu_temperature: {
                    device_class: 'temperature', entity_category: 'diagnostic', state_class: 'measurement',
                },
                cube_side: { icon: 'mdi:cube' },
                current: {
                    device_class: 'current',
                    enabled_by_default: false,
                    entity_category: 'diagnostic',
                    state_class: 'measurement',
                },
                current_phase_b: {
                    device_class: 'current',
                    enabled_by_default: false,
                    entity_category: 'diagnostic',
                    state_class: 'measurement',
                },
                current_phase_c: {
                    device_class: 'current',
                    enabled_by_default: false,
                    entity_category: 'diagnostic',
                    state_class: 'measurement',
                },
                deadzone_temperature: { entity_category: 'config', icon: 'mdi:thermometer' },
                device_temperature: {
                    device_class: 'temperature', entity_category: 'diagnostic', state_class: 'measurement',
                },
                duration: { entity_category: 'config', icon: 'mdi:timer' },
                eco2: { device_class: 'carbon_dioxide', state_class: 'measurement' },
                eco_temperature: { entity_category: 'config', icon: 'mdi:thermometer' },
                energy: { device_class: 'energy', state_class: 'total_increasing' },
                formaldehyd: { state_class: 'measurement' },
                gas_density: { icon: 'mdi:google-circles-communities', state_class: 'measurement' },
                hcho: { icon: 'mdi:air-filter', state_class: 'measurement' },
                humidity: { device_class: 'humidity', state_class: 'measurement' },
                humidity_calibration: { entity_category: 'config', icon: 'mdi:wrench-clock' },
                humidity_max: { entity_category: 'config', icon: 'mdi:water-percent' },
                humidity_min: { entity_category: 'config', icon: 'mdi:water-percent' },
                illuminance_calibration: { entity_category: 'config', icon: 'mdi:wrench-clock' },
                illuminance_lux: { device_class: 'illuminance', state_class: 'measurement' },
                illuminance: { device_class: 'illuminance', enabled_by_default: false, state_class: 'measurement' },
                linkquality: {
                    enabled_by_default: false,
                    entity_category: 'diagnostic',
                    icon: 'mdi:signal',
                    state_class: 'measurement',
                },
                local_temperature: { device_class: 'temperature', state_class: 'measurement' },
                max_temperature: { entity_category: 'config', icon: 'mdi:thermometer' },
                max_temperature_limit: { entity_category: 'config', icon: 'mdi:thermometer' },
                min_temperature: { entity_category: 'config', icon: 'mdi:thermometer' },
                measurement_poll_interval: { entity_category: 'config', icon: 'mdi:clock-out' },
                occupancy_timeout: { entity_category: 'config', icon: 'mdi:timer' },
                pm10: { device_class: 'pm10', state_class: 'measurement' },
                pm25: { device_class: 'pm25', state_class: 'measurement' },
                people: { state_class: 'measurement', icon: 'mdi:account-multiple' },
                position: { icon: 'mdi:valve', state_class: 'measurement' },
                power: { device_class: 'power', entity_category: 'diagnostic', state_class: 'measurement' },
                power_factor: { device_class: 'power_factor', enabled_by_default: false,
                    entity_category: 'diagnostic', state_class: 'measurement' },
                precision: { entity_category: 'config', icon: 'mdi:decimal-comma-increase' },
                pressure: { device_class: 'pressure', state_class: 'measurement' },
                presence_timeout: { entity_category: 'config', icon: 'mdi:timer' },
                reporting_time: { entity_category: 'config', icon: 'mdi:clock-time-one-outline' },
                requested_brightness_level: {
                    enabled_by_default: false, entity_category: 'diagnostic', icon: 'mdi:brightness-5',
                },
                requested_brightness_percent: {
                    enabled_by_default: false, entity_category: 'diagnostic', icon: 'mdi:brightness-5',
                },
                smoke_density: { icon: 'mdi:google-circles-communities', state_class: 'measurement' },
                soil_moisture: { icon: 'mdi:water-percent', state_class: 'measurement' },
                temperature: { device_class: 'temperature', state_class: 'measurement' },
                temperature_calibration: { entity_category: 'config', icon: 'mdi:wrench-clock' },
                temperature_max: { entity_category: 'config', icon: 'mdi:thermometer-plus' },
                temperature_min: { entity_category: 'config', icon: 'mdi:thermometer-minus' },
                transition: { entity_category: 'config', icon: 'mdi:transition' },
                voc: { device_class: 'volatile_organic_compounds', state_class: 'measurement' },
                vibration_timeout: { entity_category: 'config', icon: 'mdi:timer' },
                voltage: {
                    device_class: 'voltage',
                    enabled_by_default: false,
                    entity_category: 'diagnostic',
                    state_class: 'measurement',
                },
                voltage_phase_b: {
                    device_class: 'voltage',
                    enabled_by_default: false,
                    entity_category: 'diagnostic',
                    state_class: 'measurement',
                },
                voltage_phase_c: {
                    device_class: 'voltage',
                    enabled_by_default: false,
                    entity_category: 'diagnostic',
                    state_class: 'measurement',
                },
                x_axis: { icon: 'mdi:axis-x-arrow' },
                y_axis: { icon: 'mdi:axis-y-arrow' },
                z_axis: { icon: 'mdi:axis-z-arrow' },
            };
            const extraAttrs = {};
            // If a variable includes Wh, mark it as energy
            if (firstExpose.unit && ['Wh', 'kWh'].includes(firstExpose.unit)) {
                Object.assign(extraAttrs, { device_class: 'energy', state_class: 'total_increasing' });
            }
            const allowsSet = firstExpose.access & ACCESS_SET;
            const discoveryEntry = {
                type: 'sensor',
                object_id: endpoint ? `${firstExpose.name}_${endpoint}` : `${firstExpose.name}`,
                mockProperties: [{ property: firstExpose.property, value: null }],
                discovery_payload: {
                    value_template: `{{ value_json.${firstExpose.property} }}`,
                    enabled_by_default: !allowsSet,
                    ...(firstExpose.unit && { unit_of_measurement: firstExpose.unit }),
                    ...lookup[firstExpose.name],
                    ...extraAttrs,
                },
            };
            discoveryEntries.push(discoveryEntry);
            /**
             * If numeric attribute has SET access then expose as SELECT entity too.
             * Note: currently both sensor and number are discovered, this is to avoid
             * breaking changes for sensors already existing in HA (legacy).
             */
            if (allowsSet) {
                const discoveryEntry = {
                    type: 'number',
                    object_id: endpoint ? `${firstExpose.name}_${endpoint}` : `${firstExpose.name}`,
                    mockProperties: [{ property: firstExpose.property, value: null }],
                    discovery_payload: {
                        value_template: `{{ value_json.${firstExpose.property} }}`,
                        command_topic: true,
                        command_topic_prefix: endpoint,
                        command_topic_postfix: firstExpose.property,
                        ...(firstExpose.unit && { unit_of_measurement: firstExpose.unit }),
                        ...lookup[firstExpose.name],
                    },
                };
                if (((_a = lookup[firstExpose.name]) === null || _a === void 0 ? void 0 : _a.device_class) === 'temperature') {
                    discoveryEntry.discovery_payload.device_class == ((_b = lookup[firstExpose.name]) === null || _b === void 0 ? void 0 : _b.device_class);
                }
                else {
                    delete discoveryEntry.discovery_payload.device_class;
                }
                if (firstExpose.value_min != null)
                    discoveryEntry.discovery_payload.min = firstExpose.value_min;
                if (firstExpose.value_max != null)
                    discoveryEntry.discovery_payload.max = firstExpose.value_max;
                discoveryEntries.push(discoveryEntry);
            }
        }
        else if (firstExpose.type === 'enum') {
            const lookup = {
                action: { icon: 'mdi:gesture-double-tap' },
                alarm_humidity: { icon: 'mdi:water-percent-alert' },
                alarm_temperature: { icon: 'mdi:thermometer-alert' },
                backlight_auto_dim: { entity_category: 'config', icon: 'mdi:brightness-auto' },
                backlight_mode: { entity_category: 'config', icon: 'mdi:lightbulb' },
                color_power_on_behavior: { entity_category: 'config', icon: 'mdi:palette' },
                control_mode: { entity_category: 'config', icon: 'mdi:tune' },
                device_mode: { entity_category: 'config', icon: 'mdi:tune' },
                effect: { enabled_by_default: false, icon: 'mdi:palette' },
                force: { enabled_by_default: false, icon: 'mdi:valve' },
                keep_time: { entity_category: 'config', icon: 'mdi:av-timer' },
                keypad_lockout: { entity_category: 'config', icon: 'mdi:lock' },
                load_detection_mode: { entity_category: 'config', icon: 'mdi:tune' },
                load_dimmable: { entity_category: 'diagnostic', icon: 'mdi:chart-bell-curve' },
                load_type: { entity_category: 'diagnostic', icon: 'mdi:led-on' },
                melody: { entity_category: 'config', icon: 'mdi:music-note' },
                mode_phase_control: { entity_category: 'config', icon: 'mdi:tune' },
                mode: { entity_category: 'config', icon: 'mdi:tune' },
                motion_sensitivity: { entity_category: 'config', icon: 'mdi:tune' },
                operation_mode: { entity_category: 'config', icon: 'mdi:tune' },
                power_on_behavior: { entity_category: 'config', icon: 'mdi:power-settings' },
                power_outage_memory: { entity_category: 'config', icon: 'mdi:power-settings' },
                power_supply_mode: { entity_category: 'diagnostic', icon: 'mdi:power-settings' },
                power_type: { entity_category: 'diagnostic', icon: 'mdi:lightning-bolt-circle' },
                sensitivity: { entity_category: 'config', icon: 'mdi:tune' },
                sensors_type: { entity_category: 'config', icon: 'mdi:tune' },
                sound_volume: { entity_category: 'config', icon: 'mdi:volume-high' },
                status: { icon: 'mdi:state-machine' },
                switch_type: { entity_category: 'config', icon: 'mdi:tune' },
                thermostat_unit: { entity_category: 'config', icon: 'mdi:thermometer' },
                volume: { entity_category: 'config', icon: 'mdi: volume-high' },
                week: { entity_category: 'config', icon: 'mdi:calendar-clock' },
            };
            const valueTemplate = firstExpose.access & ACCESS_STATE ?
                `{{ value_json.${firstExpose.property} }}` : undefined;
            if (firstExpose.access & ACCESS_STATE) {
                discoveryEntries.push({
                    type: 'sensor',
                    object_id: firstExpose.property,
                    mockProperties: [{ property: firstExpose.property, value: null }],
                    discovery_payload: {
                        value_template: valueTemplate,
                        enabled_by_default: !(firstExpose.access & ACCESS_SET),
                        ...lookup[firstExpose.name],
                    },
                });
            }
            /**
             * If enum attribute has SET access then expose as SELECT entity too.
             * Note: currently both sensor and select are discovered, this is to avoid
             * breaking changes for sensors already existing in HA (legacy).
             */
            if ((firstExpose.access & ACCESS_SET)) {
                discoveryEntries.push({
                    type: 'select',
                    object_id: firstExpose.property,
                    mockProperties: [],
                    discovery_payload: {
                        value_template: valueTemplate,
                        state_topic: !!(firstExpose.access & ACCESS_STATE),
                        command_topic_prefix: endpoint,
                        command_topic: true,
                        command_topic_postfix: firstExpose.property,
                        options: firstExpose.values.map((v) => v.toString()),
                        ...lookup[firstExpose.name],
                    },
                });
            }
        }
        else if (firstExpose.type === 'text' || firstExpose.type === 'composite') {
            if (firstExpose.access & ACCESS_STATE) {
                const lookup = {
                    action: { icon: 'mdi:gesture-double-tap' },
                };
                const discoveryEntry = {
                    type: 'sensor',
                    object_id: firstExpose.property,
                    mockProperties: [{ property: firstExpose.property, value: null }],
                    discovery_payload: {
                        value_template: `{{ value_json.${firstExpose.property} }}`,
                        ...lookup[firstExpose.name],
                    },
                };
                discoveryEntries.push(discoveryEntry);
            }
        }
        else {
            throw new Error(`Unsupported exposes type: '${firstExpose.type}'`);
        }
        return discoveryEntries;
    }
    onDeviceRemoved(data) {
        var _a;
        logger_1.default.debug(`Clearing Home Assistant discovery topic for '${data.name}'`);
        (_a = this.discovered[data.ieeeAddr]) === null || _a === void 0 ? void 0 : _a.topics.forEach((topic) => {
            this.mqtt.publish(topic, null, { retain: true, qos: 0 }, this.discoveryTopic, false, false);
        });
        delete this.discovered[data.ieeeAddr];
    }
    onGroupMembersChanged(data) {
        this.discover(data.group, true);
    }
    async onPublishEntityState(data) {
        /**
         * In case we deal with a lightEndpoint configuration Zigbee2MQTT publishes
         * e.g. {state_l1: ON, brightness_l1: 250} to zigbee2mqtt/mydevice.
         * As the Home Assistant MQTT JSON light cannot be configured to use state_l1/brightness_l1
         * as the state variables, the state topic is set to zigbee2mqtt/mydevice/l1.
         * Here we retrieve all the attributes with the _l1 values and republish them on
         * zigbee2mqtt/mydevice/l1.
         */
        const entity = this.zigbee.resolveEntity(data.entity.name);
        if (entity.isDevice() && this.discovered[entity.ieeeAddr]) {
            for (const objectID of this.discovered[entity.ieeeAddr].objectIDs) {
                const match = /light_(.*)/.exec(objectID);
                if (match) {
                    const endpoint = match[1];
                    const endpointRegExp = new RegExp(`(.*)_${endpoint}`);
                    const payload = {};
                    for (const key of Object.keys(data.message)) {
                        const keyMatch = endpointRegExp.exec(key);
                        if (keyMatch) {
                            payload[keyMatch[1]] = data.message[key];
                        }
                    }
                    await this.mqtt.publish(`${data.entity.name}/${endpoint}`, json_stable_stringify_without_jsonify_1.default(payload), {});
                }
            }
        }
        /**
         * Publish an empty value for click and action payload, in this way Home Assistant
         * can use Home Assistant entities in automations.
         * https://github.com/Koenkk/zigbee2mqtt/issues/959#issuecomment-480341347
         */
        if (settings.get().homeassistant.legacy_triggers) {
            const keys = ['action', 'click'].filter((k) => data.message[k]);
            for (const key of keys) {
                this.publishEntityState(data.entity, { [key]: '' });
            }
        }
        /**
         * Implements the MQTT device trigger (https://www.home-assistant.io/integrations/device_trigger.mqtt/)
         * The MQTT device trigger does not support JSON parsing, so it cannot listen to zigbee2mqtt/my_device
         * Whenever a device publish an {action: *} we discover an MQTT device trigger sensor
         * and republish it to zigbee2mqtt/my_devic/action
         */
        if (entity.isDevice() && entity.definition) {
            const keys = ['action', 'click'].filter((k) => data.message[k]);
            for (const key of keys) {
                const value = data.message[key].toString();
                await this.publishDeviceTriggerDiscover(entity, key, value);
                await this.mqtt.publish(`${data.entity.name}/${key}`, value, {});
            }
        }
    }
    async onEntityRenamed(data) {
        logger_1.default.debug(`Refreshing Home Assistant discovery topic for '${data.entity.name}'`);
        // Clear before rename so Home Assistant uses new friendly_name
        // https://github.com/Koenkk/zigbee2mqtt/issues/4096#issuecomment-674044916
        if (data.homeAssisantRename) {
            for (const config of this.getConfigs(data.entity)) {
                const topic = this.getDiscoveryTopic(config, data.entity);
                this.mqtt.publish(topic, null, { retain: true, qos: 0 }, this.discoveryTopic, false, false);
            }
            // Make sure Home Assistant deletes the old entity first otherwise another one (_2) is created
            // https://github.com/Koenkk/zigbee2mqtt/issues/12610
            await utils_1.default.sleep(2);
        }
        this.discover(data.entity, true);
        if (data.entity.isDevice() && this.discoveredTriggers[data.entity.ieeeAddr]) {
            for (const config of this.discoveredTriggers[data.entity.ieeeAddr]) {
                const key = config.substring(0, config.indexOf('_'));
                const value = config.substring(config.indexOf('_') + 1);
                this.publishDeviceTriggerDiscover(data.entity, key, value, true);
            }
        }
    }
    getConfigs(entity) {
        const isDevice = entity.isDevice();
        /* istanbul ignore next */
        if (!entity || (isDevice && !entity.definition))
            return [];
        let configs = [];
        if (isDevice) {
            const exposes = entity.exposes(); // avoid calling it hundred of times/s
            for (const expose of exposes) {
                configs.push(...this.exposeToConfig([expose], 'device', entity.definition, exposes));
            }
            for (const mapping of legacyMapping) {
                if (mapping.models.includes(entity.definition.model)) {
                    configs.push(mapping.discovery);
                }
            }
            // Deprecated in favour of exposes
            /* istanbul ignore if */
            if (entity.definition.hasOwnProperty('homeassistant')) {
                // @ts-ignore
                configs.push(entity.definition.homeassistant);
            }
        }
        else { // group
            const exposesByType = {};
            entity.zh.members.map((e) => this.zigbee.resolveEntity(e.getDevice()))
                .filter((d) => d.definition).forEach((device) => {
                for (const expose of device.exposes().filter((e) => groupSupportedTypes.includes(e.type))) {
                    let key = expose.type;
                    if (['switch', 'lock', 'cover'].includes(expose.type) && expose.endpoint) {
                        // A device can have multiple of these types which have to discovered seperately.
                        // e.g. switch with property state and valve_detection.
                        const state = expose.features.find((f) => f.name === 'state');
                        key += featurePropertyWithoutEndpoint(state);
                    }
                    if (!exposesByType[key])
                        exposesByType[key] = [];
                    exposesByType[key].push(expose);
                }
            });
            configs = [].concat(...Object.values(exposesByType)
                .map((exposes) => this.exposeToConfig(exposes, 'group')));
        }
        if (isDevice && settings.get().advanced.last_seen !== 'disable') {
            const config = {
                type: 'sensor',
                object_id: 'last_seen',
                mockProperties: [{ property: 'last_seen', value: null }],
                discovery_payload: {
                    value_template: '{{ value_json.last_seen }}',
                    icon: 'mdi:clock',
                    enabled_by_default: false,
                    entity_category: 'diagnostic',
                },
            };
            /* istanbul ignore else */
            if (settings.get().advanced.last_seen.startsWith('ISO_8601')) {
                config.discovery_payload.device_class = 'timestamp';
            }
            configs.push(config);
        }
        if (isDevice && entity.definition.hasOwnProperty('ota')) {
            const updateStateSensor = {
                type: 'sensor',
                object_id: 'update_state',
                mockProperties: [{ property: 'update', value: { state: null } }],
                discovery_payload: {
                    icon: 'mdi:update',
                    value_template: `{{ value_json['update']['state'] }}`,
                    enabled_by_default: false,
                    entity_category: 'diagnostic',
                },
            };
            configs.push(updateStateSensor);
            const updateAvailableSensor = {
                type: 'binary_sensor',
                object_id: 'update_available',
                mockProperties: [{ property: 'update_available', value: null }],
                discovery_payload: {
                    payload_on: true,
                    payload_off: false,
                    value_template: `{{ value_json['update']['state'] == "available" }}`,
                    enabled_by_default: true,
                    device_class: 'update',
                    entity_category: 'diagnostic',
                },
            };
            configs.push(updateAvailableSensor);
        }
        if (isDevice && entity.options.hasOwnProperty('legacy') && !entity.options.legacy) {
            configs = configs.filter((c) => c !== sensorClick);
        }
        if (!settings.get().homeassistant.legacy_triggers) {
            configs = configs.filter((c) => c.object_id !== 'action' && c.object_id !== 'click');
        }
        // deep clone of the config objects
        configs = JSON.parse(JSON.stringify(configs));
        if (entity.options.homeassistant) {
            const s = entity.options.homeassistant;
            configs = configs.filter((config) => !s.hasOwnProperty(config.object_id) || s[config.object_id] != null);
            configs.forEach((config) => {
                const configOverride = s[config.object_id];
                if (configOverride) {
                    config.object_id = configOverride.object_id || config.object_id;
                    config.type = configOverride.type || config.type;
                }
            });
        }
        return configs;
    }
    getDiscoverKey(entity) {
        return entity.isDevice() ? entity.ieeeAddr : entity.ID;
    }
    discover(entity, force = false) {
        // Check if already discovered and check if there are configs.
        const discoverKey = this.getDiscoverKey(entity);
        const discover = force || !this.discovered[discoverKey];
        if (entity.isGroup()) {
            if (!discover || entity.zh.members.length === 0)
                return;
        }
        else if (!discover || !entity.definition || entity.zh.interviewing ||
            (entity.options.hasOwnProperty('homeassistant') && !entity.options.homeassistant)) {
            return;
        }
        this.discovered[discoverKey] = { topics: new Set(), mockProperties: new Set(), objectIDs: new Set() };
        this.getConfigs(entity).forEach((config) => {
            var _a;
            const payload = { ...config.discovery_payload };
            const baseTopic = `${settings.get().mqtt.base_topic}/${entity.name}`;
            let stateTopic = baseTopic;
            if (payload.state_topic_postfix) {
                stateTopic += `/${payload.state_topic_postfix}`;
                delete payload.state_topic_postfix;
            }
            if (!payload.hasOwnProperty('state_topic') || payload.state_topic) {
                payload.state_topic = stateTopic;
            }
            else {
                /* istanbul ignore else */
                if (payload.hasOwnProperty('state_topic')) {
                    delete payload.state_topic;
                }
            }
            if (payload.position_topic) {
                payload.position_topic = stateTopic;
            }
            if (payload.tilt_status_topic) {
                payload.tilt_status_topic = stateTopic;
            }
            if (this.entityAttributes) {
                payload.json_attributes_topic = stateTopic;
            }
            const devicePayload = this.getDevicePayload(entity);
            // Set (unique) name, separate by space if device name contains space.
            const nameSeparator = devicePayload.name.includes('_') ? '_' : ' ';
            payload.name = devicePayload.name;
            if (config.object_id.startsWith(config.type) && config.object_id.includes('_')) {
                payload.name += `${nameSeparator}${config.object_id.split(/_(.+)/)[1]}`;
            }
            else if (!config.object_id.startsWith(config.type)) {
                payload.name += `${nameSeparator}${config.object_id.replace(/_/g, nameSeparator)}`;
            }
            // Set unique_id
            payload.unique_id = `${entity.options.ID}_${config.object_id}_${settings.get().mqtt.base_topic}`;
            // Attributes for device registry
            payload.device = devicePayload;
            // Availability payload
            payload.availability = [{ topic: `${settings.get().mqtt.base_topic}/bridge/state` }];
            /* istanbul ignore next */
            if (utils_1.default.isAvailabilityEnabledForEntity(entity, settings.get())) {
                payload.availability_mode = 'all';
                payload.availability.push({ topic: `${baseTopic}/availability` });
            }
            if (!settings.get().advanced.legacy_availability_payload) {
                payload.availability.forEach((a) => a.value_template = '{{ value_json.state }}');
            }
            const commandTopicPrefix = payload.command_topic_prefix ? `${payload.command_topic_prefix}/` : '';
            delete payload.command_topic_prefix;
            const commandTopicPostfix = payload.command_topic_postfix ? `/${payload.command_topic_postfix}` : '';
            delete payload.command_topic_postfix;
            const commandTopic = `${baseTopic}/${commandTopicPrefix}set${commandTopicPostfix}`;
            if (payload.command_topic) {
                payload.command_topic = commandTopic;
            }
            if (payload.set_position_topic) {
                payload.set_position_topic = commandTopic;
            }
            if (payload.tilt_command_topic) {
                payload.tilt_command_topic = `${baseTopic}/${commandTopicPrefix}set/tilt`;
            }
            if (payload.mode_state_topic) {
                payload.mode_state_topic = stateTopic;
            }
            if (payload.mode_command_topic) {
                payload.mode_command_topic = `${baseTopic}/${commandTopicPrefix}set/system_mode`;
            }
            if (payload.current_temperature_topic) {
                payload.current_temperature_topic = stateTopic;
            }
            if (payload.temperature_state_topic) {
                payload.temperature_state_topic = stateTopic;
            }
            if (payload.temperature_low_state_topic) {
                payload.temperature_low_state_topic = stateTopic;
            }
            if (payload.temperature_high_state_topic) {
                payload.temperature_high_state_topic = stateTopic;
            }
            if (payload.temperature_command_topic) {
                payload.temperature_command_topic =
                    `${baseTopic}/${commandTopicPrefix}set/${payload.temperature_command_topic}`;
            }
            if (payload.temperature_low_command_topic) {
                payload.temperature_low_command_topic =
                    `${baseTopic}/${commandTopicPrefix}set/${payload.temperature_low_command_topic}`;
            }
            if (payload.temperature_high_command_topic) {
                payload.temperature_high_command_topic =
                    `${baseTopic}/${commandTopicPrefix}set/${payload.temperature_high_command_topic}`;
            }
            if (payload.fan_mode_state_topic) {
                payload.fan_mode_state_topic = stateTopic;
            }
            if (payload.fan_mode_command_topic) {
                payload.fan_mode_command_topic = `${baseTopic}/${commandTopicPrefix}set/fan_mode`;
            }
            if (payload.percentage_state_topic) {
                payload.percentage_state_topic = stateTopic;
            }
            if (payload.percentage_command_topic) {
                payload.percentage_command_topic = `${baseTopic}/${commandTopicPrefix}set/fan_mode`;
            }
            if (payload.preset_mode_state_topic) {
                payload.preset_mode_state_topic = stateTopic;
            }
            if (payload.preset_mode_command_topic) {
                payload.preset_mode_command_topic = `${baseTopic}/${commandTopicPrefix}set/` +
                    payload.preset_mode_command_topic;
            }
            if (payload.action_topic) {
                payload.action_topic = stateTopic;
            }
            // Override configuration with user settings.
            if (entity.options.hasOwnProperty('homeassistant')) {
                const add = (obj, ignoreName) => {
                    Object.keys(obj).forEach((key) => {
                        if (['type', 'object_id'].includes(key)) {
                            return;
                        }
                        else if (ignoreName && key === 'name') {
                            return;
                        }
                        else if (['number', 'string', 'boolean'].includes(typeof obj[key]) ||
                            Array.isArray(obj[key])) {
                            payload[key] = obj[key];
                        }
                        else if (obj[key] === null) {
                            delete payload[key];
                        }
                        else if (key === 'device' && typeof obj[key] === 'object') {
                            Object.keys(obj['device']).forEach((key) => {
                                payload['device'][key] = obj['device'][key];
                            });
                        }
                    });
                };
                add(entity.options.homeassistant, true);
                if (entity.options.homeassistant.hasOwnProperty(config.object_id)) {
                    add(entity.options.homeassistant[config.object_id], false);
                }
            }
            const topic = this.getDiscoveryTopic(config, entity);
            this.mqtt.publish(topic, json_stable_stringify_without_jsonify_1.default(payload), { retain: true, qos: 0 }, this.discoveryTopic, false, false);
            this.discovered[discoverKey].topics.add(topic);
            this.discovered[discoverKey].objectIDs.add(config.object_id);
            (_a = config.mockProperties) === null || _a === void 0 ? void 0 : _a.forEach((mockProperty) => this.discovered[discoverKey].mockProperties.add(mockProperty));
        });
    }
    onMQTTMessage(data) {
        const discoveryRegex = new RegExp(`${this.discoveryTopic}/(.*)/(.*)/(.*)/config`);
        const discoveryMatch = data.topic.match(discoveryRegex);
        const isDeviceAutomation = discoveryMatch && discoveryMatch[1] === 'device_automation';
        if (discoveryMatch) {
            // Clear outdated discovery configs and remember already discovered device_automations
            let message = null;
            try {
                message = JSON.parse(data.message);
                const baseTopic = settings.get().mqtt.base_topic + '/';
                if (isDeviceAutomation && (!message.topic || !message.topic.startsWith(baseTopic))) {
                    return;
                }
                if (!isDeviceAutomation &&
                    (!message.availability || !message.availability[0].topic.startsWith(baseTopic))) {
                    return;
                }
            }
            catch (e) {
                return;
            }
            // Group discovery topic uses "ENCODEDBASETOPIC_GROUPID", device use ieeeAddr
            const ID = discoveryMatch[2].includes('_') ? discoveryMatch[2].split('_')[1] : discoveryMatch[2];
            const entity = this.zigbee.resolveEntity(ID);
            let clear = !entity || entity.isDevice() && !entity.definition;
            // Only save when topic matches otherwise config is not updated when renamed by editing configuration.yaml
            if (entity) {
                const key = `${discoveryMatch[3].substring(0, discoveryMatch[3].indexOf('_'))}`;
                const triggerTopic = `${settings.get().mqtt.base_topic}/${entity.name}/${key}`;
                if (isDeviceAutomation && message.topic === triggerTopic) {
                    if (!this.discoveredTriggers[ID]) {
                        this.discoveredTriggers[ID] = new Set();
                    }
                    this.discoveredTriggers[ID].add(discoveryMatch[3]);
                }
            }
            if (!clear && !isDeviceAutomation) {
                const type = discoveryMatch[1];
                const objectID = discoveryMatch[3];
                clear = !this.getConfigs(entity)
                    .find((c) => c.type === type && c.object_id === objectID &&
                    `${this.discoveryTopic}/${this.getDiscoveryTopic(c, entity)}` === data.topic);
            }
            // Device was flagged to be excluded from homeassistant discovery
            clear = clear || (entity.options.hasOwnProperty('homeassistant') && !entity.options.homeassistant);
            if (clear) {
                logger_1.default.debug(`Clearing Home Assistant config '${data.topic}'`);
                const topic = data.topic.substring(this.discoveryTopic.length + 1);
                this.mqtt.publish(topic, null, { retain: true, qos: 0 }, this.discoveryTopic, false, false);
            }
        }
        else if ((data.topic === this.statusTopic || data.topic === defaultStatusTopic) &&
            data.message.toLowerCase() === 'online') {
            const timer = setTimeout(async () => {
                // Publish all device states.
                for (const entity of [...this.zigbee.devices(false), ...this.zigbee.groups()]) {
                    if (this.state.exists(entity)) {
                        this.publishEntityState(entity, this.state.get(entity), 'publishCached');
                    }
                }
                clearTimeout(timer);
            }, 30000);
        }
    }
    onZigbeeEvent(data) {
        this.discover(data.device);
    }
    getDevicePayload(entity) {
        var _a, _b, _c;
        const identifierPostfix = entity.isGroup() ?
            `zigbee2mqtt_${this.getEncodedBaseTopic()}` : 'zigbee2mqtt';
        // Allow device name to be overriden by homeassistant config
        let deviceName = entity.name;
        if (typeof ((_a = entity.options.homeassistant) === null || _a === void 0 ? void 0 : _a.name) === 'string') {
            deviceName = entity.options.homeassistant.name;
        }
        const payload = {
            identifiers: [`${identifierPostfix}_${entity.options.ID}`],
            name: deviceName,
            sw_version: `Zigbee2MQTT ${this.zigbee2MQTTVersion}`,
        };
        if (entity.isDevice()) {
            payload.model = `${entity.definition.description} (${entity.definition.model})`;
            payload.manufacturer = entity.definition.vendor;
            payload.sw_version = entity.zh.softwareBuildID;
        }
        if ((_b = settings.get().frontend) === null || _b === void 0 ? void 0 : _b.url) {
            const url = (_c = settings.get().frontend) === null || _c === void 0 ? void 0 : _c.url;
            payload.configuration_url = entity.isDevice() ? `${url}/#/device/${entity.ieeeAddr}/info` :
                `${url}/#/group/${entity.ID}`;
        }
        return payload;
    }
    adjustMessageBeforePublish(entity, message) {
        var _a, _b;
        const discoverKey = this.getDiscoverKey(entity);
        (_b = (_a = this.discovered[discoverKey]) === null || _a === void 0 ? void 0 : _a.mockProperties) === null || _b === void 0 ? void 0 : _b.forEach((mockProperty) => {
            if (!message.hasOwnProperty(mockProperty.property)) {
                message[mockProperty.property] = mockProperty.value;
            }
        });
        // Copy hue -> h, saturation -> s to make homeassitant happy
        if (message.hasOwnProperty('color')) {
            if (message.color.hasOwnProperty('hue')) {
                message.color.h = message.color.hue;
            }
            if (message.color.hasOwnProperty('saturation')) {
                message.color.s = message.color.saturation;
            }
        }
    }
    getEncodedBaseTopic() {
        return settings.get().mqtt.base_topic.split('').map((s) => s.charCodeAt(0).toString()).join('');
    }
    getDiscoveryTopic(config, entity) {
        const key = entity.isDevice() ? entity.ieeeAddr : `${this.getEncodedBaseTopic()}_${entity.ID}`;
        return `${config.type}/${key}/${config.object_id}/config`;
    }
    async publishDeviceTriggerDiscover(device, key, value, force = false) {
        const haConfig = device.options.homeassistant;
        if (device.options.hasOwnProperty('homeassistant') && (haConfig == null ||
            (haConfig.hasOwnProperty('device_automation') && typeof haConfig === 'object' &&
                haConfig.device_automation == null))) {
            return;
        }
        if (!this.discoveredTriggers[device.ieeeAddr]) {
            this.discoveredTriggers[device.ieeeAddr] = new Set();
        }
        const discoveredKey = `${key}_${value}`;
        if (this.discoveredTriggers[device.ieeeAddr].has(discoveredKey) && !force) {
            return;
        }
        const config = {
            type: 'device_automation',
            object_id: `${key}_${value}`,
            mockProperties: [],
            discovery_payload: {
                automation_type: 'trigger',
                type: key,
            },
        };
        const topic = this.getDiscoveryTopic(config, device);
        const payload = {
            ...config.discovery_payload,
            subtype: value,
            payload: value,
            topic: `${settings.get().mqtt.base_topic}/${device.name}/${key}`,
            device: this.getDevicePayload(device),
        };
        await this.mqtt.publish(topic, json_stable_stringify_without_jsonify_1.default(payload), { retain: true, qos: 0 }, this.discoveryTopic, false, false);
        this.discoveredTriggers[device.ieeeAddr].add(discoveredKey);
    }
    _clearDiscoveredTrigger() {
        this.discoveredTriggers = {};
    }
}
__decorate([
    bind_decorator_1.default
], HomeAssistant.prototype, "onDeviceRemoved", null);
__decorate([
    bind_decorator_1.default
], HomeAssistant.prototype, "onGroupMembersChanged", null);
__decorate([
    bind_decorator_1.default
], HomeAssistant.prototype, "onPublishEntityState", null);
__decorate([
    bind_decorator_1.default
], HomeAssistant.prototype, "onEntityRenamed", null);
__decorate([
    bind_decorator_1.default
], HomeAssistant.prototype, "onMQTTMessage", null);
__decorate([
    bind_decorator_1.default
], HomeAssistant.prototype, "onZigbeeEvent", null);
exports.default = HomeAssistant;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaG9tZWFzc2lzdGFudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi9leHRlbnNpb24vaG9tZWFzc2lzdGFudC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSwyREFBNkM7QUFDN0MsNERBQW9DO0FBQ3BDLDBEQUFrQztBQUNsQyxrSEFBOEQ7QUFDOUQsb0RBQTRCO0FBQzVCLDREQUFvQztBQUNwQyxvRUFBa0M7QUFPbEMsTUFBTSxXQUFXLEdBQW1CO0lBQ2hDLElBQUksRUFBRSxRQUFRO0lBQ2QsU0FBUyxFQUFFLE9BQU87SUFDbEIsY0FBYyxFQUFFLENBQUMsRUFBQyxRQUFRLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUMsQ0FBQztJQUNsRCxpQkFBaUIsRUFBRTtRQUNmLElBQUksRUFBRSxtQkFBbUI7UUFDekIsY0FBYyxFQUFFLHdCQUF3QjtLQUMzQztDQUNKLENBQUM7QUFFRixNQUFNLFlBQVksR0FBRyxLQUFLLENBQUM7QUFDM0IsTUFBTSxVQUFVLEdBQUcsS0FBSyxDQUFDO0FBQ3pCLE1BQU0sbUJBQW1CLEdBQUcsQ0FBQyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxPQUFPLENBQUMsQ0FBQztBQUNqRSxNQUFNLGtCQUFrQixHQUFHLHNCQUFzQixDQUFDO0FBRWxELE1BQU0sYUFBYSxHQUFHO0lBQ2xCO1FBQ0ksTUFBTSxFQUFFLENBQUMsVUFBVSxFQUFFLGVBQWUsRUFBRSxhQUFhLEVBQUUsYUFBYSxFQUFFLGFBQWEsRUFBRSxhQUFhO1lBQzVGLE9BQU8sRUFBRSxjQUFjLEVBQUUsYUFBYSxFQUFFLFlBQVksRUFBRSxjQUFjLEVBQUUsVUFBVSxFQUFFLFVBQVU7WUFDNUYsU0FBUyxFQUFFLFdBQVcsRUFBRSxjQUFjLEVBQUUsVUFBVSxFQUFFLFVBQVUsRUFBRSxlQUFlLEVBQUUsZUFBZTtZQUNoRyxVQUFVLEVBQUUsVUFBVSxFQUFFLFVBQVUsRUFBRSxVQUFVLEVBQUUsVUFBVSxFQUFFLFVBQVUsRUFBRSxVQUFVO1lBQ2xGLE9BQU8sQ0FBQztRQUNaLFNBQVMsRUFBRSxXQUFXO0tBQ3pCO0lBQ0Q7UUFDSSxNQUFNLEVBQUUsQ0FBQyxVQUFVLENBQUM7UUFDcEIsU0FBUyxFQUFFO1lBQ1AsSUFBSSxFQUFFLFFBQVE7WUFDZCxjQUFjLEVBQUUsQ0FBQyxFQUFDLFFBQVEsRUFBRSxZQUFZLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBQyxDQUFDO1lBQ3ZELFNBQVMsRUFBRSxZQUFZO1lBQ3ZCLGlCQUFpQixFQUFFO2dCQUNmLG1CQUFtQixFQUFFLFlBQVk7Z0JBQ2pDLElBQUksRUFBRSxrQkFBa0I7Z0JBQ3hCLGNBQWMsRUFBRSw2QkFBNkI7YUFDaEQ7U0FDSjtLQUNKO0NBQ0osQ0FBQztBQUVGLE1BQU0sOEJBQThCLEdBQUcsQ0FBQyxPQUFvQyxFQUFVLEVBQUU7SUFDcEYsSUFBSSxPQUFPLENBQUMsUUFBUSxFQUFFO1FBQ2xCLE9BQU8sT0FBTyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUM7S0FDdkU7U0FBTTtRQUNILE9BQU8sT0FBTyxDQUFDLFFBQVEsQ0FBQztLQUMzQjtBQUNMLENBQUMsQ0FBQztBQUVGOztHQUVHO0FBQ0gsTUFBcUIsYUFBYyxTQUFRLG1CQUFTO0lBU2hELFlBQVksTUFBYyxFQUFFLElBQVUsRUFBRSxLQUFZLEVBQUUsa0JBQXNDLEVBQ3hGLFFBQWtCLEVBQUUsc0JBQXdFLEVBQzVGLGVBQTJCLEVBQUUsWUFBcUQ7UUFDbEYsS0FBSyxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLGtCQUFrQixFQUFFLFFBQVEsRUFBRSxzQkFBc0IsRUFBRSxlQUFlLEVBQUUsWUFBWSxDQUFDLENBQUM7UUFYNUcsZUFBVSxHQUNzRSxFQUFFLENBQUM7UUFDbkYsdUJBQWtCLEdBQStCLEVBQUUsQ0FBQztRQUNwRCxtQkFBYyxHQUFHLFFBQVEsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxhQUFhLENBQUMsZUFBZSxDQUFDO1FBQzlELGdCQUFXLEdBQUcsUUFBUSxDQUFDLEdBQUcsRUFBRSxDQUFDLGFBQWEsQ0FBQyxZQUFZLENBQUM7UUFDeEQscUJBQWdCLEdBQUcsUUFBUSxDQUFDLEdBQUcsRUFBRSxDQUFDLGFBQWEsQ0FBQyx3QkFBd0IsQ0FBQztRQU83RSxJQUFJLFFBQVEsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxRQUFRLENBQUMsTUFBTSxLQUFLLFdBQVcsRUFBRTtZQUNoRCxNQUFNLElBQUksS0FBSyxDQUFDLG1FQUFtRSxDQUFDLENBQUM7U0FDeEY7SUFDTCxDQUFDO0lBRVEsS0FBSyxDQUFDLEtBQUs7UUFDaEIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxRQUFRLENBQUMsV0FBVyxFQUFFO1lBQ3RDLGdCQUFNLENBQUMsSUFBSSxDQUFDLGlGQUFpRixDQUFDLENBQUM7U0FDbEc7UUFFRCxJQUFJLENBQUMsa0JBQWtCLEdBQUcsQ0FBQyxNQUFNLGVBQUssQ0FBQyxxQkFBcUIsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQztRQUU3RSxJQUFJLENBQUMsUUFBUSxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQzFELElBQUksQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDdEQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUMxRCxJQUFJLENBQUMsUUFBUSxDQUFDLG9CQUFvQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsb0JBQW9CLENBQUMsQ0FBQztRQUNwRSxJQUFJLENBQUMsUUFBUSxDQUFDLHFCQUFxQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMscUJBQXFCLENBQUMsQ0FBQztRQUN0RSxJQUFJLENBQUMsUUFBUSxDQUFDLGdCQUFnQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDekQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUN2RCxJQUFJLENBQUMsUUFBUSxDQUFDLGlCQUFpQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDMUQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUN4RCxJQUFJLENBQUMsUUFBUSxDQUFDLHNCQUFzQixDQUFDLElBQUksRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDLENBQUM7UUFFdkYsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQ3RDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFDeEMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxJQUFJLENBQUMsY0FBYyxJQUFJLENBQUMsQ0FBQztRQUVoRCxtREFBbUQ7UUFDbkQsS0FBSyxNQUFNLE1BQU0sSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUU7WUFDM0UsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUM7U0FDL0I7UUFFRCwyR0FBMkc7UUFDM0csSUFBSSxDQUFDLFFBQVEsQ0FBQyx1QkFBdUIsRUFBRSxDQUFDO0lBQzVDLENBQUM7SUFFTyxjQUFjLENBQUMsT0FBK0IsRUFBRSxVQUE4QixFQUNsRixVQUEyQixFQUFFLGlCQUEwQzs7UUFDdkUsdUdBQXVHO1FBQ3ZHLCtDQUErQztRQUMvQyxnQkFBTSxDQUFDLFVBQVUsS0FBSyxPQUFPLElBQUksT0FBTyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUseUNBQXlDLENBQUMsQ0FBQztRQUNsRyxNQUFNLFdBQVcsR0FBRyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFDL0IsZ0JBQU0sQ0FBQyxVQUFVLEtBQUssUUFBUSxJQUFJLG1CQUFtQixDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEVBQzVFLDJCQUEyQixXQUFXLENBQUMsSUFBSSxZQUFZLENBQUMsQ0FBQztRQUU3RCxNQUFNLGdCQUFnQixHQUFxQixFQUFFLENBQUM7UUFDOUMsTUFBTSxRQUFRLEdBQUcsVUFBVSxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO1FBQzNFLE1BQU0sV0FBVyxHQUFHLENBQUMsT0FBb0MsRUFBVSxFQUFFLENBQUMsVUFBVSxLQUFLLE9BQU8sQ0FBQyxDQUFDO1lBQzFGLDhCQUE4QixDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDO1FBRS9ELDBCQUEwQjtRQUMxQixJQUFJLFdBQVcsQ0FBQyxJQUFJLEtBQUssT0FBTyxFQUFFO1lBQzlCLE1BQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLFVBQVUsQ0FBQyxDQUFDLENBQUM7WUFDaEcsTUFBTSxVQUFVLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssVUFBVSxDQUFDLENBQUMsQ0FBQztZQUNoRyxNQUFNLGFBQWEsR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxZQUFZLENBQUMsQ0FBQyxDQUFDO1lBQ3JHLE1BQU0sWUFBWSxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLFlBQVksQ0FBQyxDQUFDLENBQUM7WUFDcEcsTUFBTSxLQUFLLEdBQUcsV0FBVyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssT0FBTyxDQUFDLENBQUM7WUFDbkUscUZBQXFGO1lBQ3JGLDhFQUE4RTtZQUM5RSxNQUFNLFFBQVEsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsSUFBSSxLQUFLLFVBQVUsQ0FBQztnQkFDckYsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEtBQUssVUFBVSxDQUFDLENBQUMsQ0FBQztpQkFDckQsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDO1lBRTNFLE1BQU0sY0FBYyxHQUFtQjtnQkFDbkMsSUFBSSxFQUFFLE9BQU87Z0JBQ2IsU0FBUyxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUMsU0FBUyxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUMsT0FBTztnQkFDbkQsY0FBYyxFQUFFLENBQUMsRUFBQyxRQUFRLEVBQUUsS0FBSyxDQUFDLFFBQVEsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFDLENBQUM7Z0JBQ3pELGlCQUFpQixFQUFFO29CQUNmLFVBQVUsRUFBRSxDQUFDLENBQUMsYUFBYTtvQkFDM0IsTUFBTSxFQUFFLE1BQU07b0JBQ2QsYUFBYSxFQUFFLElBQUk7b0JBQ25CLGdCQUFnQixFQUFFLEdBQUc7b0JBQ3JCLG9CQUFvQixFQUFFLFFBQVE7b0JBQzlCLG1CQUFtQixFQUFFLFFBQVE7aUJBQ2hDO2FBQ0osQ0FBQztZQUVGLE1BQU0sVUFBVSxHQUFHO2dCQUNmLFVBQVUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJO2dCQUNyQyxDQUFDLENBQUMsVUFBVSxJQUFJLFFBQVEsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJO2dCQUNyRCxZQUFZLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsSUFBSTthQUNyQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFFbkIsSUFBSSxVQUFVLENBQUMsTUFBTSxFQUFFO2dCQUNuQixjQUFjLENBQUMsaUJBQWlCLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQztnQkFDbkQsY0FBYyxDQUFDLGlCQUFpQixDQUFDLHFCQUFxQixHQUFHLFVBQVUsQ0FBQzthQUN2RTtZQUVELElBQUksWUFBWSxFQUFFO2dCQUNkLE1BQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLFlBQVksQ0FBQyxDQUFDO3FCQUMzRixNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUN0QixNQUFNLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7Z0JBQzVELE1BQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQztnQkFDNUQsY0FBYyxDQUFDLGlCQUFpQixDQUFDLFVBQVUsR0FBRyxHQUFHLENBQUM7Z0JBQ2xELGNBQWMsQ0FBQyxpQkFBaUIsQ0FBQyxVQUFVLEdBQUcsR0FBRyxDQUFDO2FBQ3JEO1lBRUQsTUFBTSxNQUFNLEdBQUcsaUJBQWlCLGFBQWpCLGlCQUFpQix1QkFBakIsaUJBQWlCLENBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLE1BQU0sSUFBSSxDQUFDLENBQUMsSUFBSSxLQUFLLFFBQVEsQ0FBQyxDQUFDO1lBQ3hGLElBQUksTUFBTSxFQUFFO2dCQUNSLGNBQWMsQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDO2dCQUMvQyxjQUFjLENBQUMsaUJBQWlCLENBQUMsV0FBVyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUM7YUFDaEU7WUFFRCxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7U0FDekM7YUFBTSxJQUFJLFdBQVcsQ0FBQyxJQUFJLEtBQUssUUFBUSxFQUFFO1lBQ3RDLE1BQU0sS0FBSyxHQUFHLFdBQVcsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLE9BQU8sQ0FBQyxDQUFDO1lBQ25FLE1BQU0sUUFBUSxHQUFHLFdBQVcsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUNwQyxNQUFNLGNBQWMsR0FBbUI7Z0JBQ25DLElBQUksRUFBRSxRQUFRO2dCQUNkLFNBQVMsRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDLFVBQVUsUUFBUSxFQUFFLENBQUMsQ0FBQyxDQUFDLFFBQVE7Z0JBQ3JELGNBQWMsRUFBRSxDQUFDLEVBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFDLENBQUM7Z0JBQ25ELGlCQUFpQixFQUFFO29CQUNmLFdBQVcsRUFBRSxLQUFLLENBQUMsU0FBUztvQkFDNUIsVUFBVSxFQUFFLEtBQUssQ0FBQyxRQUFRO29CQUMxQixjQUFjLEVBQUUsaUJBQWlCLFFBQVEsS0FBSztvQkFDOUMsYUFBYSxFQUFFLElBQUk7b0JBQ25CLG9CQUFvQixFQUFFLFFBQVE7aUJBQ2pDO2FBQ0osQ0FBQztZQUVGLE1BQU0sU0FBUyxHQUFHLENBQUMsaUJBQWlCLEVBQUUsa0JBQWtCLEVBQUUsV0FBVyxFQUFFLFdBQVcsQ0FBQyxDQUFDO1lBQ3BGLElBQUksU0FBUyxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsRUFBRTtnQkFDOUIsY0FBYyxDQUFDLGlCQUFpQixDQUFDLHFCQUFxQixHQUFHLFFBQVEsQ0FBQztnQkFDbEUsY0FBYyxDQUFDLGlCQUFpQixDQUFDLFNBQVMsR0FBRyxLQUFLLENBQUMsU0FBUyxDQUFDO2dCQUM3RCxjQUFjLENBQUMsaUJBQWlCLENBQUMsUUFBUSxHQUFHLEtBQUssQ0FBQyxRQUFRLENBQUM7Z0JBQzNELGNBQWMsQ0FBQyxTQUFTLEdBQUcsUUFBUSxDQUFDO2dCQUVwQyxJQUFJLFFBQVEsS0FBSyxrQkFBa0IsRUFBRTtvQkFDakMsY0FBYyxDQUFDLGlCQUFpQixDQUFDLElBQUksR0FBRyx5QkFBeUIsQ0FBQztpQkFDckU7YUFDSjtZQUVELGdCQUFnQixDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQztTQUN6QzthQUFNLElBQUksV0FBVyxDQUFDLElBQUksS0FBSyxTQUFTLEVBQUU7WUFDdkMsTUFBTSxrQkFBa0IsR0FBRyxDQUFDLDJCQUEyQixFQUFFLDBCQUEwQixDQUFDLENBQUM7WUFDckYsTUFBTSxRQUFRLEdBQUcsV0FBVyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLGtCQUFrQixDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztZQUN2RixnQkFBTSxDQUFDLFFBQVEsRUFBRSxtQkFBbUIsQ0FBQyxDQUFDO1lBQ3RDLE1BQU0sV0FBVyxHQUFHLFdBQVcsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLG1CQUFtQixDQUFDLENBQUM7WUFDckYsZ0JBQU0sQ0FBQyxXQUFXLEVBQUUsc0JBQXNCLENBQUMsQ0FBQztZQUU1QyxNQUFNLGNBQWMsR0FBbUI7Z0JBQ25DLElBQUksRUFBRSxTQUFTO2dCQUNmLFNBQVMsRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDLFdBQVcsUUFBUSxFQUFFLENBQUMsQ0FBQyxDQUFDLFNBQVM7Z0JBQ3ZELGNBQWMsRUFBRSxFQUFFO2dCQUNsQixpQkFBaUIsRUFBRTtvQkFDZixTQUFTO29CQUNULFdBQVcsRUFBRSxLQUFLO29CQUNsQixnQkFBZ0IsRUFBRSxHQUFHO29CQUNyQixXQUFXO29CQUNYLFNBQVMsRUFBRSxRQUFRLENBQUMsVUFBVTtvQkFDOUIsUUFBUSxFQUFFLFFBQVEsQ0FBQyxTQUFTLENBQUMsUUFBUSxFQUFFO29CQUN2QyxRQUFRLEVBQUUsUUFBUSxDQUFDLFNBQVMsQ0FBQyxRQUFRLEVBQUU7b0JBQ3ZDLGNBQWM7b0JBQ2QseUJBQXlCLEVBQUUsSUFBSTtvQkFDL0IsNEJBQTRCLEVBQUUsaUJBQWlCLFdBQVcsQ0FBQyxRQUFRLEtBQUs7b0JBQ3hFLG9CQUFvQixFQUFFLFFBQVE7aUJBQ2pDO2FBQ0osQ0FBQztZQUVGLE1BQU0sSUFBSSxHQUFHLFdBQVcsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLGFBQWEsQ0FBQyxDQUFDO1lBQ3hFLElBQUksSUFBSSxFQUFFO2dCQUNOLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDLEVBQUU7b0JBQy9CLDJFQUEyRTtvQkFDM0UsMEVBQTBFO29CQUMxRSx5RUFBeUU7b0JBQ3pFLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO2lCQUN2RDtnQkFDRCxjQUFjLENBQUMsaUJBQWlCLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSxDQUFDO2dCQUN6RCxjQUFjLENBQUMsaUJBQWlCLENBQUMsbUJBQW1CLEdBQUcsaUJBQWlCLElBQUksQ0FBQyxRQUFRLEtBQUssQ0FBQztnQkFDM0YsY0FBYyxDQUFDLGlCQUFpQixDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDO2dCQUNyRCxjQUFjLENBQUMsaUJBQWlCLENBQUMsa0JBQWtCLEdBQUcsSUFBSSxDQUFDO2FBQzlEO1lBRUQsTUFBTSxLQUFLLEdBQUcsV0FBVyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssZUFBZSxDQUFDLENBQUM7WUFDM0UsSUFBSSxLQUFLLEVBQUU7Z0JBQ1AsY0FBYyxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsRUFBQyxRQUFRLEVBQUUsS0FBSyxDQUFDLFFBQVEsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFDLENBQUMsQ0FBQztnQkFDNUUsY0FBYyxDQUFDLGlCQUFpQixDQUFDLFlBQVksR0FBRyxJQUFJLENBQUM7Z0JBQ3JELGNBQWMsQ0FBQyxpQkFBaUIsQ0FBQyxlQUFlLEdBQUcsa0JBQWtCO29CQUM3RCw2RUFBNkU7b0JBQzdFLDJCQUEyQixLQUFLLENBQUMsUUFBUSxNQUFNLENBQUM7YUFDM0Q7WUFFRCxNQUFNLGVBQWUsR0FBRyxXQUFXLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSywyQkFBMkIsQ0FBQyxDQUFDO1lBQ2pHLElBQUksZUFBZSxFQUFFO2dCQUNqQixjQUFjLENBQUMsaUJBQWlCLENBQUMsNkJBQTZCLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQztnQkFDL0UsY0FBYyxDQUFDLGlCQUFpQixDQUFDLDhCQUE4QjtvQkFDM0QsaUJBQWlCLFFBQVEsQ0FBQyxRQUFRLEtBQUssQ0FBQztnQkFDNUMsY0FBYyxDQUFDLGlCQUFpQixDQUFDLDJCQUEyQixHQUFHLElBQUksQ0FBQztnQkFDcEUsY0FBYyxDQUFDLGlCQUFpQixDQUFDLDhCQUE4QixHQUFHLGVBQWUsQ0FBQyxJQUFJLENBQUM7Z0JBQ3ZGLGNBQWMsQ0FBQyxpQkFBaUIsQ0FBQywrQkFBK0I7b0JBQzVELGlCQUFpQixlQUFlLENBQUMsUUFBUSxLQUFLLENBQUM7Z0JBQ25ELGNBQWMsQ0FBQyxpQkFBaUIsQ0FBQyw0QkFBNEIsR0FBRyxJQUFJLENBQUM7YUFDeEU7aUJBQU07Z0JBQ0gsY0FBYyxDQUFDLGlCQUFpQixDQUFDLHlCQUF5QixHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUM7Z0JBQzNFLGNBQWMsQ0FBQyxpQkFBaUIsQ0FBQywwQkFBMEI7b0JBQ3ZELGlCQUFpQixRQUFRLENBQUMsUUFBUSxLQUFLLENBQUM7Z0JBQzVDLGNBQWMsQ0FBQyxpQkFBaUIsQ0FBQyx1QkFBdUIsR0FBRyxJQUFJLENBQUM7YUFDbkU7WUFFRCxNQUFNLE9BQU8sR0FBRyxXQUFXLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxVQUFVLENBQUMsQ0FBQztZQUN4RSxJQUFJLE9BQU8sRUFBRTtnQkFDVCxjQUFjLENBQUMsaUJBQWlCLENBQUMsU0FBUyxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUM7Z0JBQzVELGNBQWMsQ0FBQyxpQkFBaUIsQ0FBQyxzQkFBc0IsR0FBRyxJQUFJLENBQUM7Z0JBQy9ELGNBQWMsQ0FBQyxpQkFBaUIsQ0FBQyx1QkFBdUI7b0JBQ3BELGlCQUFpQixPQUFPLENBQUMsUUFBUSxLQUFLLENBQUM7Z0JBQzNDLGNBQWMsQ0FBQyxpQkFBaUIsQ0FBQyxvQkFBb0IsR0FBRyxJQUFJLENBQUM7YUFDaEU7WUFFRCxNQUFNLE1BQU0sR0FBRyxXQUFXLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxRQUFRLENBQUMsQ0FBQztZQUNyRSxJQUFJLE1BQU0sRUFBRTtnQkFDUixjQUFjLENBQUMsaUJBQWlCLENBQUMsWUFBWSxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUM7Z0JBQzlELGNBQWMsQ0FBQyxpQkFBaUIsQ0FBQyx5QkFBeUIsR0FBRyxRQUFRLENBQUM7Z0JBQ3RFLGNBQWMsQ0FBQyxpQkFBaUIsQ0FBQywwQkFBMEI7b0JBQ3ZELGlCQUFpQixNQUFNLENBQUMsUUFBUSxLQUFLLENBQUM7Z0JBQzFDLGNBQWMsQ0FBQyxpQkFBaUIsQ0FBQyx1QkFBdUIsR0FBRyxJQUFJLENBQUM7YUFDbkU7WUFFRCxNQUFNLGVBQWUsR0FBRyxXQUFXLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSywrQkFBK0IsQ0FBQyxDQUFDO1lBQ3JHLElBQUksZUFBZSxFQUFFO2dCQUNqQixNQUFNLGNBQWMsR0FBbUI7b0JBQ25DLElBQUksRUFBRSxRQUFRO29CQUNkLFNBQVMsRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUcsZUFBZSxDQUFDLElBQUksSUFBSSxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxlQUFlLENBQUMsSUFBSSxFQUFFO29CQUN2RixjQUFjLEVBQUUsQ0FBQyxFQUFDLFFBQVEsRUFBRSxlQUFlLENBQUMsUUFBUSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUMsQ0FBQztvQkFDbkUsaUJBQWlCLEVBQUU7d0JBQ2YsY0FBYyxFQUFFLGlCQUFpQixlQUFlLENBQUMsUUFBUSxLQUFLO3dCQUM5RCxhQUFhLEVBQUUsSUFBSTt3QkFDbkIsb0JBQW9CLEVBQUUsUUFBUTt3QkFDOUIscUJBQXFCLEVBQUUsZUFBZSxDQUFDLFFBQVE7d0JBQy9DLFlBQVksRUFBRSxhQUFhO3dCQUMzQixlQUFlLEVBQUUsUUFBUTt3QkFDekIsSUFBSSxFQUFFLGtCQUFrQjt3QkFDeEIsR0FBRyxDQUFDLGVBQWUsQ0FBQyxJQUFJLElBQUksRUFBQyxtQkFBbUIsRUFBRSxlQUFlLENBQUMsSUFBSSxFQUFDLENBQUM7cUJBQzNFO2lCQUNKLENBQUM7Z0JBRUYsSUFBSSxlQUFlLENBQUMsU0FBUyxJQUFJLElBQUk7b0JBQUUsY0FBYyxDQUFDLGlCQUFpQixDQUFDLEdBQUcsR0FBRyxlQUFlLENBQUMsU0FBUyxDQUFDO2dCQUN4RyxJQUFJLGVBQWUsQ0FBQyxTQUFTLElBQUksSUFBSTtvQkFBRSxjQUFjLENBQUMsaUJBQWlCLENBQUMsR0FBRyxHQUFHLGVBQWUsQ0FBQyxTQUFTLENBQUM7Z0JBQ3hHLGdCQUFnQixDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQzthQUN6QztZQUVELE1BQU0sZUFBZSxHQUFHLFdBQVcsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLG1CQUFtQixDQUFDLENBQUM7WUFDekYsSUFBSSxlQUFlLEVBQUU7Z0JBQ2pCLE1BQU0sY0FBYyxHQUFtQjtvQkFDbkMsSUFBSSxFQUFFLFFBQVE7b0JBQ2QsU0FBUyxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUMsR0FBRyxlQUFlLENBQUMsSUFBSSxJQUFJLFFBQVEsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLGVBQWUsQ0FBQyxJQUFJLEVBQUU7b0JBQ3ZGLGNBQWMsRUFBRSxDQUFDLEVBQUMsUUFBUSxFQUFFLGVBQWUsQ0FBQyxRQUFRLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBQyxDQUFDO29CQUNuRSxpQkFBaUIsRUFBRTt3QkFDZixjQUFjLEVBQUUsaUJBQWlCLGVBQWUsQ0FBQyxRQUFRLEtBQUs7d0JBQzlELEdBQUcsQ0FBQyxlQUFlLENBQUMsSUFBSSxJQUFJLEVBQUMsbUJBQW1CLEVBQUUsZUFBZSxDQUFDLElBQUksRUFBQyxDQUFDO3dCQUN4RSxlQUFlLEVBQUUsWUFBWTt3QkFDN0IsSUFBSSxFQUFFLGNBQWM7cUJBQ3ZCO2lCQUNKLENBQUM7Z0JBRUYsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDO2FBQ3pDO1lBRUQsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1NBQ3pDO2FBQU0sSUFBSSxXQUFXLENBQUMsSUFBSSxLQUFLLE1BQU0sRUFBRTtZQUNwQyxnQkFBTSxDQUFDLENBQUMsUUFBUSxFQUFFLHNDQUFzQyxDQUFDLENBQUM7WUFDMUQsTUFBTSxLQUFLLEdBQUcsV0FBVyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssT0FBTyxDQUFDLENBQUM7WUFDbkUsZ0JBQU0sQ0FBQyxLQUFLLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztZQUNoQyxNQUFNLGNBQWMsR0FBbUI7Z0JBQ25DLElBQUksRUFBRSxNQUFNO2dCQUNaLFNBQVMsRUFBRSxNQUFNO2dCQUNqQixjQUFjLEVBQUUsQ0FBQyxFQUFDLFFBQVEsRUFBRSxLQUFLLENBQUMsUUFBUSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUMsQ0FBQztnQkFDekQsaUJBQWlCLEVBQUU7b0JBQ2YsYUFBYSxFQUFFLElBQUk7b0JBQ25CLGNBQWMsRUFBRSxpQkFBaUIsS0FBSyxDQUFDLFFBQVEsS0FBSztpQkFDdkQ7YUFDSixDQUFDO1lBRUYsSUFBSSxLQUFLLENBQUMsUUFBUSxLQUFLLGdCQUFnQixFQUFFO2dCQUNyQyxnRUFBZ0U7Z0JBQ2hFLGNBQWMsQ0FBQyxpQkFBaUIsQ0FBQyxZQUFZLEdBQUcsS0FBSyxDQUFDLFFBQVEsQ0FBQztnQkFDL0QsY0FBYyxDQUFDLGlCQUFpQixDQUFDLGNBQWMsR0FBRyxLQUFLLENBQUMsU0FBUyxDQUFDO2dCQUNsRSxjQUFjLENBQUMsaUJBQWlCLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQztnQkFDcEQsY0FBYyxDQUFDLFNBQVMsR0FBRyxhQUFhLENBQUM7YUFDNUM7aUJBQU0sSUFBSSxLQUFLLENBQUMsUUFBUSxLQUFLLFlBQVksRUFBRTtnQkFDeEMsNERBQTREO2dCQUM1RCxjQUFjLENBQUMsaUJBQWlCLENBQUMsWUFBWSxHQUFHLEtBQUssQ0FBQyxRQUFRLENBQUM7Z0JBQy9ELGNBQWMsQ0FBQyxpQkFBaUIsQ0FBQyxjQUFjLEdBQUcsS0FBSyxDQUFDLFNBQVMsQ0FBQztnQkFDbEUsY0FBYyxDQUFDLGlCQUFpQixDQUFDLFlBQVksR0FBRyxNQUFNLENBQUM7Z0JBQ3ZELGNBQWMsQ0FBQyxpQkFBaUIsQ0FBQyxjQUFjLEdBQUcsUUFBUSxDQUFDO2dCQUMzRCxjQUFjLENBQUMsaUJBQWlCLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQztnQkFDcEQsY0FBYyxDQUFDLFNBQVMsR0FBRyxZQUFZLENBQUM7YUFDM0M7aUJBQU07Z0JBQ0gsY0FBYyxDQUFDLGlCQUFpQixDQUFDLFlBQVksR0FBRyxLQUFLLENBQUMsUUFBUSxDQUFDO2dCQUMvRCxjQUFjLENBQUMsaUJBQWlCLENBQUMsY0FBYyxHQUFHLEtBQUssQ0FBQyxTQUFTLENBQUM7YUFDckU7WUFFRCxJQUFJLEtBQUssQ0FBQyxRQUFRLEtBQUssT0FBTyxFQUFFO2dCQUM1QixjQUFjLENBQUMsaUJBQWlCLENBQUMscUJBQXFCLEdBQUcsS0FBSyxDQUFDLFFBQVEsQ0FBQzthQUMzRTtZQUVELGdCQUFnQixDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQztTQUN6QzthQUFNLElBQUksV0FBVyxDQUFDLElBQUksS0FBSyxPQUFPLEVBQUU7WUFDckMsTUFBTSxRQUFRLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssVUFBVSxDQUFDLENBQUMsQ0FBQztZQUM5RixNQUFNLElBQUksR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxNQUFNLENBQUMsQ0FBQyxDQUFDO1lBQ3RGLE1BQU0sVUFBVSxHQUFHLGlCQUFpQixhQUFqQixpQkFBaUIsdUJBQWpCLGlCQUFpQixDQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxNQUFNLElBQUksQ0FBQyxDQUFDLElBQUksS0FBSyxhQUFhO2dCQUMzRixDQUFDLENBQUMsTUFBTSxLQUFLLFlBQVksQ0FBQyxDQUFDO1lBQy9CLE1BQU0sT0FBTyxHQUFHLGlCQUFpQixhQUFqQixpQkFBaUIsdUJBQWpCLGlCQUFpQixDQUFFLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxRQUFRLElBQUksQ0FBQyxDQUFDLElBQUksS0FBSyxTQUFTLENBQUMsQ0FBQztZQUU1RixNQUFNLGNBQWMsR0FBbUI7Z0JBQ25DLElBQUksRUFBRSxPQUFPO2dCQUNiLGNBQWMsRUFBRSxFQUFFO2dCQUNsQixTQUFTLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQyxTQUFTLFFBQVEsRUFBRSxDQUFDLENBQUMsQ0FBQyxPQUFPO2dCQUNuRCxpQkFBaUIsRUFBRTtvQkFDZixvQkFBb0IsRUFBRSxRQUFRO29CQUM5QixhQUFhLEVBQUUsSUFBSTtvQkFDbkIsV0FBVyxFQUFFLElBQUk7aUJBQ3BCO2FBQ0osQ0FBQztZQUVGLG1GQUFtRjtZQUNuRiw2RUFBNkU7WUFDN0Usc0ZBQXNGO1lBQ3RGLElBQUksVUFBVSxFQUFFO2dCQUNaLE1BQU0sYUFBYSxHQUFHLENBQUMsU0FBUyxFQUFFLE1BQU0sRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDO2dCQUNyRSxNQUFNLGFBQWEsR0FBRyxDQUFDLFNBQVMsRUFBRSxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sRUFBRSxTQUFTLEVBQUUsTUFBTSxFQUFFLFdBQVcsQ0FBQyxDQUFDO2dCQUMvRixNQUFNLGFBQWEsR0FBRyxDQUFDLFNBQVMsRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLFFBQVEsQ0FBQyxDQUFDO2dCQUU3RCxNQUFNLFlBQVksR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUM1RixNQUFNLFlBQVksR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUM1RixNQUFNLFlBQVksR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQyxDQUFDO2dCQUU1RixJQUFJLFlBQVksSUFBSSxZQUFZLElBQUksWUFBWSxFQUFFO29CQUM5QyxjQUFjLENBQUMsaUJBQWlCLENBQUMsYUFBYSxHQUFHLFlBQVksQ0FBQztvQkFDOUQsY0FBYyxDQUFDLGlCQUFpQixDQUFDLGFBQWEsR0FBRyxZQUFZLENBQUM7b0JBQzlELGNBQWMsQ0FBQyxpQkFBaUIsQ0FBQyxhQUFhLEdBQUcsWUFBWSxDQUFDO29CQUM5RCxjQUFjLENBQUMsaUJBQWlCLENBQUMsY0FBYyxHQUFHLHNDQUFzQzt3QkFDcEYsR0FBRyxZQUFZLHNEQUFzRCxDQUFDO2lCQUM3RTthQUNKO2lCQUFNLElBQUksT0FBTyxFQUFFO2dCQUNoQixjQUFjLENBQUMsaUJBQWlCLENBQUMsY0FBYyxHQUFHLGtDQUFrQztvQkFDaEYseUVBQXlFO29CQUN6RSxpQ0FBaUMsQ0FBQzthQUN6QztpQkFBTTtnQkFDSCxjQUFjLENBQUMsaUJBQWlCLENBQUMsY0FBYyxHQUFHLHdCQUF3QixDQUFDO2dCQUMzRSxjQUFjLENBQUMsaUJBQWlCLENBQUMsVUFBVSxHQUFHLE1BQU0sQ0FBQztnQkFDckQsY0FBYyxDQUFDLGlCQUFpQixDQUFDLFlBQVksR0FBRyxPQUFPLENBQUM7YUFDM0Q7WUFFRCxJQUFJLENBQUMsUUFBUSxJQUFJLENBQUMsSUFBSSxFQUFFO2dCQUNwQixjQUFjLENBQUMsaUJBQWlCLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQzthQUN0RDtZQUVELElBQUksUUFBUSxFQUFFO2dCQUNWLE1BQU0sQ0FBQyxHQUFHLFFBQVEsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLFVBQVUsQ0FBQyxDQUFDO2dCQUMvRCxjQUFjLENBQUMsaUJBQWlCLEdBQUcsRUFBQyxHQUFHLGNBQWMsQ0FBQyxpQkFBaUI7b0JBQ25FLGlCQUFpQixFQUFFLGlCQUFpQixXQUFXLENBQUMsQ0FBQyxDQUFDLEtBQUs7b0JBQ3ZELHFCQUFxQixFQUFFLE1BQU0sV0FBVyxDQUFDLENBQUMsQ0FBQyxxQkFBcUI7b0JBQ2hFLGtCQUFrQixFQUFFLElBQUk7b0JBQ3hCLGNBQWMsRUFBRSxJQUFJO2lCQUN2QixDQUFDO2FBQ0w7WUFFRCxJQUFJLElBQUksRUFBRTtnQkFDTixNQUFNLENBQUMsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxNQUFNLENBQUMsQ0FBQztnQkFDdkQsY0FBYyxDQUFDLGlCQUFpQixHQUFHLEVBQUMsR0FBRyxjQUFjLENBQUMsaUJBQWlCO29CQUNuRSxrQkFBa0IsRUFBRSxJQUFJO29CQUN4QixpQkFBaUIsRUFBRSxJQUFJO29CQUN2QixvQkFBb0IsRUFBRSxpQkFBaUIsV0FBVyxDQUFDLENBQUMsQ0FBQyxLQUFLO2lCQUM3RCxDQUFDO2FBQ0w7WUFFRCxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7U0FDekM7YUFBTSxJQUFJLFdBQVcsQ0FBQyxJQUFJLEtBQUssS0FBSyxFQUFFO1lBQ25DLGdCQUFNLENBQUMsQ0FBQyxRQUFRLEVBQUUscUNBQXFDLENBQUMsQ0FBQztZQUN6RCxNQUFNLGNBQWMsR0FBbUI7Z0JBQ25DLElBQUksRUFBRSxLQUFLO2dCQUNYLFNBQVMsRUFBRSxLQUFLO2dCQUNoQixjQUFjLEVBQUUsQ0FBQyxFQUFDLFFBQVEsRUFBRSxXQUFXLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBQyxDQUFDO2dCQUN0RCxpQkFBaUIsRUFBRTtvQkFDZixXQUFXLEVBQUUsSUFBSTtvQkFDakIsb0JBQW9CLEVBQUUsNEJBQTRCO29CQUNsRCxhQUFhLEVBQUUsSUFBSTtvQkFDbkIscUJBQXFCLEVBQUUsV0FBVztpQkFDckM7YUFDSixDQUFDO1lBRUYsTUFBTSxLQUFLLEdBQUcsV0FBVyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssTUFBTSxDQUFDLENBQUM7WUFDbEUsSUFBSSxLQUFLLEVBQUU7Z0JBQ1Asb0VBQW9FO2dCQUNwRSxzRUFBc0U7Z0JBQ3RFLG9FQUFvRTtnQkFDcEUsdUVBQXVFO2dCQUN2RSxzREFBc0Q7Z0JBQ3RELEVBQUU7Z0JBQ0YscUVBQXFFO2dCQUNyRSxvRUFBb0U7Z0JBQ3BFLGdFQUFnRTtnQkFDaEUsbUVBQW1FO2dCQUNuRSxrRUFBa0U7Z0JBQ2xFLHdCQUF3QjtnQkFDeEIsSUFBSSxNQUFNLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxLQUFLLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRztvQkFDekUsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ2pFLElBQUksT0FBTyxHQUFHLENBQUMsSUFBSSxFQUFFLE1BQU0sRUFBRSxPQUFPLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBRTlFLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxFQUFFO29CQUN0Qyw4REFBOEQ7b0JBQzlELDREQUE0RDtvQkFDNUQsZ0VBQWdFO29CQUNoRSw4QkFBOEI7b0JBQzlCLE1BQU0sR0FBRyxDQUFDLEtBQUssRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztvQkFDaEQsT0FBTyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7aUJBQ3ZCO2dCQUVELE1BQU0sT0FBTyxHQUFHLENBQUMsR0FBRyxNQUFNLEVBQUUsR0FBRyxPQUFPLENBQUMsQ0FBQztnQkFDeEMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLGdCQUFNLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3pELE1BQU0sYUFBYSxHQUFHLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDckUsTUFBTSxlQUFlLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUN2RSxNQUFNLFVBQVUsR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUUzRCxjQUFjLENBQUMsaUJBQWlCLENBQUMsc0JBQXNCLEdBQUcsSUFBSSxDQUFDO2dCQUMvRCxjQUFjLENBQUMsaUJBQWlCLENBQUMsd0JBQXdCLEdBQUcsSUFBSSxDQUFDO2dCQUNqRSxjQUFjLENBQUMsaUJBQWlCLENBQUMseUJBQXlCO29CQUN0RCxPQUFPLGFBQWEsZ0JBQWdCLEtBQUssQ0FBQyxRQUFRLHdCQUF3QixDQUFDO2dCQUMvRSxjQUFjLENBQUMsaUJBQWlCLENBQUMsMkJBQTJCO29CQUN4RCxPQUFPLGVBQWUsMkJBQTJCLENBQUM7Z0JBQ3RELGNBQWMsQ0FBQyxpQkFBaUIsQ0FBQyxlQUFlLEdBQUcsQ0FBQyxDQUFDO2dCQUNyRCxjQUFjLENBQUMsaUJBQWlCLENBQUMsZUFBZSxHQUFHLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO2dCQUNyRSxnQkFBTSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDLENBQUM7Z0JBQzdCLGNBQWMsQ0FBQyxpQkFBaUIsQ0FBQyx1QkFBdUIsR0FBRyxJQUFJLENBQUM7Z0JBQ2hFLGNBQWMsQ0FBQyxpQkFBaUIsQ0FBQyx5QkFBeUIsR0FBRyxVQUFVLENBQUM7Z0JBQ3hFLGNBQWMsQ0FBQyxpQkFBaUIsQ0FBQywwQkFBMEI7b0JBQ3ZELGlCQUFpQixLQUFLLENBQUMsUUFBUSxrQkFBa0IsS0FBSyxDQUFDLFFBQVEsUUFBUSxVQUFVLEdBQUc7d0JBQ3BGLG1DQUFtQyxDQUFDO2dCQUN4QyxjQUFjLENBQUMsaUJBQWlCLENBQUMsWUFBWSxHQUFHLE9BQU8sQ0FBQzthQUMzRDtZQUVELGdCQUFnQixDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQztTQUN6QzthQUFNLElBQUksV0FBVyxDQUFDLElBQUksS0FBSyxRQUFRLEVBQUU7WUFDdEMsTUFBTSxNQUFNLEdBQTJCO2dCQUNuQyxXQUFXLEVBQUUsRUFBQyxlQUFlLEVBQUUsWUFBWSxFQUFFLFlBQVksRUFBRSxTQUFTLEVBQUM7Z0JBQ3JFLFdBQVcsRUFBRSxFQUFDLGVBQWUsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBQztnQkFDMUQsV0FBVyxFQUFFLEVBQUMsZUFBZSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUscUJBQXFCLEVBQUM7Z0JBQ3JFLGVBQWUsRUFBRSxFQUFDLFlBQVksRUFBRSxRQUFRLEVBQUM7Z0JBQ3pDLElBQUksRUFBRSxFQUFDLGVBQWUsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLHFCQUFxQixFQUFDO2dCQUM5RCxVQUFVLEVBQUUsRUFBQyxlQUFlLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxrQkFBa0IsRUFBQztnQkFDakUsVUFBVSxFQUFFLEVBQUMsZUFBZSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsaUJBQWlCLEVBQUM7Z0JBQ2hFLGtCQUFrQixFQUFFLEVBQUMsZUFBZSxFQUFFLFlBQVksRUFBRSxZQUFZLEVBQUUsY0FBYyxFQUFDO2dCQUNqRixPQUFPLEVBQUUsRUFBQyxZQUFZLEVBQUUsTUFBTSxFQUFDO2dCQUMvQixtQkFBbUIsRUFBRSxFQUFDLFlBQVksRUFBRSxhQUFhLEVBQUUsVUFBVSxFQUFFLEtBQUssRUFBRSxXQUFXLEVBQUUsSUFBSSxFQUFDO2dCQUN4RixRQUFRLEVBQUUsRUFBQyxlQUFlLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUM7Z0JBQ3ZELFVBQVUsRUFBRSxFQUFDLGVBQWUsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBQztnQkFDeEQsb0JBQW9CLEVBQUUsRUFBQyxlQUFlLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxzQkFBc0IsRUFBQztnQkFDL0UsR0FBRyxFQUFFLEVBQUMsWUFBWSxFQUFFLEtBQUssRUFBQztnQkFDMUIsWUFBWSxFQUFFLEVBQUMsZUFBZSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsc0JBQXNCLEVBQUM7Z0JBQ3ZFLGtCQUFrQixFQUFFLEVBQUMsZUFBZSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsYUFBYSxFQUFDO2dCQUNwRSxjQUFjLEVBQUUsRUFBQyxlQUFlLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxZQUFZLEVBQUM7Z0JBQy9ELE1BQU0sRUFBRSxFQUFDLGVBQWUsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBQztnQkFDcEQsY0FBYyxFQUFFLEVBQUMsZUFBZSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsc0JBQXNCLEVBQUM7Z0JBQ3pFLE1BQU0sRUFBRSxFQUFDLFlBQVksRUFBRSxRQUFRLEVBQUM7Z0JBQ2hDLG1CQUFtQixFQUFFLEVBQUMsZUFBZSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsMEJBQTBCLEVBQUM7Z0JBQ2xGLFNBQVMsRUFBRSxFQUFDLFlBQVksRUFBRSxRQUFRLEVBQUM7Z0JBQ25DLG1CQUFtQixFQUFFLEVBQUMsZUFBZSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsWUFBWSxFQUFDO2dCQUNwRSxRQUFRLEVBQUUsRUFBQyxZQUFZLEVBQUUsVUFBVSxFQUFDO2dCQUNwQyxLQUFLLEVBQUUsRUFBQyxZQUFZLEVBQUUsT0FBTyxFQUFDO2dCQUM5QixHQUFHLEVBQUUsRUFBQyxZQUFZLEVBQUUsUUFBUSxFQUFDO2dCQUM3QixNQUFNLEVBQUUsRUFBQyxZQUFZLEVBQUUsUUFBUSxFQUFDO2dCQUNoQyxpQkFBaUIsRUFBRSxFQUFDLGVBQWUsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLHlCQUF5QixFQUFDO2dCQUMvRSxJQUFJLEVBQUUsRUFBQyxlQUFlLEVBQUUsWUFBWSxFQUFFLElBQUksRUFBRSxlQUFlLEVBQUM7Z0JBQzVELFNBQVMsRUFBRSxFQUFDLFlBQVksRUFBRSxXQUFXLEVBQUM7Z0JBQ3RDLFVBQVUsRUFBRSxFQUFDLFlBQVksRUFBRSxVQUFVLEVBQUM7YUFDekMsQ0FBQztZQUVGOzs7OztlQUtHO1lBQ0gsSUFBSSxXQUFXLENBQUMsTUFBTSxHQUFHLFVBQVUsRUFBRTtnQkFDakMsTUFBTSxjQUFjLEdBQW1CO29CQUNuQyxJQUFJLEVBQUUsUUFBUTtvQkFDZCxjQUFjLEVBQUUsQ0FBQyxFQUFDLFFBQVEsRUFBRSxXQUFXLENBQUMsUUFBUSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUMsQ0FBQztvQkFDL0QsU0FBUyxFQUFFLFFBQVEsQ0FBQyxDQUFDO3dCQUNqQixVQUFVLFdBQVcsQ0FBQyxJQUFJLElBQUksUUFBUSxFQUFFLENBQUMsQ0FBQzt3QkFDMUMsVUFBVSxXQUFXLENBQUMsSUFBSSxFQUFFO29CQUNoQyxpQkFBaUIsRUFBRTt3QkFDZixjQUFjLEVBQUUsT0FBTyxXQUFXLENBQUMsUUFBUSxLQUFLLFNBQVMsQ0FBQyxDQUFDOzRCQUN2RCxvQkFBb0IsV0FBVyxDQUFDLFFBQVEsdUNBQXVDLENBQUMsQ0FBQzs0QkFDakYsaUJBQWlCLFdBQVcsQ0FBQyxRQUFRLEtBQUs7d0JBQzlDLFVBQVUsRUFBRSxXQUFXLENBQUMsUUFBUSxDQUFDLFFBQVEsRUFBRTt3QkFDM0MsV0FBVyxFQUFFLFdBQVcsQ0FBQyxTQUFTLENBQUMsUUFBUSxFQUFFO3dCQUM3QyxhQUFhLEVBQUUsSUFBSTt3QkFDbkIsb0JBQW9CLEVBQUUsUUFBUTt3QkFDOUIscUJBQXFCLEVBQUUsV0FBVyxDQUFDLFFBQVE7d0JBQzNDLEdBQUcsQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQztxQkFDdEM7aUJBQ0osQ0FBQztnQkFDRixnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7YUFDekM7aUJBQU07Z0JBQ0gsTUFBTSxjQUFjLEdBQW1CO29CQUNuQyxJQUFJLEVBQUUsZUFBZTtvQkFDckIsU0FBUyxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUMsR0FBRyxXQUFXLENBQUMsSUFBSSxJQUFJLFFBQVEsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLFdBQVcsQ0FBQyxJQUFJLEVBQUU7b0JBQy9FLGNBQWMsRUFBRSxDQUFDLEVBQUMsUUFBUSxFQUFFLFdBQVcsQ0FBQyxRQUFRLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBQyxDQUFDO29CQUMvRCxpQkFBaUIsRUFBRTt3QkFDZixjQUFjLEVBQUUsaUJBQWlCLFdBQVcsQ0FBQyxRQUFRLEtBQUs7d0JBQzFELFVBQVUsRUFBRSxXQUFXLENBQUMsUUFBUTt3QkFDaEMsV0FBVyxFQUFFLFdBQVcsQ0FBQyxTQUFTO3dCQUNsQyxHQUFHLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7cUJBQ3RDO2lCQUNKLENBQUM7Z0JBQ0YsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDO2FBQ3pDO1NBQ0o7YUFBTSxJQUFJLFdBQVcsQ0FBQyxJQUFJLEtBQUssU0FBUyxFQUFFO1lBQ3ZDLE1BQU0sTUFBTSxHQUE0QjtnQkFDcEMsWUFBWSxFQUFFLEVBQUMsWUFBWSxFQUFFLFdBQVcsRUFBRSxrQkFBa0IsRUFBRSxLQUFLLEVBQUUsZUFBZSxFQUFFLFlBQVk7b0JBQzlGLFdBQVcsRUFBRSxhQUFhLEVBQUM7Z0JBQy9CLGtCQUFrQixFQUFFLEVBQUMsWUFBWSxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUUsZ0JBQWdCLEVBQUM7Z0JBQ3RFLGtCQUFrQixFQUFFLEVBQUMsWUFBWSxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUUsaUJBQWlCLEVBQUM7Z0JBQ3ZFLHFCQUFxQixFQUFFLEVBQUMsWUFBWSxFQUFFLGFBQWEsRUFBRSxJQUFJLEVBQUUsc0JBQXNCLEVBQUM7Z0JBQ2xGLHFCQUFxQixFQUFFLEVBQUMsWUFBWSxFQUFFLGFBQWEsRUFBRSxJQUFJLEVBQUUscUJBQXFCLEVBQUM7Z0JBQ2pGLEtBQUssRUFBRSxFQUFDLElBQUksRUFBRSxhQUFhLEVBQUM7Z0JBQzVCLFVBQVUsRUFBRSxFQUFDLElBQUksRUFBRSxhQUFhLEVBQUM7Z0JBQ2pDLEdBQUcsRUFBRSxFQUFDLFlBQVksRUFBRSxLQUFLLEVBQUUsV0FBVyxFQUFFLGFBQWEsRUFBQztnQkFDdEQsZ0JBQWdCLEVBQUUsRUFBQyxlQUFlLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUM7Z0JBQ2hFLGdCQUFnQixFQUFFLEVBQUMsZUFBZSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFDO2dCQUNoRSx1QkFBdUIsRUFBRSxFQUFDLGVBQWUsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLGlCQUFpQixFQUFDO2dCQUM3RSxPQUFPLEVBQUUsRUFBQyxZQUFZLEVBQUUsU0FBUyxFQUFFLGVBQWUsRUFBRSxZQUFZLEVBQUUsV0FBVyxFQUFFLGFBQWEsRUFBQztnQkFDN0YsUUFBUSxFQUFFLEVBQUMsWUFBWSxFQUFFLFNBQVMsRUFBRSxlQUFlLEVBQUUsWUFBWSxFQUFFLFdBQVcsRUFBRSxhQUFhLEVBQUM7Z0JBQzlGLGVBQWUsRUFBRSxFQUFDLFlBQVksRUFBRSxTQUFTLEVBQUUsZUFBZSxFQUFFLFlBQVksRUFBRSxXQUFXLEVBQUUsYUFBYSxFQUFDO2dCQUNyRyxVQUFVLEVBQUUsRUFBQyxlQUFlLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUM7Z0JBQzFELFdBQVcsRUFBRSxFQUFDLGVBQWUsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLGtCQUFrQixFQUFDO2dCQUNsRSxnQkFBZ0IsRUFBRSxFQUFDLGVBQWUsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLGtCQUFrQixFQUFDO2dCQUN2RSxHQUFHLEVBQUUsRUFBQyxZQUFZLEVBQUUsZ0JBQWdCLEVBQUUsV0FBVyxFQUFFLGFBQWEsRUFBQztnQkFDakUsbUJBQW1CLEVBQUUsRUFBQyxlQUFlLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxpQkFBaUIsRUFBQztnQkFDekUsZUFBZSxFQUFFO29CQUNiLFlBQVksRUFBRSxhQUFhLEVBQUUsZUFBZSxFQUFFLFlBQVksRUFBRSxXQUFXLEVBQUUsYUFBYTtpQkFDekY7Z0JBQ0QsU0FBUyxFQUFFLEVBQUMsSUFBSSxFQUFFLFVBQVUsRUFBQztnQkFDN0IsT0FBTyxFQUFFO29CQUNMLFlBQVksRUFBRSxTQUFTO29CQUN2QixrQkFBa0IsRUFBRSxLQUFLO29CQUN6QixlQUFlLEVBQUUsWUFBWTtvQkFDN0IsV0FBVyxFQUFFLGFBQWE7aUJBQzdCO2dCQUNELGVBQWUsRUFBRTtvQkFDYixZQUFZLEVBQUUsU0FBUztvQkFDdkIsa0JBQWtCLEVBQUUsS0FBSztvQkFDekIsZUFBZSxFQUFFLFlBQVk7b0JBQzdCLFdBQVcsRUFBRSxhQUFhO2lCQUM3QjtnQkFDRCxlQUFlLEVBQUU7b0JBQ2IsWUFBWSxFQUFFLFNBQVM7b0JBQ3ZCLGtCQUFrQixFQUFFLEtBQUs7b0JBQ3pCLGVBQWUsRUFBRSxZQUFZO29CQUM3QixXQUFXLEVBQUUsYUFBYTtpQkFDN0I7Z0JBQ0Qsb0JBQW9CLEVBQUUsRUFBQyxlQUFlLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxpQkFBaUIsRUFBQztnQkFDMUUsa0JBQWtCLEVBQUU7b0JBQ2hCLFlBQVksRUFBRSxhQUFhLEVBQUUsZUFBZSxFQUFFLFlBQVksRUFBRSxXQUFXLEVBQUUsYUFBYTtpQkFDekY7Z0JBQ0QsUUFBUSxFQUFFLEVBQUMsZUFBZSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFDO2dCQUN4RCxJQUFJLEVBQUUsRUFBQyxZQUFZLEVBQUUsZ0JBQWdCLEVBQUUsV0FBVyxFQUFFLGFBQWEsRUFBQztnQkFDbEUsZUFBZSxFQUFFLEVBQUMsZUFBZSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsaUJBQWlCLEVBQUM7Z0JBQ3JFLE1BQU0sRUFBRSxFQUFDLFlBQVksRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLGtCQUFrQixFQUFDO2dCQUNqRSxXQUFXLEVBQUUsRUFBQyxXQUFXLEVBQUUsYUFBYSxFQUFDO2dCQUN6QyxXQUFXLEVBQUUsRUFBQyxJQUFJLEVBQUUsZ0NBQWdDLEVBQUUsV0FBVyxFQUFFLGFBQWEsRUFBQztnQkFDakYsSUFBSSxFQUFFLEVBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFLFdBQVcsRUFBRSxhQUFhLEVBQUM7Z0JBQzFELFFBQVEsRUFBRSxFQUFDLFlBQVksRUFBRSxVQUFVLEVBQUUsV0FBVyxFQUFFLGFBQWEsRUFBQztnQkFDaEUsb0JBQW9CLEVBQUUsRUFBQyxlQUFlLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxrQkFBa0IsRUFBQztnQkFDM0UsWUFBWSxFQUFFLEVBQUMsZUFBZSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsbUJBQW1CLEVBQUM7Z0JBQ3BFLFlBQVksRUFBRSxFQUFDLGVBQWUsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLG1CQUFtQixFQUFDO2dCQUNwRSx1QkFBdUIsRUFBRSxFQUFDLGVBQWUsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLGtCQUFrQixFQUFDO2dCQUM5RSxlQUFlLEVBQUUsRUFBQyxZQUFZLEVBQUUsYUFBYSxFQUFFLFdBQVcsRUFBRSxhQUFhLEVBQUM7Z0JBQzFFLFdBQVcsRUFBRSxFQUFDLFlBQVksRUFBRSxhQUFhLEVBQUUsa0JBQWtCLEVBQUUsS0FBSyxFQUFFLFdBQVcsRUFBRSxhQUFhLEVBQUM7Z0JBQ2pHLFdBQVcsRUFBRTtvQkFDVCxrQkFBa0IsRUFBRSxLQUFLO29CQUN6QixlQUFlLEVBQUUsWUFBWTtvQkFDN0IsSUFBSSxFQUFFLFlBQVk7b0JBQ2xCLFdBQVcsRUFBRSxhQUFhO2lCQUM3QjtnQkFDRCxpQkFBaUIsRUFBRSxFQUFDLFlBQVksRUFBRSxhQUFhLEVBQUUsV0FBVyxFQUFFLGFBQWEsRUFBQztnQkFDNUUsZUFBZSxFQUFFLEVBQUMsZUFBZSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsaUJBQWlCLEVBQUM7Z0JBQ3JFLHFCQUFxQixFQUFFLEVBQUMsZUFBZSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsaUJBQWlCLEVBQUM7Z0JBQzNFLGVBQWUsRUFBRSxFQUFDLGVBQWUsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLGlCQUFpQixFQUFDO2dCQUNyRSx5QkFBeUIsRUFBRSxFQUFDLGVBQWUsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLGVBQWUsRUFBQztnQkFDN0UsaUJBQWlCLEVBQUUsRUFBQyxlQUFlLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUM7Z0JBQ2pFLElBQUksRUFBRSxFQUFDLFlBQVksRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFLGFBQWEsRUFBQztnQkFDeEQsSUFBSSxFQUFFLEVBQUMsWUFBWSxFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUUsYUFBYSxFQUFDO2dCQUN4RCxNQUFNLEVBQUUsRUFBQyxXQUFXLEVBQUUsYUFBYSxFQUFFLElBQUksRUFBRSxzQkFBc0IsRUFBQztnQkFDbEUsUUFBUSxFQUFFLEVBQUMsSUFBSSxFQUFFLFdBQVcsRUFBRSxXQUFXLEVBQUUsYUFBYSxFQUFDO2dCQUN6RCxLQUFLLEVBQUUsRUFBQyxZQUFZLEVBQUUsT0FBTyxFQUFFLGVBQWUsRUFBRSxZQUFZLEVBQUUsV0FBVyxFQUFFLGFBQWEsRUFBQztnQkFDekYsWUFBWSxFQUFFLEVBQUMsWUFBWSxFQUFFLGNBQWMsRUFBRSxrQkFBa0IsRUFBRSxLQUFLO29CQUNsRSxlQUFlLEVBQUUsWUFBWSxFQUFFLFdBQVcsRUFBRSxhQUFhLEVBQUM7Z0JBQzlELFNBQVMsRUFBRSxFQUFDLGVBQWUsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLDRCQUE0QixFQUFDO2dCQUMxRSxRQUFRLEVBQUUsRUFBQyxZQUFZLEVBQUUsVUFBVSxFQUFFLFdBQVcsRUFBRSxhQUFhLEVBQUM7Z0JBQ2hFLGdCQUFnQixFQUFFLEVBQUMsZUFBZSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFDO2dCQUNoRSxjQUFjLEVBQUUsRUFBQyxlQUFlLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSw0QkFBNEIsRUFBQztnQkFDL0UsMEJBQTBCLEVBQUU7b0JBQ3hCLGtCQUFrQixFQUFFLEtBQUssRUFBRSxlQUFlLEVBQUUsWUFBWSxFQUFFLElBQUksRUFBRSxrQkFBa0I7aUJBQ3JGO2dCQUNELDRCQUE0QixFQUFFO29CQUMxQixrQkFBa0IsRUFBRSxLQUFLLEVBQUUsZUFBZSxFQUFFLFlBQVksRUFBRSxJQUFJLEVBQUUsa0JBQWtCO2lCQUNyRjtnQkFDRCxhQUFhLEVBQUUsRUFBQyxJQUFJLEVBQUUsZ0NBQWdDLEVBQUUsV0FBVyxFQUFFLGFBQWEsRUFBQztnQkFDbkYsYUFBYSxFQUFFLEVBQUMsSUFBSSxFQUFFLG1CQUFtQixFQUFFLFdBQVcsRUFBRSxhQUFhLEVBQUM7Z0JBQ3RFLFdBQVcsRUFBRSxFQUFDLFlBQVksRUFBRSxhQUFhLEVBQUUsV0FBVyxFQUFFLGFBQWEsRUFBQztnQkFDdEUsdUJBQXVCLEVBQUUsRUFBQyxlQUFlLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxrQkFBa0IsRUFBQztnQkFDOUUsZUFBZSxFQUFFLEVBQUMsZUFBZSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsc0JBQXNCLEVBQUM7Z0JBQzFFLGVBQWUsRUFBRSxFQUFDLGVBQWUsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLHVCQUF1QixFQUFDO2dCQUMzRSxVQUFVLEVBQUUsRUFBQyxlQUFlLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxnQkFBZ0IsRUFBQztnQkFDL0QsR0FBRyxFQUFFLEVBQUMsWUFBWSxFQUFFLDRCQUE0QixFQUFFLFdBQVcsRUFBRSxhQUFhLEVBQUM7Z0JBQzdFLGlCQUFpQixFQUFFLEVBQUMsZUFBZSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsV0FBVyxFQUFDO2dCQUNqRSxPQUFPLEVBQUU7b0JBQ0wsWUFBWSxFQUFFLFNBQVM7b0JBQ3ZCLGtCQUFrQixFQUFFLEtBQUs7b0JBQ3pCLGVBQWUsRUFBRSxZQUFZO29CQUM3QixXQUFXLEVBQUUsYUFBYTtpQkFDN0I7Z0JBQ0QsZUFBZSxFQUFFO29CQUNiLFlBQVksRUFBRSxTQUFTO29CQUN2QixrQkFBa0IsRUFBRSxLQUFLO29CQUN6QixlQUFlLEVBQUUsWUFBWTtvQkFDN0IsV0FBVyxFQUFFLGFBQWE7aUJBQzdCO2dCQUNELGVBQWUsRUFBRTtvQkFDYixZQUFZLEVBQUUsU0FBUztvQkFDdkIsa0JBQWtCLEVBQUUsS0FBSztvQkFDekIsZUFBZSxFQUFFLFlBQVk7b0JBQzdCLFdBQVcsRUFBRSxhQUFhO2lCQUM3QjtnQkFDRCxNQUFNLEVBQUUsRUFBQyxJQUFJLEVBQUUsa0JBQWtCLEVBQUM7Z0JBQ2xDLE1BQU0sRUFBRSxFQUFDLElBQUksRUFBRSxrQkFBa0IsRUFBQztnQkFDbEMsTUFBTSxFQUFFLEVBQUMsSUFBSSxFQUFFLGtCQUFrQixFQUFDO2FBQ3JDLENBQUM7WUFFRixNQUFNLFVBQVUsR0FBRyxFQUFFLENBQUM7WUFFdEIsK0NBQStDO1lBQy9DLElBQUksV0FBVyxDQUFDLElBQUksSUFBSSxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxFQUFFO2dCQUM5RCxNQUFNLENBQUMsTUFBTSxDQUFDLFVBQVUsRUFBRSxFQUFDLFlBQVksRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLGtCQUFrQixFQUFDLENBQUMsQ0FBQzthQUN4RjtZQUVELE1BQU0sU0FBUyxHQUFHLFdBQVcsQ0FBQyxNQUFNLEdBQUcsVUFBVSxDQUFDO1lBRWxELE1BQU0sY0FBYyxHQUFtQjtnQkFDbkMsSUFBSSxFQUFFLFFBQVE7Z0JBQ2QsU0FBUyxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUMsR0FBRyxXQUFXLENBQUMsSUFBSSxJQUFJLFFBQVEsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLFdBQVcsQ0FBQyxJQUFJLEVBQUU7Z0JBQy9FLGNBQWMsRUFBRSxDQUFDLEVBQUMsUUFBUSxFQUFFLFdBQVcsQ0FBQyxRQUFRLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBQyxDQUFDO2dCQUMvRCxpQkFBaUIsRUFBRTtvQkFDZixjQUFjLEVBQUUsaUJBQWlCLFdBQVcsQ0FBQyxRQUFRLEtBQUs7b0JBQzFELGtCQUFrQixFQUFFLENBQUMsU0FBUztvQkFDOUIsR0FBRyxDQUFDLFdBQVcsQ0FBQyxJQUFJLElBQUksRUFBQyxtQkFBbUIsRUFBRSxXQUFXLENBQUMsSUFBSSxFQUFDLENBQUM7b0JBQ2hFLEdBQUcsTUFBTSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUM7b0JBQzNCLEdBQUcsVUFBVTtpQkFDaEI7YUFDSixDQUFDO1lBQ0YsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1lBRXRDOzs7O2VBSUc7WUFDSCxJQUFJLFNBQVMsRUFBRTtnQkFDWCxNQUFNLGNBQWMsR0FBbUI7b0JBQ25DLElBQUksRUFBRSxRQUFRO29CQUNkLFNBQVMsRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDLEdBQUcsV0FBVyxDQUFDLElBQUksSUFBSSxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxXQUFXLENBQUMsSUFBSSxFQUFFO29CQUMvRSxjQUFjLEVBQUUsQ0FBQyxFQUFDLFFBQVEsRUFBRSxXQUFXLENBQUMsUUFBUSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUMsQ0FBQztvQkFDL0QsaUJBQWlCLEVBQUU7d0JBQ2YsY0FBYyxFQUFFLGlCQUFpQixXQUFXLENBQUMsUUFBUSxLQUFLO3dCQUMxRCxhQUFhLEVBQUUsSUFBSTt3QkFDbkIsb0JBQW9CLEVBQUUsUUFBUTt3QkFDOUIscUJBQXFCLEVBQUUsV0FBVyxDQUFDLFFBQVE7d0JBQzNDLEdBQUcsQ0FBQyxXQUFXLENBQUMsSUFBSSxJQUFJLEVBQUMsbUJBQW1CLEVBQUUsV0FBVyxDQUFDLElBQUksRUFBQyxDQUFDO3dCQUNoRSxHQUFHLE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDO3FCQUM5QjtpQkFDSixDQUFDO2dCQUVGLElBQUksT0FBQSxNQUFNLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQywwQ0FBRSxZQUFZLE1BQUssYUFBYSxFQUFFO29CQUMxRCxjQUFjLENBQUMsaUJBQWlCLENBQUMsWUFBWSxXQUFJLE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLDBDQUFFLFlBQVksQ0FBQSxDQUFDO2lCQUMzRjtxQkFBTTtvQkFDSCxPQUFPLGNBQWMsQ0FBQyxpQkFBaUIsQ0FBQyxZQUFZLENBQUM7aUJBQ3hEO2dCQUVELElBQUksV0FBVyxDQUFDLFNBQVMsSUFBSSxJQUFJO29CQUFFLGNBQWMsQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHLEdBQUcsV0FBVyxDQUFDLFNBQVMsQ0FBQztnQkFDaEcsSUFBSSxXQUFXLENBQUMsU0FBUyxJQUFJLElBQUk7b0JBQUUsY0FBYyxDQUFDLGlCQUFpQixDQUFDLEdBQUcsR0FBRyxXQUFXLENBQUMsU0FBUyxDQUFDO2dCQUVoRyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7YUFDekM7U0FDSjthQUFNLElBQUksV0FBVyxDQUFDLElBQUksS0FBSyxNQUFNLEVBQUU7WUFDcEMsTUFBTSxNQUFNLEdBQTRCO2dCQUNwQyxNQUFNLEVBQUUsRUFBQyxJQUFJLEVBQUUsd0JBQXdCLEVBQUM7Z0JBQ3hDLGNBQWMsRUFBRSxFQUFDLElBQUksRUFBRSx5QkFBeUIsRUFBQztnQkFDakQsaUJBQWlCLEVBQUUsRUFBQyxJQUFJLEVBQUUsdUJBQXVCLEVBQUM7Z0JBQ2xELGtCQUFrQixFQUFFLEVBQUMsZUFBZSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUscUJBQXFCLEVBQUM7Z0JBQzVFLGNBQWMsRUFBRSxFQUFDLGVBQWUsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLGVBQWUsRUFBQztnQkFDbEUsdUJBQXVCLEVBQUUsRUFBQyxlQUFlLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxhQUFhLEVBQUM7Z0JBQ3pFLFlBQVksRUFBRSxFQUFDLGVBQWUsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBQztnQkFDM0QsV0FBVyxFQUFFLEVBQUMsZUFBZSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFDO2dCQUMxRCxNQUFNLEVBQUUsRUFBQyxrQkFBa0IsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLGFBQWEsRUFBQztnQkFDeEQsS0FBSyxFQUFFLEVBQUMsa0JBQWtCLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUM7Z0JBQ3JELFNBQVMsRUFBRSxFQUFDLGVBQWUsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLGNBQWMsRUFBQztnQkFDNUQsY0FBYyxFQUFFLEVBQUMsZUFBZSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFDO2dCQUM3RCxtQkFBbUIsRUFBRSxFQUFDLGVBQWUsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBQztnQkFDbEUsYUFBYSxFQUFFLEVBQUMsZUFBZSxFQUFFLFlBQVksRUFBRSxJQUFJLEVBQUUsc0JBQXNCLEVBQUM7Z0JBQzVFLFNBQVMsRUFBRSxFQUFDLGVBQWUsRUFBRSxZQUFZLEVBQUUsSUFBSSxFQUFFLFlBQVksRUFBQztnQkFDOUQsTUFBTSxFQUFFLEVBQUMsZUFBZSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsZ0JBQWdCLEVBQUM7Z0JBQzNELGtCQUFrQixFQUFFLEVBQUMsZUFBZSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFDO2dCQUNqRSxJQUFJLEVBQUUsRUFBQyxlQUFlLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUM7Z0JBQ25ELGtCQUFrQixFQUFFLEVBQUMsZUFBZSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFDO2dCQUNqRSxjQUFjLEVBQUUsRUFBQyxlQUFlLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUM7Z0JBQzdELGlCQUFpQixFQUFFLEVBQUMsZUFBZSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsb0JBQW9CLEVBQUM7Z0JBQzFFLG1CQUFtQixFQUFFLEVBQUMsZUFBZSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsb0JBQW9CLEVBQUM7Z0JBQzVFLGlCQUFpQixFQUFFLEVBQUMsZUFBZSxFQUFFLFlBQVksRUFBRSxJQUFJLEVBQUUsb0JBQW9CLEVBQUM7Z0JBQzlFLFVBQVUsRUFBRSxFQUFDLGVBQWUsRUFBRSxZQUFZLEVBQUUsSUFBSSxFQUFFLDJCQUEyQixFQUFDO2dCQUM5RSxXQUFXLEVBQUUsRUFBQyxlQUFlLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUM7Z0JBQzFELFlBQVksRUFBRSxFQUFDLGVBQWUsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBQztnQkFDM0QsWUFBWSxFQUFFLEVBQUMsZUFBZSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsaUJBQWlCLEVBQUM7Z0JBQ2xFLE1BQU0sRUFBRSxFQUFDLElBQUksRUFBRSxtQkFBbUIsRUFBQztnQkFDbkMsV0FBVyxFQUFFLEVBQUMsZUFBZSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFDO2dCQUMxRCxlQUFlLEVBQUUsRUFBQyxlQUFlLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxpQkFBaUIsRUFBQztnQkFDckUsTUFBTSxFQUFFLEVBQUMsZUFBZSxFQUFFLFFBQVEsRUFBRSxJQUFJLEVBQUUsa0JBQWtCLEVBQUM7Z0JBQzdELElBQUksRUFBRSxFQUFDLGVBQWUsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFLG9CQUFvQixFQUFDO2FBQ2hFLENBQUM7WUFFRixNQUFNLGFBQWEsR0FBRyxXQUFXLENBQUMsTUFBTSxHQUFHLFlBQVksQ0FBQyxDQUFDO2dCQUNyRCxpQkFBaUIsV0FBVyxDQUFDLFFBQVEsS0FBSyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7WUFFM0QsSUFBSSxXQUFXLENBQUMsTUFBTSxHQUFHLFlBQVksRUFBRTtnQkFDbkMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDO29CQUNsQixJQUFJLEVBQUUsUUFBUTtvQkFDZCxTQUFTLEVBQUUsV0FBVyxDQUFDLFFBQVE7b0JBQy9CLGNBQWMsRUFBRSxDQUFDLEVBQUMsUUFBUSxFQUFFLFdBQVcsQ0FBQyxRQUFRLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBQyxDQUFDO29CQUMvRCxpQkFBaUIsRUFBRTt3QkFDZixjQUFjLEVBQUUsYUFBYTt3QkFDN0Isa0JBQWtCLEVBQUUsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxNQUFNLEdBQUcsVUFBVSxDQUFDO3dCQUN0RCxHQUFHLE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDO3FCQUM5QjtpQkFDSixDQUFDLENBQUM7YUFDTjtZQUVEOzs7O2VBSUc7WUFDSCxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sR0FBRyxVQUFVLENBQUMsRUFBRTtnQkFDbkMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDO29CQUNsQixJQUFJLEVBQUUsUUFBUTtvQkFDZCxTQUFTLEVBQUUsV0FBVyxDQUFDLFFBQVE7b0JBQy9CLGNBQWMsRUFBRSxFQUFFO29CQUNsQixpQkFBaUIsRUFBRTt3QkFDZixjQUFjLEVBQUUsYUFBYTt3QkFDN0IsV0FBVyxFQUFFLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxNQUFNLEdBQUcsWUFBWSxDQUFDO3dCQUNsRCxvQkFBb0IsRUFBRSxRQUFRO3dCQUM5QixhQUFhLEVBQUUsSUFBSTt3QkFDbkIscUJBQXFCLEVBQUUsV0FBVyxDQUFDLFFBQVE7d0JBQzNDLE9BQU8sRUFBRSxXQUFXLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDO3dCQUNwRCxHQUFHLE1BQU0sQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDO3FCQUM5QjtpQkFDSixDQUFDLENBQUM7YUFDTjtTQUNKO2FBQU0sSUFBSSxXQUFXLENBQUMsSUFBSSxLQUFLLE1BQU0sSUFBSSxXQUFXLENBQUMsSUFBSSxLQUFLLFdBQVcsRUFBRTtZQUN4RSxJQUFJLFdBQVcsQ0FBQyxNQUFNLEdBQUcsWUFBWSxFQUFFO2dCQUNuQyxNQUFNLE1BQU0sR0FBNEI7b0JBQ3BDLE1BQU0sRUFBRSxFQUFDLElBQUksRUFBRSx3QkFBd0IsRUFBQztpQkFDM0MsQ0FBQztnQkFFRixNQUFNLGNBQWMsR0FBbUI7b0JBQ25DLElBQUksRUFBRSxRQUFRO29CQUNkLFNBQVMsRUFBRSxXQUFXLENBQUMsUUFBUTtvQkFDL0IsY0FBYyxFQUFFLENBQUMsRUFBQyxRQUFRLEVBQUUsV0FBVyxDQUFDLFFBQVEsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFDLENBQUM7b0JBQy9ELGlCQUFpQixFQUFFO3dCQUNmLGNBQWMsRUFBRSxpQkFBaUIsV0FBVyxDQUFDLFFBQVEsS0FBSzt3QkFDMUQsR0FBRyxNQUFNLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQztxQkFDOUI7aUJBQ0osQ0FBQztnQkFDRixnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7YUFDekM7U0FDSjthQUFNO1lBQ0gsTUFBTSxJQUFJLEtBQUssQ0FBQyw4QkFBOEIsV0FBVyxDQUFDLElBQUksR0FBRyxDQUFDLENBQUM7U0FDdEU7UUFFRCxPQUFPLGdCQUFnQixDQUFDO0lBQzVCLENBQUM7SUFFSyxlQUFlLENBQUMsSUFBNkI7O1FBQy9DLGdCQUFNLENBQUMsS0FBSyxDQUFDLGdEQUFnRCxJQUFJLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQztRQUMzRSxNQUFBLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQywwQ0FBRSxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsS0FBSyxFQUFFLEVBQUU7WUFDckQsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRSxFQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBQyxFQUFFLElBQUksQ0FBQyxjQUFjLEVBQUUsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQzlGLENBQUMsRUFBRTtRQUVILE9BQU8sSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDMUMsQ0FBQztJQUVLLHFCQUFxQixDQUFDLElBQW1DO1FBQzNELElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsQ0FBQztJQUNwQyxDQUFDO0lBRUssS0FBSyxDQUFDLG9CQUFvQixDQUFDLElBQWtDO1FBQy9EOzs7Ozs7O1dBT0c7UUFDSCxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzNELElBQUksTUFBTSxDQUFDLFFBQVEsRUFBRSxJQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxFQUFFO1lBQ3ZELEtBQUssTUFBTSxRQUFRLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsU0FBUyxFQUFFO2dCQUMvRCxNQUFNLEtBQUssR0FBRyxZQUFZLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUMxQyxJQUFJLEtBQUssRUFBRTtvQkFDUCxNQUFNLFFBQVEsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQzFCLE1BQU0sY0FBYyxHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsUUFBUSxFQUFFLENBQUMsQ0FBQztvQkFDdEQsTUFBTSxPQUFPLEdBQWEsRUFBRSxDQUFDO29CQUM3QixLQUFLLE1BQU0sR0FBRyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFO3dCQUN6QyxNQUFNLFFBQVEsR0FBRyxjQUFjLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO3dCQUMxQyxJQUFJLFFBQVEsRUFBRTs0QkFDVixPQUFPLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQzt5QkFDNUM7cUJBQ0o7b0JBRUQsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FDbkIsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksSUFBSSxRQUFRLEVBQUUsRUFBRSwrQ0FBUyxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUUsQ0FDNUQsQ0FBQztpQkFDTDthQUNKO1NBQ0o7UUFFRDs7OztXQUlHO1FBQ0gsSUFBSSxRQUFRLENBQUMsR0FBRyxFQUFFLENBQUMsYUFBYSxDQUFDLGVBQWUsRUFBRTtZQUM5QyxNQUFNLElBQUksR0FBRyxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNoRSxLQUFLLE1BQU0sR0FBRyxJQUFJLElBQUksRUFBRTtnQkFDcEIsSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsRUFBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUUsRUFBQyxDQUFDLENBQUM7YUFDckQ7U0FDSjtRQUVEOzs7OztXQUtHO1FBQ0gsSUFBSSxNQUFNLENBQUMsUUFBUSxFQUFFLElBQUksTUFBTSxDQUFDLFVBQVUsRUFBRTtZQUN4QyxNQUFNLElBQUksR0FBRyxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNoRSxLQUFLLE1BQU0sR0FBRyxJQUFJLElBQUksRUFBRTtnQkFDcEIsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQztnQkFDM0MsTUFBTSxJQUFJLENBQUMsNEJBQTRCLENBQUMsTUFBTSxFQUFFLEdBQUcsRUFBRSxLQUFLLENBQUMsQ0FBQztnQkFDNUQsTUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxJQUFJLEdBQUcsRUFBRSxFQUFFLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQzthQUNwRTtTQUNKO0lBQ0wsQ0FBQztJQUVLLEtBQUssQ0FBQyxlQUFlLENBQUMsSUFBNkI7UUFDckQsZ0JBQU0sQ0FBQyxLQUFLLENBQUMsa0RBQWtELElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxHQUFHLENBQUMsQ0FBQztRQUVwRiwrREFBK0Q7UUFDL0QsMkVBQTJFO1FBQzNFLElBQUksSUFBSSxDQUFDLGtCQUFrQixFQUFFO1lBQ3pCLEtBQUssTUFBTSxNQUFNLElBQUksSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLEVBQUU7Z0JBQy9DLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUMxRCxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsSUFBSSxFQUFFLEVBQUMsTUFBTSxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFDLEVBQUUsSUFBSSxDQUFDLGNBQWMsRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUM7YUFDN0Y7WUFFRCw4RkFBOEY7WUFDOUYscURBQXFEO1lBQ3JELE1BQU0sZUFBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztTQUN4QjtRQUVELElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsQ0FBQztRQUVqQyxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLElBQUksSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEVBQUU7WUFDekUsS0FBSyxNQUFNLE1BQU0sSUFBSSxJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsRUFBRTtnQkFDaEUsTUFBTSxHQUFHLEdBQUcsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO2dCQUNyRCxNQUFNLEtBQUssR0FBRyxNQUFNLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0JBQ3hELElBQUksQ0FBQyw0QkFBNEIsQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLEdBQUcsRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUM7YUFDcEU7U0FDSjtJQUNMLENBQUM7SUFFTyxVQUFVLENBQUMsTUFBc0I7UUFDckMsTUFBTSxRQUFRLEdBQUcsTUFBTSxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQ25DLDBCQUEwQjtRQUMxQixJQUFJLENBQUMsTUFBTSxJQUFJLENBQUMsUUFBUSxJQUFJLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQztZQUFFLE9BQU8sRUFBRSxDQUFDO1FBRTNELElBQUksT0FBTyxHQUFxQixFQUFFLENBQUM7UUFDbkMsSUFBSSxRQUFRLEVBQUU7WUFDVixNQUFNLE9BQU8sR0FBRyxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxzQ0FBc0M7WUFDeEUsS0FBSyxNQUFNLE1BQU0sSUFBSSxPQUFPLEVBQUU7Z0JBQzFCLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsUUFBUSxFQUFFLE1BQU0sQ0FBQyxVQUFVLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQzthQUN4RjtZQUVELEtBQUssTUFBTSxPQUFPLElBQUksYUFBYSxFQUFFO2dCQUNqQyxJQUFJLE9BQU8sQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLEVBQUU7b0JBQ2xELE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDO2lCQUNuQzthQUNKO1lBRUQsa0NBQWtDO1lBQ2xDLHdCQUF3QjtZQUN4QixJQUFJLE1BQU0sQ0FBQyxVQUFVLENBQUMsY0FBYyxDQUFDLGVBQWUsQ0FBQyxFQUFFO2dCQUNuRCxhQUFhO2dCQUNiLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQyxhQUFhLENBQUMsQ0FBQzthQUNqRDtTQUNKO2FBQU0sRUFBRSxRQUFRO1lBQ2IsTUFBTSxhQUFhLEdBQTBDLEVBQUUsQ0FBQztZQUVoRSxNQUFNLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxTQUFTLEVBQUUsQ0FBVyxDQUFDO2lCQUMzRSxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxNQUFNLEVBQUUsRUFBRTtnQkFDNUMsS0FBSyxNQUFNLE1BQU0sSUFBSSxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUU7b0JBQ3ZGLElBQUksR0FBRyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUM7b0JBQ3RCLElBQUksQ0FBQyxRQUFRLEVBQUUsTUFBTSxFQUFFLE9BQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksTUFBTSxDQUFDLFFBQVEsRUFBRTt3QkFDdEUsaUZBQWlGO3dCQUNqRix1REFBdUQ7d0JBQ3ZELE1BQU0sS0FBSyxHQUFHLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLE9BQU8sQ0FBQyxDQUFDO3dCQUM5RCxHQUFHLElBQUksOEJBQThCLENBQUMsS0FBSyxDQUFDLENBQUM7cUJBQ2hEO29CQUVELElBQUksQ0FBQyxhQUFhLENBQUMsR0FBRyxDQUFDO3dCQUFFLGFBQWEsQ0FBQyxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7b0JBQ2pELGFBQWEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUM7aUJBQ25DO1lBQ0wsQ0FBQyxDQUFDLENBQUM7WUFFUCxPQUFPLEdBQUcsRUFBRSxDQUFDLE1BQU0sQ0FBQyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDO2lCQUM5QyxHQUFHLENBQUMsQ0FBQyxPQUFPLEVBQUUsRUFBRSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQztTQUNqRTtRQUVELElBQUksUUFBUSxJQUFJLFFBQVEsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxRQUFRLENBQUMsU0FBUyxLQUFLLFNBQVMsRUFBRTtZQUM3RCxNQUFNLE1BQU0sR0FBbUI7Z0JBQzNCLElBQUksRUFBRSxRQUFRO2dCQUNkLFNBQVMsRUFBRSxXQUFXO2dCQUN0QixjQUFjLEVBQUUsQ0FBQyxFQUFDLFFBQVEsRUFBRSxXQUFXLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBQyxDQUFDO2dCQUN0RCxpQkFBaUIsRUFBRTtvQkFDZixjQUFjLEVBQUUsNEJBQTRCO29CQUM1QyxJQUFJLEVBQUUsV0FBVztvQkFDakIsa0JBQWtCLEVBQUUsS0FBSztvQkFDekIsZUFBZSxFQUFFLFlBQVk7aUJBQ2hDO2FBQ0osQ0FBQztZQUVGLDBCQUEwQjtZQUMxQixJQUFJLFFBQVEsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsRUFBRTtnQkFDMUQsTUFBTSxDQUFDLGlCQUFpQixDQUFDLFlBQVksR0FBRyxXQUFXLENBQUM7YUFDdkQ7WUFFRCxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1NBQ3hCO1FBRUQsSUFBSSxRQUFRLElBQUksTUFBTSxDQUFDLFVBQVUsQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLEVBQUU7WUFDckQsTUFBTSxpQkFBaUIsR0FBbUI7Z0JBQ3RDLElBQUksRUFBRSxRQUFRO2dCQUNkLFNBQVMsRUFBRSxjQUFjO2dCQUN6QixjQUFjLEVBQUUsQ0FBQyxFQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLEVBQUMsS0FBSyxFQUFFLElBQUksRUFBQyxFQUFDLENBQUM7Z0JBQzVELGlCQUFpQixFQUFFO29CQUNmLElBQUksRUFBRSxZQUFZO29CQUNsQixjQUFjLEVBQUUscUNBQXFDO29CQUNyRCxrQkFBa0IsRUFBRSxLQUFLO29CQUN6QixlQUFlLEVBQUUsWUFBWTtpQkFDaEM7YUFDSixDQUFDO1lBRUYsT0FBTyxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1lBQ2hDLE1BQU0scUJBQXFCLEdBQW1CO2dCQUMxQyxJQUFJLEVBQUUsZUFBZTtnQkFDckIsU0FBUyxFQUFFLGtCQUFrQjtnQkFDN0IsY0FBYyxFQUFFLENBQUMsRUFBQyxRQUFRLEVBQUUsa0JBQWtCLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBQyxDQUFDO2dCQUM3RCxpQkFBaUIsRUFBRTtvQkFDZixVQUFVLEVBQUUsSUFBSTtvQkFDaEIsV0FBVyxFQUFFLEtBQUs7b0JBQ2xCLGNBQWMsRUFBRSxvREFBb0Q7b0JBQ3BFLGtCQUFrQixFQUFFLElBQUk7b0JBQ3hCLFlBQVksRUFBRSxRQUFRO29CQUN0QixlQUFlLEVBQUUsWUFBWTtpQkFDaEM7YUFDSixDQUFDO1lBQ0YsT0FBTyxDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO1NBQ3ZDO1FBRUQsSUFBSSxRQUFRLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRTtZQUMvRSxPQUFPLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxLQUFLLFdBQVcsQ0FBQyxDQUFDO1NBQ3REO1FBRUQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxhQUFhLENBQUMsZUFBZSxFQUFFO1lBQy9DLE9BQU8sR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsU0FBUyxLQUFLLFFBQVEsSUFBSSxDQUFDLENBQUMsU0FBUyxLQUFLLE9BQU8sQ0FBQyxDQUFDO1NBQ3hGO1FBRUQsbUNBQW1DO1FBQ25DLE9BQU8sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztRQUU5QyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsYUFBYSxFQUFFO1lBQzlCLE1BQU0sQ0FBQyxHQUFHLE1BQU0sQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDO1lBQ3ZDLE9BQU8sR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUM7WUFDekcsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFO2dCQUN2QixNQUFNLGNBQWMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDO2dCQUMzQyxJQUFJLGNBQWMsRUFBRTtvQkFDaEIsTUFBTSxDQUFDLFNBQVMsR0FBRyxjQUFjLENBQUMsU0FBUyxJQUFJLE1BQU0sQ0FBQyxTQUFTLENBQUM7b0JBQ2hFLE1BQU0sQ0FBQyxJQUFJLEdBQUcsY0FBYyxDQUFDLElBQUksSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDO2lCQUNwRDtZQUNMLENBQUMsQ0FBQyxDQUFDO1NBQ047UUFFRCxPQUFPLE9BQU8sQ0FBQztJQUNuQixDQUFDO0lBRU8sY0FBYyxDQUFDLE1BQXNCO1FBQ3pDLE9BQU8sTUFBTSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO0lBQzNELENBQUM7SUFFTyxRQUFRLENBQUMsTUFBc0IsRUFBRSxLQUFLLEdBQUMsS0FBSztRQUNoRCw4REFBOEQ7UUFDOUQsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNoRCxNQUFNLFFBQVEsR0FBRyxLQUFLLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBRXhELElBQUksTUFBTSxDQUFDLE9BQU8sRUFBRSxFQUFFO1lBQ2xCLElBQUksQ0FBQyxRQUFRLElBQUksTUFBTSxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsTUFBTSxLQUFLLENBQUM7Z0JBQUUsT0FBTztTQUMzRDthQUFNLElBQUksQ0FBQyxRQUFRLElBQUksQ0FBQyxNQUFNLENBQUMsVUFBVSxJQUFJLE1BQU0sQ0FBQyxFQUFFLENBQUMsWUFBWTtZQUNoRSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsRUFBRTtZQUNuRixPQUFPO1NBQ1Y7UUFFRCxJQUFJLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxHQUFHLEVBQUMsTUFBTSxFQUFFLElBQUksR0FBRyxFQUFFLEVBQUUsY0FBYyxFQUFFLElBQUksR0FBRyxFQUFFLEVBQUUsU0FBUyxFQUFFLElBQUksR0FBRyxFQUFFLEVBQUMsQ0FBQztRQUNwRyxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLE1BQU0sRUFBRSxFQUFFOztZQUN2QyxNQUFNLE9BQU8sR0FBRyxFQUFDLEdBQUcsTUFBTSxDQUFDLGlCQUFpQixFQUFDLENBQUM7WUFDOUMsTUFBTSxTQUFTLEdBQUcsR0FBRyxRQUFRLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLFVBQVUsSUFBSSxNQUFNLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDckUsSUFBSSxVQUFVLEdBQUcsU0FBUyxDQUFDO1lBQzNCLElBQUksT0FBTyxDQUFDLG1CQUFtQixFQUFFO2dCQUM3QixVQUFVLElBQUksSUFBSSxPQUFPLENBQUMsbUJBQW1CLEVBQUUsQ0FBQztnQkFDaEQsT0FBTyxPQUFPLENBQUMsbUJBQW1CLENBQUM7YUFDdEM7WUFFRCxJQUFJLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxhQUFhLENBQUMsSUFBSSxPQUFPLENBQUMsV0FBVyxFQUFFO2dCQUMvRCxPQUFPLENBQUMsV0FBVyxHQUFHLFVBQVUsQ0FBQzthQUNwQztpQkFBTTtnQkFDSCwwQkFBMEI7Z0JBQzFCLElBQUksT0FBTyxDQUFDLGNBQWMsQ0FBQyxhQUFhLENBQUMsRUFBRTtvQkFDdkMsT0FBTyxPQUFPLENBQUMsV0FBVyxDQUFDO2lCQUM5QjthQUNKO1lBRUQsSUFBSSxPQUFPLENBQUMsY0FBYyxFQUFFO2dCQUN4QixPQUFPLENBQUMsY0FBYyxHQUFHLFVBQVUsQ0FBQzthQUN2QztZQUVELElBQUksT0FBTyxDQUFDLGlCQUFpQixFQUFFO2dCQUMzQixPQUFPLENBQUMsaUJBQWlCLEdBQUcsVUFBVSxDQUFDO2FBQzFDO1lBRUQsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLEVBQUU7Z0JBQ3ZCLE9BQU8sQ0FBQyxxQkFBcUIsR0FBRyxVQUFVLENBQUM7YUFDOUM7WUFFRCxNQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDLENBQUM7WUFFcEQsc0VBQXNFO1lBQ3RFLE1BQU0sYUFBYSxHQUFHLGFBQWEsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQztZQUNuRSxPQUFPLENBQUMsSUFBSSxHQUFHLGFBQWEsQ0FBQyxJQUFJLENBQUM7WUFDbEMsSUFBSSxNQUFNLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksTUFBTSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUU7Z0JBQzVFLE9BQU8sQ0FBQyxJQUFJLElBQUksR0FBRyxhQUFhLEdBQUcsTUFBTSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQzthQUMzRTtpQkFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFO2dCQUNsRCxPQUFPLENBQUMsSUFBSSxJQUFJLEdBQUcsYUFBYSxHQUFHLE1BQU0sQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxhQUFhLENBQUMsRUFBRSxDQUFDO2FBQ3RGO1lBRUQsZ0JBQWdCO1lBQ2hCLE9BQU8sQ0FBQyxTQUFTLEdBQUcsR0FBRyxNQUFNLENBQUMsT0FBTyxDQUFDLEVBQUUsSUFBSSxNQUFNLENBQUMsU0FBUyxJQUFJLFFBQVEsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7WUFFakcsaUNBQWlDO1lBQ2pDLE9BQU8sQ0FBQyxNQUFNLEdBQUcsYUFBYSxDQUFDO1lBRS9CLHVCQUF1QjtZQUN2QixPQUFPLENBQUMsWUFBWSxHQUFHLENBQUMsRUFBQyxLQUFLLEVBQUUsR0FBRyxRQUFRLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLFVBQVUsZUFBZSxFQUFDLENBQUMsQ0FBQztZQUVuRiwwQkFBMEI7WUFDMUIsSUFBSSxlQUFLLENBQUMsOEJBQThCLENBQUMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxFQUFFO2dCQUM5RCxPQUFPLENBQUMsaUJBQWlCLEdBQUcsS0FBSyxDQUFDO2dCQUNsQyxPQUFPLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxFQUFDLEtBQUssRUFBRSxHQUFHLFNBQVMsZUFBZSxFQUFDLENBQUMsQ0FBQzthQUNuRTtZQUVELElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxFQUFFLENBQUMsUUFBUSxDQUFDLDJCQUEyQixFQUFFO2dCQUN0RCxPQUFPLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQVcsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLGNBQWMsR0FBRyx3QkFBd0IsQ0FBQyxDQUFDO2FBQzlGO1lBRUQsTUFBTSxrQkFBa0IsR0FBRyxPQUFPLENBQUMsb0JBQW9CLENBQUMsQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDLG9CQUFvQixHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztZQUNsRyxPQUFPLE9BQU8sQ0FBQyxvQkFBb0IsQ0FBQztZQUNwQyxNQUFNLG1CQUFtQixHQUFHLE9BQU8sQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDLENBQUMsSUFBSSxPQUFPLENBQUMscUJBQXFCLEVBQUUsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO1lBQ3JHLE9BQU8sT0FBTyxDQUFDLHFCQUFxQixDQUFDO1lBQ3JDLE1BQU0sWUFBWSxHQUFHLEdBQUcsU0FBUyxJQUFJLGtCQUFrQixNQUFNLG1CQUFtQixFQUFFLENBQUM7WUFFbkYsSUFBSSxPQUFPLENBQUMsYUFBYSxFQUFFO2dCQUN2QixPQUFPLENBQUMsYUFBYSxHQUFHLFlBQVksQ0FBQzthQUN4QztZQUVELElBQUksT0FBTyxDQUFDLGtCQUFrQixFQUFFO2dCQUM1QixPQUFPLENBQUMsa0JBQWtCLEdBQUcsWUFBWSxDQUFDO2FBQzdDO1lBRUQsSUFBSSxPQUFPLENBQUMsa0JBQWtCLEVBQUU7Z0JBQzVCLE9BQU8sQ0FBQyxrQkFBa0IsR0FBRyxHQUFHLFNBQVMsSUFBSSxrQkFBa0IsVUFBVSxDQUFDO2FBQzdFO1lBRUQsSUFBSSxPQUFPLENBQUMsZ0JBQWdCLEVBQUU7Z0JBQzFCLE9BQU8sQ0FBQyxnQkFBZ0IsR0FBRyxVQUFVLENBQUM7YUFDekM7WUFFRCxJQUFJLE9BQU8sQ0FBQyxrQkFBa0IsRUFBRTtnQkFDNUIsT0FBTyxDQUFDLGtCQUFrQixHQUFHLEdBQUcsU0FBUyxJQUFJLGtCQUFrQixpQkFBaUIsQ0FBQzthQUNwRjtZQUVELElBQUksT0FBTyxDQUFDLHlCQUF5QixFQUFFO2dCQUNuQyxPQUFPLENBQUMseUJBQXlCLEdBQUcsVUFBVSxDQUFDO2FBQ2xEO1lBRUQsSUFBSSxPQUFPLENBQUMsdUJBQXVCLEVBQUU7Z0JBQ2pDLE9BQU8sQ0FBQyx1QkFBdUIsR0FBRyxVQUFVLENBQUM7YUFDaEQ7WUFFRCxJQUFJLE9BQU8sQ0FBQywyQkFBMkIsRUFBRTtnQkFDckMsT0FBTyxDQUFDLDJCQUEyQixHQUFHLFVBQVUsQ0FBQzthQUNwRDtZQUVELElBQUksT0FBTyxDQUFDLDRCQUE0QixFQUFFO2dCQUN0QyxPQUFPLENBQUMsNEJBQTRCLEdBQUcsVUFBVSxDQUFDO2FBQ3JEO1lBRUQsSUFBSSxPQUFPLENBQUMseUJBQXlCLEVBQUU7Z0JBQ25DLE9BQU8sQ0FBQyx5QkFBeUI7b0JBQzdCLEdBQUcsU0FBUyxJQUFJLGtCQUFrQixPQUFPLE9BQU8sQ0FBQyx5QkFBeUIsRUFBRSxDQUFDO2FBQ3BGO1lBRUQsSUFBSSxPQUFPLENBQUMsNkJBQTZCLEVBQUU7Z0JBQ3ZDLE9BQU8sQ0FBQyw2QkFBNkI7b0JBQ2pDLEdBQUcsU0FBUyxJQUFJLGtCQUFrQixPQUFPLE9BQU8sQ0FBQyw2QkFBNkIsRUFBRSxDQUFDO2FBQ3hGO1lBRUQsSUFBSSxPQUFPLENBQUMsOEJBQThCLEVBQUU7Z0JBQ3hDLE9BQU8sQ0FBQyw4QkFBOEI7b0JBQ2xDLEdBQUcsU0FBUyxJQUFJLGtCQUFrQixPQUFPLE9BQU8sQ0FBQyw4QkFBOEIsRUFBRSxDQUFDO2FBQ3pGO1lBRUQsSUFBSSxPQUFPLENBQUMsb0JBQW9CLEVBQUU7Z0JBQzlCLE9BQU8sQ0FBQyxvQkFBb0IsR0FBRyxVQUFVLENBQUM7YUFDN0M7WUFFRCxJQUFJLE9BQU8sQ0FBQyxzQkFBc0IsRUFBRTtnQkFDaEMsT0FBTyxDQUFDLHNCQUFzQixHQUFHLEdBQUcsU0FBUyxJQUFJLGtCQUFrQixjQUFjLENBQUM7YUFDckY7WUFFRCxJQUFJLE9BQU8sQ0FBQyxzQkFBc0IsRUFBRTtnQkFDaEMsT0FBTyxDQUFDLHNCQUFzQixHQUFHLFVBQVUsQ0FBQzthQUMvQztZQUVELElBQUksT0FBTyxDQUFDLHdCQUF3QixFQUFFO2dCQUNsQyxPQUFPLENBQUMsd0JBQXdCLEdBQUcsR0FBRyxTQUFTLElBQUksa0JBQWtCLGNBQWMsQ0FBQzthQUN2RjtZQUVELElBQUksT0FBTyxDQUFDLHVCQUF1QixFQUFFO2dCQUNqQyxPQUFPLENBQUMsdUJBQXVCLEdBQUcsVUFBVSxDQUFDO2FBQ2hEO1lBRUQsSUFBSSxPQUFPLENBQUMseUJBQXlCLEVBQUU7Z0JBQ25DLE9BQU8sQ0FBQyx5QkFBeUIsR0FBRyxHQUFHLFNBQVMsSUFBSSxrQkFBa0IsTUFBTTtvQkFDeEUsT0FBTyxDQUFDLHlCQUF5QixDQUFDO2FBQ3pDO1lBRUQsSUFBSSxPQUFPLENBQUMsWUFBWSxFQUFFO2dCQUN0QixPQUFPLENBQUMsWUFBWSxHQUFHLFVBQVUsQ0FBQzthQUNyQztZQUVELDZDQUE2QztZQUM3QyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLGVBQWUsQ0FBQyxFQUFFO2dCQUNoRCxNQUFNLEdBQUcsR0FBRyxDQUFDLEdBQWEsRUFBRSxVQUFtQixFQUFRLEVBQUU7b0JBQ3JELE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsR0FBRyxFQUFFLEVBQUU7d0JBQzdCLElBQUksQ0FBQyxNQUFNLEVBQUUsV0FBVyxDQUFDLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFOzRCQUNyQyxPQUFPO3lCQUNWOzZCQUFNLElBQUksVUFBVSxJQUFJLEdBQUcsS0FBSyxNQUFNLEVBQUU7NEJBQ3JDLE9BQU87eUJBQ1Y7NkJBQU0sSUFBSSxDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsU0FBUyxDQUFDLENBQUMsUUFBUSxDQUFDLE9BQU8sR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDOzRCQUNoRSxLQUFLLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFOzRCQUN6QixPQUFPLENBQUMsR0FBRyxDQUFDLEdBQUcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO3lCQUMzQjs2QkFBTSxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsS0FBSyxJQUFJLEVBQUU7NEJBQzFCLE9BQU8sT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDO3lCQUN2Qjs2QkFBTSxJQUFJLEdBQUcsS0FBSyxRQUFRLElBQUksT0FBTyxHQUFHLENBQUMsR0FBRyxDQUFDLEtBQUssUUFBUSxFQUFFOzRCQUN6RCxNQUFNLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEdBQUcsRUFBRSxFQUFFO2dDQUN2QyxPQUFPLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRyxDQUFDLEdBQUcsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDOzRCQUNoRCxDQUFDLENBQUMsQ0FBQzt5QkFDTjtvQkFDTCxDQUFDLENBQUMsQ0FBQztnQkFDUCxDQUFDLENBQUM7Z0JBRUYsR0FBRyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUV4QyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLEVBQUU7b0JBQy9ELEdBQUcsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7aUJBQzlEO2FBQ0o7WUFFRCxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1lBQ3JELElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSwrQ0FBUyxDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUMsTUFBTSxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFDLEVBQUUsSUFBSSxDQUFDLGNBQWMsRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDeEcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUMsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQy9DLElBQUksQ0FBQyxVQUFVLENBQUMsV0FBVyxDQUFDLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDN0QsTUFBQSxNQUFNLENBQUMsY0FBYywwQ0FBRSxPQUFPLENBQUMsQ0FBQyxZQUFZLEVBQUUsRUFBRSxDQUM1QyxJQUFJLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLEVBQUU7UUFDdkUsQ0FBQyxDQUFDLENBQUM7SUFDUCxDQUFDO0lBRWEsYUFBYSxDQUFDLElBQTJCO1FBQ25ELE1BQU0sY0FBYyxHQUFHLElBQUksTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLGNBQWMsd0JBQXdCLENBQUMsQ0FBQztRQUNsRixNQUFNLGNBQWMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUN4RCxNQUFNLGtCQUFrQixHQUFHLGNBQWMsSUFBSSxjQUFjLENBQUMsQ0FBQyxDQUFDLEtBQUssbUJBQW1CLENBQUM7UUFDdkYsSUFBSSxjQUFjLEVBQUU7WUFDaEIsc0ZBQXNGO1lBQ3RGLElBQUksT0FBTyxHQUFhLElBQUksQ0FBQztZQUM3QixJQUFJO2dCQUNBLE9BQU8sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztnQkFDbkMsTUFBTSxTQUFTLEdBQUcsUUFBUSxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxVQUFVLEdBQUcsR0FBRyxDQUFDO2dCQUN2RCxJQUFJLGtCQUFrQixJQUFJLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxJQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLENBQUMsRUFBRTtvQkFDaEYsT0FBTztpQkFDVjtnQkFFRCxJQUFJLENBQUMsa0JBQWtCO29CQUNuQixDQUFDLENBQUMsT0FBTyxDQUFDLFlBQVksSUFBSSxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFO29CQUNqRixPQUFPO2lCQUNWO2FBQ0o7WUFBQyxPQUFPLENBQUMsRUFBRTtnQkFDUixPQUFPO2FBQ1Y7WUFFRCw2RUFBNkU7WUFDN0UsTUFBTSxFQUFFLEdBQUcsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2pHLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQzdDLElBQUksS0FBSyxHQUFHLENBQUMsTUFBTSxJQUFJLE1BQU0sQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUM7WUFFL0QsMEdBQTBHO1lBQzFHLElBQUksTUFBTSxFQUFFO2dCQUNSLE1BQU0sR0FBRyxHQUFHLEdBQUcsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLENBQUM7Z0JBQ2hGLE1BQU0sWUFBWSxHQUFHLEdBQUcsUUFBUSxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxVQUFVLElBQUksTUFBTSxDQUFDLElBQUksSUFBSSxHQUFHLEVBQUUsQ0FBQztnQkFDL0UsSUFBSSxrQkFBa0IsSUFBSSxPQUFPLENBQUMsS0FBSyxLQUFLLFlBQVksRUFBRTtvQkFDdEQsSUFBSSxDQUFDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxFQUFFLENBQUMsRUFBRTt3QkFDOUIsSUFBSSxDQUFDLGtCQUFrQixDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFLENBQUM7cUJBQzNDO29CQUNELElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7aUJBQ3REO2FBQ0o7WUFFRCxJQUFJLENBQUMsS0FBSyxJQUFJLENBQUMsa0JBQWtCLEVBQUU7Z0JBQy9CLE1BQU0sSUFBSSxHQUFHLGNBQWMsQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDL0IsTUFBTSxRQUFRLEdBQUcsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNuQyxLQUFLLEdBQUcsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQztxQkFDM0IsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxLQUFLLElBQUksSUFBSSxDQUFDLENBQUMsU0FBUyxLQUFLLFFBQVE7b0JBQ3hELEdBQUcsSUFBSSxDQUFDLGNBQWMsSUFBSSxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxFQUFFLEtBQUssSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO2FBQ3JGO1lBQ0QsaUVBQWlFO1lBQ2pFLEtBQUssR0FBRyxLQUFLLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUM7WUFFbkcsSUFBSSxLQUFLLEVBQUU7Z0JBQ1AsZ0JBQU0sQ0FBQyxLQUFLLENBQUMsbUNBQW1DLElBQUksQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDO2dCQUMvRCxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQztnQkFDbkUsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRSxFQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBQyxFQUFFLElBQUksQ0FBQyxjQUFjLEVBQUUsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDO2FBQzdGO1NBQ0o7YUFBTSxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssS0FBSyxJQUFJLENBQUMsV0FBVyxJQUFJLElBQUksQ0FBQyxLQUFLLEtBQUssa0JBQWtCLENBQUM7WUFDN0UsSUFBSSxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsS0FBSyxRQUFRLEVBQUU7WUFDekMsTUFBTSxLQUFLLEdBQUcsVUFBVSxDQUFDLEtBQUssSUFBSSxFQUFFO2dCQUNoQyw2QkFBNkI7Z0JBQzdCLEtBQUssTUFBTSxNQUFNLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFO29CQUMzRSxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFFO3dCQUMzQixJQUFJLENBQUMsa0JBQWtCLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFFLGVBQWUsQ0FBQyxDQUFDO3FCQUM1RTtpQkFDSjtnQkFFRCxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDeEIsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDO1NBQ2I7SUFDTCxDQUFDO0lBRUssYUFBYSxDQUFDLElBQXNCO1FBQ3RDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQy9CLENBQUM7SUFFTyxnQkFBZ0IsQ0FBQyxNQUFzQjs7UUFDM0MsTUFBTSxpQkFBaUIsR0FBRyxNQUFNLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQztZQUN4QyxlQUFlLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQztRQUVoRSw0REFBNEQ7UUFDNUQsSUFBSSxVQUFVLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQztRQUM3QixJQUFJLGNBQU8sTUFBTSxDQUFDLE9BQU8sQ0FBQyxhQUFhLDBDQUFFLElBQUksQ0FBQSxLQUFLLFFBQVEsRUFBRTtZQUN4RCxVQUFVLEdBQUcsTUFBTSxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDO1NBQ2xEO1FBRUQsTUFBTSxPQUFPLEdBQWE7WUFDdEIsV0FBVyxFQUFFLENBQUMsR0FBRyxpQkFBaUIsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRSxDQUFDO1lBQzFELElBQUksRUFBRSxVQUFVO1lBQ2hCLFVBQVUsRUFBRSxlQUFlLElBQUksQ0FBQyxrQkFBa0IsRUFBRTtTQUN2RCxDQUFDO1FBRUYsSUFBSSxNQUFNLENBQUMsUUFBUSxFQUFFLEVBQUU7WUFDbkIsT0FBTyxDQUFDLEtBQUssR0FBRyxHQUFHLE1BQU0sQ0FBQyxVQUFVLENBQUMsV0FBVyxLQUFLLE1BQU0sQ0FBQyxVQUFVLENBQUMsS0FBSyxHQUFHLENBQUM7WUFDaEYsT0FBTyxDQUFDLFlBQVksR0FBRyxNQUFNLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQztZQUNoRCxPQUFPLENBQUMsVUFBVSxHQUFHLE1BQU0sQ0FBQyxFQUFFLENBQUMsZUFBZSxDQUFDO1NBQ2xEO1FBRUQsVUFBSSxRQUFRLENBQUMsR0FBRyxFQUFFLENBQUMsUUFBUSwwQ0FBRSxHQUFHLEVBQUU7WUFDOUIsTUFBTSxHQUFHLFNBQUcsUUFBUSxDQUFDLEdBQUcsRUFBRSxDQUFDLFFBQVEsMENBQUUsR0FBRyxDQUFDO1lBQ3pDLE9BQU8sQ0FBQyxpQkFBaUIsR0FBRyxNQUFNLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQyxDQUFDLEdBQUcsR0FBRyxhQUFhLE1BQU0sQ0FBQyxRQUFRLE9BQU8sQ0FBQyxDQUFDO2dCQUN2RixHQUFHLEdBQUcsWUFBWSxNQUFNLENBQUMsRUFBRSxFQUFFLENBQUM7U0FDckM7UUFFRCxPQUFPLE9BQU8sQ0FBQztJQUNuQixDQUFDO0lBRVEsMEJBQTBCLENBQUMsTUFBc0IsRUFBRSxPQUFpQjs7UUFDekUsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNoRCxZQUFBLElBQUksQ0FBQyxVQUFVLENBQUMsV0FBVyxDQUFDLDBDQUFFLGNBQWMsMENBQUUsT0FBTyxDQUFDLENBQUMsWUFBWSxFQUFFLEVBQUU7WUFDbkUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxFQUFFO2dCQUNoRCxPQUFPLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxHQUFHLFlBQVksQ0FBQyxLQUFLLENBQUM7YUFDdkQ7UUFDTCxDQUFDLEVBQUU7UUFFSCw0REFBNEQ7UUFDNUQsSUFBSSxPQUFPLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxFQUFFO1lBQ2pDLElBQUksT0FBTyxDQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLEVBQUU7Z0JBQ3JDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDO2FBQ3ZDO1lBQ0QsSUFBSSxPQUFPLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxZQUFZLENBQUMsRUFBRTtnQkFDNUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUM7YUFDOUM7U0FDSjtJQUNMLENBQUM7SUFFTyxtQkFBbUI7UUFDdkIsT0FBTyxRQUFRLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBQ3BHLENBQUM7SUFFTyxpQkFBaUIsQ0FBQyxNQUFzQixFQUFFLE1BQXNCO1FBQ3BFLE1BQU0sR0FBRyxHQUFHLE1BQU0sQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsbUJBQW1CLEVBQUUsSUFBSSxNQUFNLENBQUMsRUFBRSxFQUFFLENBQUM7UUFDL0YsT0FBTyxHQUFHLE1BQU0sQ0FBQyxJQUFJLElBQUksR0FBRyxJQUFJLE1BQU0sQ0FBQyxTQUFTLFNBQVMsQ0FBQztJQUM5RCxDQUFDO0lBRU8sS0FBSyxDQUFDLDRCQUE0QixDQUFDLE1BQWMsRUFBRSxHQUFXLEVBQUUsS0FBYSxFQUFFLEtBQUssR0FBQyxLQUFLO1FBQzlGLE1BQU0sUUFBUSxHQUFHLE1BQU0sQ0FBQyxPQUFPLENBQUMsYUFBYSxDQUFDO1FBQzlDLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxRQUFRLElBQUksSUFBSTtZQUMvRCxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsbUJBQW1CLENBQUMsSUFBSSxPQUFPLFFBQVEsS0FBSyxRQUFRO2dCQUN6RSxRQUFRLENBQUMsaUJBQWlCLElBQUksSUFBSSxDQUFDLENBQUMsRUFBRTtZQUM5QyxPQUFPO1NBQ1Y7UUFFRCxJQUFJLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsRUFBRTtZQUMzQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFLENBQUM7U0FDeEQ7UUFFRCxNQUFNLGFBQWEsR0FBRyxHQUFHLEdBQUcsSUFBSSxLQUFLLEVBQUUsQ0FBQztRQUN4QyxJQUFJLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFO1lBQ3ZFLE9BQU87U0FDVjtRQUVELE1BQU0sTUFBTSxHQUFtQjtZQUMzQixJQUFJLEVBQUUsbUJBQW1CO1lBQ3pCLFNBQVMsRUFBRSxHQUFHLEdBQUcsSUFBSSxLQUFLLEVBQUU7WUFDNUIsY0FBYyxFQUFFLEVBQUU7WUFDbEIsaUJBQWlCLEVBQUU7Z0JBQ2YsZUFBZSxFQUFFLFNBQVM7Z0JBQzFCLElBQUksRUFBRSxHQUFHO2FBQ1o7U0FDSixDQUFDO1FBRUYsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsQ0FBQztRQUNyRCxNQUFNLE9BQU8sR0FBRztZQUNaLEdBQUcsTUFBTSxDQUFDLGlCQUFpQjtZQUMzQixPQUFPLEVBQUUsS0FBSztZQUNkLE9BQU8sRUFBRSxLQUFLO1lBQ2QsS0FBSyxFQUFFLEdBQUcsUUFBUSxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxVQUFVLElBQUksTUFBTSxDQUFDLElBQUksSUFBSSxHQUFHLEVBQUU7WUFDaEUsTUFBTSxFQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUM7U0FDeEMsQ0FBQztRQUVGLE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLCtDQUFTLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBQyxNQUFNLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUMsRUFBRSxJQUFJLENBQUMsY0FBYyxFQUFFLEtBQUssRUFBRSxLQUFLLENBQUMsQ0FBQztRQUM5RyxJQUFJLENBQUMsa0JBQWtCLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUNoRSxDQUFDO0lBRUQsdUJBQXVCO1FBQ25CLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxFQUFFLENBQUM7SUFDakMsQ0FBQztDQUNKO0FBdGxCUztJQUFMLHdCQUFJO29EQU9KO0FBRUs7SUFBTCx3QkFBSTswREFFSjtBQUVLO0lBQUwsd0JBQUk7eURBeURKO0FBRUs7SUFBTCx3QkFBSTtvREF5Qko7QUFzVUs7SUFBTCx3QkFBSTtrREFtRUo7QUFFSztJQUFMLHdCQUFJO2tEQUVKO0FBeHdDTCxnQ0FnM0NDIn0=